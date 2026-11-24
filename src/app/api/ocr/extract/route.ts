import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { checkRateLimit, rateLimitHeaders, rateLimiters } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ocrExtractRequestSchema = z.object({
    image: z.string().min(32).max(6_000_000),
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

function parseImagePayload(rawImage: string): { mimeType: string; base64Data: string } | null {
    const trimmed = rawImage.trim();
    const dataUrlMatch = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(trimmed);
    if (dataUrlMatch) {
        const mimeType = dataUrlMatch[1].toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
            return null;
        }
        const base64Data = dataUrlMatch[2].replace(/\s+/g, "");
        if (!base64Data) return null;
        return { mimeType, base64Data };
    }

    const plainBase64 = trimmed.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/=]+$/.test(plainBase64)) {
        return null;
    }
    return { mimeType: "image/jpeg", base64Data: plainBase64 };
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
    const rl = await checkRateLimit(req, rateLimiters.ocr);
    const headers = rateLimitHeaders(rl);
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
                error: "Unsupported image format (use JPEG, PNG, or WebP)",
            },
            { status: 400, headers }
        );
    }

    const mode = parsedReq.data.mode ?? "auto";
    const model = process.env.GEMINI_OCR_MODEL?.trim() || "gemini-3.5-flash-lite";

    try {
        const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
        const interaction = await client.interactions.create({
            model,
            store: false,
            generation_config: {
                max_output_tokens: 512,
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
