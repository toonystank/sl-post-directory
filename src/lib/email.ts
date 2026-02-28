import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = "notifications@slpost.directory"; // Replace with verified domain when ready

export async function sendEditRequestReceivedEmail(toEmail: string, userName: string, officeName: string) {
    if (!process.env.RESEND_API_KEY) {
        console.log("Mock Email: Request Received to", toEmail);
        return;
    }

    try {
        await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: `Edit Request Received: ${officeName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Thank you for your contribution, ${userName}!</h2>
                    <p>We have successfully received your suggested edits for the <strong>${officeName}</strong> Post Office.</p>
                    <p>Our moderation team will review your changes shortly. You will receive another email once your edit has been approved or if we need more information.</p>
                    <br/>
                    <p>Best regards,</p>
                    <p>The SL Post Directory Team</p>
                </div>
            `
        });
    } catch (error) {
        console.error("Failed to send Request Received email:", error);
    }
}

export async function sendEditRequestApprovedEmail(toEmail: string, userName: string, officeName: string) {
    if (!process.env.RESEND_API_KEY) {
        console.log("Mock Email: Request Approved to", toEmail);
        return;
    }

    try {
        await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: `Edit Request Approved: ${officeName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Great news, ${userName}!</h2>
                    <p>Your suggested edits for the <strong>${officeName}</strong> Post Office have been approved and published to the live directory.</p>
                    <p>Thank you for helping us keep Sri Lanka's postal information accurate and up-to-date.</p>
                    <br/>
                    <p>Best regards,</p>
                    <p>The SL Post Directory Team</p>
                </div>
            `
        });
    } catch (error) {
        console.error("Failed to send Request Approved email:", error);
    }
}

export async function sendEditRequestRejectedEmail(toEmail: string, userName: string, officeName: string) {
    if (!process.env.RESEND_API_KEY) {
        console.log("Mock Email: Request Rejected to", toEmail);
        return;
    }

    try {
        await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: `Update on Edit Request: ${officeName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Hello ${userName},</h2>
                    <p>Thank you for submitting suggested edits for the <strong>${officeName}</strong> Post Office.</p>
                    <p>Unfortunately, our moderation team was unable to verify the changes provided, and the request has been declined at this time.</p>
                    <p>If you believe this was a mistake, or if you have official sources, please feel free to submit a new request with additional context.</p>
                    <br/>
                    <p>Best regards,</p>
                    <p>The SL Post Directory Team</p>
                </div>
            `
        });
    } catch (error) {
        console.error("Failed to send Request Rejected email:", error);
    }
}

export async function sendEditRequestMoreInfoEmail(toEmail: string, userName: string, officeName: string) {
    if (!process.env.RESEND_API_KEY) {
        console.log("Mock Email: Need More Info to", toEmail);
        return;
    }

    try {
        await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: `More Information Needed: ${officeName}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Hello ${userName},</h2>
                    <p>Thank you for submitting suggested edits for the <strong>${officeName}</strong> Post Office.</p>
                    <p>Our moderation team needs a bit more information or clarification regarding your requested changes before we can approve them.</p>
                    <p>Please reply to this email or submit a new request with additional details or sources to help us verify.</p>
                    <br/>
                    <p>Best regards,</p>
                    <p>The SL Post Directory Team</p>
                </div>
            `
        });
    } catch (error) {
        console.error("Failed to send Need More Info email:", error);
    }
}
