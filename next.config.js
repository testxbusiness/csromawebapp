// next.config.js
/** @type {import('next').NextConfig} */
const path = require('path')
const { withSentryConfig } = require('@sentry/nextjs/config')

// ricava l'hostname di Supabase dalla env (fallback al placeholder)
const SUPABASE_HOST =
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : '<PROJECT_REF>.supabase.co'

const nextConfig = {
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT:
      process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_RELEASE:
      process.env.SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || '',
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  outputFileTracingRoot: process.cwd(),

  images: {
    // se ti serve ancora caricare da localhost in dev, lascialo
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: SUPABASE_HOST,
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000,
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },

  // Alias stabile per "@/..." anche lato webpack
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),
    }
    return config
  },

  // In produzione rimuovi i console.* ma conserva warn/error per il debug
  // Questo evita che i log importanti (es. ResetPasswordForm) vengano soppressi nei deploy
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    excludeServerRoutes: ['/api/sentry-source-map-check'],
  },
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
})
