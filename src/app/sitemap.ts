import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

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

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...officeUrls,
  ];
}
