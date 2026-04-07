import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@pasteking/sdk', '@pasteking/types', '@pasteking/validation'],
};

export default nextConfig;
