import fs from "fs";
import path from "path";
import { cache } from "react";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import type { BlogPost } from "@prisma/client";

// Keep this type for backward compatibility where needed, 
// though we now use Prisma's BlogPost type natively
export type { BlogPost };

export const BLOG_CATEGORIES = ["NEWS", "ALERT", "TARIFF", "GUIDE"] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export function normalizeBlogCategory(raw?: string | null): BlogCategory {
    const upper = String(raw || "").trim().toUpperCase();
    if (upper === "NEWS" || upper === "ALERT" || upper === "TARIFF" || upper === "GUIDE") {
        return upper;
    }
    return "GUIDE";
}

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");

export function calculateReadingTime(text: string): number {
    // Strip HTML tags for word count
    const strippedText = text.replace(/<[^>]*>?/gm, '');
    const words = strippedText.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

export interface FrontmatterData {
    title?: string;
    excerpt?: string;
    date?: string;
    author?: string;
    tags?: string[];
    category?: string;
    coverImage?: string;
    coverCaption?: string;
    featured?: string;
    sourceUrl?: string;
    [key: string]: string | string[] | undefined;
}

// Keep the old markdown function only for the migration script
export function parseFrontmatter(fileContent: string): { data: FrontmatterData; content: string } {
    const match = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return { data: {}, content: fileContent };

    const frontmatter = match[1];
    const content = match[2].trim();
    const data: FrontmatterData = {};

    for (const line of frontmatter.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let value = line.slice(colonIdx + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (value.startsWith("[") && value.endsWith("]")) {
            data[key] = value
                .slice(1, -1)
                .split(",")
                .map(s => s.trim().replace(/^["']|["']$/g, ""));
        } else {
            data[key] = value;
        }
    }

    return { data, content };
}

export function markdownToHtml(markdown: string): string {
    let html = markdown;
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold mt-8 mb-3 text-foreground">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-10 mb-4 text-foreground">$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
        const trimmed = href.trim();
        const isSafe =
            trimmed.startsWith("/") ||
            trimmed.startsWith("#") ||
            /^https?:\/\//i.test(trimmed);
        if (!isSafe) return label;
        const safeHref = trimmed.replace(/"/g, "&quot;");
        return `<a href="${safeHref}" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-6 my-4 space-y-1 text-muted-foreground">${match}</ul>`);
    
    const blocks = html.split(/\n\n+/);
    html = blocks
        .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return "";
            if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<ol") || trimmed.startsWith("<li")) {
                return trimmed;
            }
            return `<p class="mb-4 text-muted-foreground leading-relaxed">${trimmed}</p>`;
        })
        .join("\n");

    return sanitizeRichHtml(html);
}

// --- LOCAL MARKDOWN FALLBACK & DATABASE FETCHING LOGIC ---

function getLocalMarkdownPosts(): BlogPost[] {
    if (!fs.existsSync(CONTENT_DIR)) {
        return [];
    }

    try {
        const files = fs
            .readdirSync(CONTENT_DIR)
            .filter((file) => file.endsWith(".md"));

        const posts = files.map((file): BlogPost => {
            const slug = file.replace(/\.md$/, "");
            const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
            const { data, content } = parseFrontmatter(raw);
            const htmlContent = markdownToHtml(content);
            const dateStr = typeof data.date === "string" && data.date ? data.date : "2026-01-01";
            const parsedDate = new Date(dateStr);
            const validDate = Number.isNaN(parsedDate.getTime())
                ? new Date("2026-01-01T00:00:00Z")
                : parsedDate;
            const tags = Array.isArray(data.tags)
                ? data.tags.map(String).filter(Boolean)
                : [];

            return {
                id: `local-${slug}`,
                slug,
                title: String(data.title || slug.replace(/-/g, " ")),
                excerpt: String(data.excerpt || ""),
                date: validDate,
                author: String(data.author || "SL Post Directory Team"),
                tags,
                contentHtml: htmlContent,
                readingTime: calculateReadingTime(htmlContent),
                published: true,
                category: normalizeBlogCategory(typeof data.category === "string" ? data.category : undefined),
                coverImage: typeof data.coverImage === "string" && data.coverImage ? data.coverImage : null,
                coverCaption: typeof data.coverCaption === "string" && data.coverCaption ? data.coverCaption : null,
                featured: String(data.featured || "").toLowerCase() === "true",
                sourceUrl: typeof data.sourceUrl === "string" && data.sourceUrl ? data.sourceUrl : null,
                createdAt: validDate,
                updatedAt: validDate,
            };
        });

        return posts.sort((a, b) => {
            if (a.featured !== b.featured) return a.featured ? -1 : 1;
            return b.date.getTime() - a.date.getTime();
        });
    } catch {
        return [];
    }
}

export async function getAllPosts(): Promise<BlogPost[]> {
    if (!hasDatabaseUrl) {
        return getLocalMarkdownPosts();
    }

    try {
        const posts = await prisma.blogPost.findMany({
            where: { published: true },
            orderBy: [{ featured: "desc" }, { date: "desc" }],
        });
        return posts.length > 0 ? posts : getLocalMarkdownPosts();
    } catch {
        return getLocalMarkdownPosts();
    }
}

export const getPostBySlug = cache(async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    if (!hasDatabaseUrl) {
        return getLocalMarkdownPosts().find((post) => post.slug === slug && post.published) ?? null;
    }

    try {
        const post = await prisma.blogPost.findFirst({
            where: { slug, published: true },
        });
        return post ?? getLocalMarkdownPosts().find((p) => p.slug === slug && p.published) ?? null;
    } catch {
        return getLocalMarkdownPosts().find((post) => post.slug === slug && post.published) ?? null;
    }
});

export async function getLatestPosts(count: number): Promise<BlogPost[]> {
    if (!hasDatabaseUrl) {
        return getLocalMarkdownPosts().slice(0, count);
    }

    try {
        const posts = await prisma.blogPost.findMany({
            where: { published: true },
            orderBy: [{ featured: "desc" }, { date: "desc" }],
            take: count,
        });
        return posts.length > 0 ? posts : getLocalMarkdownPosts().slice(0, count);
    } catch {
        return getLocalMarkdownPosts().slice(0, count);
    }
}

export async function getFeaturedAlert(): Promise<BlogPost | null> {
    const localFallback = () =>
        getLocalMarkdownPosts().find((post) => post.published && post.featured && post.category === "ALERT") ?? null;

    if (!hasDatabaseUrl) {
        return localFallback();
    }

    try {
        const alert = await prisma.blogPost.findFirst({
            where: { published: true, featured: true, category: "ALERT" },
            orderBy: { date: "desc" },
        });
        return alert ?? localFallback();
    } catch {
        return localFallback();
    }
}
