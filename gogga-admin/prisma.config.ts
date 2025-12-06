/**
 * GOGGA Admin - Prisma 7 Configuration
 * 
 * This file configures the Prisma CLI for migrations and database operations.
 * Environment variables are loaded via dotenv.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // Also load .env if it exists
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // The main entry for your schema
  schema: 'prisma/schema.prisma',
  
  // Where migrations should be generated
  migrations: {
    path: 'prisma/migrations',
  },
  
  // The database URL for CLI operations
  datasource: {
    // Type-safe env() helper (does not replace the need for dotenv)
    url: env('DATABASE_URL'),
  },
})
