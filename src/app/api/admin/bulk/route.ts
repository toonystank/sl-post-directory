import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { invalidateOfficeIndexCache } from "@/lib/server-caches";
import { adminBulkSchema } from "@/lib/validations";

export async function POST(req: Request) {
    try {
        const csrf = verifySameOrigin(req);
        if (!csrf.ok) {
            return NextResponse.json({ error: csrf.error }, { status: 403 });
        }

        const auth = await requireRole(["ADMIN", "SUPER_ADMIN"]);
        if (!auth.ok) {
            return auth.response;
        }

        const body = await req.json();
        const parsed = adminBulkSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid bulk payload" },
                { status: 400 }
            );
        }

        const { officeIds, action, serviceQuery } = parsed.data;

        if (action === "delete") {
            await prisma.$transaction([
                prisma.postOffice.updateMany({
                    where: { controllingOfficeId: { in: officeIds } },
                    data: { controllingOfficeId: null },
                }),
                prisma.user.updateMany({
                    where: { postOfficeId: { in: officeIds } },
                    data: { postOfficeId: null },
                }),
                prisma.editRequest.deleteMany({
                    where: { postOfficeId: { in: officeIds } },
                }),
                prisma.postOffice.deleteMany({
                    where: { id: { in: officeIds } },
                }),
            ]);

            invalidateOfficeIndexCache();
            revalidatePath("/");
            revalidatePath("/browse");

            return NextResponse.json({ success: true, message: "Offices deleted" });
        }

        if (!serviceQuery) {
            return NextResponse.json({ error: "Service tag required" }, { status: 400 });
        }

        const offices = await prisma.postOffice.findMany({
            where: { id: { in: officeIds } },
            select: { id: true, slug: true, services: true },
        });

        if (action === "add_service") {
            const updates = offices
                .filter((office) => !(office.services || []).includes(serviceQuery))
                .map((office) =>
                    prisma.postOffice.update({
                        where: { id: office.id },
                        data: { services: [...(office.services || []), serviceQuery] },
                    })
                );

            if (updates.length > 0) {
                await prisma.$transaction(updates);
                invalidateOfficeIndexCache();
                revalidatePath("/browse");
            }

            return NextResponse.json({ success: true, message: "Services added" });
        }

        if (action === "remove_service") {
            const updates = offices
                .filter((office) => (office.services || []).includes(serviceQuery))
                .map((office) =>
                    prisma.postOffice.update({
                        where: { id: office.id },
                        data: { services: (office.services || []).filter((s) => s !== serviceQuery) },
                    })
                );

            if (updates.length > 0) {
                await prisma.$transaction(updates);
                invalidateOfficeIndexCache();
                revalidatePath("/browse");
            }

            return NextResponse.json({ success: true, message: "Services removed" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    } catch (error) {
        console.error("Admin Bulk Action Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
