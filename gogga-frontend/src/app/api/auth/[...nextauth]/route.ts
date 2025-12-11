/**
 * GOGGA - NextAuth v5 Route Handler
 * 
 * Handles all /api/auth/* routes using the new v5 pattern
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
