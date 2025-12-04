/** @type {import('next').NextConfig} */

// Use localhost for dev, backend for Docker
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`, // Proxy to Backend
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`, // Proxy health check
      },
    ]
  },
}

module.exports = nextConfig
