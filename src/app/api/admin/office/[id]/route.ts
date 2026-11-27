import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { invalidateOfficeIndexCache } from "@/lib/server-caches";
import { extractValidatedDynamicFields, updateOfficeSchema } from "@/lib/validations";

function revalidateOfficeDirectory(slug?: string) {
    invalidateOfficeIndexCache();
    revalidatePath("/");
    revalidatePath("/si");
    revalidatePath("/ta");
    revalidatePath("/browse");
    revalidatePath("/si/browse");
    revalidatePath("/ta/browse");
    if (slug) {
        revalidatePath(`/office/${slug}`);
        revalidatePath(`/si/office/${slug}`);
        revalidatePath(`/ta/office/${slug}`);
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const auth = await requireRole(["ADMIN", "SUPER_ADMIN", "MODERATOR"]);
        if (!auth.ok) {
            return auth.response;
        }

        const office = await prisma.postOffice.findUnique({
            where: { id },
            include: {
                fields: true,
                controllingOffice: { select: { id: true, name: true, postalCode: true } },
                controlledOffices: { select: { id: true, name: true, postalCode: true } },
            },
        });

        if (!office) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }

        return NextResponse.json({ office }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Admin Get Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const { id } = await params;
        const auth = await requireRole(["ADMIN", "SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const body = await req.json();
        const parsed = updateOfficeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid office update payload" },
                { status: 400 }
            );
        }

        const {
            name,
            postalCode,
            operatingHours,
            services,
            rmsc,
            latitude,
            longitude,
            customFields,
            newFieldName,
            newFieldValue,
            controllingOfficeId,
            controlledOfficesIds,
            ...fields
        } = parsed.data;

        if (controllingOfficeId && controllingOfficeId === id) {
            return NextResponse.json({ error: "An office cannot be its own controlling office" }, { status: 400 });
        }

        const sanitizedChildIds = controlledOfficesIds?.filter((cid) => cid !== id);

        const newFields: { name: string; value: string; type: string; postOfficeId: string }[] = [];
        if (Array.isArray(customFields)) {
            for (const item of customFields) {
                if (item.name.trim() && item.value.trim()) {
                    newFields.push({
                        name: item.name.trim(),
                        value: item.value.trim(),
                        type: "TEXT",
                        postOfficeId: id,
                    });
                }
            }
        } else {
            try {
                for (const item of extractValidatedDynamicFields(fields, 50)) {
                    newFields.push({
                        name: item.name,
                        value: item.value,
                        type: "TEXT",
                        postOfficeId: id,
                    });
                }
            } catch (fieldErr) {
                return NextResponse.json(
                    { error: fieldErr instanceof Error ? fieldErr.message : "Invalid custom fields" },
                    { status: 400 }
                );
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            if (sanitizedChildIds !== undefined) {
                await tx.postOffice.updateMany({
                    where: { controllingOfficeId: id },
                    data: { controllingOfficeId: null },
                });
            }

            const updatedOffice = await tx.postOffice.update({
                where: { id },
                data: {
                    name,
                    postalCode,
                    ...(operatingHours !== undefined && { operatingHours: operatingHours || null }),
                    ...(services !== undefined && { services }),
                    ...(rmsc !== undefined && { rmsc: rmsc || null }),
                    ...(latitude !== undefined && { latitude }),
                    ...(longitude !== undefined && { longitude }),
                    ...(controllingOfficeId !== undefined && { controllingOfficeId: controllingOfficeId || null }),
                    ...(sanitizedChildIds !== undefined && {
                        controlledOffices: {
                            connect: sanitizedChildIds.map((childId) => ({ id: childId })),
                        },
                    }),
                },
            });

            await tx.postOfficeField.deleteMany({
                where: { postOfficeId: id },
            });

            if (newFields.length > 0) {
                await tx.postOfficeField.createMany({ data: newFields });
            }

            if (
                newFieldName &&
                typeof newFieldName === "string" &&
                newFieldName.trim() &&
                newFieldValue &&
                typeof newFieldValue === "string" &&
                newFieldValue.trim()
            ) {
                await tx.postOfficeField.create({
                    data: {
                        name: newFieldName.trim(),
                        value: newFieldValue.trim(),
                        type: "TEXT",
                        postOfficeId: id,
                    },
                });
            }

            return updatedOffice;
        });

        revalidateOfficeDirectory(result.slug);

        return NextResponse.json({ success: true, office: result });
    } catch (error: unknown) {
        console.error("Admin Edit Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const { id } = await params;
        const auth = await requireRole(["ADMIN", "SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const deletedSlug = await prisma.$transaction(async (tx) => {
            const existing = await tx.postOffice.findUnique({ where: { id }, select: { slug: true } });
            if (!existing) return null;

            await tx.postOffice.updateMany({
                where: { controllingOfficeId: id },
                data: { controllingOfficeId: null },
            });
            await tx.user.updateMany({
                where: { postOfficeId: id },
                data: { postOfficeId: null },
            });
            await tx.editRequest.deleteMany({
                where: { postOfficeId: id },
            });
            await tx.postOffice.delete({
                where: { id },
            });

            return existing.slug;
        });

        if (!deletedSlug) {
            return NextResponse.json({ error: "Post office not found" }, { status: 404 });
        }

        revalidateOfficeDirectory(deletedSlug);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Admin Delete Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
