import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { blogPostInputSchema } from "@/lib/validations";

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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const post = await prisma.blogPost.findUnique({ where: { id } });
        if (!post) {
            return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }
        return NextResponse.json(post, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Error loading blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
        const existing = await prisma.blogPost.findUnique({
            where: { id },
            select: { slug: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "Article not found" }, { status: 404 });
        }

        const body = await req.json();
        const parsed = blogPostInputSchema.partial().safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid update payload" },
                { status: 400 }
            );
        }

        const {
            title,
            slug,
            excerpt,
            contentHtml,
            tags,
            published,
            category,
            coverImage,
            coverCaption,
            featured,
            sourceUrl,
            author,
        } = parsed.data;

        let cleanSlug: string | undefined;
        if (slug !== undefined) {
            cleanSlug = slug
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-]+/g, "-")
                .replace(/^-+|-+$/g, "");
            if (!cleanSlug) {
                return NextResponse.json({ error: "Invalid URL slug" }, { status: 400 });
            }
        }

        let cleanHtml: string | undefined;
        let readingTime: number | undefined;
        if (contentHtml !== undefined) {
            cleanHtml = sanitizeRichHtml(contentHtml);
            const strippedText = cleanHtml.replace(/<[^>]*>?/gm, "");
            const words = strippedText.split(/\s+/).filter(Boolean).length;
            readingTime = Math.max(1, Math.ceil(words / 200));
        }

        const post = await prisma.blogPost.update({
            where: { id },
            data: {
                ...(title !== undefined && { title }),
                ...(cleanSlug !== undefined && { slug: cleanSlug }),
                ...(excerpt !== undefined && { excerpt }),
                ...(cleanHtml !== undefined && { contentHtml: cleanHtml }),
                ...(readingTime !== undefined && { readingTime }),
                ...(tags !== undefined && { tags }),
                ...(typeof published === "boolean" && { published }),
                ...(category !== undefined && { category }),
                ...(coverImage !== undefined && { coverImage }),
                ...(coverCaption !== undefined && { coverCaption: coverCaption?.trim() || null }),
                ...(typeof featured === "boolean" && { featured }),
                ...(sourceUrl !== undefined && { sourceUrl }),
                ...(author !== undefined && { author }),
            },
        });

        revalidateBlogRoutes(post.slug);
        if (existing.slug !== post.slug) {
            revalidateBlogRoutes(existing.slug);
        }

        return NextResponse.json(post);
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
        }
        console.error("Error updating blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
