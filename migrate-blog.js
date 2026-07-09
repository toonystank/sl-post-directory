const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function calculateReadingTime(text) {
    const strippedText = text.replace(/<[^>]*>?/gm, '');
    const words = strippedText.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function parseFrontmatter(fileContent) {
    const match = fileContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return { data: {}, content: fileContent };

    const frontmatter = match[1];
    const content = match[2].trim();
    const data = {};

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

function markdownToHtml(markdown) {
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

async function main() {
    const contentDir = path.join(process.cwd(), "src", "content", "blog");
    if (!fs.existsSync(contentDir)) {
        console.log("Content directory not found");
        return;
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
    console.log(`Migrated ${migratedCount} posts.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
