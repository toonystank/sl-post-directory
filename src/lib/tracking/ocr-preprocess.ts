"use client";

/**
 * Offscreen Canvas Image Pre-Processor for Printed & Handwritten Postal Receipts and Addresses.
 *
 * - Crops to the target Reticle ROI (keeping pixel count compact for fast mobile OCR).
 * - Uses the RED channel (`data[i]`) as grayscale so red postmarks and franking stamps fade
 *   toward white paper while black/blue ink remains dark and legible.
 * - `toContrastCanvas`: Percentile/min-max contrast stretch (ideal for printed text & labels).
 * - `toThresholdCanvas`: Adaptive local mean binarization (ideal for ballpoint pen handwriting).
 */

export interface ReticleCropRect {
    /** Normalized 0..1 X offset from left of video/image */
    xRatio: number;
    /** Normalized 0..1 Y offset from top of video/image */
    yRatio: number;
    /** Normalized 0..1 width */
    wRatio: number;
    /** Normalized 0..1 height */
    hRatio: number;
}

export type CaptureRotation = 0 | 90 | 270;

export const DEFAULT_RETICLE_RECT: ReticleCropRect = {
    xRatio: 0.08,
    yRatio: 0.34,
    wRatio: 0.84,
    hRatio: 0.28,
};

export const ADDRESS_RETICLE_RECT: ReticleCropRect = {
    xRatio: 0.06,
    yRatio: 0.2,
    wRatio: 0.88,
    hRatio: 0.52,
};

export interface CaptureRoiOptions {
    rotation?: CaptureRotation;
    maxWidth?: number;
}

export interface PreprocessedOcrFrame {
    /** Data URL of the natural cropped ROI (shown to the user in the confirmation strip) */
    previewDataUrl: string;
    /** Data URL with contrast stretch applied (Pass 1) */
    contrastDataUrl: string;
    /** Data URL with adaptive ink binarization applied (Pass 2 for handwriting) */
    thresholdDataUrl: string;
}

function getSourceDimensions(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): { width: number; height: number } {
    if (source instanceof HTMLVideoElement) {
        return { width: source.videoWidth, height: source.videoHeight };
    }
    if (source instanceof HTMLImageElement) {
        return {
            width: source.naturalWidth || source.width,
            height: source.naturalHeight || source.height,
        };
    }
    return { width: source.width, height: source.height };
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext("2d", { willReadFrequently: true });
    if (ctx) {
        ctx.drawImage(src, 0, 0);
    }
    return out;
}

function applyContrastStretch(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const red = new Uint8Array(width * height);

    let min = 255;
    let max = 0;

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        // Red channel suppresses red postmarks & franking stamps while keeping black/blue ink dark
        const r = data[i];
        red[p] = r;
        if (r < min) min = r;
        if (r > max) max = r;
    }

    const range = Math.max(1, max - min);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const stretched = Math.min(255, Math.max(0, Math.round(((red[p] - min) * 255) / range)));
        data[i] = stretched;
        data[i + 1] = stretched;
        data[i + 2] = stretched;
    }

    ctx.putImageData(imgData, 0, 0);
}

function applyAdaptiveBinarization(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const gray = new Uint8Array(width * height);

    // Integral image for fast O(1) local window mean calculation
    const integral = new Float64Array((width + 1) * (height + 1));
    const stride = width + 1;

    for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Red channel fades red stamps toward paper brightness before adaptive thresholding
            const r = data[idx];
            gray[y * width + x] = r;
            rowSum += r;
            integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + rowSum;
        }
    }

    const radius = Math.max(12, Math.round(Math.min(width, height) / 8));
    const bias = 14; // Sensitivity to pen stroke vs paper grain

    for (let y = 0; y < height; y++) {
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        for (let x = 0; x < width; x++) {
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(width - 1, x + radius);

            const area = (x1 - x0 + 1) * (y1 - y0 + 1);
            const sum =
                integral[(y1 + 1) * stride + (x1 + 1)] -
                integral[y0 * stride + (x1 + 1)] -
                integral[(y1 + 1) * stride + x0] +
                integral[y0 * stride + x0];

            const localMean = sum / area;
            const val = gray[y * width + x] < localMean - bias ? 0 : 255;

            const idx = (y * width + x) * 4;
            data[idx] = val;
            data[idx + 1] = val;
            data[idx + 2] = val;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

/**
 * Downscales large gallery photos so their longest edge is capped (default 1600px)
 * before running barcode detection or multi-rotation OCR.
 */
export function downscaleImageToCanvas(
    source: HTMLImageElement | HTMLCanvasElement,
    maxSide = 1600
): HTMLCanvasElement | null {
    const { width: srcW, height: srcH } = getSourceDimensions(source);
    if (!srcW || !srcH) return null;

    const longest = Math.max(srcW, srcH);
    const scale = longest > maxSide ? maxSide / longest : 1;
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(source, 0, 0, outW, outH);
    return canvas;
}

/**
 * Captures and optionally rotates the target ROI from a video frame, image, or canvas
 * without encoding data URLs.
 */
export function captureRoi(
    source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
    crop: ReticleCropRect = DEFAULT_RETICLE_RECT,
    options: CaptureRoiOptions = {}
): HTMLCanvasElement | null {
    const { rotation = 0, maxWidth = 1000 } = options;
    const { width: srcW, height: srcH } = getSourceDimensions(source);

    if (!srcW || !srcH) return null;

    const sx = Math.max(0, Math.round(srcW * crop.xRatio));
    const sy = Math.max(0, Math.round(srcH * crop.yRatio));
    const sw = Math.min(srcW - sx, Math.round(srcW * crop.wRatio));
    const sh = Math.min(srcH - sy, Math.round(srcH * crop.hRatio));

    if (sw < 40 || sh < 20) return null;

    const targetWBeforeCap = rotation === 0 ? sw : sh;
    let scale = Math.min(2, Math.max(1, 750 / targetWBeforeCap));
    if (targetWBeforeCap * scale > maxWidth) {
        scale = maxWidth / targetWBeforeCap;
    }

    const drawW = Math.max(1, Math.round(sw * scale));
    const drawH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = rotation === 0 ? drawW : drawH;
    canvas.height = rotation === 0 ? drawH : drawW;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    if (rotation === 90) {
        ctx.translate(canvas.width, 0);
        ctx.rotate(Math.PI / 2);
    } else if (rotation === 270) {
        ctx.translate(0, canvas.height);
        ctx.rotate(-Math.PI / 2);
    }

    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, drawW, drawH);
    return canvas;
}

/**
 * Produces a contrast-stretched red-channel grayscale copy of an ROI canvas.
 */
export function toContrastCanvas(roiCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = cloneCanvas(roiCanvas);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    if (ctx) {
        applyContrastStretch(ctx, out.width, out.height);
    }
    return out;
}

/**
 * Produces an adaptively binarized red-channel copy of an ROI canvas (best for pen handwriting).
 */
export function toThresholdCanvas(roiCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = cloneCanvas(roiCanvas);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    if (ctx) {
        applyAdaptiveBinarization(ctx, out.width, out.height);
    }
    return out;
}

/**
 * Encodes an ROI canvas to JPEG only when a confirmation preview needs to be displayed.
 */
export function canvasToPreviewJpeg(roiCanvas: HTMLCanvasElement, quality = 0.85): string {
    return roiCanvas.toDataURL("image/jpeg", quality);
}

/**
 * Legacy helper retained as a thin wrapper around the lazy canvas pipeline.
 */
export function preprocessSourceForOcr(
    source: HTMLVideoElement | HTMLImageElement,
    crop: ReticleCropRect = DEFAULT_RETICLE_RECT
): PreprocessedOcrFrame | null {
    const roi = captureRoi(source, crop);
    if (!roi) return null;

    return {
        previewDataUrl: canvasToPreviewJpeg(roi, 0.88),
        contrastDataUrl: toContrastCanvas(roi).toDataURL("image/png"),
        thresholdDataUrl: toThresholdCanvas(roi).toDataURL("image/png"),
    };
}
