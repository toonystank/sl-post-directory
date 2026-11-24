import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/security";
import { getSiteUrl } from "@/lib/site";

function resolveFromAddress(): string {
    return (
        process.env.EMAIL_FROM?.trim() ||
        process.env.RESEND_FROM_EMAIL?.trim() ||
        process.env.SMTP_USER?.trim() ||
        "notifications@slpost.directory"
    );
}

const getTransporter = () => {
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const resolvedPort = Number.isFinite(port) && port > 0 ? port : 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port: resolvedPort,
        secure: resolvedPort === 465,
        auth: {
            user: process.env.SMTP_USER?.trim(),
            pass: process.env.SMTP_PASSWORD?.trim(),
        },
    });
};

// Send via Resend HTTP API when configured with a verified sender domain,
// fall back to Nodemailer SMTP when SMTP credentials exist, or log locally.
const sendOrLog = async (options: nodemailer.SendMailOptions) => {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom =
        process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();

    if (resendApiKey && resendFrom) {
        try {
            const toList = Array.isArray(options.to)
                ? options.to.map((addr) => String(addr))
                : options.to
                  ? [String(options.to)]
                  : [];

            const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: resendFrom,
                    to: toList,
                    subject: String(options.subject ?? ""),
                    html: String(options.html ?? ""),
                }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                const detail = await res.text().catch(() => res.statusText);
                console.error(`Resend email API failed (${res.status}):`, detail);
            }
            return;
        } catch (error) {
            console.error("Failed to send email via Resend:", error);
            return;
        }
    }

    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASSWORD?.trim();
    if (smtpUser && smtpPass) {
        try {
            const transporter = getTransporter();
            await transporter.sendMail({
                ...options,
                from: options.from || resolveFromAddress(),
            });
            return;
        } catch (error) {
            console.error("Failed to send email via SMTP:", error);
            return;
        }
    }

    if (resendApiKey && !resendFrom) {
        console.warn(
            "Email delivery skipped: RESEND_API_KEY is set, but EMAIL_FROM (verified custom domain sender) is missing."
        );
    }

    console.log("=====================================");
    console.log(`[MOCK EMAIL to: ${options.to}]`);
    console.log(`Subject: ${options.subject}`);
    console.log("HTML Body:");
    console.log(options.html);
    console.log("=====================================");
};

export async function sendVerificationEmail(toEmail: string, userName: string, token: string) {
    const baseUrl = (process.env.NEXTAUTH_URL?.trim() || getSiteUrl()).replace(/\/+$/, "");
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const safeName = escapeHtml(userName);

    await sendOrLog({
        from: resolveFromAddress(),
        to: toEmail,
        subject: "Verify your email address - Lanka Post Directory",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to Lanka Post Directory, ${safeName}!</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <div style="margin: 30px 0;">
                    <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                <br/>
                <p>Best regards,</p>
                <p>The Lanka Post Directory Team</p>
            </div>
        `,
    });
}

export async function sendEditRequestReceivedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: resolveFromAddress(),
        to: toEmail,
        subject: `Edit Request Received: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Thank you for your contribution, ${safeName}!</h2>
                <p>We have successfully received your suggested edits for the <strong>${safeOffice}</strong> Post Office.</p>
                <p>Our moderation team will review your changes shortly. You will receive another email once your edit has been approved or if we need more information.</p>
                <br/>
                <p>Best regards,</p>
                <p>The Lanka Post Directory Team</p>
            </div>
        `,
    });
}

export async function sendEditRequestApprovedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: resolveFromAddress(),
        to: toEmail,
        subject: `Edit Request Approved: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Great news, ${safeName}!</h2>
                <p>Your suggested edits for the <strong>${safeOffice}</strong> Post Office have been approved and published to the live directory.</p>
                <p>Thank you for helping us keep Sri Lanka's postal information accurate and up-to-date.</p>
                <br/>
                <p>Best regards,</p>
                <p>The Lanka Post Directory Team</p>
            </div>
        `,
    });
}

export async function sendEditRequestRejectedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: resolveFromAddress(),
        to: toEmail,
        subject: `Update on Edit Request: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hello ${safeName},</h2>
                <p>Thank you for submitting suggested edits for the <strong>${safeOffice}</strong> Post Office.</p>
                <p>Unfortunately, our moderation team was unable to verify the changes provided, and the request has been declined at this time.</p>
                <p>If you believe this was a mistake, or if you have official sources, please feel free to submit a new request with additional context.</p>
                <br/>
                <p>Best regards,</p>
                <p>The Lanka Post Directory Team</p>
            </div>
        `,
    });
}

export async function sendEditRequestMoreInfoEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: resolveFromAddress(),
        to: toEmail,
        subject: `More Information Needed: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hello ${safeName},</h2>
                <p>Thank you for submitting suggested edits for the <strong>${safeOffice}</strong> Post Office.</p>
                <p>Our moderation team needs a bit more information or clarification regarding your requested changes before we can approve them.</p>
                <p>Please reply to this email or submit a new request with additional details or sources to help us verify.</p>
                <br/>
                <p>Best regards,</p>
                <p>The Lanka Post Directory Team</p>
            </div>
        `,
    });
}
