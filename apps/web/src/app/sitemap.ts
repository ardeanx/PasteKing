import type { MetadataRoute } from 'next';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  let pasteEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/v1/pastes/sitemap-feed?limit=5000`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const body = await res.json();
      const entries: { id: string; updatedAt: string }[] = body.data ?? [];
      pasteEntries = entries.map((entry) => ({
        url: `${SITE_URL}/p/${entry.id}`,
        lastModified: new Date(entry.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch {
    // sitemap generation is non-critical
  }

  return [...staticPages, ...pasteEntries];
}
