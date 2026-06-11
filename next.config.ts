//next.config.ts

import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  serverExternalPackages: [],
}

export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
})
