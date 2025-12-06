/**
 * GOGGA - Prisma Client Singleton (Prisma 7)
 * 
 * Prevents multiple Prisma Client instances in development
 * when hot-reloading occurs with Next.js.
 * 
 * Prisma 7 requires a driver adapter for all database connections.
 * We use @prisma/adapter-better-sqlite3 for SQLite.
 * 
 * Features:
 * - Driver adapter pattern for SQLite
 * - Global transaction options (isolationLevel, timeouts)
 * - Transaction retry helper for deadlock handling
 * 
 * Note: DATABASE_URL must be set in .env.local
 */
import { PrismaClient, Prisma } from '../../prisma/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

// Create the SQLite adapter
// DATABASE_URL format: file:./prisma/dev.db or file:../path/to/dev.db
const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';

const adapter = new PrismaBetterSqlite3({
  url: databaseUrl,
})

// Global transaction options for consistent behavior
export const prisma = globalThis.prisma ?? new PrismaClient({
  adapter,
  transactionOptions: {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,  // Max time to wait for transaction slot (ms)
    timeout: 10000, // Max transaction execution time (ms)
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

/**
 * Transaction with automatic retry for deadlocks (P2034 errors)
 * 
 * Use this for critical operations like subscription updates or payments
 * that may encounter concurrent write conflicts.
 * 
 * @example
 * const result = await withRetry(async (tx) => {
 *   const user = await tx.user.update({ ... })
 *   await tx.subscription.update({ ... })
 *   return user
 * })
 */
export async function withRetry<T>(
  fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      })
    } catch (error) {
      // P2034: Transaction conflict (concurrent writes)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        retries++
        if (retries >= maxRetries) {
          throw new Error(`Transaction failed after ${maxRetries} retries: ${error.message}`)
        }
        // Exponential backoff: 100ms, 200ms, 400ms...
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries - 1)))
        continue
      }
      throw error
    }
  }
  
  throw new Error('Transaction retry loop exited unexpectedly')
}

export default prisma
