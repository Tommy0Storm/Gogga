/**
 * Server-side Prisma client for Server Actions
 * This file is only imported in Server Components and Server Actions
 */

import { PrismaClient } from '../../prisma/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Create the SQLite adapter
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
})

export const db = globalThis.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}
