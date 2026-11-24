/**
 * Server-side Cloudflare Turnstile CAPTCHA verification helper.
 * Fails closed in production when `TURNSTILE_SECRET_KEY` is missing or when
 * the token fails verification.
 */
export async function verifyTurnstile(
    turnstileToken: string | null | undefined
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();

    if (!turnstileSecret) {
        if (process.env.NODE_ENV === "production") {
            console.error("CRITICAL: TURNSTILE_SECRET_KEY is not configured in production!");
            return { ok: false, status: 500, error: "Server configuration error" };
        }
        return { ok: true };
    }

    if (!turnstileToken) {
        return { ok: false, status: 400, error: "Please complete the Captcha" };
    }

    try {
        const formData = new FormData();
        formData.append("secret", turnstileSecret);
        formData.append("response", turnstileToken);

        const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            body: formData,
            method: "POST",
            signal: AbortSignal.timeout(10000),
        });
        const outcome = (await result.json()) as { success?: boolean };
        if (!outcome.success) {
            return { ok: false, status: 400, error: "Captcha verification failed" };
        }
        return { ok: true };
    } catch (err) {
        console.error("Turnstile verification request failed:", err);
        return { ok: false, status: 502, error: "Unable to verify Captcha right now. Please try again." };
    }
}
