import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { invalidateOfficeIndexCache } from "@/lib/server-caches";
import { generateSlug } from "@/lib/utils";
import { moderateRequestSchema } from "@/lib/validations";
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
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["ADMIN", "SUPER_ADMIN", "MODERATOR"]);
        if (!auth.ok) {
            return auth.response;
        }
        const user = auth.user;

        const body = await req.json();
        const parsedBody = moderateRequestSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: parsedBody.error.issues[0]?.message || "Invalid request parameters" },
                { status: 400 }
            );
        }

        const { requestId, action } = parsedBody.data;

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
        const boundedFields = Array.isArray(parsedChanges.fields)
            ? parsedChanges.fields
                  .filter(
                      (f): f is { name: string; value: string } =>
                          Boolean(f?.name && typeof f.name === "string" && typeof f.value === "string")
                  )
                  .slice(0, 50)
                  .map((f) => ({
                      name: f.name.trim().slice(0, 60),
                      value: f.value.trim().slice(0, 300),
                  }))
                  .filter((f) => f.name.length > 0 && f.value.length > 0)
            : [];
        const officeName = editRequest.postOffice?.name || parsedChanges.name || "New Post Office";

        if (editRequest.status !== "PENDING" && editRequest.status !== "MORE_INFO") {
            return NextResponse.json({ error: "Request is already processed" }, { status: 400 });
        }

        if (action === "REJECT") {
            const transition = await prisma.$transaction(async (tx) => {
                const updated = await tx.editRequest.updateMany({
                    where: { id: requestId, status: { in: ["PENDING", "MORE_INFO"] } },
                    data: { status: "REJECTED" },
                });
                if (updated.count !== 1) return false;

                await tx.actionLog.create({
                    data: {
                        userId: user.id,
                        action: "REJECTED_EDIT",
                        details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                    },
                });
                return true;
            });

            if (!transition) {
                return NextResponse.json({ error: "Request is already processed" }, { status: 409 });
            }

            await sendEditRequestRejectedEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Request rejected successfully" });
        }

        if (action === "MORE_INFO") {
            const transition = await prisma.$transaction(async (tx) => {
                const updated = await tx.editRequest.updateMany({
                    where: { id: requestId, status: { in: ["PENDING", "MORE_INFO"] } },
                    data: { status: "MORE_INFO" },
                });
                if (updated.count !== 1) return false;

                await tx.actionLog.create({
                    data: {
                        userId: user.id,
                        action: "REQUESTED_MORE_INFO",
                        details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                    },
                });
                return true;
            });

            if (!transition) {
                return NextResponse.json({ error: "Request is already processed" }, { status: 409 });
            }

            await sendEditRequestMoreInfoEmail(
                editRequest.requestedBy.email,
                editRequest.requestedBy.name,
                officeName
            );

            return NextResponse.json({ success: true, message: "Requested more info successfully" });
        }

        if (action === "APPROVE") {
            let affectedSlug = editRequest.postOffice?.slug;

            const approved = await prisma.$transaction(async (tx) => {
                const claimed = await tx.editRequest.updateMany({
                    where: { id: requestId, status: { in: ["PENDING", "MORE_INFO"] } },
                    data: { status: "APPROVED" },
                });
                if (claimed.count !== 1) return false;

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
                    const addName = (parsedChanges.name || "Post Office").trim().slice(0, 100);
                    const addPostalCode = (parsedChanges.postalCode || "").trim().slice(0, 20);
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
                                create: boundedFields.map((field) => ({
                                    name: field.name,
                                    value: field.value,
                                    type: "TEXT",
                                })),
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
                            name: (parsedChanges.name || editRequest.postOffice?.name || "").slice(0, 100),
                            postalCode: (parsedChanges.postalCode || editRequest.postOffice?.postalCode || "").slice(0, 20),
                        },
                    });

                    if (boundedFields.length > 0) {
                        const existingFields = await tx.postOfficeField.findMany({
                            where: { postOfficeId: editRequest.postOfficeId },
                            select: { id: true, name: true },
                        });
                        const existingByName = new Map(existingFields.map((f) => [f.name, f.id]));

                        const updates: Promise<unknown>[] = [];
                        const toCreate: { name: string; value: string; type: string; postOfficeId: string }[] = [];

                        for (const field of boundedFields) {
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
                                    name: field.name,
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

                await tx.actionLog.create({
                    data: {
                        userId: user.id,
                        action: "APPROVED_EDIT",
                        details: JSON.stringify({ requestId, type: editRequest.type, postOfficeName: officeName }),
                    },
                });
                return true;
            });

            if (!approved) {
                return NextResponse.json({ error: "Request is already processed" }, { status: 409 });
            }

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
