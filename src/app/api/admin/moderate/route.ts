import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { sendEditRequestApprovedEmail, sendEditRequestRejectedEmail, sendEditRequestMoreInfoEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { requestId, action } = body;

        if (!requestId || !action || !["APPROVE", "REJECT", "MORE_INFO"].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const editRequest = await prisma.editRequest.findUnique({
            where: { id: requestId },
            include: {
                postOffice: true,
                requestedBy: true
            }
        });

        if (!editRequest) {
            return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
        }

        if (editRequest.status !== "PENDING" && editRequest.status !== "MORE_INFO") {
            return NextResponse.json({ error: "Request is already processed" }, { status: 400 });
        }

        if (action === "REJECT") {
            await prisma.editRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED" }
            });

            await sendEditRequestRejectedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                editRequest.postOffice.name
            );

            return NextResponse.json({ success: true, message: "Request rejected successfully" });
        }

        if (action === "MORE_INFO") {
            await prisma.editRequest.update({
                where: { id: requestId },
                data: { status: "MORE_INFO" }
            });

            await sendEditRequestMoreInfoEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                editRequest.postOffice.name
            );

            return NextResponse.json({ success: true, message: "Requested more info successfully" });
        }

        if (action === "APPROVE") {
            const changes = JSON.parse(editRequest.changes);

            // Execute the approval in a transaction to ensure atomic updates
            await prisma.$transaction(async (tx) => {
                // Update basic fields
                await tx.postOffice.update({
                    where: { id: editRequest.postOfficeId },
                    data: {
                        name: changes.name || editRequest.postOffice.name,
                        postalCode: changes.postalCode || editRequest.postOffice.postalCode,
                    }
                });

                // Upsert only the changed fields — preserve untouched ones
                if (changes.fields && Array.isArray(changes.fields)) {
                    for (const field of changes.fields) {
                        const existing = await tx.postOfficeField.findFirst({
                            where: {
                                postOfficeId: editRequest.postOfficeId,
                                name: field.name,
                            }
                        });

                        if (existing) {
                            await tx.postOfficeField.update({
                                where: { id: existing.id },
                                data: { value: field.value }
                            });
                        } else {
                            await tx.postOfficeField.create({
                                data: {
                                    name: field.name,
                                    value: field.value,
                                    type: "TEXT",
                                    postOfficeId: editRequest.postOfficeId,
                                }
                            });
                        }
                    }
                }

                // Mark request as approved
                await tx.editRequest.update({
                    where: { id: requestId },
                    data: { status: "APPROVED" }
                });
            });

            await sendEditRequestApprovedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                editRequest.postOffice.name
            );

            return NextResponse.json({ success: true, message: "Request approved and applied successfully" });
        }

    } catch (error: any) {
        console.error("Moderation API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
