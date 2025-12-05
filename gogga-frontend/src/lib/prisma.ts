/**
 * GOGGA - Prisma Client Singleton
 * 
 * Prevents multiple Prisma Client instances in development
 * when hot-reloading occurs with Next.js.
 */
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const prisma = globalThis.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
