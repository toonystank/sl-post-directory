import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { hasDatabaseUrl, prisma } from "@/lib/prisma";
import { normalizeBlogCategory } from "@/lib/blog";
import NewsStudioEditor from "@/components/admin/NewsStudioEditor";

interface SessionUser {
    name?: string | null;
    role?: string;
}

export default async function EditNewsDispatchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;

    if (!session || !["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(user?.role || "")) {
        redirect("/dashboard");
    }

    const post = hasDatabaseUrl
        ? await prisma.blogPost.findUnique({ where: { id } })
        : null;

    if (!post) {
        notFound();
    }

    return (
        <NewsStudioEditor
            defaultAuthor={user?.name || "Lanka Post Editorial"}
            initialPost={{
                id: post.id,
                slug: post.slug,
                title: post.title,
                excerpt: post.excerpt,
                contentHtml: post.contentHtml,
                tags: post.tags,
                published: post.published,
                category: normalizeBlogCategory(post.category),
                coverImage: post.coverImage,
                coverCaption: post.coverCaption || "",
                featured: post.featured,
                sourceUrl: post.sourceUrl || "",
                author: post.author,
            }}
        />
    );
}
