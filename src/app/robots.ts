import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/login', '/register', '/suggest/'],
    },
    sitemap: 'https://lankapost.vercel.app/sitemap.xml',
  };
}
