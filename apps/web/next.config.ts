import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pasteking/sdk', '@pasteking/types', '@pasteking/validation'],
  poweredByHeader: false,
  compress: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
    {
      source: '/sitemap.xml',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' }],
    },
    {
      source: '/robots.txt',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' }],
    },
  ],
};

export default nextConfig;
