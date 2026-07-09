import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { parseFrontmatter, markdownToHtml, calculateReadingTime } from "@/lib/blog";

export async function POST() {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;

    if (!session || !["SUPER_ADMIN", "ADMIN"].includes(userRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const contentDir = path.join(process.cwd(), "src", "content", "blog");
        if (!fs.existsSync(contentDir)) {
            return NextResponse.json({ error: "Content directory not found" }, { status: 404 });
        }

        const files = fs.readdirSync(contentDir).filter(f => f.endsWith(".md"));
        let migratedCount = 0;

        for (const filename of files) {
            const filePath = path.join(contentDir, filename);
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const slug = filename.replace(/\.md$/, "");

            const { data, content } = parseFrontmatter(fileContent);
            const htmlContent = markdownToHtml(content);

            const existing = await prisma.blogPost.findUnique({ where: { slug } });
            
            if (!existing) {
                await prisma.blogPost.create({
                    data: {
                        slug,
                        title: data.title || slug,
                        excerpt: data.excerpt || "",
                        date: data.date ? new Date(data.date) : new Date(),
                        author: data.author || "Unknown",
                        tags: Array.isArray(data.tags) ? data.tags : [],
                        contentHtml: htmlContent,
                        readingTime: calculateReadingTime(content),
                        published: true
                    }
                });
                migratedCount++;
            }
        }

        return NextResponse.json({ success: true, migratedCount });
    } catch (error) {
        console.error("Migration error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
