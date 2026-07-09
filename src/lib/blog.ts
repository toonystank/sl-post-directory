import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import type { BlogPost } from "@prisma/client";

// Keep this type for backward compatibility where needed, 
// though we now use Prisma's BlogPost type natively
export type { BlogPost };

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "blog");

export function calculateReadingTime(text: string): number {
    // Strip HTML tags for word count
    const strippedText = text.replace(/<[^>]*>?/gm, '');
    const words = strippedText.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

// Keep the old markdown function only for the migration script
export function parseFrontmatter(fileContent: string): { data: Record<string, any>; content: string } {
    const match = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return { data: {}, content: fileContent };

    const frontmatter = match[1];
    const content = match[2].trim();
    const data: Record<string, any> = {};

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
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
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

    return html;
}

// --- NEW DATABASE FETCHING LOGIC ---

export async function getAllPosts(): Promise<BlogPost[]> {
    try {
        return await prisma.blogPost.findMany({
            where: { published: true },
            orderBy: { date: 'desc' }
        });
    } catch (error) {
        console.error("Error fetching all posts:", error);
        return [];
    }
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
        return await prisma.blogPost.findUnique({
            where: { slug }
        });
    } catch (error) {
        console.error(`Error fetching post ${slug}:`, error);
        return null;
    }
}

export async function getLatestPosts(count: number): Promise<BlogPost[]> {
    try {
        return await prisma.blogPost.findMany({
            where: { published: true },
            orderBy: { date: 'desc' },
            take: count
        });
    } catch (error) {
        console.error("Error fetching latest posts:", error);
        return [];
    }
}
