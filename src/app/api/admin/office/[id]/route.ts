import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name, postalCode, newFieldName, newFieldValue, ...fields } = body;

        // Start a transaction to safely update fields
        const result = await prisma.$transaction(async (tx) => {
            // Update the core office data
            const updatedOffice = await tx.postOffice.update({
                where: { id },
                data: { name, postalCode }
            });

            // Delete all existing fields
            await tx.postOfficeField.deleteMany({
                where: { postOfficeId: id }
            });

            // Re-insert dynamic fields
            const newFields: { name: string; value: string; type: string; postOfficeId: string }[] = [];
            for (const [key, value] of Object.entries(fields)) {
                if (key.startsWith("field_") && typeof value === 'string' && value.trim() !== '') {
                    const fieldName = key.replace("field_", "");
                    newFields.push({
                        name: fieldName,
                        value: value.trim(),
                        type: "TEXT",
                        postOfficeId: id
                    });
                }
            }

            if (newFields.length > 0) {
                await tx.postOfficeField.createMany({ data: newFields });
            }

            // Handle a potential new field addition
            if (newFieldName && typeof newFieldName === 'string' && newFieldName.trim() &&
                newFieldValue && typeof newFieldValue === 'string' && newFieldValue.trim()) {
                await tx.postOfficeField.create({
                    data: {
                        name: newFieldName.trim(),
                        value: newFieldValue.trim(),
                        type: "TEXT",
                        postOfficeId: id
                    }
                });
            }

            return updatedOffice;
        });

        return NextResponse.json({ success: true, office: result });

    } catch (error: any) {
        console.error("Admin Edit Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const user = session?.user as { role?: string } | undefined;

        if (!session || (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Prisma schema uses `onDelete: Cascade` for fields, but edit requests might need cleanup too
        // or also use cascade. Let's delete it directly.

        await prisma.editRequest.deleteMany({
            where: { postOfficeId: id }
        });

        await prisma.postOffice.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Admin Delete Office Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
