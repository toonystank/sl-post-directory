import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const posts = await prisma.blogPost.findMany({
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(posts);
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { title, slug, excerpt, contentHtml, tags, published } = body;

        if (!title || !slug || !contentHtml) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Calculate reading time roughly from HTML
        const strippedText = contentHtml.replace(/<[^>]*>?/gm, '');
        const words = strippedText.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(words / 200));

        const post = await prisma.blogPost.create({
            data: {
                title,
                slug,
                excerpt: excerpt || "",
                contentHtml,
                tags: tags || [],
                published: published ?? true,
                author: session.user?.name || "Admin",
                readingTime
            }
        });

        return NextResponse.json(post);
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
        }
        console.error("Error creating blog post:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
