import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getAllPosts } from '@/lib/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://postagedirectory.vercel.app';

  // Fetch all post offices
  const postOffices = await prisma.postOffice.findMany({
    select: {
      id: true,
      updatedAt: true,
    },
  });

  const officeUrls: MetadataRoute.Sitemap = postOffices.map((office) => ({
    url: `${baseUrl}/office/${office.id}`,
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
    ...blogUrls,
    ...officeUrls,
  ];
}
