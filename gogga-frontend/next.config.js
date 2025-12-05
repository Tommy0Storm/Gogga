/** @type {import('next').NextConfig} */

const webpack = require('webpack');

// Use localhost for dev, backend for Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow dev requests from any origin (for Docker/remote development)
  // Next.js: hostnames without protocol, supports wildcards
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1', 
    '192.168.0.*',  // Allow all local network IPs
    '10.*',         // Allow all 10.x.x.x IPs
    '*.local',
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
  // Set correct workspace root to avoid lockfile detection issues
  outputFileTracingRoot: __dirname,
  // Image optimization configuration
  images: {
    // Use default loader for local images
    // Add remote patterns if you need external images
    remotePatterns: [],
    // Disable optimization for data URLs (generated images)
    unoptimized: false,
    // Modern formats
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    return [
      // Proxy backend API routes EXCEPT auth (handled by NextAuth)
      {
        source: '/api/v1/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
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
