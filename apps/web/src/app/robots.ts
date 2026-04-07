import type { MetadataRoute } from 'next';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function robots(): Promise<MetadataRoute.Robots> {
  let index = true;

  try {
    const res = await fetch(`${API_URL}/v1/settings/seo`, { next: { revalidate: 60 } });
    if (res.ok) {
      const body = await res.json();
      index = body.data?.robotsIndex ?? true;
    }
  } catch {
    // default to allowing indexing
  }

  if (!index) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/settings/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
