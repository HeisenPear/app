import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // Lint is run separately in CI; do not block production builds on it
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keep heavy Node-only parsing libs out of the bundler so they load
  // correctly at runtime in the Node.js serverless functions.
  serverExternalPackages: ['exceljs'],
}

export default nextConfig
