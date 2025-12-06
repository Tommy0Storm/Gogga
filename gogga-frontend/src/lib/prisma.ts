/**
 * GOGGA - Prisma Client Singleton (Prisma 7)
 * 
 * Prevents multiple Prisma Client instances in development
 * when hot-reloading occurs with Next.js.
 * 
 * Prisma 7 requires a driver adapter for all database connections.
 * We use @prisma/adapter-better-sqlite3 for SQLite.
 * 
 * Note: DATABASE_URL must be set in .env.local
 */
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Create the SQLite adapter
// DATABASE_URL format: file:./prisma/dev.db or file:../path/to/dev.db
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'
// Extract the file path from the URL (remove 'file:' prefix)
const dbPath = databaseUrl.replace(/^file:/, '')

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
})

export const prisma = globalThis.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
