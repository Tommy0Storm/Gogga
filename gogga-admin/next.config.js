/** @type {import('next').NextConfig} */

// Backend URL for API calls
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
// Frontend URL for shared Prisma database
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Allow dev requests from any origin (for Docker/remote development)
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.241.135.171',
    '192.168.0.168',
    '192.168.0.101',
    '192.168.0.102',
    '192.168.0.103',
    '192.168.0.104',
    '192.168.0.105',
  ],
  // Disable the Next.js dev indicator
  devIndicators: false,
  env: {
    BACKEND_URL: BACKEND_URL,
    FRONTEND_URL: FRONTEND_URL,
  },
  async rewrites() {
    return [
      // Proxy backend API routes
      {
        source: '/api/backend/:path*',
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
      {
        source: '/backend/health',
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
