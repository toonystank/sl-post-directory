import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

function revalidateBlogRoutes(slug?: string) {
    revalidatePath("/");
    revalidatePath("/si");
    revalidatePath("/ta");
    revalidatePath("/blog");
    revalidatePath("/si/blog");
    revalidatePath("/ta/blog");
    if (slug) {
        revalidatePath(`/blog/${slug}`);
        revalidatePath(`/si/blog/${slug}`);
        revalidatePath(`/ta/blog/${slug}`);
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = (await req.json()) as {
            title?: string;
            slug?: string;
            excerpt?: string;
            contentHtml?: string;
            tags?: string[];
            published?: boolean;
        };
        const { title, slug, excerpt, contentHtml, tags, published } = body;

        const cleanHtml = sanitizeRichHtml(contentHtml || "");
        const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") : undefined;

        // Calculate reading time
        const strippedText = cleanHtml.replace(/<[^>]*>?/gm, "");
        const words = strippedText.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        const post = await prisma.blogPost.update({
            where: { id },
            data: {
                ...(title !== undefined && { title: title.trim() }),
                ...(cleanSlug && { slug: cleanSlug }),
                ...(excerpt !== undefined && { excerpt: excerpt.trim() }),
                contentHtml: cleanHtml,
                ...(Array.isArray(tags) && { tags: tags.map((t) => String(t).trim()).filter(Boolean) }),
                ...(typeof published === "boolean" && { published }),
                readingTime,
            },
        });

        revalidateBlogRoutes(post.slug);

        return NextResponse.json(post);
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
        }
        console.error("Error updating blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const deleted = await prisma.blogPost.delete({ where: { id } });
        revalidateBlogRoutes(deleted.slug);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
