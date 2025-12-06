/**
 * GOGGA Admin - Prisma Client Singleton (Prisma 7)
 * 
 * Prisma 7 requires a driver adapter for all database connections.
 * We use @prisma/adapter-better-sqlite3 for SQLite.
 */
import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create the SQLite adapter
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db'

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
