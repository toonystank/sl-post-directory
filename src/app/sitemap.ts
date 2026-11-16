import { MetadataRoute } from 'next';
import { hasDatabaseUrl, prisma } from '@/lib/prisma';
import { getAllPosts } from '@/lib/blog';
import { loadLocalOffices } from '@/lib/local-sqlite';

async function getSitemapOffices(): Promise<{ slug: string; updatedAt: Date }[]> {
  if (!hasDatabaseUrl) {
    return loadLocalOffices().map((o) => ({ slug: o.slug, updatedAt: o.updatedAt }));
  }
  try {
    return await prisma.postOffice.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
    });
  } catch {
    return loadLocalOffices().map((o) => ({ slug: o.slug, updatedAt: o.updatedAt }));
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://lankapost.vercel.app';

  // Fetch all post offices (with local SQLite fallback when DATABASE_URL is unavailable)
  const postOffices = await getSitemapOffices();

  const officeUrls: MetadataRoute.Sitemap = postOffices.map((office) => ({
    url: `${baseUrl}/office/${office.slug}`,
    lastModified: office.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Blog posts
  const posts = await getAllPosts();
  const blogUrls: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/browse`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/calculator`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    ...blogUrls,
    ...officeUrls,
  ];
}
