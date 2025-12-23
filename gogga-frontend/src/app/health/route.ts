/**
 * Health check endpoint for frontend
 * 
 * Returns basic health status and version info.
 * Used by AdminPanel to check frontend status.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'gogga-frontend',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
}
