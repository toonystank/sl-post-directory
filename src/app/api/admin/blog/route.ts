import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth-guard";
import { verifySameOrigin } from "@/lib/csrf";
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

export async function GET(req: NextRequest) {
    const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
    if (!auth.ok) {
        return auth.response;
    }

    const searchParams = req.nextUrl.searchParams;
    const summaryOnly = searchParams.get("summary") === "1";
    const category = searchParams.get("category")?.trim().toUpperCase();
    const status = searchParams.get("status")?.trim().toLowerCase();
    const q = searchParams.get("q")?.trim().slice(0, 100);

    const where: Prisma.BlogPostWhereInput = {};
    if (category && ["NEWS", "ALERT", "TARIFF", "GUIDE"].includes(category)) {
        where.category = category;
    }
    if (status === "published") {
        where.published = true;
    } else if (status === "draft") {
        where.published = false;
    }
    if (q) {
        where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
        ];
    }

    try {
        const orderBy: Prisma.BlogPostOrderByWithRelationInput[] = [
            { featured: "desc" },
            { date: "desc" },
        ];

        const posts = summaryOnly
            ? await prisma.blogPost.findMany({
                  where,
                  select: {
                      id: true,
                      slug: true,
                      title: true,
                      excerpt: true,
                      date: true,
                      author: true,
                      tags: true,
                      readingTime: true,
                      published: true,
                      category: true,
                      coverImage: true,
                      coverCaption: true,
                      featured: true,
                      sourceUrl: true,
                      createdAt: true,
                      updatedAt: true,
                  },
                  orderBy,
              })
            : await prisma.blogPost.findMany({
                  where,
                  orderBy,
              });

        return NextResponse.json(posts, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const csrf = verifySameOrigin(req);
    if (!csrf.ok) {
        return NextResponse.json({ error: csrf.error }, { status: 403 });
    }

    const auth = await requireRole(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
    if (!auth.ok) {
        return auth.response;
    }

    try {
        const body = await req.json();
        const parsed = blogPostInputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || "Invalid article data" },
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

        const cleanSlug = slug
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        if (!cleanSlug) {
            return NextResponse.json({ error: "Invalid URL slug" }, { status: 400 });
        }

        const cleanHtml = sanitizeRichHtml(contentHtml);
        const strippedText = cleanHtml.replace(/<[^>]*>?/gm, "");
        const words = strippedText.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        const post = await prisma.blogPost.create({
            data: {
                title,
                slug: cleanSlug,
                excerpt,
                contentHtml: cleanHtml,
                tags,
                published,
                category,
                coverImage: coverImage ?? null,
                coverCaption: coverCaption?.trim() || null,
                featured,
                sourceUrl: sourceUrl ?? null,
                author: author || auth.user.name || "Admin",
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
