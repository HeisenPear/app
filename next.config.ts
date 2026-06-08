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
  // Keep heavy native/Node-only parsing libs out of the bundler so they load
  // correctly at runtime in the Node.js serverless functions.
  serverExternalPackages: ['pdf-parse', 'exceljs'],
}

export default nextConfig
