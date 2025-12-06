/**
 * GOGGA Admin - Prisma 7 Configuration
 * 
 * This file configures the Prisma CLI for migrations and database operations.
 * Environment variables are loaded via dotenv.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // Also load .env if it exists
import { defineConfig } from "prisma/config";

// Use process.env with fallback for Docker build where DATABASE_URL might not be set
// (prisma generate only needs schema, not actual DB connection)
const databaseUrl = process.env.DATABASE_URL || "file:./data/gogga.db";

export default defineConfig({
  // The main entry for your schema
  schema: "prisma/schema.prisma",

  // Where migrations should be generated
  migrations: {
    path: "prisma/migrations",
  },

  // The database URL for CLI operations
  datasource: {
    url: databaseUrl,
  },
});
