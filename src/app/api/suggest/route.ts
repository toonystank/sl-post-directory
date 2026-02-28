import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEditRequestReceivedEmail } from "@/lib/email";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { officeId, submitterName, submitterEmail, name, postalCode, newFieldName, newFieldValue, ...fields } = body;

        if (!officeId || !submitterName || !submitterEmail) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate office exists
        const office = await prisma.postOffice.findUnique({
            where: { id: officeId }
        });

        if (!office) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        // Find or create the user as a CONTRIBUTOR
        let user = await prisma.user.findUnique({
            where: { email: submitterEmail }
        });

        if (!user) {
            // Generate a random password since they are just submitting edits via email for now
            const randomPassword = Math.random().toString(36).slice(-10);
            const passwordHash = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    name: submitterName,
                    email: submitterEmail,
                    passwordHash,
                    role: "CONTRIBUTOR" // They are not an employee, just a public contributor
                }
            });
        }

        // Build the changes object
        const changes: any = {
            name,
            postalCode,
            fields: []
        };

        // Process dynamic fields
        for (const [key, value] of Object.entries(fields)) {
            if (key.startsWith("field_")) {
                const fieldName = key.replace("field_", "");
                changes.fields.push({ name: fieldName, value });
            }
        }

        // Processing a potential new field addition
        if (newFieldName && newFieldValue) {
            changes.fields.push({ name: newFieldName, value: newFieldValue });
        }

        // Create the edit request
        const editRequest = await prisma.editRequest.create({
            data: {
                postOfficeId: officeId,
                requestedById: user.id,
                changes: JSON.stringify(changes),
                status: "PENDING"
            }
        });

        // Trigger email notification via Resend
        await sendEditRequestReceivedEmail(user.email, user.name, office.name);

        return NextResponse.json({
            success: true,
            message: "Edit request submitted successfully",
            requestId: editRequest.id
        });

    } catch (error: any) {
        console.error("Suggest API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
