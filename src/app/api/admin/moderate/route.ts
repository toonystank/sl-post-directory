import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { invalidateOfficeIndexCache } from "@/lib/server-caches";
import { generateSlug } from "@/lib/utils";
import { sendEditRequestApprovedEmail, sendEditRequestRejectedEmail, sendEditRequestMoreInfoEmail } from "@/lib/email";

interface EditChangeField {
    name?: string;
    value?: string;
}

interface ParsedEditChanges {
    name?: string;
    postalCode?: string;
    fields?: EditChangeField[];
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; role?: string } | undefined;

        if (!session || !user?.id || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN" && user?.role !== "MODERATOR")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as { requestId?: string; action?: string };
        const { requestId, action } = body;

        if (!requestId || !action || !["APPROVE", "REJECT", "MORE_INFO"].includes(action)) {
            return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
        }

        const editRequest = await prisma.editRequest.findUnique({
            where: { id: requestId },
            include: {
                postOffice: true,
                requestedBy: true,
            },
        });

        if (!editRequest) {
            return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
        }

        const parsedChanges = JSON.parse(editRequest.changes || "{}") as ParsedEditChanges;
        const officeName = editRequest.postOffice?.name || parsedChanges.name || "New Post Office";

        if (editRequest.status !== "PENDING" && editRequest.status !== "MORE_INFO") {
            return NextResponse.json({ error: "Request is already processed" }, { status: 400 });
        }

        if (action === "REJECT") {
            await prisma.editRequest.update({
                where: { id: requestId },
                data: { status: "REJECTED" },
            });

            await prisma.actionLog.create({
                data: {
                    userId: user.id,
                    action: "REJECTED_EDIT",
                    details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                },
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
                data: { status: "MORE_INFO" },
            });

            await prisma.actionLog.create({
                data: {
                    userId: user.id,
                    action: "REQUESTED_MORE_INFO",
                    details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                },
            });

            await sendEditRequestMoreInfoEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Requested more info successfully" });
        }

        if (action === "APPROVE") {
            let affectedSlug = editRequest.postOffice?.slug;

            await prisma.$transaction(async (tx) => {
                if (editRequest.type === "REMOVAL") {
                    if (editRequest.postOfficeId) {
                        const targetOfficeId = editRequest.postOfficeId;
                        await tx.postOffice.updateMany({
                            where: { controllingOfficeId: targetOfficeId },
                            data: { controllingOfficeId: null },
                        });
                        await tx.user.updateMany({
                            where: { postOfficeId: targetOfficeId },
                            data: { postOfficeId: null },
                        });
                        await tx.editRequest.updateMany({
                            where: { postOfficeId: targetOfficeId },
                            data: { postOfficeId: null },
                        });
                        await tx.postOffice.delete({
                            where: { id: targetOfficeId },
                        });
                    }
                } else if (editRequest.type === "ADD") {
                    const addName = parsedChanges.name || "Post Office";
                    const addPostalCode = parsedChanges.postalCode || "";
                    const baseSlug = generateSlug(addName);
                    const existingSlug = await tx.postOffice.findUnique({
                        where: { slug: baseSlug },
                        select: { id: true },
                    });
                    const finalSlug = existingSlug
                        ? `${baseSlug}-${addPostalCode.trim().toLowerCase() || Date.now().toString(36)}`
                        : baseSlug;

                    const newOffice = await tx.postOffice.create({
                        data: {
                            name: addName,
                            slug: finalSlug,
                            postalCode: addPostalCode,
                            fields: {
                                create:
                                    parsedChanges.fields
                                        ?.filter((f): f is { name: string; value: string } => Boolean(f?.name && typeof f.value === "string"))
                                        .map((field) => ({
                                            name: field.name,
                                            value: field.value,
                                            type: "TEXT",
                                        })) || [],
                            },
                        },
                    });
                    affectedSlug = newOffice.slug;

                    await tx.editRequest.update({
                        where: { id: requestId },
                        data: { postOfficeId: newOffice.id },
                    });
                } else {
                    if (!editRequest.postOfficeId) throw new Error("Missing postOfficeId for edit request");

                    await tx.postOffice.update({
                        where: { id: editRequest.postOfficeId },
                        data: {
                            name: parsedChanges.name || editRequest.postOffice?.name,
                            postalCode: parsedChanges.postalCode || editRequest.postOffice?.postalCode,
                        },
                    });

                    if (parsedChanges.fields && Array.isArray(parsedChanges.fields) && parsedChanges.fields.length > 0) {
                        const existingFields = await tx.postOfficeField.findMany({
                            where: { postOfficeId: editRequest.postOfficeId },
                            select: { id: true, name: true },
                        });
                        const existingByName = new Map(existingFields.map((f) => [f.name, f.id]));

                        const updates: Promise<unknown>[] = [];
                        const toCreate: { name: string; value: string; type: string; postOfficeId: string }[] = [];

                        for (const field of parsedChanges.fields) {
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

                await tx.editRequest.update({
                    where: { id: requestId },
                    data: { status: "APPROVED" },
                });

                await tx.actionLog.create({
                    data: {
                        userId: user.id!,
                        action: "APPROVED_EDIT",
                        details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                    },
                });
            });

            invalidateOfficeIndexCache();
            revalidatePath("/");
            revalidatePath("/browse");
            if (affectedSlug) {
                revalidatePath(`/office/${affectedSlug}`);
                revalidatePath(`/si/office/${affectedSlug}`);
                revalidatePath(`/ta/office/${affectedSlug}`);
            }

            await sendEditRequestApprovedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Request approved and applied successfully" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error: unknown) {
        console.error("Moderation API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
