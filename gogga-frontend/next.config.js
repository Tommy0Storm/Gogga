/** @type {import('next').NextConfig} */

const webpack = require('webpack');

// Use localhost for dev, backend for Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Next.js 16: Partial Prerendering with cacheComponents (replaces experimental.ppr)
  cacheComponents: true,
  // React 19.2: Enable React Compiler for automatic memoization
  // Eliminates need for manual useMemo/useCallback, 10-15% faster renders
  reactCompiler: true,
  // Allow dev requests from any origin (for Docker/remote development)
  // Next.js: hostnames without protocol - no wildcards supported
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.241.135.171',   // Remote dev machine
    '192.168.0.168',    // Local network access
    '192.168.0.101',
    '192.168.0.102',
    '192.168.0.103',
    '192.168.0.104',
    '192.168.0.105',
  ],
  // Disable the Next.js dev indicator (floating N button)
  devIndicators: false,
  // Turbopack configuration (equivalent to webpack config below)
  turbopack: {
    resolveAlias: {
      // Explicitly use the web/browser build for @huggingface/transformers
      '@huggingface/transformers': {
        browser: '@huggingface/transformers/dist/transformers.js',
      },
      // Disable Node.js-only packages with browser condition - point to empty module
      sharp: { browser: './src/empty.ts' },
      'onnxruntime-node': { browser: './src/empty.ts' },
      // Node.js polyfills - use browser condition to point to empty module
      fs: { browser: './src/empty.ts' },
      path: { browser: './src/empty.ts' },
      crypto: { browser: './src/empty.ts' },
    },
  },
  // Next.js 16: Enable Turbopack filesystem caching (Phase 1)
  // Persists compiled modules between dev server restarts
  // Provides 10x faster cold starts after initial compilation
  experimental: {
    turbopackFileSystemCacheForDev: true, // Enable filesystem caching
  },
  // Set correct workspace root to avoid lockfile detection issues
  outputFileTracingRoot: __dirname,
  // Image optimization configuration
  images: {




    // Next.js 16: Use remotePatterns instead of deprecated domains
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**', // Allow any HTTPS domain for external images
      },
    ],
    // Disable optimization for data URLs (generated images)
    unoptimized: false,
    // Modern formats with webp first for better compatibility
    formats: ['image/webp', 'image/avif'],
    // Optimized device sizes for SA market (mobile-first)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    return [
      // Proxy backend API routes EXCEPT:
      // - auth (handled by NextAuth)
      // - chat (handled by app/api/v1/chat/route.ts with extended timeout)
      {
        source: '/api/v1/images/:path*',
        destination: `${BACKEND_URL}/api/v1/images/:path*`,
      },
      {
        source: '/api/v1/payments/:path*',
        destination: `${BACKEND_URL}/api/v1/payments/:path*`,
      },
      {
        source: '/api/v1/tools/:path*',
        destination: `${BACKEND_URL}/api/v1/tools/:path*`,
      },
      {
        source: '/api/v1/tools',
        destination: `${BACKEND_URL}/api/v1/tools`,
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  // Configure webpack for client-side transformers.js
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const path = require('path');

      // Force browser builds by removing 'node' condition
      config.resolve.conditionNames = [
        'browser',
        'import',
        'module',
        'default',
      ];

      // Explicitly alias @huggingface/transformers to the web build
      // This bypasses package.json exports that prefer transformers.node.mjs
      config.resolve.alias = {
        ...config.resolve.alias,
        '@huggingface/transformers': path.join(
          __dirname,
          'node_modules/@huggingface/transformers/dist/transformers.web.js'
        ),
        // Disable Node.js-only packages
        sharp$: false,
        'onnxruntime-node$': false,
      };

      // Node.js polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };

      // Ignore .node binary files
      config.module.rules.push({
        test: /\.node$/,
        loader: 'null-loader',
      });
    }

    return config;
  },
  // Externalize these packages for server components (Next.js 15 moved this out of experimental)
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
};

module.exports = nextConfig;
