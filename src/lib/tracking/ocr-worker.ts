"use client";

import type { Worker, PSM } from "tesseract.js";

export type OcrLangs = "eng" | "eng+sin" | "eng+tam";
export type OcrPsmMode = "sparse" | "auto";

const IDLE_TERMINATE_MS = 30_000;

let cachedLangs: OcrLangs | null = null;
let cachedWorkerPromise: Promise<Worker> | null = null;
let lastPsm: OcrPsmMode | null = null;
let releaseTimer: number | null = null;
let jobQueue: Promise<unknown> = Promise.resolve();

function clearReleaseTimer(): void {
    if (releaseTimer !== null && typeof window !== "undefined") {
        window.clearTimeout(releaseTimer);
        releaseTimer = null;
    }
}

async function createWorkerForLangs(langs: OcrLangs): Promise<Worker> {
    const { createWorker, OEM } = await import("tesseract.js");
    const langList = langs.split("+");
    return createWorker(langList, OEM.LSTM_ONLY);
}

/**
 * Returns a cached Tesseract OCR worker for the requested language pack,
 * reusing the loaded WASM + traineddata across frames.
 */
export function getOcrWorker(langs: OcrLangs = "eng"): Promise<Worker> {
    clearReleaseTimer();

    if (cachedLangs === langs && cachedWorkerPromise) {
        return cachedWorkerPromise;
    }

    const prevPromise = cachedWorkerPromise;
    cachedLangs = langs;
    lastPsm = null;

    const nextPromise = (async () => {
        if (prevPromise) {
            try {
                const prevWorker = await prevPromise;
                await prevWorker.terminate();
            } catch {
                // Ignore previous worker teardown error
            }
        }
        return createWorkerForLangs(langs);
    })().catch((err) => {
        if (cachedWorkerPromise === nextPromise) {
            cachedWorkerPromise = null;
            cachedLangs = null;
            lastPsm = null;
        }
        throw err;
    });

    cachedWorkerPromise = nextPromise;
    return nextPromise;
}

/**
 * Warms up the Tesseract worker and traineddata model ahead of scanning.
 */
export function prewarmOcr(langs: OcrLangs = "eng"): void {
    if (typeof window === "undefined") return;
    void getOcrWorker(langs).catch(() => {
        // Ignore background prewarm failures; active scan handles retries
    });
}

/**
 * Schedules worker termination 30s after the scanner closes so quick re-opens
 * remain instant while memory is freed after idle.
 */
export function releaseOcrWorker(): void {
    if (typeof window === "undefined") return;
    clearReleaseTimer();
    releaseTimer = window.setTimeout(() => {
        releaseTimer = null;
        const workerPromise = cachedWorkerPromise;
        cachedWorkerPromise = null;
        cachedLangs = null;
        lastPsm = null;
        if (workerPromise) {
            void workerPromise
                .then((worker) => worker.terminate())
                .catch(() => {
                    // Ignore teardown errors
                });
        }
    }, IDLE_TERMINATE_MS);
}

/**
 * Serialized canvas OCR using the persistent worker.
 * Updates PSM parameters only when switching between live ("sparse") and photo ("auto") modes.
 */
export function recognizeCanvas(
    canvas: HTMLCanvasElement,
    langs: OcrLangs = "eng",
    psmMode: OcrPsmMode = "sparse"
): Promise<{ text: string; confidence: number }> {
    const run = async (): Promise<{ text: string; confidence: number }> => {
        const worker = await getOcrWorker(langs);
        if (lastPsm !== psmMode) {
            const { PSM: TesseractPsm } = await import("tesseract.js");
            const psmValue: PSM =
                psmMode === "sparse" ? TesseractPsm.SPARSE_TEXT : TesseractPsm.AUTO;
            await worker.setParameters({
                tessedit_pageseg_mode: psmValue,
                preserve_interword_spaces: "1",
            });
            lastPsm = psmMode;
        }
        const res = await worker.recognize(canvas);
        return {
            text: res.data.text || "",
            confidence: typeof res.data.confidence === "number" ? res.data.confidence : 0,
        };
    };

    const next = jobQueue.then(run, run);
    jobQueue = next.catch(() => undefined);
    return next;
}
