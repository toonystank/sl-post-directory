import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/csrf";
import { checkRateLimit, checkRateLimitByKey, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_CONTENT_LENGTH_BYTES = 2_600_000;
const OCR_CACHE_TTL_MS = 5 * 60_000;
const OCR_CACHE_MAX_ENTRIES = 100;

const ocrExtractRequestSchema = z.object({
    image: z.string().min(32).max(2_400_000),
    mode: z.enum(["tracking", "address", "auto"]).optional(),
});

const ocrExtractionResultSchema = z.object({
    trackingCodes: z.array(z.string()).default([]),
    destinationTown: z.string().nullable().default(null),
    destinationTownOriginal: z.string().nullable().default(null),
    postalCode: z.string().nullable().default(null),
    rawText: z.string().default(""),
});

export type AiOcrExtractionData = z.infer<typeof ocrExtractionResultSchema>;

interface AiOcrApiResponse {
    success: boolean;
    aiAvailable: boolean;
    data?: AiOcrExtractionData;
    error?: string;
}

const ocrDedupeCache = new Map<string, { data: AiOcrExtractionData; expiresAt: number }>();

function getCachedOcrResult(cacheKey: string): AiOcrExtractionData | null {
    const entry = ocrDedupeCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        ocrDedupeCache.delete(cacheKey);
        return null;
    }
    return entry.data;
}

function setCachedOcrResult(cacheKey: string, data: AiOcrExtractionData): void {
    ocrDedupeCache.set(cacheKey, { data, expiresAt: Date.now() + OCR_CACHE_TTL_MS });
    if (ocrDedupeCache.size > OCR_CACHE_MAX_ENTRIES) {
        const oldestKey = ocrDedupeCache.keys().next().value;
        if (oldestKey !== undefined) {
            ocrDedupeCache.delete(oldestKey);
        }
    }
}

/**
 * Verifies decoded image bytes start with genuine JPEG, PNG, or WebP magic headers
 * before forwarding payloads to the paid Gemini Vision API.
 */
export function validateOcrImageMagicBytes(buf: Buffer, mimeType: string): boolean {
    if (buf.length < 32 || buf.length > 2_000_000) return false;
    if (mimeType === "image/jpeg") {
        return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    if (mimeType === "image/png") {
        return (
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
        );
    }
    if (mimeType === "image/webp") {
        return (
            buf.subarray(0, 4).toString("ascii") === "RIFF" &&
            buf.subarray(8, 12).toString("ascii") === "WEBP"
        );
    }
    return false;
}

const ocrExtractionJsonSchema = {
    type: "object",
    properties: {
        trackingCodes: {
            type: "array",
            items: { type: "string" },
            description:
                "Uppercased Sri Lanka Post or UPU tracking codes only (e.g. BD00000LK, BF009065544LK, RA123456789LK, EE123456789GB). Never include phone numbers, prices, dates, or licence numbers.",
        },
        destinationTown: {
            type: ["string", "null"],
            description:
                "Sri Lankan destination town or post office transliterated into English (e.g. Kandy, Maharagama, Nugegoda, Jaffna). Ignore red cancellation/date postmark stamps.",
        },
        destinationTownOriginal: {
            type: ["string", "null"],
            description:
                "Destination town or post office written in the original Sinhala, Tamil, or English script from the address block.",
        },
        postalCode: {
            type: ["string", "null"],
            description:
                "5-digit Sri Lanka postal code associated with the destination address (e.g. 20000), or null if absent.",
        },
        rawText: {
            type: "string",
            description:
                "Accurate line-by-line transcription of printed or handwritten address/tracking text visible in the image.",
        },
    },
    required: ["trackingCodes", "destinationTown", "destinationTownOriginal", "postalCode", "rawText"],
};

function parseImagePayload(rawImage: string): { mimeType: string; base64Data: string; rawBuffer: Buffer } | null {
    const trimmed = rawImage.trim();
    const dataUrlMatch = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(trimmed);
    let mimeType = "image/jpeg";
    let base64Data: string;

    if (dataUrlMatch) {
        mimeType = dataUrlMatch[1].toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
            return null;
        }
        base64Data = dataUrlMatch[2].replace(/\s+/g, "");
    } else {
        base64Data = trimmed.replace(/\s+/g, "");
    }

    if (!base64Data || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
        return null;
    }

    const rawBuffer = Buffer.from(base64Data, "base64");
    if (!validateOcrImageMagicBytes(rawBuffer, mimeType)) {
        return null;
    }

    return { mimeType, base64Data, rawBuffer };
}

function buildExtractionPrompt(mode: "tracking" | "address" | "auto"): string {
    const modeGuidance =
        mode === "tracking"
            ? "Focus on Sri Lanka Post / UPU parcel tracking numbers (such as BF009065544LK, NA123456789LK, BD123456LK, EA..., RA..., CP..., EE...). Never turn phone numbers (e.g. 071..., 9471...), invoice IDs, or dates into tracking codes."
            : mode === "address"
              ? "Focus on extracting the Sri Lankan destination address block: town / city / post office name (English and original Sinhala or Tamil script) and any 5-digit postal code. Ignore circular red cancellation postmark stamps or franking meter ink."
              : "Extract any Sri Lanka Post / UPU tracking codes AND any destination Sri Lankan town/post office and 5-digit postal code visible on the receipt, parcel label, or handwritten envelope. Ignore circular red postmark stamps, phone numbers, and prices.";

    return [
        "Read all printed and handwritten English, Sinhala, and Tamil postal text in this cropped image.",
        modeGuidance,
        "If handwritten Sinhala or Tamil shows a Sri Lankan town/post office (such as කොළඹ -> Colombo, මහනුවර -> Kandy, මහරගම -> Maharagama, ගාල්ල -> Galle, නුවරඑළිය -> Nuwara Eliya, யாழ்ப்பாணம் -> Jaffna), set destinationTown to the standard English town/post office name and destinationTownOriginal to the exact script read.",
        "Return strict JSON matching the schema with null or empty arrays when fields are not present.",
    ].join("\n");
}

export async function POST(req: NextRequest): Promise<NextResponse<AiOcrApiResponse>> {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json(
            { success: false, aiAvailable: true, error: csrf.error },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        );
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH_BYTES) {
        return NextResponse.json(
            { success: false, aiAvailable: true, error: "Image payload too large" },
            { status: 413, headers: { "Cache-Control": "no-store" } }
        );
    }

    const rl = await checkRateLimit(req, rateLimiters.ocr);
    const headers = { ...rateLimitHeaders(rl), "Cache-Control": "no-store" };
    if (rl.isRateLimited) {
        return NextResponse.json(
            {
                success: false,
                aiAvailable: true,
                error: "Too many scan requests. Please wait a moment and try again.",
            },
            { status: 429, headers }
        );
    }

    const hourlyRl = await checkRateLimit(req, rateLimiters.ocrHourly);
    if (hourlyRl.isRateLimited) {
        return NextResponse.json(
            {
                success: false,
                aiAvailable: true,
                error: "Hourly AI scan limit reached. Using local scanner instead.",
            },
            { status: 429, headers: { ...rateLimitHeaders(hourlyRl), "Cache-Control": "no-store" } }
        );
    }

    const globalRl = await checkRateLimitByKey("global", rateLimiters.ocrGlobalHourly);
    if (globalRl.isRateLimited) {
        return NextResponse.json(
            {
                success: false,
                aiAvailable: false,
                error: "AI scan capacity temporarily reached. Falling back to local scanner.",
            },
            { status: 503, headers }
        );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json(
            {
                success: false,
                aiAvailable: false,
                error: "AI OCR key not configured",
            },
            { status: 503, headers }
        );
    }

    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, aiAvailable: true, error: "Invalid JSON request body" },
            { status: 400, headers }
        );
    }

    const parsedReq = ocrExtractRequestSchema.safeParse(rawBody);
    if (!parsedReq.success) {
        return NextResponse.json(
            { success: false, aiAvailable: true, error: "Invalid image payload" },
            { status: 400, headers }
        );
    }

    const imagePayload = parseImagePayload(parsedReq.data.image);
    if (!imagePayload) {
        return NextResponse.json(
            {
                success: false,
                aiAvailable: true,
                error: "Unsupported or corrupted image format (use JPEG, PNG, or WebP)",
            },
            { status: 400, headers }
        );
    }

    const mode = parsedReq.data.mode ?? "auto";
    const imageHash = crypto
        .createHash("sha256")
        .update(mode)
        .update(":")
        .update(imagePayload.rawBuffer)
        .digest("hex");
    const cached = getCachedOcrResult(imageHash);
    if (cached) {
        return NextResponse.json(
            {
                success: true,
                aiAvailable: true,
                data: cached,
            },
            { status: 200, headers }
        );
    }

    const model = process.env.GEMINI_OCR_MODEL?.trim() || "gemini-3.5-flash-lite";

    try {
        const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
        const interactionPromise = client.interactions.create({
            model,
            store: false,
            generation_config: {
                max_output_tokens: 384,
                thinking_level: mode === "tracking" ? "minimal" : "low",
            },
            input: [
                { type: "text", text: buildExtractionPrompt(mode) },
                {
                    type: "image",
                    data: imagePayload.base64Data,
                    mime_type: imagePayload.mimeType,
                    resolution: "high",
                },
            ],
            response_format: {
                type: "text",
                mime_type: "application/json",
                schema: ocrExtractionJsonSchema,
            },
        });

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const interaction = await Promise.race([
            interactionPromise,
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error("Gemini OCR timeout")), 15_000);
            }),
        ]).finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
        });

        const rawJsonText = interaction.output_text?.trim();
        if (!rawJsonText) {
            return NextResponse.json(
                { success: false, aiAvailable: true, error: "Empty AI extraction response" },
                { status: 502, headers }
            );
        }

        const parsedOutput = ocrExtractionResultSchema.safeParse(JSON.parse(rawJsonText));
        if (!parsedOutput.success) {
            return NextResponse.json(
                { success: false, aiAvailable: true, error: "Malformed AI extraction output" },
                { status: 502, headers }
            );
        }

        setCachedOcrResult(imageHash, parsedOutput.data);

        return NextResponse.json(
            {
                success: true,
                aiAvailable: true,
                data: parsedOutput.data,
            },
            { status: 200, headers }
        );
    } catch (err) {
        console.error("Gemini OCR extraction error:", err);
        return NextResponse.json(
            {
                success: false,
                aiAvailable: true,
                error: "AI scan service is temporarily unavailable. Falling back to local scanner.",
            },
            { status: 502, headers }
        );
    }
}
