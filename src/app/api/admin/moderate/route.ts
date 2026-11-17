import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/lib/utils";
import { sendEditRequestApprovedEmail, sendEditRequestRejectedEmail, sendEditRequestMoreInfoEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string, role?: string } | undefined;

        if (!session || !user?.id || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
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

        const officeName = editRequest.postOffice?.name || JSON.parse(editRequest.changes || "{}").name || "New Post Office";

        if (editRequest.status !== "PENDING" && editRequest.status !== "MORE_INFO") {
            return NextResponse.json({ error: "Request is already processed" }, { status: 400 });
        }

        if (action === "REJECT") {
            await prisma.editRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED" }
            });

            await prisma.actionLog.create({
                data: {
                    userId: user.id!,
                    action: "REJECTED_EDIT",
                    details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName })
                }
            });

            await sendEditRequestRejectedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Request rejected successfully" });
        }

        if (action === "MORE_INFO") {
            await prisma.editRequest.update({
                where: { id: requestId },
                data: { status: "MORE_INFO" }
            });

            await prisma.actionLog.create({
                data: {
                    userId: user.id!,
                    action: "REQUESTED_MORE_INFO",
                    details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName })
                }
            });

            await sendEditRequestMoreInfoEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Requested more info successfully" });
        }

        if (action === "APPROVE") {
            const changes = JSON.parse(editRequest.changes);

            // Execute the approval in a transaction to ensure atomic updates
            await prisma.$transaction(async (tx) => {
                // @ts-ignore
                if (editRequest.type === "REMOVAL") {
                    if (editRequest.postOfficeId) {
                        await tx.postOffice.delete({
                            where: { id: editRequest.postOfficeId }
                        });
                    }
                    // @ts-ignore
                } else if (editRequest.type === "ADD") {
                    const newOffice = await tx.postOffice.create({
                        data: {
                            name: changes.name,
                            slug: generateSlug(changes.name),
                            postalCode: changes.postalCode,
                            fields: {
                                create: changes.fields?.map((field: any) => ({
                                    name: field.name,
                                    value: field.value,
                                    type: "TEXT"
                                })) || []
                            }
                        }
                    });

                    // Update the request with the new officeID
                    await tx.editRequest.update({
                        where: { id: requestId },
                        data: { postOfficeId: newOffice.id }
                    });
                } else {
                    // Default EDIT flow
                    if (!editRequest.postOfficeId) throw new Error("Missing postOfficeId for edit request");

                    // Update basic fields
                    await tx.postOffice.update({
                        where: { id: editRequest.postOfficeId },
                        data: {
                            name: changes.name || editRequest.postOffice?.name,
                            postalCode: changes.postalCode || editRequest.postOffice?.postalCode,
                        }
                    });

                    // Upsert only the changed fields — preserve untouched ones without N+1 queries
                    if (changes.fields && Array.isArray(changes.fields) && changes.fields.length > 0) {
                        const existingFields = await tx.postOfficeField.findMany({
                            where: { postOfficeId: editRequest.postOfficeId },
                            select: { id: true, name: true },
                        });
                        const existingByName = new Map(existingFields.map((f) => [f.name, f.id]));

                        const updates: Promise<unknown>[] = [];
                        const toCreate: { name: string; value: string; type: string; postOfficeId: string }[] = [];

                        for (const field of changes.fields) {
                            if (!field?.name || typeof field.value !== "string") continue;
                            const existingId = existingByName.get(field.name);
                            if (existingId) {
                                updates.push(
                                    tx.postOfficeField.update({
                                        where: { id: existingId },
                                        data: { value: field.value },
                                    })
                                );
                            } else {
                                toCreate.push({
                                    name: String(field.name),
                                    value: field.value,
                                    type: "TEXT",
                                    postOfficeId: editRequest.postOfficeId,
                                });
                            }
                        }

                        if (updates.length > 0) {
                            await Promise.all(updates);
                        }
                        if (toCreate.length > 0) {
                            await tx.postOfficeField.createMany({ data: toCreate });
                        }
                    }
                }

                // Mark request as approved
                await tx.editRequest.update({
                    where: { id: requestId },
                    data: { status: "APPROVED" }
                });

                // Log the approval action
                await tx.actionLog.create({
                    data: {
                        userId: user.id!,
                        action: "APPROVED_EDIT",
                        details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName })
                    }
                });
            });

            await sendEditRequestApprovedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Request approved and applied successfully" });
        }

    } catch (error: any) {
        console.error("Moderation API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
