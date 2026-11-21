"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useLocale } from "next-intl";
import {
    AlertCircle,
    ArrowRight,
    Barcode,
    Camera,
    Check,
    FileText,
    Flashlight,
    ImagePlus,
    Layers,
    Loader2,
    MapPin,
    PencilLine,
    Plus,
    RefreshCw,
    ScanLine,
    Sparkles,
    SwitchCamera,
    Upload,
    X,
    ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { ensureLocalOfficeIndex } from "@/lib/office-index-client";
import {
    extractDestinationFromOcr,
    type DestinationCandidate,
    type PlaceDictionary,
} from "@/lib/address-extract";
import {
    MAX_BATCH_BARCODES,
    VALID_BARCODE_REGEX,
    classifyBarcode,
    parseBarcodes,
} from "@/lib/tracking/classifier";
import {
    extractPostalCodesFromOcr,
    tryParseOcrToken,
    type ExtractedOcrCode,
} from "@/lib/tracking/ocr-extract";
import {
    ADDRESS_RETICLE_RECT,
    DEFAULT_RETICLE_RECT,
    canvasToAiJpeg,
    canvasToPreviewJpeg,
    captureRoi,
    downscaleImageToCanvas,
    toContrastCanvas,
    toThresholdCanvas,
    type CaptureRotation,
} from "@/lib/tracking/ocr-preprocess";
import type { AiOcrExtractionData } from "@/app/api/ocr/extract/route";
import {
    prewarmOcr,
    recognizeCanvas,
    releaseOcrWorker,
    type OcrLangs,
} from "@/lib/tracking/ocr-worker";

export type ScannerMode = "tracking" | "address" | "auto";

export interface AppliedPlace {
    name: string;
    slug?: string;
    postalCode?: string;
}

interface BarcodeScannerSheetProps {
    open: boolean;
    onClose: () => void;
    /** Called with 1 or more scanned/confirmed barcodes to populate and track */
    onApplyBarcodes: (barcodes: string[]) => void;
    /** Mode: "tracking" (default), "address", or "auto" (both tracking & address) */
    mode?: ScannerMode;
    /** Called when user picks a detected destination post office ("address" or "auto" modes) */
    onApplyPlace?: (place: AppliedPlace) => void;
}

type ScannerTab = "camera" | "photo";
type ScanSourceKind = "barcode" | "ocr";

interface PendingConfirmation {
    code: string;
    rawMatch: string;
    source: ScanSourceKind;
    wasCorrected: boolean;
    previewImage?: string;
}

interface PendingPlaceConfirmation {
    candidates: DestinationCandidate[];
    previewImage?: string;
}

// Minimal detector contract shared by native BarcodeDetector and barcode-detector/ponyfill
interface CommonBarcodeDetector {
    detect(
        image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    ): Promise<Array<{ rawValue: string; format: string }>>;
}

type VideoWithFrameCallback = HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: () => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
};

type ExtendedTrackCapabilities = MediaTrackCapabilities & {
    torch?: boolean;
    focusMode?: string[];
    exposureMode?: string[];
    whiteBalanceMode?: string[];
    zoom?: { min?: number; max?: number; step?: number };
};

interface AiOcrExtractionResult {
    data: AiOcrExtractionData;
    combinedText: string;
}

declare global {
    interface Window {
        BarcodeDetector?: {
            new (options?: { formats: string[] }): CommonBarcodeDetector;
            getSupportedFormats?: () => Promise<string[]>;
        };
    }
}

const TARGET_BARCODE_FORMATS = ["code_128", "code_39", "qr_code", "data_matrix", "ean_13"] as const;
const ROTATION_CYCLE: CaptureRotation[] = [0, 90, 270];
const PHOTO_FULL_RECT = { xRatio: 0.02, yRatio: 0.02, wRatio: 0.96, hRatio: 0.96 };

function logScanTiming(label: string, startedAt: number) {
    if (process.env.NODE_ENV !== "production") {
        console.debug("[scan]", label, `${Math.round(performance.now() - startedAt)}ms`);
    }
}

async function createBarcodeDetector(): Promise<CommonBarcodeDetector> {
    if (typeof window !== "undefined" && window.BarcodeDetector) {
        try {
            const supported = window.BarcodeDetector.getSupportedFormats
                ? await window.BarcodeDetector.getSupportedFormats()
                : [];
            if (supported.length === 0 || supported.includes("code_128")) {
                const desired =
                    supported.length > 0
                        ? TARGET_BARCODE_FORMATS.filter((f) => supported.includes(f))
                        : [...TARGET_BARCODE_FORMATS];
                return new window.BarcodeDetector({
                    formats: desired.length > 0 ? desired : ["code_128"],
                });
            }
        } catch {
            // Fall through to WASM ponyfill
        }
    }

    const { BarcodeDetector: PonyfillDetector } = await import("barcode-detector/ponyfill");
    return new PonyfillDetector({
        formats: [...TARGET_BARCODE_FORMATS],
    });
}

function extractDetectedBarcode(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const upper = trimmed.toUpperCase();
    return (
        parseBarcodes(trimmed)[0] ||
        tryParseOcrToken(trimmed)?.code ||
        (VALID_BARCODE_REGEX.test(upper) ? upper : null)
    );
}

function defaultOcrLangsForLocale(locale: string, addressEnabled: boolean): OcrLangs {
    if (!addressEnabled) return "eng";
    if (locale === "si") return "eng+sin";
    if (locale === "ta") return "eng+tam";
    return "eng";
}

function nextOcrLangs(current: OcrLangs): OcrLangs {
    if (current === "eng") return "eng+sin";
    if (current === "eng+sin") return "eng+tam";
    return "eng";
}

function formatOcrLangBadge(langs: OcrLangs): string {
    if (langs === "eng+sin") return "EN+සිං";
    if (langs === "eng+tam") return "EN+த";
    return "EN";
}

export default function BarcodeScannerSheet({
    open,
    onClose,
    onApplyBarcodes,
    mode = "tracking",
    onApplyPlace,
}: BarcodeScannerSheetProps) {
    const locale = useLocale();
    const addressScanEnabled = mode !== "tracking" && Boolean(onApplyPlace);
    const barcodeScanEnabled = mode !== "address";
    const trackingOcrEnabled = mode !== "address";

    const activeReticleRect =
        mode === "tracking" ? DEFAULT_RETICLE_RECT : ADDRESS_RETICLE_RECT;

    const defaultHint =
        mode === "address"
            ? "Point at the address on the letter — town name or postal code"
            : mode === "auto"
              ? "Point at a barcode, tracking number, or the address"
              : "Align barcode, printed code, or handwriting inside box";

    const [tab, setTab] = React.useState<ScannerTab>("camera");
    const [batchMode, setBatchMode] = React.useState(false);
    const [batchList, setBatchList] = React.useState<string[]>([]);
    const [ocrLangs, setOcrLangs] = React.useState<OcrLangs>(() =>
        defaultOcrLangsForLocale(locale, addressScanEnabled)
    );

    const [cameraReady, setCameraReady] = React.useState(false);
    const [cameraError, setCameraError] = React.useState<string | null>(null);
    const [facingMode, setFacingMode] = React.useState<"environment" | "user">("environment");
    const [torchSupported, setTorchSupported] = React.useState(false);
    const [torchOn, setTorchOn] = React.useState(false);
    const [zoomRange, setZoomRange] = React.useState<{ min: number; max: number } | null>(null);
    const [zoomLevel, setZoomLevel] = React.useState<number>(1);

    const [ocrRunning, setOcrRunning] = React.useState(false);
    const [statusHint, setStatusHint] = React.useState<string>(defaultHint);

    // Editable confirmation strip for tracking OCR / manual tweak
    const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirmation | null>(null);
    const [editableCode, setEditableCode] = React.useState("");

    // Destination post office confirmation card (address / auto modes)
    const [pendingPlace, setPendingPlace] = React.useState<PendingPlaceConfirmation | null>(null);

    // Photo / Gallery tab state
    const [photoPreviewUrl, setPhotoPreviewUrl] = React.useState<string | null>(null);
    const [photoAnalyzing, setPhotoAnalyzing] = React.useState(false);
    const [photoResults, setPhotoResults] = React.useState<ExtractedOcrCode[]>([]);
    const [photoError, setPhotoError] = React.useState<string | null>(null);

    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const streamRef = React.useRef<MediaStream | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const cameraCaptureInputRef = React.useRef<HTMLInputElement | null>(null);
    const ocrBusyRef = React.useRef(false);
    const manualOcrRunningRef = React.useRef(false);
    const lastHitRotationRef = React.useRef<CaptureRotation | null>(null);
    const lastLiveCandidateRef = React.useRef<{ key: string; seenCount: number } | null>(null);
    const aiAvailableRef = React.useRef<boolean | null>(null);
    const placeDictRef = React.useRef<PlaceDictionary | null>(null);
    const detectorPromiseRef = React.useRef<Promise<CommonBarcodeDetector> | null>(null);

    const pendingConfirmRef = React.useRef<PendingConfirmation | null>(null);
    pendingConfirmRef.current = pendingConfirm;

    const pendingPlaceRef = React.useRef<PendingPlaceConfirmation | null>(null);
    pendingPlaceRef.current = pendingPlace;

    const getSharedDetector = React.useCallback((): Promise<CommonBarcodeDetector> => {
        if (!detectorPromiseRef.current) {
            detectorPromiseRef.current = createBarcodeDetector().catch((err) => {
                detectorPromiseRef.current = null;
                throw err;
            });
        }
        return detectorPromiseRef.current;
    }, []);

    // Keep default language synced when address mode toggles or sheet opens
    React.useEffect(() => {
        if (!addressScanEnabled) {
            setOcrLangs("eng");
        }
    }, [addressScanEnabled]);

    // Prewarm persistent OCR worker & local office dictionary when opened
    React.useEffect(() => {
        if (!open) return;

        if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        prewarmOcr(ocrLangs);

        if (addressScanEnabled) {
            void ensureLocalOfficeIndex()
                .then((engine) => {
                    if (engine) {
                        placeDictRef.current = engine.getPlaceDictionary();
                    }
                })
                .catch(() => {
                    // Offline index optional if unavailable
                });
        }

        return () => {
            releaseOcrWorker();
        };
    }, [open, ocrLangs, addressScanEnabled]);

    const stopCameraStream = React.useCallback(() => {
        if (streamRef.current) {
            for (const track of streamRef.current.getTracks()) {
                try {
                    track.stop();
                } catch {
                    // Ignore
                }
            }
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setCameraReady(false);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomRange(null);
        setZoomLevel(1);
    }, []);

    // Start live camera stream when modal opens on "camera" tab
    const startCameraStream = React.useCallback(async () => {
        stopCameraStream();
        setCameraError(null);
        setStatusHint("Starting camera...");

        if (typeof window !== "undefined" && !window.isSecureContext) {
            setCameraError(
                "Live camera requires HTTPS. Tap Take Photo below to scan using your phone camera."
            );
            return;
        }

        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
            setCameraError(
                "Live camera is unavailable in this browser. Tap Take Photo below to scan with your phone camera."
            );
            return;
        }

        const constraintAttempts: MediaStreamConstraints[] = [
            {
                audio: false,
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                },
            },
            {
                audio: false,
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            },
            {
                audio: false,
                video: { facingMode: { ideal: facingMode } },
            },
            {
                audio: false,
                video: true,
            },
        ];

        let stream: MediaStream | null = null;
        let lastErr: unknown = null;

        for (const constraints of constraintAttempts) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                break;
            } catch (err) {
                lastErr = err;
                const name = err instanceof DOMException ? err.name : "";
                if (
                    name === "NotAllowedError" ||
                    name === "PermissionDeniedError" ||
                    name === "SecurityError"
                ) {
                    break;
                }
            }
        }

        if (!stream) {
            const name = lastErr instanceof DOMException ? lastErr.name : "";
            if (
                name === "NotAllowedError" ||
                name === "PermissionDeniedError" ||
                name === "SecurityError"
            ) {
                setCameraError(
                    "Camera permission was blocked by the browser or site policy. Allow camera access and retry, or tap Take Photo below."
                );
            } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
                setCameraError(
                    "No camera was detected on this device. Switch to From Photo / Receipt to upload an image."
                );
            } else if (name === "NotReadableError" || name === "TrackStartError") {
                setCameraError(
                    "Camera is currently in use by another app. Close the other app and tap Retry, or tap Take Photo."
                );
            } else {
                setCameraError(
                    "Could not start live camera. Tap Retry Camera or use Take Photo below."
                );
            }
            return;
        }

        try {
            streamRef.current = stream;
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                const caps = (
                    videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}
                ) as ExtendedTrackCapabilities;
                setTorchSupported(Boolean(caps.torch));

                if (caps.zoom && typeof caps.zoom.max === "number" && caps.zoom.max >= 1.5) {
                    const minZoom = typeof caps.zoom.min === "number" ? caps.zoom.min : 1;
                    setZoomRange({ min: minZoom, max: caps.zoom.max });
                    setZoomLevel(Math.max(1, minZoom));
                }

                // Request continuous autofocus, exposure & white balance when hardware supports it
                const advancedConstraints: Record<string, string> = {};
                if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
                    advancedConstraints.focusMode = "continuous";
                }
                if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
                    advancedConstraints.exposureMode = "continuous";
                }
                if (
                    Array.isArray(caps.whiteBalanceMode) &&
                    caps.whiteBalanceMode.includes("continuous")
                ) {
                    advancedConstraints.whiteBalanceMode = "continuous";
                }
                if (Object.keys(advancedConstraints).length > 0) {
                    void videoTrack
                        .applyConstraints({
                            advanced: [advancedConstraints as unknown as MediaTrackConstraintSet],
                        })
                        .catch(() => {
                            // Hardware autofocus hints optional
                        });
                }
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraReady(true);
                setStatusHint(defaultHint);
            }
        } catch {
            stopCameraStream();
            setCameraError(
                "Could not display camera preview. Tap Retry Camera or use Take Photo below."
            );
        }
    }, [facingMode, stopCameraStream, defaultHint]);

    React.useEffect(() => {
        if (!open) {
            stopCameraStream();
            lastHitRotationRef.current = null;
            lastLiveCandidateRef.current = null;
            setPendingConfirm(null);
            setPendingPlace(null);
            return;
        }
        if (tab === "camera") {
            void startCameraStream();
        } else {
            stopCameraStream();
        }
        return () => {
            stopCameraStream();
        };
    }, [open, tab, startCameraStream, stopCameraStream]);

    const toggleTorch = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;
        const next = !torchOn;
        try {
            await track.applyConstraints({
                advanced: [{ torch: next } as MediaTrackConstraintSet],
            });
            triggerHaptic("light");
            setTorchOn(next);
        } catch {
            // Torch constraint failed
        }
    };

    const toggleZoom = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track || !zoomRange) return;
        const presets = [1, 1.5, 2].filter(
            (v) => v >= zoomRange.min && v <= zoomRange.max
        );
        const options = presets.length > 0 ? presets : [zoomRange.min, Math.min(2, zoomRange.max)];
        const currentIdx = options.findIndex((v) => Math.abs(v - zoomLevel) < 0.1);
        const nextZoom = options[(currentIdx + 1) % options.length];
        try {
            await track.applyConstraints({
                advanced: [{ zoom: nextZoom } as unknown as MediaTrackConstraintSet],
            });
            triggerHaptic("light");
            setZoomLevel(nextZoom);
        } catch {
            // Zoom constraint failed
        }
    };

    const handleTapToFocus = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track || !cameraReady || cameraError) return;
        const caps = (
            track.getCapabilities ? track.getCapabilities() : {}
        ) as ExtendedTrackCapabilities;
        if (!Array.isArray(caps.focusMode)) return;

        try {
            triggerHaptic("light");
            if (caps.focusMode.includes("single-shot")) {
                await track.applyConstraints({
                    advanced: [{ focusMode: "single-shot" } as unknown as MediaTrackConstraintSet],
                });
            }
            if (caps.focusMode.includes("continuous")) {
                await track.applyConstraints({
                    advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet],
                });
            }
        } catch {
            // Tap-to-refocus unsupported on this lens
        }
    };

    const handleFlipCamera = () => {
        triggerHaptic("light");
        setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    };

    const acceptVerifiedCode = React.useCallback(
        (rawCode: string) => {
            const normalized = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
            if (!normalized) return;

            triggerHaptic("success");

            if (batchMode) {
                setBatchList((prev) => {
                    if (prev.includes(normalized) || prev.length >= MAX_BATCH_BARCODES) return prev;
                    return [...prev, normalized];
                });
                setPendingConfirm(null);
                setPendingPlace(null);
                setEditableCode("");
                setStatusHint(`Added ${normalized} to batch! Point at next code...`);
            } else {
                stopCameraStream();
                onApplyBarcodes([normalized]);
                onClose();
            }
        },
        [batchMode, onApplyBarcodes, onClose, stopCameraStream]
    );

    const acceptPlace = React.useCallback(
        (candidate: DestinationCandidate) => {
            if (!onApplyPlace) return;
            triggerHaptic("success");
            stopCameraStream();
            onApplyPlace({
                name: candidate.name,
                slug: candidate.slug,
                postalCode: candidate.postalCode,
            });
            onClose();
        },
        [onApplyPlace, onClose, stopCameraStream]
    );

    const showConfirmationPrompt = React.useCallback((conf: PendingConfirmation) => {
        triggerHaptic("medium");
        setPendingPlace(null);
        setPendingConfirm(conf);
        setEditableCode(conf.code);
    }, []);

    const showPlacePrompt = React.useCallback(
        (candidates: DestinationCandidate[], previewImage?: string) => {
            triggerHaptic("success");
            setPendingConfirm(null);
            setPendingPlace({ candidates, previewImage });
            setStatusHint(`Found ${candidates[0].name} — tap Search or pick another match`);
        },
        []
    );

    // Engine 1: Fast native / WASM BarcodeDetector driven by video frames (tracking & auto modes)
    React.useEffect(() => {
        if (!open || tab !== "camera" || !cameraReady || !barcodeScanEnabled) return;

        let cancelled = false;
        let busy = false;
        let lastDetectAt = 0;
        let frameHandle: number | null = null;
        let usesRvfc = false;

        const videoEl = videoRef.current as VideoWithFrameCallback | null;
        if (!videoEl) return;

        let detector: CommonBarcodeDetector | null = null;

        const scheduleNext = () => {
            if (cancelled || !videoEl) return;
            if (usesRvfc && videoEl.requestVideoFrameCallback) {
                frameHandle = videoEl.requestVideoFrameCallback(onFrame);
            } else {
                frameHandle = window.requestAnimationFrame(onFrame);
            }
        };

        const onFrame = () => {
            if (cancelled) return;
            const now = performance.now();

            if (
                !busy &&
                detector &&
                !pendingConfirmRef.current &&
                !pendingPlaceRef.current &&
                videoEl.readyState >= 2 &&
                now - lastDetectAt >= 120
            ) {
                const roiCanvas = captureRoi(videoEl, activeReticleRect, { maxWidth: 1100 });
                if (roiCanvas) {
                    busy = true;
                    lastDetectAt = now;
                    const t0 = performance.now();
                    void detector
                        .detect(roiCanvas)
                        .then((hits) => {
                            logScanTiming("barcode-live", t0);
                            if (cancelled || hits.length === 0) return;
                            for (const hit of hits) {
                                const parsed = extractDetectedBarcode(hit.rawValue || "");
                                if (parsed) {
                                    acceptVerifiedCode(parsed);
                                    return;
                                }
                            }
                        })
                        .catch(() => {
                            // Frame without readable barcode
                        })
                        .finally(() => {
                            busy = false;
                        });
                }
            }

            scheduleNext();
        };

        void getSharedDetector()
            .then((det) => {
                if (cancelled) return;
                detector = det;
                usesRvfc = Boolean(videoEl.requestVideoFrameCallback);
                scheduleNext();
            })
            .catch(() => {
                // Barcode detector unavailable; OCR loop remains active
            });

        return () => {
            cancelled = true;
            if (frameHandle !== null) {
                if (usesRvfc && videoEl.cancelVideoFrameCallback) {
                    videoEl.cancelVideoFrameCallback(frameHandle);
                } else {
                    window.cancelAnimationFrame(frameHandle);
                }
            }
        };
    }, [
        open,
        tab,
        cameraReady,
        barcodeScanEnabled,
        activeReticleRect,
        acceptVerifiedCode,
        getSharedDetector,
    ]);

    /**
     * Calls server-side Gemini Vision OCR (`/api/ocr/extract`) with the color JPEG capture.
     * Returns structured text lines when available, or null cleanly when offline / unconfigured.
     */
    const requestAiOcrExtraction = React.useCallback(
        async (canvas: HTMLCanvasElement): Promise<AiOcrExtractionResult | null> => {
            if (aiAvailableRef.current === false) return null;
            try {
                const tAi = performance.now();
                const res = await fetch("/api/ocr/extract", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        image: canvasToAiJpeg(canvas, 0.88),
                        mode,
                    }),
                    signal: AbortSignal.timeout(12000),
                });
                const payload = (await res.json().catch(() => null)) as {
                    success?: boolean;
                    aiAvailable?: boolean;
                    data?: AiOcrExtractionData;
                } | null;
                logScanTiming("ai-ocr", tAi);

                if (res.status === 503 || payload?.aiAvailable === false) {
                    aiAvailableRef.current = false;
                    return null;
                }
                if (!res.ok || !payload?.success || !payload.data) {
                    return null;
                }

                aiAvailableRef.current = true;
                const d = payload.data;
                const combinedParts = [
                    ...d.trackingCodes,
                    d.destinationTown && d.postalCode
                        ? `${d.destinationTown} ${d.postalCode}`
                        : d.destinationTown,
                    d.destinationTownOriginal,
                    d.postalCode,
                    d.rawText,
                ].filter((part): part is string => Boolean(part && part.trim()));

                return {
                    data: d,
                    combinedText: combinedParts.join("\n"),
                };
            } catch {
                return null;
            }
        },
        [mode]
    );

    /**
     * Evaluates OCR text against mode-appropriate extractors.
     * In auto mode, a strong destination address beats an auto-corrected tracking guess.
     * Background attempts require 2 consecutive matching frames for fuzzy/auto-corrected hits.
     */
    const evaluateOcrText = React.useCallback(
        (
            text: string,
            roiCanvas: HTMLCanvasElement,
            rotation: CaptureRotation,
            isBackgroundAttempt = false
        ): boolean => {
            const extractedCodes = trackingOcrEnabled ? extractPostalCodesFromOcr(text) : [];
            const places =
                addressScanEnabled && placeDictRef.current
                    ? extractDestinationFromOcr(text, placeDictRef.current)
                    : [];

            const bestCode = extractedCodes[0];
            const topPlace = places[0];
            const hasStrongAddress = Boolean(
                topPlace && (topPlace.score >= 75 || topPlace.reason === "name+postal_code")
            );

            const confirmConsensus = (fuzzyKey: string): boolean => {
                if (!isBackgroundAttempt) return true;
                const prev = lastLiveCandidateRef.current;
                if (prev && prev.key === fuzzyKey) {
                    prev.seenCount += 1;
                    return prev.seenCount >= 2;
                }
                lastLiveCandidateRef.current = { key: fuzzyKey, seenCount: 1 };
                return false;
            };

            if (mode === "auto" && hasStrongAddress && bestCode?.wasCorrected) {
                lastHitRotationRef.current = rotation;
                lastLiveCandidateRef.current = null;
                showPlacePrompt(places, canvasToPreviewJpeg(roiCanvas));
                return true;
            }

            if (bestCode) {
                if (bestCode.wasCorrected && !confirmConsensus(`code:${bestCode.code}`)) {
                    return false;
                }
                lastHitRotationRef.current = rotation;
                lastLiveCandidateRef.current = null;
                showConfirmationPrompt({
                    code: bestCode.code,
                    rawMatch: bestCode.rawMatch,
                    source: "ocr",
                    wasCorrected: bestCode.wasCorrected,
                    previewImage: canvasToPreviewJpeg(roiCanvas),
                });
                setStatusHint(`Detected ${bestCode.code} — confirm or edit digits below`);
                return true;
            }

            if (places.length > 0 && topPlace) {
                if (
                    !hasStrongAddress &&
                    topPlace.score < 92 &&
                    !confirmConsensus(`place:${topPlace.slug || topPlace.name}`)
                ) {
                    return false;
                }
                lastHitRotationRef.current = rotation;
                lastLiveCandidateRef.current = null;
                showPlacePrompt(places, canvasToPreviewJpeg(roiCanvas));
                return true;
            }

            return false;
        },
        [mode, trackingOcrEnabled, addressScanEnabled, showConfirmationPrompt, showPlacePrompt]
    );

    /**
     * Engine 2: Live ROI OCR using Gemini Vision (manual shutter) + persistent Tesseract worker.
     * - Background attempts run upright (`rotation = 0`) with 2-frame consensus for fuzzy matches.
     * - Manual shutter trigger tries AI Vision first, falling back to multi-rotation sharpened OCR.
     */
    const runLiveOcrAttempt = React.useCallback(
        async (attemptIndex: number, isManualTrigger: boolean) => {
            if (!videoRef.current || pendingConfirmRef.current || pendingPlaceRef.current) return;
            if (!isManualTrigger && (ocrBusyRef.current || manualOcrRunningRef.current)) return;
            const videoEl = videoRef.current;
            if (videoEl.readyState < 2) return;

            if (isManualTrigger) {
                if (manualOcrRunningRef.current) return;
                manualOcrRunningRef.current = true;
                triggerHaptic("light");
                setOcrRunning(true);
                setStatusHint(
                    aiAvailableRef.current !== false
                        ? "Reading text with AI Vision..."
                        : mode === "address"
                          ? "Reading address inside box..."
                          : "Reading printed / written text inside box..."
                );
            }

            ocrBusyRef.current = true;

            try {
                if (isManualTrigger) {
                    if (addressScanEnabled && !placeDictRef.current) {
                        const engine = await ensureLocalOfficeIndex().catch(() => null);
                        if (engine) placeDictRef.current = engine.getPlaceDictionary();
                    }

                    const uprightRoi = captureRoi(videoEl, activeReticleRect, { rotation: 0 });
                    if (uprightRoi && aiAvailableRef.current !== false) {
                        const aiResult = await requestAiOcrExtraction(uprightRoi);
                        if (aiResult?.combinedText && evaluateOcrText(aiResult.combinedText, uprightRoi, 0, false)) {
                            return;
                        }
                    }

                    const rotations: CaptureRotation[] =
                        lastHitRotationRef.current !== null
                            ? [
                                  lastHitRotationRef.current,
                                  ...ROTATION_CYCLE.filter((r) => r !== lastHitRotationRef.current),
                              ]
                            : ROTATION_CYCLE;

                    let found = false;
                    for (const rot of rotations) {
                        if (pendingConfirmRef.current || pendingPlaceRef.current) break;
                        const roi =
                            rot === 0 && uprightRoi
                                ? uprightRoi
                                : captureRoi(videoEl, activeReticleRect, { rotation: rot });
                        if (!roi) continue;

                        const t1 = performance.now();
                        const contrastCanvas = toContrastCanvas(roi);
                        const pass1 = await recognizeCanvas(contrastCanvas, ocrLangs, "sparse");
                        logScanTiming(`ocr-manual-c-${rot}`, t1);
                        if (evaluateOcrText(pass1.text, roi, rot, false)) {
                            found = true;
                            break;
                        }

                        const t2 = performance.now();
                        const threshCanvas = toThresholdCanvas(roi);
                        const pass2 = await recognizeCanvas(threshCanvas, ocrLangs, "sparse");
                        logScanTiming(`ocr-manual-t-${rot}`, t2);
                        if (evaluateOcrText(pass2.text, roi, rot, false)) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        setStatusHint(
                            mode === "address"
                                ? "No town or postal code read yet — move closer or hold steady"
                                : "No tracking code or address read yet — hold steady and frame closely"
                        );
                    }
                    return;
                }

                // Single fast upright pass for background viewfinder scanning
                const rotation: CaptureRotation = 0;
                const roi = captureRoi(videoEl, activeReticleRect, { rotation });
                if (!roi) return;

                const useThreshold = attemptIndex % 2 === 1;
                const filtered = useThreshold ? toThresholdCanvas(roi) : toContrastCanvas(roi);

                const t0 = performance.now();
                const res = await recognizeCanvas(filtered, ocrLangs, "sparse");
                logScanTiming(`ocr-live-${useThreshold ? "t" : "c"}-${rotation}`, t0);

                if (pendingConfirmRef.current || pendingPlaceRef.current) return;
                evaluateOcrText(res.text, roi, rotation, true);
            } catch {
                if (isManualTrigger) {
                    setStatusHint("Could not read text — try holding steady with good lighting");
                }
            } finally {
                ocrBusyRef.current = false;
                if (isManualTrigger) {
                    manualOcrRunningRef.current = false;
                    setOcrRunning(false);
                }
            }
        },
        [activeReticleRect, addressScanEnabled, evaluateOcrText, mode, ocrLangs, requestAiOcrExtraction]
    );

    // Non-overlapping background OCR loop (>= 700ms pause between completions)
    React.useEffect(() => {
        if (!open || tab !== "camera" || !cameraReady) return;

        let cancelled = false;
        let sleepTimer: number | null = null;

        const waitMs = (ms: number) =>
            new Promise<void>((resolve) => {
                sleepTimer = window.setTimeout(() => {
                    sleepTimer = null;
                    resolve();
                }, ms);
            });

        const loop = async () => {
            let attempt = 0;
            while (!cancelled) {
                if (
                    !pendingConfirmRef.current &&
                    !pendingPlaceRef.current &&
                    !ocrBusyRef.current &&
                    !manualOcrRunningRef.current
                ) {
                    await runLiveOcrAttempt(attempt++, false);
                }
                if (cancelled) break;
                await waitMs(700);
            }
        };

        void loop();

        return () => {
            cancelled = true;
            if (sleepTimer !== null) {
                window.clearTimeout(sleepTimer);
            }
        };
    }, [open, tab, cameraReady, runLiveOcrAttempt]);

    // Gallery / Photo Upload Analyzer (Downscaled BarcodeDetector + Multi-Rotation Persistent OCR)
    const handlePhotoSelected = async (file: File) => {
        if (!file || !file.type.startsWith("image/")) return;

        setPhotoError(null);
        setPhotoResults([]);
        setPendingConfirm(null);
        setPendingPlace(null);
        setPhotoAnalyzing(true);
        const objUrl = URL.createObjectURL(file);
        setPhotoPreviewUrl(objUrl);

        try {
            const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = objUrl;
            });

            const scaledCanvas = downscaleImageToCanvas(imgEl, 1600);
            const detectTarget: HTMLCanvasElement | HTMLImageElement = scaledCanvas ?? imgEl;
            const foundMap = new Map<string, ExtractedOcrCode>();

            // Step 1: 1D/2D Barcode detection (tracking & auto modes)
            if (barcodeScanEnabled) {
                try {
                    const t0 = performance.now();
                    const detector = await getSharedDetector();
                    const hits = await detector.detect(detectTarget);
                    logScanTiming("barcode-photo", t0);
                    for (const hit of hits) {
                        const raw = hit.rawValue || "";
                        const code = extractDetectedBarcode(raw);
                        if (code && !foundMap.has(code)) {
                            foundMap.set(code, {
                                code,
                                rawMatch: raw,
                                wasCorrected: false,
                                score: 100,
                            });
                        }
                    }
                } catch {
                    // Continue to OCR
                }
            }

            // Step 2: Gemini Vision AI extraction (handles handwritten & rotated Sinhala/Tamil/English)
            let detectedPlaces: DestinationCandidate[] = [];
            let placePreviewUrl: string | undefined;

            if (foundMap.size === 0) {
                if (addressScanEnabled && !placeDictRef.current) {
                    const engine = await ensureLocalOfficeIndex().catch(() => null);
                    if (engine) placeDictRef.current = engine.getPlaceDictionary();
                }

                if (scaledCanvas && aiAvailableRef.current !== false) {
                    const aiResult = await requestAiOcrExtraction(scaledCanvas);
                    if (aiResult) {
                        if (trackingOcrEnabled) {
                            for (const rawCode of aiResult.data.trackingCodes) {
                                const parsed = extractDetectedBarcode(rawCode);
                                if (parsed && !foundMap.has(parsed)) {
                                    foundMap.set(parsed, {
                                        code: parsed,
                                        rawMatch: rawCode,
                                        wasCorrected: false,
                                        score: 99,
                                    });
                                }
                            }
                            for (const item of extractPostalCodesFromOcr(aiResult.combinedText)) {
                                if (!foundMap.has(item.code)) foundMap.set(item.code, item);
                            }
                        }
                        if (foundMap.size === 0 && addressScanEnabled && placeDictRef.current) {
                            const places = extractDestinationFromOcr(
                                aiResult.combinedText,
                                placeDictRef.current
                            );
                            if (places.length > 0) {
                                detectedPlaces = places;
                                placePreviewUrl = canvasToPreviewJpeg(scaledCanvas);
                            }
                        }
                    }
                }
            }

            // Step 3: Fallback multi-rotation OCR using persistent worker (PSM.AUTO)
            if (foundMap.size === 0 && detectedPlaces.length === 0) {
                for (const rot of ROTATION_CYCLE) {
                    const fullPre = captureRoi(detectTarget, PHOTO_FULL_RECT, {
                        rotation: rot,
                        maxWidth: 1400,
                    });
                    if (!fullPre) continue;

                    const t1 = performance.now();
                    const ocr1 = await recognizeCanvas(toContrastCanvas(fullPre), ocrLangs, "auto");
                    logScanTiming(`photo-ocr-c-${rot}`, t1);

                    if (trackingOcrEnabled) {
                        for (const item of extractPostalCodesFromOcr(ocr1.text)) {
                            if (!foundMap.has(item.code)) foundMap.set(item.code, item);
                        }
                    }

                    if (foundMap.size === 0 && addressScanEnabled && placeDictRef.current) {
                        const places = extractDestinationFromOcr(ocr1.text, placeDictRef.current);
                        if (places.length > 0) {
                            detectedPlaces = places;
                            placePreviewUrl = canvasToPreviewJpeg(fullPre);
                        }
                    }

                    if (foundMap.size === 0 && detectedPlaces.length === 0) {
                        const t2 = performance.now();
                        const ocr2 = await recognizeCanvas(
                            toThresholdCanvas(fullPre),
                            ocrLangs,
                            "auto"
                        );
                        logScanTiming(`photo-ocr-t-${rot}`, t2);

                        if (trackingOcrEnabled) {
                            for (const item of extractPostalCodesFromOcr(ocr2.text)) {
                                if (!foundMap.has(item.code)) foundMap.set(item.code, item);
                            }
                        }

                        if (foundMap.size === 0 && addressScanEnabled && placeDictRef.current) {
                            const places = extractDestinationFromOcr(ocr2.text, placeDictRef.current);
                            if (places.length > 0) {
                                detectedPlaces = places;
                                placePreviewUrl = canvasToPreviewJpeg(fullPre);
                            }
                        }
                    }

                    if (foundMap.size > 0 || detectedPlaces.length > 0) {
                        break;
                    }
                }
            }

            const allDetected = Array.from(foundMap.values()).sort((a, b) => b.score - a.score);
            setPhotoResults(allDetected);

            if (allDetected.length > 0) {
                triggerHaptic("success");
                setPendingConfirm({
                    code: allDetected[0].code,
                    rawMatch: allDetected[0].rawMatch,
                    source: allDetected[0].score === 100 ? "barcode" : "ocr",
                    wasCorrected: allDetected[0].wasCorrected,
                });
                setEditableCode(allDetected[0].code);
            } else if (detectedPlaces.length > 0) {
                showPlacePrompt(detectedPlaces, placePreviewUrl);
            } else {
                setPhotoError(
                    mode === "address"
                        ? "No town name or 5-digit postal code was found in this image. Try framing the address closer or typing it in search."
                        : mode === "auto"
                          ? "No barcode, tracking number, or destination address was found in this image."
                          : "No barcode or 13-character SL Post tracking number was found in this image. Try cropping closer to the tracking number or enter it below."
                );
            }
        } catch {
            setPhotoError("Could not analyze image. Please try another photo.");
        } finally {
            setPhotoAnalyzing(false);
        }
    };

    React.useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                stopCameraStream();
                onClose();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose, stopCameraStream]);

    if (!open || typeof document === "undefined") return null;

    const cleanEditable = editableCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isEditableValid = VALID_BARCODE_REGEX.test(cleanEditable);

    const dialogTitle =
        mode === "address"
            ? "Scan Address"
            : mode === "auto"
              ? "Scan Code or Address"
              : "Scan Parcel Code";

    const reticleTag =
        mode === "address"
            ? "Town Name · 5-Digit Postal Code · Address"
            : mode === "auto"
              ? "Barcode · Tracking Code · Town / Address"
              : "BD · NA · BF · RA · BG · 1D/2D · Handwritten";

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogTitle}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    stopCameraStream();
                    onClose();
                }
            }}
            style={{ backgroundColor: "rgba(15, 12, 10, 0.72)" }}
            className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center backdrop-blur-[2px] p-0 sm:p-4"
        >
            <div className="animate-fade-slide-up w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border-t-2 sm:border-2 border-foreground bg-card pb-safe shadow-[0_-4px_0_0_hsl(var(--foreground))] sm:shadow-[4px_4px_0_0_hsl(var(--foreground))]">
                {/* Top Header Bar */}
                <div className="flex items-center justify-between gap-2 border-b-2 border-foreground bg-secondary px-3.5 py-2.5 text-secondary-foreground shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <ScanLine className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                        <span className="font-heading text-sm sm:text-base font-extrabold uppercase tracking-tight truncate">
                            {dialogTitle}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Language Script Chip for Address OCR */}
                        {addressScanEnabled && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    setOcrLangs((prev) => nextOcrLangs(prev));
                                }}
                                data-testid="scanner-lang-toggle"
                                title="Cycle OCR script (English / Sinhala / Tamil)"
                                className={cn(
                                    "tap inline-flex h-7 items-center gap-1 rounded border-[1.5px] border-foreground px-2 font-mono text-[10px] font-bold transition-colors",
                                    ocrLangs !== "eng"
                                        ? "bg-foreground text-background"
                                        : "bg-card text-foreground hover:bg-muted"
                                )}
                            >
                                <span>{formatOcrLangBadge(ocrLangs)}</span>
                            </button>
                        )}

                        {/* Single vs Multi-Parcel Batch Toggle (tracking / auto modes only) */}
                        {barcodeScanEnabled && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    setBatchMode((prev) => !prev);
                                }}
                                className={cn(
                                    "tap inline-flex h-7 items-center gap-1 rounded border-[1.5px] border-foreground px-2 font-mono text-[10px] font-bold uppercase transition-colors",
                                    batchMode
                                        ? "bg-foreground text-background"
                                        : "bg-card text-foreground hover:bg-muted"
                                )}
                                title="Toggle multi-parcel batch scanning"
                            >
                                <Layers className="h-3 w-3" />
                                <span>{batchMode ? "Batch On" : "Single"}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                stopCameraStream();
                                onClose();
                            }}
                            aria-label="Close scanner"
                            className="tap inline-flex h-7 w-7 items-center justify-center rounded border-[1.5px] border-foreground bg-card text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                            <X className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Extra-script honest note when Sinhala/Tamil OCR is toggled on */}
                {addressScanEnabled && ocrLangs !== "eng" && (
                    <div className="border-b border-foreground/20 bg-muted/60 px-3.5 py-1 text-[10.5px] font-medium text-muted-foreground shrink-0">
                        Printed Sinhala/Tamil only — handwriting may not read
                    </div>
                )}

                {/* Mode Tabs: Live Camera vs Photo / Receipt Upload */}
                <div className="grid grid-cols-2 border-b-[1.5px] border-foreground bg-muted/60 p-1 gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            setTab("camera");
                            setPendingConfirm(null);
                            setPendingPlace(null);
                        }}
                        className={cn(
                            "tap inline-flex items-center justify-center gap-1.5 rounded py-1.5 font-heading text-xs font-extrabold transition-colors",
                            tab === "camera"
                                ? "bg-foreground text-background shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Live Camera</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            setTab("photo");
                        }}
                        className={cn(
                            "tap inline-flex items-center justify-center gap-1.5 rounded py-1.5 font-heading text-xs font-extrabold transition-colors",
                            tab === "photo"
                                ? "bg-foreground text-background shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ImagePlus className="h-3.5 w-3.5" />
                        <span>{mode === "address" ? "From Letter Photo" : "From Photo / Receipt"}</span>
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="overflow-y-auto p-3.5 space-y-3 flex-1">
                    {/* Always-mounted file & native mobile camera capture inputs so clicks preserve user gesture */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                setTab("photo");
                                void handlePhotoSelected(file);
                            }
                            e.target.value = "";
                        }}
                        className="hidden"
                    />
                    <input
                        ref={cameraCaptureInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                setTab("photo");
                                void handlePhotoSelected(file);
                            }
                            e.target.value = "";
                        }}
                        className="hidden"
                    />

                    {/* ===== TAB 1: LIVE CAMERA VIEWFINDER ===== */}
                    {tab === "camera" && (
                        <div className="space-y-3">
                            <div
                                onClick={() => void handleTapToFocus()}
                                className="relative overflow-hidden rounded-xl border-2 border-foreground bg-black aspect-[4/3] max-h-[270px] w-full mx-auto flex items-center justify-center cursor-crosshair"
                            >
                                <video
                                    ref={videoRef}
                                    playsInline
                                    muted
                                    autoPlay
                                    className="h-full w-full object-cover"
                                />

                                {/* Darkened mask around the target reticle box */}
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 flex flex-col justify-center items-center px-4"
                                >
                                    <div
                                        className={cn(
                                            "relative w-full rounded-lg border-2 border-dashed border-secondary shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]",
                                            mode === "tracking"
                                                ? "h-24 sm:h-28"
                                                : "h-36 sm:h-40"
                                        )}
                                    >
                                        {/* Corner targeting brackets */}
                                        <span className="absolute -top-0.5 -left-0.5 h-3.5 w-3.5 border-t-4 border-l-4 border-secondary rounded-tl" />
                                        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 border-t-4 border-r-4 border-secondary rounded-tr" />
                                        <span className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 border-b-4 border-l-4 border-secondary rounded-bl" />
                                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 border-b-4 border-r-4 border-secondary rounded-br" />

                                        {/* Center laser guide line */}
                                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[1.5px] bg-primary/80 shadow-[0_0_8px_hsl(var(--primary))]" />

                                        {/* Reticle Top Tag */}
                                        <span className="absolute -top-5 left-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-secondary">
                                            {reticleTag}
                                        </span>
                                    </div>
                                </div>

                                {/* Top-right hardware controls (Zoom + Torch + Flip Camera) */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                                    {zoomRange && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void toggleZoom();
                                            }}
                                            aria-label="Toggle camera zoom"
                                            title="Cycle camera zoom"
                                            className={cn(
                                                "tap inline-flex h-8 items-center justify-center gap-1 rounded-md border-[1.5px] border-foreground px-2 font-mono text-[10.5px] font-extrabold transition-colors",
                                                zoomLevel > 1.05
                                                    ? "bg-secondary text-secondary-foreground"
                                                    : "bg-black/70 text-white hover:bg-black"
                                            )}
                                        >
                                            <ZoomIn className="h-3.5 w-3.5" />
                                            <span>{zoomLevel.toFixed(zoomLevel % 1 === 0 ? 0 : 1)}x</span>
                                        </button>
                                    )}
                                    {torchSupported && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void toggleTorch();
                                            }}
                                            aria-label="Toggle flashlight"
                                            className={cn(
                                                "tap inline-flex h-8 w-8 items-center justify-center rounded-md border-[1.5px] border-foreground transition-colors",
                                                torchOn
                                                    ? "bg-secondary text-secondary-foreground"
                                                    : "bg-black/70 text-white hover:bg-black"
                                            )}
                                        >
                                            <Flashlight className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleFlipCamera();
                                        }}
                                        aria-label="Switch camera"
                                        className="tap inline-flex h-8 w-8 items-center justify-center rounded-md border-[1.5px] border-foreground bg-black/70 text-white hover:bg-black"
                                    >
                                        <SwitchCamera className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Bottom status HUD inside video */}
                                <div className="absolute bottom-2 inset-x-2.5 flex items-center justify-center z-10">
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/80 px-3 py-1 font-mono text-[10.5px] font-bold text-white text-center">
                                        {ocrRunning ? (
                                            <Loader2 className="h-3 w-3 animate-spin text-secondary shrink-0" />
                                        ) : (
                                            <Sparkles className="h-3 w-3 text-secondary shrink-0" />
                                        )}
                                        <span className="truncate">{statusHint}</span>
                                    </span>
                                </div>

                                {cameraError && (
                                    <div className="absolute inset-0 bg-black/90 p-4 flex flex-col items-center justify-center text-center gap-2.5 z-20">
                                        <AlertCircle className="h-7 w-7 text-secondary" />
                                        <p className="text-xs font-bold text-white max-w-xs">{cameraError}</p>
                                        <div className="flex flex-wrap items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => void startCameraStream()}
                                                className="tap rounded-md border border-white bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
                                            >
                                                Retry Camera
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => cameraCaptureInputRef.current?.click()}
                                                className="tap inline-flex items-center gap-1.5 rounded-md border border-foreground bg-secondary px-3 py-1.5 text-xs font-extrabold text-secondary-foreground"
                                            >
                                                <Camera className="h-3.5 w-3.5" />
                                                <span>Take Photo</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dedicated Manual Trigger Button */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={!cameraReady || ocrRunning}
                                    onClick={() => void runLiveOcrAttempt(0, true)}
                                    className="tap flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-secondary px-4 font-heading text-xs sm:text-sm font-extrabold text-secondary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95 disabled:opacity-50"
                                >
                                    {ocrRunning ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Reading Text...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4" />
                                            <span>
                                                {mode === "address"
                                                    ? "Read Address Now"
                                                    : "Read Printed / Written Text Now"}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== TAB 2: PHOTO / GALLERY UPLOAD ===== */}
                    {tab === "photo" && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => cameraCaptureInputRef.current?.click()}
                                    className="tap inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-foreground bg-secondary px-3 font-heading text-xs font-extrabold text-secondary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                >
                                    <Camera className="h-4 w-4 shrink-0" />
                                    <span>Take Photo</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="tap inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-foreground bg-card px-3 font-heading text-xs font-extrabold text-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                                >
                                    <Upload className="h-4 w-4 shrink-0" />
                                    <span>Choose Gallery</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="tap flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-foreground/75 bg-background/70 p-4 text-center hover:bg-secondary/20 transition-colors"
                            >
                                {photoPreviewUrl ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={photoPreviewUrl}
                                        alt="Uploaded postal photo"
                                        className="max-h-36 w-auto rounded-lg border border-foreground/30 object-contain"
                                    />
                                ) : (
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-foreground bg-secondary text-secondary-foreground">
                                        <Upload className="h-5 w-5" />
                                    </div>
                                )}
                                <div>
                                    <p className="font-heading text-xs sm:text-sm font-extrabold text-foreground">
                                        {photoPreviewUrl
                                            ? "Tap to choose a different photo"
                                            : mode === "address"
                                              ? "Select Letter or Envelope Photo"
                                              : mode === "auto"
                                                ? "Select Parcel, Letter, or Receipt Photo"
                                                : "Select Receipt Photo or Screenshot"}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {mode === "address"
                                            ? "Reads printed town names & 5-digit postal codes on letters"
                                            : mode === "auto"
                                              ? "Reads barcodes, tracking numbers, and destination addresses"
                                              : "Reads 1D/2D barcodes, printed slips, and handwritten COD/SLP numbers"}
                                    </p>
                                </div>
                            </button>

                            {photoAnalyzing && (
                                <div className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-foreground bg-background p-3 text-xs font-bold text-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>
                                        {mode === "address"
                                            ? "Scanning photo for town names & postal codes..."
                                            : "Scanning photo for barcodes, tracking codes & addresses..."}
                                    </span>
                                </div>
                            )}

                            {photoError && (
                                <div className="flex items-start gap-2 rounded-xl border-[1.5px] border-primary bg-primary/10 p-3 text-xs font-semibold text-primary">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{photoError}</span>
                                </div>
                            )}

                            {photoResults.length > 1 && (
                                <div className="space-y-1.5">
                                    <span className="label-mono block text-[10px]">
                                        Detected Codes on Receipt ({photoResults.length}):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {photoResults.map((item) => (
                                            <button
                                                key={item.code}
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic("light");
                                                    setPendingConfirm({
                                                        code: item.code,
                                                        rawMatch: item.rawMatch,
                                                        source: item.score === 100 ? "barcode" : "ocr",
                                                        wasCorrected: item.wasCorrected,
                                                    });
                                                    setEditableCode(item.code);
                                                }}
                                                className={cn(
                                                    "tap inline-flex items-center gap-1.5 rounded-md border-[1.5px] px-2.5 py-1 font-mono text-xs font-extrabold",
                                                    editableCode === item.code
                                                        ? "border-foreground bg-secondary text-secondary-foreground"
                                                        : "border-dashed border-foreground/70 bg-card text-foreground"
                                                )}
                                            >
                                                <span>{item.code}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== DESTINATION POST OFFICE CONFIRMATION CARD (address / auto) ===== */}
                    {pendingPlace && pendingPlace.candidates.length > 0 && (
                        <div
                            data-testid="scanner-place-card"
                            className="animate-fade-slide-up rounded-xl border-2 border-foreground bg-secondary/25 p-3 space-y-2.5"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <MapPin className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="font-heading text-sm font-extrabold text-foreground truncate">
                                                Destination: {pendingPlace.candidates[0].name}
                                            </span>
                                            {pendingPlace.candidates[0].postalCode && (
                                                <span className="rounded border border-foreground/40 bg-card px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-foreground">
                                                    {pendingPlace.candidates[0].postalCode}
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-mono text-[10.5px] text-muted-foreground truncate">
                                            read: &ldquo;{pendingPlace.candidates[0].matchedText}&rdquo;
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        lastHitRotationRef.current = null;
                                        lastLiveCandidateRef.current = null;
                                        setPendingPlace(null);
                                        setStatusHint(defaultHint);
                                    }}
                                    className="tap inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground hover:text-foreground"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    <span>Rescan</span>
                                </button>
                            </div>

                            {pendingPlace.previewImage && (
                                <div className="flex items-center gap-2 rounded-lg border border-foreground/30 bg-black/85 p-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={pendingPlace.previewImage}
                                        alt="Cropped address region"
                                        className="h-12 w-auto rounded object-contain mx-auto"
                                    />
                                </div>
                            )}

                            <button
                                type="button"
                                data-testid="scanner-place-apply-btn"
                                onClick={() => acceptPlace(pendingPlace.candidates[0])}
                                className="tap inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-foreground bg-primary px-4 font-heading text-xs sm:text-sm font-extrabold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))]"
                            >
                                <span>Search {pendingPlace.candidates[0].name}</span>
                                <ArrowRight className="h-4 w-4 shrink-0" />
                            </button>

                            {pendingPlace.candidates.length > 1 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    <span className="font-mono text-[10px] font-bold text-muted-foreground">
                                        Alternatives:
                                    </span>
                                    {pendingPlace.candidates.slice(1).map((alt) => (
                                        <button
                                            key={`${alt.slug ?? alt.name}-${alt.postalCode ?? ""}`}
                                            type="button"
                                            onClick={() => acceptPlace(alt)}
                                            className="tap inline-flex items-center gap-1 rounded-md border border-foreground/50 bg-card px-2 py-1 text-xs font-bold text-foreground hover:border-foreground hover:bg-muted"
                                        >
                                            <span>{alt.name}</span>
                                            {alt.postalCode && (
                                                <span className="font-mono text-[10px] text-muted-foreground">
                                                    {alt.postalCode}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== EDITABLE CONFIRMATION STRIP (for Handwritten / OCR / Tweaking Digits) ===== */}
                    {pendingConfirm && (
                        <div
                            data-testid="scanner-confirm-strip"
                            className="animate-fade-slide-up rounded-xl border-2 border-foreground bg-secondary/25 p-3 space-y-2.5"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <PencilLine className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span className="font-heading text-xs font-extrabold text-foreground">
                                        {pendingConfirm.source === "barcode"
                                            ? "Barcode Detected"
                                            : "Verify Printed / Written Code"}
                                    </span>
                                    {pendingConfirm.wasCorrected && (
                                        <span className="rounded bg-secondary px-1.5 py-px font-mono text-[9px] font-bold uppercase text-secondary-foreground border border-foreground/40">
                                            Auto-Corrected
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        lastHitRotationRef.current = null;
                                        lastLiveCandidateRef.current = null;
                                        setPendingConfirm(null);
                                        setEditableCode("");
                                        setStatusHint(defaultHint);
                                    }}
                                    className="tap inline-flex items-center gap-1 font-mono text-[10px] font-bold text-muted-foreground hover:text-foreground"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    <span>Rescan</span>
                                </button>
                            </div>

                            {pendingConfirm.previewImage && (
                                <div className="flex items-center gap-2 rounded-lg border border-foreground/30 bg-black/85 p-1.5">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={pendingConfirm.previewImage}
                                        alt="Cropped code region"
                                        className="h-9 w-auto rounded object-contain mx-auto"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={editableCode}
                                        onChange={(e) => setEditableCode(e.target.value.toUpperCase())}
                                        maxLength={20}
                                        autoCapitalize="characters"
                                        spellCheck={false}
                                        aria-label="Edit detected tracking code"
                                        className="h-11 w-full rounded-lg border-2 border-foreground bg-card px-3 font-mono text-base font-extrabold tracking-widest text-foreground focus:outline-none"
                                    />
                                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-muted-foreground">
                                        {classifyBarcode(cleanEditable) === "cod_only"
                                            ? "COD"
                                            : classifyBarcode(cleanEditable) === "slp_likely"
                                              ? "SLP"
                                              : "SL POST"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    disabled={!isEditableValid}
                                    onClick={() => acceptVerifiedCode(cleanEditable)}
                                    className="tap inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border-2 border-foreground bg-primary px-4 font-heading text-xs sm:text-sm font-extrabold text-primary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] disabled:opacity-50"
                                >
                                    {batchMode ? (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            <span>Add to Batch</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="h-4 w-4" strokeWidth={2.5} />
                                            <span>Track Now</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-[10.5px] text-muted-foreground">
                                Tip: Tap any character above if a handwritten digit needs adjustment before tracking.
                            </p>
                        </div>
                    )}

                    {/* ===== MULTI-PARCEL BATCH TRAY ===== */}
                    {barcodeScanEnabled && batchMode && batchList.length > 0 && (
                        <div className="rounded-xl border-2 border-foreground bg-background p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] font-bold uppercase text-foreground">
                                    Scanned Batch ({batchList.length}/{MAX_BATCH_BARCODES})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setBatchList([])}
                                    className="font-mono text-[10px] font-bold text-muted-foreground hover:text-primary"
                                >
                                    Clear
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {batchList.map((code) => (
                                    <span
                                        key={code}
                                        className="inline-flex items-center gap-1 rounded border-[1.5px] border-dashed border-foreground bg-card px-2 py-0.5 font-mono text-xs font-extrabold text-foreground"
                                    >
                                        <Barcode className="h-3 w-3 text-primary" />
                                        <span>{code}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setBatchList((prev) => prev.filter((c) => c !== code))
                                            }
                                            aria-label={`Remove ${code}`}
                                            className="ml-0.5 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("medium");
                                    stopCameraStream();
                                    onApplyBarcodes(batchList);
                                    onClose();
                                }}
                                className="tap inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border-2 border-foreground bg-[#15803D] px-4 font-heading text-xs sm:text-sm font-extrabold text-white shadow-[0_2px_0_0_hsl(var(--foreground))]"
                            >
                                <span>Track All {batchList.length} Parcels</span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
