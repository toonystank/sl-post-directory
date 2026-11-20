"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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
    PencilLine,
    Plus,
    RefreshCw,
    ScanLine,
    Sparkles,
    SwitchCamera,
    Upload,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
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
    DEFAULT_RETICLE_RECT,
    preprocessSourceForOcr,
} from "@/lib/tracking/ocr-preprocess";

interface BarcodeScannerSheetProps {
    open: boolean;
    onClose: () => void;
    /** Called with 1 or more scanned/confirmed barcodes to populate and track */
    onApplyBarcodes: (barcodes: string[]) => void;
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

// Minimal TypeScript declaration for Web BarcodeDetector API (built into Android Chrome / TWA)
interface WebBarcodeDetector {
    detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
}

declare global {
    interface Window {
        BarcodeDetector?: {
            new (options?: { formats: string[] }): WebBarcodeDetector;
            getSupportedFormats?: () => Promise<string[]>;
        };
    }
}

export default function BarcodeScannerSheet({
    open,
    onClose,
    onApplyBarcodes,
}: BarcodeScannerSheetProps) {
    const [tab, setTab] = React.useState<ScannerTab>("camera");
    const [batchMode, setBatchMode] = React.useState(false);
    const [batchList, setBatchList] = React.useState<string[]>([]);

    const [cameraReady, setCameraReady] = React.useState(false);
    const [cameraError, setCameraError] = React.useState<string | null>(null);
    const [facingMode, setFacingMode] = React.useState<"environment" | "user">("environment");
    const [torchSupported, setTorchSupported] = React.useState(false);
    const [torchOn, setTorchOn] = React.useState(false);

    const [ocrRunning, setOcrRunning] = React.useState(false);
    const [statusHint, setStatusHint] = React.useState<string>(
        "Align barcode, printed code, or handwriting inside box"
    );

    // Editable confirmation strip for OCR / handwritten codes (or manual tweak)
    const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirmation | null>(null);
    const [editableCode, setEditableCode] = React.useState("");

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
    const pendingConfirmRef = React.useRef<PendingConfirmation | null>(null);
    pendingConfirmRef.current = pendingConfirm;

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

        // Progressive fallback chain so Android/iOS cameras never fail on strict resolution constraints
        const constraintAttempts: MediaStreamConstraints[] = [
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
                // Stop retrying immediately on hard permission / security denial
                if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
                    break;
                }
            }
        }

        if (!stream) {
            const name = lastErr instanceof DOMException ? lastErr.name : "";
            if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
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
                ) as { torch?: boolean };
                setTorchSupported(Boolean(caps.torch));
            }

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraReady(true);
                setStatusHint("Scanning 1D/2D barcode & printed/written code...");
            }
        } catch {
            stopCameraStream();
            setCameraError(
                "Could not display camera preview. Tap Retry Camera or use Take Photo below."
            );
        }
    }, [facingMode, stopCameraStream]);

    React.useEffect(() => {
        if (!open) {
            stopCameraStream();
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

    const showConfirmationPrompt = React.useCallback((conf: PendingConfirmation) => {
        triggerHaptic("medium");
        setPendingConfirm(conf);
        setEditableCode(conf.code);
    }, []);

    // Engine 1: Continuous 1D/2D Barcode scanning on live video stream
    React.useEffect(() => {
        if (!open || tab !== "camera" || !cameraReady) return;

        let cancelled = false;
        let nativeDetector: WebBarcodeDetector | null = null;

        if (typeof window !== "undefined" && window.BarcodeDetector) {
            try {
                nativeDetector = new window.BarcodeDetector({
                    formats: [
                        "code_128",
                        "code_39",
                        "code_93",
                        "codabar",
                        "ean_13",
                        "ean_8",
                        "itf",
                        "qr_code",
                        "data_matrix",
                        "aztec",
                    ],
                });
            } catch {
                try {
                    nativeDetector = new window.BarcodeDetector();
                } catch {
                    nativeDetector = null;
                }
            }
        }

        const decodeWithZxingCanvas = async (videoEl: HTMLVideoElement): Promise<string | null> => {
            try {
                const pre = preprocessSourceForOcr(videoEl, DEFAULT_RETICLE_RECT);
                if (!pre) return null;
                const { Html5Qrcode } = await import("html5-qrcode");
                const res = await fetch(pre.previewDataUrl);
                const blob = await res.blob();
                const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
                const tempId = "lpd-hidden-qr-worker";
                let holder = document.getElementById(tempId);
                if (!holder) {
                    holder = document.createElement("div");
                    holder.id = tempId;
                    holder.style.display = "none";
                    document.body.appendChild(holder);
                }
                const qr = new Html5Qrcode(tempId);
                try {
                    const decoded = await qr.scanFile(file, false);
                    return decoded;
                } finally {
                    try {
                        qr.clear();
                    } catch {
                        // Ignore
                    }
                }
            } catch {
                return null;
            }
        };

        const interval = window.setInterval(async () => {
            if (cancelled || pendingConfirmRef.current || !videoRef.current) return;
            const videoEl = videoRef.current;
            if (videoEl.readyState < 2) return;

            try {
                if (nativeDetector) {
                    const hits = await nativeDetector.detect(videoEl);
                    if (cancelled || hits.length === 0) return;
                    for (const hit of hits) {
                        const raw = (hit.rawValue || "").trim();
                        const parsed =
                            parseBarcodes(raw)[0] ||
                            tryParseOcrToken(raw)?.code ||
                            (VALID_BARCODE_REGEX.test(raw.toUpperCase()) ? raw.toUpperCase() : null);
                        if (parsed) {
                            acceptVerifiedCode(parsed);
                            return;
                        }
                    }
                } else {
                    const fallbackHit = await decodeWithZxingCanvas(videoEl);
                    if (cancelled || !fallbackHit) return;
                    const parsed =
                        parseBarcodes(fallbackHit)[0] ||
                        tryParseOcrToken(fallbackHit)?.code ||
                        (VALID_BARCODE_REGEX.test(fallbackHit.trim().toUpperCase())
                            ? fallbackHit.trim().toUpperCase()
                            : null);
                    if (parsed) {
                        acceptVerifiedCode(parsed);
                    }
                }
            } catch {
                // Frame without barcode
            }
        }, 280);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [open, tab, cameraReady, acceptVerifiedCode]);

    /**
     * Engine 2: Run 2-Pass OCR (Printed Contrast Pass + Handwritten Binarized Pass)
     * on the cropped Reticle ROI of the live camera feed.
     */
    const runLiveReticleOcr = React.useCallback(
        async (isManualTrigger: boolean) => {
            if (ocrBusyRef.current || pendingConfirmRef.current || !videoRef.current) return;
            const videoEl = videoRef.current;
            if (videoEl.readyState < 2) return;

            const pre = preprocessSourceForOcr(videoEl, DEFAULT_RETICLE_RECT);
            if (!pre) return;

            ocrBusyRef.current = true;
            if (isManualTrigger) {
                triggerHaptic("light");
                setOcrRunning(true);
                setStatusHint("Reading printed / written code inside box...");
            }

            try {
                const Tesseract = await import("tesseract.js");

                // Pass 1: Contrast-stretched ROI (fast & accurate for printed/stamped slips)
                const pass1 = await Tesseract.recognize(pre.contrastDataUrl, "eng");
                let extracted = extractPostalCodesFromOcr(pass1.data.text);

                // Pass 2: Adaptive ink binarization (for handwritten pen ink on coloured paper)
                if (extracted.length === 0 || (isManualTrigger && extracted[0].score < 70)) {
                    const pass2 = await Tesseract.recognize(pre.thresholdDataUrl, "eng");
                    const extracted2 = extractPostalCodesFromOcr(pass2.data.text);
                    if (
                        extracted2.length > 0 &&
                        (extracted.length === 0 || extracted2[0].score > extracted[0].score)
                    ) {
                        extracted = extracted2;
                    }
                }

                if (extracted.length > 0) {
                    const best = extracted[0];
                    showConfirmationPrompt({
                        code: best.code,
                        rawMatch: best.rawMatch,
                        source: "ocr",
                        wasCorrected: best.wasCorrected,
                        previewImage: pre.previewDataUrl,
                    });
                    setStatusHint(`Detected ${best.code} — confirm or edit digits below`);
                } else if (isManualTrigger) {
                    setStatusHint(
                        "No tracking number read yet — move closer so the 13-character code fills the box"
                    );
                }
            } catch {
                if (isManualTrigger) {
                    setStatusHint("Could not read text — try holding steady with good lighting");
                }
            } finally {
                ocrBusyRef.current = false;
                setOcrRunning(false);
            }
        },
        [showConfirmationPrompt]
    );

    // Periodic background OCR pass every 2.8s while holding camera open
    React.useEffect(() => {
        if (!open || tab !== "camera" || !cameraReady) return;
        const timer = window.setInterval(() => {
            if (!ocrBusyRef.current && !pendingConfirmRef.current) {
                void runLiveReticleOcr(false);
            }
        }, 2800);
        return () => window.clearInterval(timer);
    }, [open, tab, cameraReady, runLiveReticleOcr]);

    // Gallery / Photo Upload Analyzer (1D/2D Barcode + Multi-Pass OCR)
    const handlePhotoSelected = async (file: File) => {
        if (!file || !file.type.startsWith("image/")) return;

        setPhotoError(null);
        setPhotoResults([]);
        setPhotoAnalyzing(true);
        const objUrl = URL.createObjectURL(file);
        setPhotoPreviewUrl(objUrl);

        try {
            const foundMap = new Map<string, ExtractedOcrCode>();

            // Step 1: Check 1D/2D Barcode in uploaded image
            try {
                const { Html5Qrcode } = await import("html5-qrcode");
                const tempId = "lpd-hidden-photo-qr";
                let holder = document.getElementById(tempId);
                if (!holder) {
                    holder = document.createElement("div");
                    holder.id = tempId;
                    holder.style.display = "none";
                    document.body.appendChild(holder);
                }
                const qr = new Html5Qrcode(tempId);
                try {
                    const rawBarcode = await qr.scanFile(file, false);
                    const code =
                        parseBarcodes(rawBarcode)[0] ||
                        tryParseOcrToken(rawBarcode)?.code ||
                        rawBarcode.trim().toUpperCase();
                    if (code && VALID_BARCODE_REGEX.test(code)) {
                        foundMap.set(code, {
                            code,
                            rawMatch: rawBarcode,
                            wasCorrected: false,
                            score: 100,
                        });
                    }
                } finally {
                    try {
                        qr.clear();
                    } catch {
                        // Ignore
                    }
                }
            } catch {
                // No 1D/2D barcode in photo; continue to OCR
            }

            // Step 2: Load image into offscreen canvas for multi-pass Printed + Handwritten OCR
            const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = objUrl;
            });

            const Tesseract = await import("tesseract.js");

            // Full-frame preprocessed pass
            const fullPre = preprocessSourceForOcr(imgEl, {
                xRatio: 0.02,
                yRatio: 0.02,
                wRatio: 0.96,
                hRatio: 0.96,
            });

            if (fullPre) {
                const ocr1 = await Tesseract.recognize(fullPre.contrastDataUrl, "eng");
                for (const item of extractPostalCodesFromOcr(ocr1.data.text)) {
                    if (!foundMap.has(item.code)) foundMap.set(item.code, item);
                }

                if (foundMap.size === 0) {
                    const ocr2 = await Tesseract.recognize(fullPre.thresholdDataUrl, "eng");
                    for (const item of extractPostalCodesFromOcr(ocr2.data.text)) {
                        if (!foundMap.has(item.code)) foundMap.set(item.code, item);
                    }
                }
            }

            const allDetected = Array.from(foundMap.values()).sort((a, b) => b.score - a.score);
            setPhotoResults(allDetected);

            if (allDetected.length > 0) {
                triggerHaptic("success");
                // Pre-open editable confirmation with top match
                setPendingConfirm({
                    code: allDetected[0].code,
                    rawMatch: allDetected[0].rawMatch,
                    source: allDetected[0].score === 100 ? "barcode" : "ocr",
                    wasCorrected: allDetected[0].wasCorrected,
                    previewImage: fullPre?.previewDataUrl,
                });
                setEditableCode(allDetected[0].code);
            } else {
                setPhotoError(
                    "No barcode or 13-character SL Post tracking number was found in this image. Try cropping closer to the tracking number or enter it below."
                );
            }
        } catch {
            setPhotoError("Could not analyze image. Please try another photo.");
        } finally {
            setPhotoAnalyzing(false);
        }
    };

    if (!open || typeof document === "undefined") return null;

    const cleanEditable = editableCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isEditableValid = VALID_BARCODE_REGEX.test(cleanEditable);

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Scan barcode, printed code, or handwritten tracking number"
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
                            Scan Parcel Code
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Single vs Multi-Parcel Batch Toggle */}
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

                {/* Mode Tabs: Live Camera vs Photo / Receipt Upload */}
                <div className="grid grid-cols-2 border-b-[1.5px] border-foreground bg-muted/60 p-1 gap-1 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            setTab("camera");
                            setPendingConfirm(null);
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
                        <span>From Photo / Receipt</span>
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
                            <div className="relative overflow-hidden rounded-xl border-2 border-foreground bg-black aspect-[4/3] max-h-[270px] w-full mx-auto flex items-center justify-center">
                                <video
                                    ref={videoRef}
                                    playsInline
                                    muted
                                    autoPlay
                                    className="h-full w-full object-cover"
                                />

                                {/* Darkened mask around the horizontal postal reticle box */}
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0 flex flex-col justify-center items-center px-5"
                                >
                                    <div className="relative w-full h-24 sm:h-28 rounded-lg border-2 border-dashed border-secondary shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]">
                                        {/* Corner targeting brackets */}
                                        <span className="absolute -top-0.5 -left-0.5 h-3.5 w-3.5 border-t-4 border-l-4 border-secondary rounded-tl" />
                                        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 border-t-4 border-r-4 border-secondary rounded-tr" />
                                        <span className="absolute -bottom-0.5 -left-0.5 h-3.5 w-3.5 border-b-4 border-l-4 border-secondary rounded-bl" />
                                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 border-b-4 border-r-4 border-secondary rounded-br" />

                                        {/* Center laser guide line */}
                                        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[1.5px] bg-primary/80 shadow-[0_0_8px_hsl(var(--primary))]" />

                                        {/* Reticle Top Tag */}
                                        <span className="absolute -top-5 left-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-secondary">
                                            BD · NA · BF · RA · BG · 1D/2D · Handwritten
                                        </span>
                                    </div>
                                </div>

                                {/* Top-right hardware controls (Torch + Flip Camera) */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                                    {torchSupported && (
                                        <button
                                            type="button"
                                            onClick={() => void toggleTorch()}
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
                                        onClick={handleFlipCamera}
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

                            {/* Dedicated Shutter Button for Printed & Handwritten Codes */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    disabled={!cameraReady || ocrRunning}
                                    onClick={() => void runLiveReticleOcr(true)}
                                    className="tap flex-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-secondary px-4 font-heading text-xs sm:text-sm font-extrabold text-secondary-foreground shadow-[0_2px_0_0_hsl(var(--foreground))] hover:opacity-95 disabled:opacity-50"
                                >
                                    {ocrRunning ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Reading Text / Handwriting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="h-4 w-4" />
                                            <span>Capture Printed / Written Code</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ===== TAB 2: PHOTO / GALLERY RECEIPT UPLOAD ===== */}
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
                                        alt="Uploaded postal receipt"
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
                                            ? "Tap to choose a different receipt photo"
                                            : "Select Receipt Photo or Screenshot"}
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        Reads 1D/2D barcodes, printed slips, and handwritten COD/SLP numbers
                                    </p>
                                </div>
                            </button>

                            {photoAnalyzing && (
                                <div className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-foreground bg-background p-3 text-xs font-bold text-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    <span>Scanning photo for barcodes &amp; written tracking numbers...</span>
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
                                        setPendingConfirm(null);
                                        setEditableCode("");
                                        setStatusHint("Scanning 1D/2D barcode & printed/written code...");
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
                    {batchMode && batchList.length > 0 && (
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
