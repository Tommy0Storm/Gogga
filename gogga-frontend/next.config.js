/** @type {import('next').NextConfig} */

const webpack = require('webpack');

// Use localhost for dev, backend for Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Next.js 16: DISABLED cacheComponents - causes race condition with Turbopack manifest writes
  cacheComponents: false,
  // React 19.2: Enable React Compiler for automatic memoization
  reactCompiler: true,
  // Allow dev requests from any origin (for Docker/remote development)
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.241.135.171',
    '192.168.0.130',
    '192.168.0.168',
    '192.168.0.101',
    '192.168.0.102',
    '192.168.0.103',
    '192.168.0.104',
    '192.168.0.105',
  ],
  // Disable the Next.js dev indicator
  devIndicators: false,
  // Turbopack configuration
  turbopack: {
    resolveAlias: {
      sharp: './src/empty.ts',
      'onnxruntime-node': './src/empty.ts',
    },
  },
  // Set correct workspace root
  outputFileTracingRoot: __dirname,
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: false,
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  experimental: {
    optimizePackageImports: ['react-icons', 'lucide-react'],
  },
  async rewrites() {
    return [
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
  // Configure webpack for client-side
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      config.cache = false;
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
      };
      
      config.resolve.conditionNames = [
        'browser',
        'import',
        'module',
        'default',
      ];

      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
        'onnxruntime-node$': false,
      };
    }

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /unpdf/ },
    ];

    return config;
  },
  serverExternalPackages: ['sharp', 'onnxruntime-node', '@huggingface/transformers', 'unpdf'],
};

module.exports = nextConfig;
