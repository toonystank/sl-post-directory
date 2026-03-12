import nodemailer from "nodemailer";

const getTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "465"),
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
        },
    });
};

const fromEmail = process.env.SMTP_USER || "notifications@slpost.directory";

// HTML-encode user-supplied values to prevent XSS in email templates
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper feature to log emails locally if SMTP is not configured
const sendOrLog = async (options: nodemailer.SendMailOptions) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.log("=====================================");
        console.log(`[MOCK EMAIL to: ${options.to}]`);
        console.log(`Subject: ${options.subject}`);
        console.log(`HTML Body:`);
        console.log(options.html);
        console.log("=====================================");
        return;
    }

    try {
        const transporter = getTransporter();
        await transporter.sendMail(options);
    } catch (error) {
        console.error("Failed to send email:", error);
    }
};

export async function sendVerificationEmail(toEmail: string, userName: string, token: string) {
    const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`;
    const safeName = escapeHtml(userName);

    await sendOrLog({
        from: fromEmail,
        to: toEmail,
        subject: "Verify your email address - SL Post Directory",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Welcome to SL Post Directory, ${safeName}!</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <div style="margin: 30px 0;">
                    <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
                </div>
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p><a href="${verificationUrl}">${verificationUrl}</a></p>
                <br/>
                <p>Best regards,</p>
                <p>The SL Post Directory Team</p>
            </div>
        `
    });
}

export async function sendEditRequestReceivedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: fromEmail,
        to: toEmail,
        subject: `Edit Request Received: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Thank you for your contribution, ${safeName}!</h2>
                <p>We have successfully received your suggested edits for the <strong>${safeOffice}</strong> Post Office.</p>
                <p>Our moderation team will review your changes shortly. You will receive another email once your edit has been approved or if we need more information.</p>
                <br/>
                <p>Best regards,</p>
                <p>The SL Post Directory Team</p>
            </div>
        `
    });
}

export async function sendEditRequestApprovedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: fromEmail,
        to: toEmail,
        subject: `Edit Request Approved: ${safeOffice}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Great news, ${safeName}!</h2>
                <p>Your suggested edits for the <strong>${safeOffice}</strong> Post Office have been approved and published to the live directory.</p>
                <p>Thank you for helping us keep Sri Lanka's postal information accurate and up-to-date.</p>
                <br/>
                <p>Best regards,</p>
                <p>The SL Post Directory Team</p>
            </div>
        `
    });
}

export async function sendEditRequestRejectedEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: fromEmail,
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
                <p>The SL Post Directory Team</p>
            </div>
        `
    });
}

export async function sendEditRequestMoreInfoEmail(toEmail: string, userName: string, officeName: string) {
    const safeName = escapeHtml(userName);
    const safeOffice = escapeHtml(officeName);

    await sendOrLog({
        from: fromEmail,
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
                <p>The SL Post Directory Team</p>
            </div>
        `
    });
}
