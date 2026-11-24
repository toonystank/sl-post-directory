import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { invalidateOfficeIndexCache } from "@/lib/server-caches";
import { createOfficeSchema } from "@/lib/validations";
import { generateSlug } from "@/lib/utils";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();

        const validation = createOfficeSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error?.issues[0]?.message || "Invalid input" },
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
            ...fields
        } = validation.data;

        const dynamicFields: { name: string; value: string; type: string }[] = [];
        if (Array.isArray(customFields)) {
            for (const f of customFields) {
                if (f.name.trim() && f.value.trim()) {
                    dynamicFields.push({ name: f.name.trim(), value: f.value.trim(), type: "TEXT" });
                }
            }
        } else {
            for (const [key, value] of Object.entries(fields)) {
                if (key.startsWith("field_") && typeof value === "string" && value.trim() !== "") {
                    const fieldName = key.replace("field_", "");
                    dynamicFields.push({ name: fieldName, value: value.trim(), type: "TEXT" });
                }
            }
        }

        const baseSlug = generateSlug(name);
        const existingSlug = await prisma.postOffice.findUnique({ where: { slug: baseSlug }, select: { id: true } });
        const finalSlug = existingSlug ? `${baseSlug}-${postalCode.trim().toLowerCase()}` : baseSlug;

        const newOffice = await prisma.postOffice.create({
            data: {
                name,
                slug: finalSlug,
                postalCode,
                ...(operatingHours !== undefined && { operatingHours: operatingHours || null }),
                ...(services !== undefined && { services }),
                ...(rmsc !== undefined && { rmsc: rmsc || null }),
                ...(latitude !== undefined && { latitude }),
                ...(longitude !== undefined && { longitude }),
                fields: {
                    create: dynamicFields,
                },
            },
            include: {
                fields: true,
            },
        });

        invalidateOfficeIndexCache();
        revalidatePath("/");
        revalidatePath("/si");
        revalidatePath("/ta");
        revalidatePath("/browse");
        revalidatePath("/si/browse");
        revalidatePath("/ta/browse");
        revalidatePath(`/office/${newOffice.slug}`);
        revalidatePath(`/si/office/${newOffice.slug}`);
        revalidatePath(`/ta/office/${newOffice.slug}`);

        return NextResponse.json({ success: true, office: newOffice });
    } catch (error: unknown) {
        console.error("Admin Create Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
