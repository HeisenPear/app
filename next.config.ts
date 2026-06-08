import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Vercel deployment configuration
  output: 'standalone',
  // Lint is run separately in CI; do not block production builds on it
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
