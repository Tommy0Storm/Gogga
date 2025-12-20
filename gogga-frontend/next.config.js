/** @type {import('next').NextConfig} */

const webpack = require('webpack');

// Use localhost for dev, backend for Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Next.js 16: DISABLED cacheComponents - causes race condition with Turbopack manifest writes
  // Re-enable once 16.1.1+ patch is released
  cacheComponents: false,
  // React 19.2: Enable React Compiler for automatic memoization
  // Eliminates need for manual useMemo/useCallback, 10-15% faster renders
  reactCompiler: true,
  // Allow dev requests from any origin (for Docker/remote development)
  // Next.js: hostnames without protocol - no wildcards supported
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.241.135.171',   // Remote dev machine
    '192.168.0.130',    // Primary dev host (LAN)
    '192.168.0.168',    // Local network access
    '192.168.0.101',
    '192.168.0.102',
    '192.168.0.103',
    '192.168.0.104',
    '192.168.0.105',
  ],
  // Disable the Next.js dev indicator (floating N button)
  devIndicators: false,
  // Turbopack configuration - use simple string aliases (not browser condition objects)
  turbopack: {
    resolveAlias: {
      // Disable Node.js-only packages - point to empty module
      // Note: @huggingface/transformers is in serverExternalPackages, no client alias needed
      sharp: './src/empty.ts',
      'onnxruntime-node': './src/empty.ts',
    },
  },
  // Webpack configuration for crypto polyfill
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // Workaround: webpack's PackFileCacheStrategy can hit ENOENT on some filesystems
      // (e.g. failing to rename/open `.pack.gz_` temp files). Disable FS cache in dev.
      config.cache = false;
    }

    if (!isServer) {
      // Polyfill crypto.subtle for RxDB in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
      };
      
      // Force browser builds by removing 'node' condition
      config.resolve.conditionNames = [
        'browser',
        'import',
        'module',
        'default',
      ];

      // Disable Node.js-only packages for client bundle
      // Note: @huggingface/transformers is in serverExternalPackages, no client alias needed
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
        'onnxruntime-node$': false,
      };
    }

    return config;
  },
  // Next.js 16: Let Turbopack filesystem caching use default (true) - required for proper manifest generation
  experimental: {
    // turbopackFileSystemCacheForDev: use default (true) - setting false breaks SST directory assumptions
    // Optimize large barrel-file imports (react-icons, lucide-react)
    // Note: @huggingface/transformers removed - conflicts with serverExternalPackages
    optimizePackageImports: ['react-icons', 'lucide-react'],
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
    ];
  },
  // Configure webpack for client-side transformers.js
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // Workaround: webpack's PackFileCacheStrategy can hit ENOENT on some filesystems
      // (e.g. failing to rename/open `.pack.gz_` temp files). Disable FS cache in dev.
      config.cache = false;
    }

    if (!isServer) {
      // Polyfill crypto.subtle for RxDB in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
      };
      
      // Force browser builds by removing 'node' condition
      config.resolve.conditionNames = [
        'browser',
        'import',
        'module',
        'default',
      ];

      // Disable Node.js-only packages for client bundle
      // Note: @huggingface/transformers is in serverExternalPackages, no client alias needed
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
        'onnxruntime-node$': false,
      };
    }

    // Suppress critical dependency warnings for unpdf (uses dynamic imports)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /unpdf/ },
    ];

    return config;
  },
  // Externalize these packages for server components (Next.js 15 moved this out of experimental)
  // Critical: @huggingface/transformers must be externalized to prevent bundling onnxruntime-node
  serverExternalPackages: ['sharp', 'onnxruntime-node', '@huggingface/transformers', 'unpdf'],
};

module.exports = nextConfig;
