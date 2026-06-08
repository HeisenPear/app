import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Vercel deployment configuration
  output: 'standalone',
}

export default nextConfig
