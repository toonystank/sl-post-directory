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

export async function GET() {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const posts = await prisma.blogPost.findMany({
            orderBy: { date: "desc" },
        });
        return NextResponse.json(posts, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as { role?: string } | undefined)?.role;

    if (!session || !userRole || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await req.json()) as {
            title?: string;
            slug?: string;
            excerpt?: string;
            contentHtml?: string;
            tags?: string[];
            published?: boolean;
        };
        const { title, slug, excerpt, contentHtml, tags, published } = body;

        if (!title?.trim() || !slug?.trim() || !contentHtml?.trim()) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        if (!cleanSlug) {
            return NextResponse.json({ error: "Invalid URL slug" }, { status: 400 });
        }

        const cleanHtml = sanitizeRichHtml(contentHtml);

        // Calculate reading time roughly from sanitized HTML
        const strippedText = cleanHtml.replace(/<[^>]*>?/gm, "");
        const words = strippedText.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        const post = await prisma.blogPost.create({
            data: {
                title: title.trim(),
                slug: cleanSlug,
                excerpt: excerpt?.trim() || "",
                contentHtml: cleanHtml,
                tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
                published: published ?? true,
                author: session.user?.name || "Admin",
                readingTime,
            },
        });

        revalidateBlogRoutes(post.slug);

        return NextResponse.json(post);
    } catch (error: unknown) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
            return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
        }
        console.error("Error creating blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
