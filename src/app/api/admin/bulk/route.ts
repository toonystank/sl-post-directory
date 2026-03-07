import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { officeIds, action, serviceQuery } = body;

        if (!officeIds || !Array.isArray(officeIds) || officeIds.length === 0) {
            return NextResponse.json({ error: "No offices selected" }, { status: 400 });
        }

        if (action === "delete") {
            await prisma.editRequest.deleteMany({
                where: { postOfficeId: { in: officeIds } }
            });

            await prisma.postOffice.deleteMany({
                where: { id: { in: officeIds } }
            });

            return NextResponse.json({ success: true, message: "Offices deleted" });
        }

        if (action === "add_service") {
            if (!serviceQuery) return NextResponse.json({ error: "Service tag required" }, { status: 400 });

            const offices = await prisma.postOffice.findMany({
                where: { id: { in: officeIds } },
                select: { id: true, services: true }
            });

            const updatePromises = offices.map((office) => {
                const currentServices = office.services || [];
                if (!currentServices.includes(serviceQuery)) {
                    return prisma.postOffice.update({
                        where: { id: office.id },
                        data: { services: [...currentServices, serviceQuery] }
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            return NextResponse.json({ success: true, message: "Services added" });
        }

        if (action === "remove_service") {
            if (!serviceQuery) return NextResponse.json({ error: "Service tag required" }, { status: 400 });

            const offices = await prisma.postOffice.findMany({
                where: { id: { in: officeIds } },
                select: { id: true, services: true }
            });

            const updatePromises = offices.map((office) => {
                const currentServices = office.services || [];
                if (currentServices.includes(serviceQuery)) {
                    return prisma.postOffice.update({
                        where: { id: office.id },
                        data: { services: currentServices.filter(s => s !== serviceQuery) }
                    });
                }
                return Promise.resolve();
            });

            await Promise.all(updatePromises);
            return NextResponse.json({ success: true, message: "Services removed" });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (error: any) {
        console.error("Admin Bulk Action Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
