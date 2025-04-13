import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  typescript: {
    // !! WARN !!
    // Turning this off will disable TypeScript type checking
    ignoreBuildErrors: true,
  },
  eslint: {
    // Turning this off will disable ESLint checking
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
