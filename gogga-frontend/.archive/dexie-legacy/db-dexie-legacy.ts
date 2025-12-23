/**
 * GOGGA Local Database (Dexie.js)
 * IndexedDB wrapper for local document storage
 * Supports: RAG documents, chat history, generated images
 */

import Dexie, { type Table } from 'dexie';
import type { ChatMessageMeta } from '../types/prisma-json';

// ============================================================================
// Enterprise RAG Storage Limits (Hard-coded)
// ============================================================================

export const RAG_LIMITS = {
  MAX_DOCUMENT_SIZE_MB: 15,        // 15MB per document
  MAX_DOCUMENT_SIZE_BYTES: 15 * 1024 * 1024,
  MAX_TOTAL_STORAGE_MB: 100,       // 100MB total RAG storage
  MAX_TOTAL_STORAGE_BYTES: 100 * 1024 * 1024,
  // Session-Scoped RAG (v8)
  MAX_DOCS_PER_USER_POOL: 100,     // 100 docs max per user
  JIVE_MAX_DOCS_PER_SESSION: 5,    // JIVE: max 5 docs active per session
  JIGGA_MAX_DOCS_PER_SESSION: 10,  // JIGGA: max 10 docs active per session (can pull from pool)
} as const;

// Document stored in IndexedDB for RAG
export interface Document {
  id?: number;
  // Session-Scoped RAG fields (v8)
  userId: string;           // Owner of the document (user's pool)
  originSessionId: string;  // Session where doc was originally uploaded
  activeSessions: string[]; // Sessions where doc is currently active for RAG
  accessCount: number;      // Usage tracking for pool management
  lastAccessedAt: Date;     // Last time doc was used in RAG
  // Legacy field - frozen at upload time, use activeSessions for filtering
  sessionId: string;        // @deprecated Use originSessionId instead
  // Document content
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

// Chunk for search index
export interface DocumentChunk {
  id?: number;
  documentId: number;
  sessionId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
}

// Chat session for JIVE/JIGGA persistence
export interface ChatSession {
  id?: string;  // UUID
  tier: 'jive' | 'jigga';
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

// Chat message (persisted for JIVE/JIGGA)
export interface ChatMessage {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tier: string;
  timestamp: Date;
  imageId?: number;  // Reference to generated image
  thinking?: string; // JIGGA thinking block (collapsed in UI)
  meta?: ChatMessageMeta;
}

// Generated image storage
export interface GeneratedImage {
  id?: number;
  sessionId: string;
  prompt: string;
  enhancedPrompt: string;
  thumbnailData: string;  // 2x size thumbnail base64
  fullImageData: string;  // Full size base64
  mimeType: string;
  width: number;
  height: number;
  tier: string;
  model: string;
  isDeleted: boolean;  // Soft delete - shows placeholder
  createdAt: Date;
}

// User preferences
export interface UserPreference {
  key: string;
  value: string;
}

// Long-term memory context (persists across all sessions)
export interface MemoryContext {
  id?: number;
  title: string;
  content: string;
  category: 'personal' | 'project' | 'reference' | 'custom';
  source: 'user' | 'gogga';  // Who created this memory - user or AI
  isActive: boolean;  // Whether to include in LLM context
  priority: number;   // Higher = more important (1-10)
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Token usage tracking
export interface TokenUsage {
  id?: number;
  date: string;  // YYYY-MM-DD format for daily aggregation
  tier: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  updatedAt: Date;
}

// RAG Metrics (persistent - 3 day retention)
export interface RagMetric {
  id?: number;
  metricId: string;  // Original metric ID from ragMetrics.ts
  type: 'retrieval' | 'embedding_generated' | 'query' | 'cache_hit' | 'cache_miss' | 'error';
  timestamp: number;
  sessionId?: string;
  docId?: number;
  value: Record<string, unknown>;
  createdAt: Date;
}

// System Logs (persistent - 7 day retention)
export interface SystemLog {
  id?: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: 'rag' | 'auth' | 'chat' | 'image' | 'system';
  message: string;
  data?: Record<string, unknown>;
  sessionId?: string;
  timestamp: number;
  createdAt: Date;
}

// GoggaSmart Skill - learned strategy for self-improving AI
// Inspired by ACE (Agentic Context Engine) playbook/skillbook system
export interface GoggaSmartSkill {
  id?: number;
  skillId: string;          // Unique ID like "legal-00001"
  userId: string;           // Owner of the skill
  section: string;          // Category: "tool_selection", "legal_sa", "user_preferences", etc.
  content: string;          // The actual strategy/insight
  helpful: number;          // Times this skill led to success
  harmful: number;          // Times this skill caused issues
  neutral: number;          // Times referenced but not decisive
  status: 'active' | 'invalid';  // Soft delete support
  createdAt: Date;
  updatedAt: Date;
}

// GoggaSmart limits
export const GOGGA_SMART_LIMITS = {
  MAX_SKILLS_PER_USER: 100,    // Max skills in user's skillbook
  MAX_SKILLS_IN_PROMPT: 15,    // Max skills to inject in system prompt
  MIN_SCORE_THRESHOLD: -3,     // Skills with (helpful - harmful) < this are pruned
} as const;

// Retention policy constants
export const RETENTION_POLICY = {
  METRICS_DAYS: 7,   // RAG metrics retained for 7 days (auto-aging)
  LOGS_DAYS: 7,      // System logs retained for 7 days
} as const;

// Supported document types for RAG
export const SUPPORTED_RAG_FORMATS = {
  // Text formats
  'text/plain': { ext: '.txt', name: 'Text' },
  'text/markdown': { ext: '.md', name: 'Markdown' },
  'application/x-markdown': { ext: '.md', name: 'Markdown' },
  
  // PDF
  'application/pdf': { ext: '.pdf', name: 'PDF' },
  
  // Microsoft Word
  'application/msword': { ext: '.doc', name: 'Word (Legacy)' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', name: 'Word' },
  
  // OpenDocument formats
  'application/vnd.oasis.opendocument.text': { ext: '.odt', name: 'OpenDocument Text' },
  
  // Rich Text
  'application/rtf': { ext: '.rtf', name: 'Rich Text' },
  'text/rtf': { ext: '.rtf', name: 'Rich Text' },
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_RAG_FORMATS;

export function isSupportedFormat(mimeType: string): boolean {
  return mimeType in SUPPORTED_RAG_FORMATS;
}

export function getSupportedExtensions(): string[] {
  return Object.values(SUPPORTED_RAG_FORMATS).map(f => f.ext);
}

class GoggaDatabase extends Dexie {
  documents!: Table<Document>;
  chunks!: Table<DocumentChunk>;
  sessions!: Table<ChatSession>;
  messages!: Table<ChatMessage>;
  images!: Table<GeneratedImage>;
  preferences!: Table<UserPreference>;
  tokenUsage!: Table<TokenUsage>;
  memories!: Table<MemoryContext>;
  ragMetrics!: Table<RagMetric>;
  systemLogs!: Table<SystemLog>;
  skills!: Table<GoggaSmartSkill>;  // GoggaSmart learning system

  constructor() {
    super('GoggaDB');
    
    // Version 2: Added sessionId for per-session RAG, chat sessions, and images
    this.version(2).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key'
    });

    // Version 3: Added token usage tracking
    this.version(3).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, date, tier, updatedAt'
    });

    // Version 4: Added long-term memory context
    this.version(4).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, date, tier, updatedAt',
      memories: '++id, category, isActive, priority, createdAt'
    });

    // Version 5: Added compound index for tokenUsage [date+tier] for faster queries
    this.version(5).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, [date+tier], date, tier, updatedAt',
      memories: '++id, category, isActive, priority, createdAt'
    });

    // Version 6: Added RAG metrics (3-day retention) and system logs (7-day retention)
    this.version(6).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, [date+tier], date, tier, updatedAt',
      memories: '++id, category, isActive, priority, createdAt',
      ragMetrics: '++id, type, timestamp, sessionId, docId',
      systemLogs: '++id, level, timestamp, category'
    });

    // Version 7: Added source field to memories (user vs gogga created)
    this.version(7).stores({
      documents: '++id, sessionId, filename, createdAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, [date+tier], date, tier, updatedAt',
      memories: '++id, category, source, isActive, priority, createdAt',
      ragMetrics: '++id, type, timestamp, sessionId, docId',
      systemLogs: '++id, level, timestamp, category'
    }).upgrade(tx => {
      // Migrate existing memories: set source to 'user' (assume user created)
      return tx.table('memories').toCollection().modify(memory => {
        if (!memory.source) {
          memory.source = 'user';
        }
      });
    });

    // Version 8: Session-Scoped RAG - documents belong to user pool, activated per session
    // See docs/SESSION_SCOPED_RAG_DESIGN.md for architecture details
    this.version(8).stores({
      // New indexes: userId for pool queries, *activeSessions for multi-value index
      documents: '++id, userId, originSessionId, *activeSessions, filename, createdAt, lastAccessedAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, [date+tier], date, tier, updatedAt',
      memories: '++id, category, source, isActive, priority, createdAt',
      ragMetrics: '++id, type, timestamp, sessionId, docId',
      systemLogs: '++id, level, timestamp, category'
    }).upgrade(tx => {
      // Migrate existing documents to session-scoped model
      return tx.table('documents').toCollection().modify(doc => {
        // Copy sessionId to originSessionId (frozen reference)
        doc.originSessionId = doc.sessionId;
        // Initialize activeSessions with origin session (doc stays active where uploaded)
        doc.activeSessions = [doc.sessionId];
        // Default userId (will be set properly on next auth)
        doc.userId = doc.userId || 'migrated_user';
        // Initialize tracking fields
        doc.accessCount = doc.accessCount || 0;
        doc.lastAccessedAt = doc.lastAccessedAt || doc.updatedAt || new Date();
      });
    });

    // Version 9: GoggaSmart - self-improving AI with learned strategies
    // Inspired by ACE (Agentic Context Engine) skillbook system
    this.version(9).stores({
      documents: '++id, userId, originSessionId, *activeSessions, filename, createdAt, lastAccessedAt',
      chunks: '++id, documentId, sessionId, chunkIndex',
      sessions: 'id, tier, createdAt, updatedAt',
      messages: '++id, sessionId, role, tier, timestamp',
      images: '++id, sessionId, isDeleted, createdAt',
      preferences: 'key',
      tokenUsage: '++id, [date+tier], date, tier, updatedAt',
      memories: '++id, category, source, isActive, priority, createdAt',
      ragMetrics: '++id, type, timestamp, sessionId, docId',
      systemLogs: '++id, level, timestamp, category',
      // GoggaSmart skills: indexed by userId, section, and skillId for efficient queries
      skills: '++id, skillId, userId, section, status, [userId+section], createdAt, updatedAt'
    });
  }
}

// Singleton instance
export const db = new GoggaDatabase();

// ============================================================================
// Session Management
// ============================================================================

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function createChatSession(tier: 'jive' | 'jigga'): Promise<ChatSession> {
  const session: ChatSession = {
    id: generateSessionId(),
    tier,
    title: `Chat ${new Date().toLocaleDateString()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    messageCount: 0,
  };
  
  await db.sessions.add(session);
  return session;
}

export async function getChatSessions(tier?: 'jive' | 'jigga'): Promise<ChatSession[]> {
  let query = db.sessions.orderBy('updatedAt').reverse();
  if (tier) {
    return query.filter(s => s.tier === tier).toArray();
  }
  return query.toArray();
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await db.sessions.update(sessionId, { title, updatedAt: new Date() });
}

/**
 * Delete a chat session
 * IMPORTANT: Documents are NOT deleted, only deactivated from this session
 * Documents remain in user's pool for future sessions
 * See docs/SESSION_SCOPED_RAG_DESIGN.md - Invariant: Session deletion never deletes documents
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.sessions, db.messages, db.documents, db.chunks, db.images], async () => {
    // Delete messages and images (session-specific)
    await db.messages.where('sessionId').equals(sessionId).delete();
    await db.images.where('sessionId').equals(sessionId).delete();
    
    // Deactivate documents from this session (don't delete them!)
    // Documents stay in user's pool, just removed from activeSessions
    await db.documents.toCollection().modify(doc => {
      if (doc.activeSessions?.includes(sessionId)) {
        doc.activeSessions = doc.activeSessions.filter((id: string) => id !== sessionId);
        doc.updatedAt = new Date();
      }
    });
    
    // Delete chunks that were created in this session
    await db.chunks.where('sessionId').equals(sessionId).delete();
    
    // Delete the session itself
    await db.sessions.delete(sessionId);
  });
}

// ============================================================================
// Message Management (JIVE/JIGGA only)
// ============================================================================

export async function saveMessage(
  sessionId: string,
  message: Omit<ChatMessage, 'id' | 'sessionId'>
): Promise<number> {
  const id = await db.messages.add({
    ...message,
    sessionId,
  });
  
  // Update session
  await db.sessions.update(sessionId, {
    updatedAt: new Date(),
    messageCount: await db.messages.where('sessionId').equals(sessionId).count(),
  });
  
  return id as number;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return db.messages.where('sessionId').equals(sessionId).sortBy('timestamp');
}

// ============================================================================
// Image Management
// ============================================================================

export async function saveGeneratedImage(
  sessionId: string,
  image: Omit<GeneratedImage, 'id' | 'sessionId' | 'isDeleted' | 'createdAt'>
): Promise<number> {
  return await db.images.add({
    ...image,
    sessionId,
    isDeleted: false,
    createdAt: new Date(),
  }) as number;
}

export async function getSessionImages(sessionId: string): Promise<GeneratedImage[]> {
  return db.images.where('sessionId').equals(sessionId).sortBy('createdAt');
}

export async function softDeleteImage(imageId: number): Promise<void> {
  await db.images.update(imageId, { isDeleted: true });
}

export async function getImage(imageId: number): Promise<GeneratedImage | undefined> {
  return db.images.get(imageId);
}

// ============================================================================
// Document Management - Session-Scoped RAG (v8)
// See docs/SESSION_SCOPED_RAG_DESIGN.md for architecture details
// ============================================================================

/**
 * Get documents ACTIVE in a specific session
 * CRITICAL: This is the correct filtering for RAG retrieval
 * Uses activeSessions array, with fallback to legacy sessionId field
 */
export async function getActiveDocumentsForSession(sessionId: string): Promise<Document[]> {
  try {
    // Primary: Use Dexie's multi-value index on activeSessions (v8+ documents)
    const v8Docs = await db.documents.where('activeSessions').equals(sessionId).toArray();
    
    if (v8Docs.length > 0) {
      return v8Docs;
    }
    
    // Fallback: Legacy documents - filter manually since sessionId is not indexed in v8+
    // This handles pre-v8 documents that weren't migrated properly
    const allDocs = await db.documents.toArray();
    return allDocs.filter(doc => doc.sessionId === sessionId && !doc.activeSessions?.length);
  } catch (error) {
    console.error('[DB] getActiveDocumentsForSession error:', error);
    return [];
  }
}

/**
 * Get ALL documents in a user's pool (for document picker UI)
 */
export async function getUserDocumentPool(userId: string): Promise<Document[]> {
  return db.documents.where('userId').equals(userId).sortBy('lastAccessedAt');
}

/**
 * Get document count for a user (pool limit enforcement)
 */
export async function getUserDocumentCount(userId: string): Promise<number> {
  return db.documents.where('userId').equals(userId).count();
}

/**
 * Activate a document for a session (pull from pool)
 * Adds sessionId to activeSessions array
 */
export async function activateDocumentForSession(docId: number, sessionId: string): Promise<void> {
  await db.documents.where('id').equals(docId).modify(doc => {
    if (!doc.activeSessions.includes(sessionId)) {
      doc.activeSessions.push(sessionId);
      doc.accessCount = (doc.accessCount || 0) + 1;
      doc.lastAccessedAt = new Date();
      doc.updatedAt = new Date();
    }
  });
}

/**
 * Deactivate a document from a session (remove from active set)
 * Document remains in user's pool
 */
export async function deactivateDocumentFromSession(docId: number, sessionId: string): Promise<void> {
  await db.documents.where('id').equals(docId).modify(doc => {
    doc.activeSessions = doc.activeSessions.filter((id: string) => id !== sessionId);
    doc.updatedAt = new Date();
  });
}

/**
 * Get orphaned documents (not active in any session)
 * Useful for cleanup UI
 */
export async function getOrphanedDocuments(userId: string): Promise<Document[]> {
  const allDocs = await getUserDocumentPool(userId);
  return allDocs.filter(doc => !doc.activeSessions || doc.activeSessions.length === 0);
}

/**
 * Delete a document completely (from pool)
 * IMPORTANT: This cascades to embeddings but NOT to facts
 * See Invariant #3: Deleting documents never deletes authoritative facts
 */
export async function deleteDocumentFromPool(docId: number): Promise<void> {
  await db.transaction('rw', [db.documents, db.chunks], async () => {
    // Delete chunks (embeddings are in-memory, will be cleared by ragManager)
    await db.chunks.where('documentId').equals(docId).delete();
    // Delete the document
    await db.documents.delete(docId);
  });
}

/**
 * Legacy compatibility: Get documents by originSessionId
 * @deprecated Use getActiveDocumentsForSession instead for RAG retrieval
 */
export async function getSessionDocuments(sessionId: string): Promise<Document[]> {
  // For backward compatibility, return docs where this session is active
  return getActiveDocumentsForSession(sessionId);
}

/**
 * Clear/deactivate documents from a session
 * @deprecated This function now deactivates rather than deletes. Use deleteSession() for full cleanup.
 * v8: Deactivates documents from session, doesn't delete them (they remain in user's pool)
 */
export async function clearSessionDocuments(sessionId: string): Promise<void> {
  await db.transaction('rw', [db.documents, db.chunks], async () => {
    // v8: Deactivate documents from this session instead of deleting
    await db.documents.where('activeSessions').equals(sessionId).modify(doc => {
      doc.activeSessions = doc.activeSessions.filter((id: string) => id !== sessionId);
      doc.updatedAt = new Date();
    });
    // Chunks still use sessionId index - delete chunks for this session
    await db.chunks.where('sessionId').equals(sessionId).delete();
  });
}

// ============================================================================
// Stats & Utilities
// ============================================================================

export async function clearAllData(): Promise<void> {
  await db.documents.clear();
  await db.chunks.clear();
  await db.messages.clear();
  await db.sessions.clear();
  await db.images.clear();
  // Keep preferences
}

export async function getDocumentCount(): Promise<number> {
  return db.documents.count();
}

export async function getTotalChunks(): Promise<number> {
  return db.chunks.count();
}

export async function getStorageStats(sessionId?: string): Promise<{
  documents: number;
  chunks: number;
  messages: number;
  images: number;
  estimatedSizeMB: number;
}> {
  let documentsQuery = db.documents.toCollection();
  let chunksQuery = db.chunks.toCollection();
  let messagesQuery = db.messages.toCollection();
  let imagesQuery = db.images.toCollection();
  
  if (sessionId) {
    // v8: Use activeSessions multi-value index for documents
    documentsQuery = db.documents.where('activeSessions').equals(sessionId);
    chunksQuery = db.chunks.where('sessionId').equals(sessionId);
    messagesQuery = db.messages.where('sessionId').equals(sessionId);
    imagesQuery = db.images.where('sessionId').equals(sessionId);
  }

  const [documents, chunks, messages, images] = await Promise.all([
    documentsQuery.count(),
    chunksQuery.count(),
    messagesQuery.count(),
    imagesQuery.count(),
  ]);

  // Rough estimate: 500 bytes per chunk, 100KB per image thumbnail
  const estimatedSizeMB = ((chunks * 500) + (images * 100000)) / (1024 * 1024);

  return { documents, chunks, messages, images, estimatedSizeMB };
}

// ============================================================================
// Enterprise RAG Storage Management
// ============================================================================

/**
 * Get total RAG storage used across all documents
 */
export async function getTotalRAGStorageBytes(): Promise<number> {
  const documents = await db.documents.toArray();
  return documents.reduce((total, doc) => total + doc.size, 0);
}

/**
 * Get total RAG storage used in MB
 */
export async function getTotalRAGStorageMB(): Promise<number> {
  const bytes = await getTotalRAGStorageBytes();
  return bytes / (1024 * 1024);
}

/**
 * Check if adding a document would exceed storage limits
 */
export async function checkStorageLimits(
  fileSize: number,
  tier: 'jive' | 'jigga',
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Check individual document size
  if (fileSize > RAG_LIMITS.MAX_DOCUMENT_SIZE_BYTES) {
    return { 
      allowed: false, 
      reason: `Document exceeds ${RAG_LIMITS.MAX_DOCUMENT_SIZE_MB}MB limit (${(fileSize / (1024 * 1024)).toFixed(1)}MB)` 
    };
  }

  // Check total storage
  const currentTotal = await getTotalRAGStorageBytes();
  if (currentTotal + fileSize > RAG_LIMITS.MAX_TOTAL_STORAGE_BYTES) {
    const usedMB = (currentTotal / (1024 * 1024)).toFixed(1);
    return { 
      allowed: false, 
      reason: `Would exceed ${RAG_LIMITS.MAX_TOTAL_STORAGE_MB}MB total storage limit (currently using ${usedMB}MB)` 
    };
  }

  // Check per-session document limit (v8: use activeSessions multi-value index)
  const sessionDocs = await db.documents.where('activeSessions').equals(sessionId).count();
  const maxDocs = tier === 'jive' 
    ? RAG_LIMITS.JIVE_MAX_DOCS_PER_SESSION 
    : RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION;

  if (sessionDocs >= maxDocs) {
    return { 
      allowed: false, 
      reason: `Session already has ${sessionDocs} documents (max ${maxDocs} for ${tier.toUpperCase()})` 
    };
  }

  return { allowed: true };
}

/**
 * Get all documents across all sessions (for JIGGA document selection)
 */
export async function getAllDocuments(): Promise<Document[]> {
  const docs = await db.documents.orderBy('createdAt').reverse().toArray();
  console.log('[DB] getAllDocuments returning:', docs.length, 'documents');
  return docs;
}

/**
 * Get documents grouped by session (for JIGGA document selection UI)
 */
export async function getDocumentsGroupedBySession(): Promise<Map<string, { session: ChatSession | null; documents: Document[] }>> {
  const [documents, sessions] = await Promise.all([
    db.documents.toArray(),
    db.sessions.toArray(),
  ]);

  const sessionMap = new Map(sessions.map(s => [s.id!, s]));
  const grouped = new Map<string, { session: ChatSession | null; documents: Document[] }>();

  for (const doc of documents) {
    const group = grouped.get(doc.sessionId) || { 
      session: sessionMap.get(doc.sessionId) || null, 
      documents: [] 
    };
    group.documents.push(doc);
    grouped.set(doc.sessionId, group);
  }

  return grouped;
}

/**
 * Get documents by IDs (for JIGGA selected documents)
 */
export async function getDocumentsByIds(ids: number[]): Promise<Document[]> {
  return db.documents.where('id').anyOf(ids).toArray();
}

/**
 * Get storage usage breakdown
 */
export async function getStorageUsageBreakdown(): Promise<{
  totalBytes: number;
  totalMB: number;
  usedPercent: number;
  remainingBytes: number;
  remainingMB: number;
  documentCount: number;
  bySession: Array<{
    sessionId: string;
    sessionTitle: string;
    documentCount: number;
    sizeBytes: number;
    sizeMB: number;
  }>;
}> {
  const [documents, sessions] = await Promise.all([
    db.documents.toArray(),
    db.sessions.toArray(),
  ]);

  const sessionMap = new Map(sessions.map(s => [s.id!, s.title]));
  const bySession = new Map<string, { count: number; size: number }>();

  let totalBytes = 0;
  for (const doc of documents) {
    totalBytes += doc.size;
    const current = bySession.get(doc.sessionId) || { count: 0, size: 0 };
    current.count++;
    current.size += doc.size;
    bySession.set(doc.sessionId, current);
  }

  const sessionBreakdown = Array.from(bySession.entries()).map(([sessionId, data]) => ({
    sessionId,
    sessionTitle: sessionMap.get(sessionId) || 'Unknown Session',
    documentCount: data.count,
    sizeBytes: data.size,
    sizeMB: data.size / (1024 * 1024),
  }));

  return {
    totalBytes,
    totalMB: totalBytes / (1024 * 1024),
    usedPercent: (totalBytes / RAG_LIMITS.MAX_TOTAL_STORAGE_BYTES) * 100,
    remainingBytes: RAG_LIMITS.MAX_TOTAL_STORAGE_BYTES - totalBytes,
    remainingMB: (RAG_LIMITS.MAX_TOTAL_STORAGE_BYTES - totalBytes) / (1024 * 1024),
    documentCount: documents.length,
    bySession: sessionBreakdown,
  };
}

// ============================================================================
// Token Usage Tracking
// ============================================================================

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

export async function trackTokenUsage(
  tier: string,
  inputTokens: number,
  outputTokens: number,
  costZar: number = 0
): Promise<void> {
  const today = getTodayDateString();
  
  // Find existing entry for today and tier
  const existing = await db.tokenUsage
    .where({ date: today, tier })
    .first();
  
  if (existing) {
    // Update existing entry
    await db.tokenUsage.update(existing.id!, {
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
      totalTokens: existing.totalTokens + inputTokens + outputTokens,
      costZar: existing.costZar + costZar,
      requestCount: existing.requestCount + 1,
      updatedAt: new Date()
    });
  } else {
    // Create new entry
    await db.tokenUsage.add({
      date: today,
      tier,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costZar,
      requestCount: 1,
      updatedAt: new Date()
    });
  }
}

export async function getTodayTokenUsage(): Promise<{
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
  requestCount: number;
  byTier: Record<string, {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    costZar: number;
    requestCount: number;
  }>;
}> {
  const today = getTodayDateString();
  const entries = await db.tokenUsage
    .where('date')
    .equals(today)
    .toArray();
  
  const result = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    costZar: 0,
    requestCount: 0,
    byTier: {} as Record<string, {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      costZar: number;
      requestCount: number;
    }>
  };
  
  for (const entry of entries) {
    result.totalTokens += entry.totalTokens;
    result.inputTokens += entry.inputTokens;
    result.outputTokens += entry.outputTokens;
    result.costZar += entry.costZar;
    result.requestCount += entry.requestCount;
    
    result.byTier[entry.tier] = {
      totalTokens: entry.totalTokens,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costZar: entry.costZar,
      requestCount: entry.requestCount
    };
  }
  
  return result;
}

export async function getTokenUsageHistory(days: number = 30): Promise<TokenUsage[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  
  return db.tokenUsage
    .where('date')
    .aboveOrEqual(startDateStr)
    .toArray();
}

export async function getTotalTokenUsage(): Promise<{
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
  requestCount: number;
}> {
  const entries = await db.tokenUsage.toArray();
  
  return entries.reduce((acc, entry) => ({
    totalTokens: acc.totalTokens + entry.totalTokens,
    inputTokens: acc.inputTokens + entry.inputTokens,
    outputTokens: acc.outputTokens + entry.outputTokens,
    costZar: acc.costZar + entry.costZar,
    requestCount: acc.requestCount + entry.requestCount
  }), {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    costZar: 0,
    requestCount: 0
  });
}

// ============================================================================
// Long-Term Memory Context Management
// ============================================================================

export const MEMORY_LIMITS = {
  MAX_MEMORIES: 20,           // Max number of memory entries
  MAX_CONTENT_LENGTH: 10000,  // Max characters per memory
  MAX_TOTAL_TOKENS: 4000,     // Max tokens to include in context
} as const;

export type MemoryCategory = MemoryContext['category'];
export type MemorySource = MemoryContext['source'];

export async function createMemory(
  title: string,
  content: string,
  category: MemoryCategory = 'custom',
  priority: number = 5,
  source: MemorySource = 'user'
): Promise<MemoryContext> {
  // Estimate token count (rough: 1 token ≈ 4 chars)
  const tokenCount = Math.ceil(content.length / 4);
  
  const memory: MemoryContext = {
    title,
    content,
    category,
    source,
    isActive: true,
    priority: Math.max(1, Math.min(10, priority)),
    tokenCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const id = await db.memories.add(memory);
  return { ...memory, id };
}

export async function updateMemory(
  id: number,
  updates: Partial<Pick<MemoryContext, 'title' | 'content' | 'category' | 'isActive' | 'priority'>>
): Promise<void> {
  const updateData: Partial<MemoryContext> = {
    ...updates,
    updatedAt: new Date(),
  };
  
  if (updates.content) {
    updateData.tokenCount = Math.ceil(updates.content.length / 4);
  }
  
  await db.memories.update(id, updateData);
}

export async function deleteMemory(id: number): Promise<void> {
  await db.memories.delete(id);
}

/**
 * Delete a memory only if it was created by Gogga (AI).
 * User-created memories cannot be deleted by the AI.
 * @returns true if deleted, false if not allowed
 */
export async function deleteGoggaMemory(id: number): Promise<boolean> {
  const memory = await db.memories.get(id);
  if (!memory) return false;
  
  // Only allow deletion of Gogga-created memories
  if (memory.source !== 'gogga') {
    console.warn('[Memory] Cannot delete user-created memory:', id);
    return false;
  }
  
  await db.memories.delete(id);
  return true;
}

/**
 * Get memories by source (user or gogga created)
 */
export async function getMemoriesBySource(source: MemorySource): Promise<MemoryContext[]> {
  return db.memories
    .where('source')
    .equals(source)
    .toArray();
}

export async function getAllMemories(): Promise<MemoryContext[]> {
  return db.memories.orderBy('priority').reverse().toArray();
}

export async function getActiveMemories(): Promise<MemoryContext[]> {
  // Get all memories and filter for active ones (Dexie boolean indexing can be tricky)
  const allMemories = await db.memories.toArray();
  return allMemories
    .filter(m => m.isActive === true)
    .sort((a, b) => b.priority - a.priority);
}

export async function getMemoriesByCategory(category: MemoryCategory): Promise<MemoryContext[]> {
  return db.memories
    .where('category')
    .equals(category)
    .toArray();
}

/**
 * Get memories formatted for LLM context injection
 * Returns memories sorted by priority, limited by token count
 */
export async function getMemoryContextForLLM(maxTokens: number = MEMORY_LIMITS.MAX_TOTAL_TOKENS): Promise<string> {
  const activeMemories = await getActiveMemories();
  
  if (activeMemories.length === 0) return '';
  
  let totalTokens = 0;
  const includedMemories: MemoryContext[] = [];
  
  for (const memory of activeMemories) {
    if (totalTokens + memory.tokenCount <= maxTokens) {
      includedMemories.push(memory);
      totalTokens += memory.tokenCount;
    }
  }
  
  if (includedMemories.length === 0) return '';
  
  // Format as structured context
  const contextParts = includedMemories.map(m => 
    `## ${m.title} (${m.category})\n${m.content}`
  );
  
  return `<user_context>\n${contextParts.join('\n\n')}\n</user_context>`;
}

export async function getMemoryStats(): Promise<{
  total: number;
  active: number;
  totalTokens: number;
  byCategory: Record<MemoryCategory, number>;
  bySource: Record<MemorySource, number>;
}> {
  const memories = await getAllMemories();
  const active = memories.filter(m => m.isActive);
  
  const byCategory: Record<MemoryCategory, number> = {
    personal: 0,
    project: 0,
    reference: 0,
    custom: 0,
  };
  
  const bySource: Record<MemorySource, number> = {
    user: 0,
    gogga: 0,
  };
  
  memories.forEach(m => {
    byCategory[m.category]++;
    bySource[m.source || 'user']++;  // Default to 'user' for legacy memories
  });
  
  return {
    total: memories.length,
    active: active.length,
    totalTokens: active.reduce((sum, m) => sum + m.tokenCount, 0),
    byCategory,
    bySource,
  };
}

// ============================================================================
// RAG Metrics Persistence (3-day retention)
// ============================================================================

/**
 * Save a RAG metric to Dexie (persists across page navigation)
 */
export async function saveRagMetric(metric: Omit<RagMetric, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.ragMetrics.add({
    ...metric,
    createdAt: new Date(),
  });
  return id as number;
}

/**
 * Get recent RAG metrics, optionally filtered by type
 */
export async function getRecentRagMetrics(options?: {
  type?: RagMetric['type'];
  sessionId?: string;
  docId?: number;
  limit?: number;
  sinceTimestamp?: number;
}): Promise<RagMetric[]> {
  let query = db.ragMetrics.orderBy('timestamp').reverse();
  
  // Apply filters
  const results = await query.toArray();
  let filtered = results;
  
  if (options?.type) {
    filtered = filtered.filter(m => m.type === options.type);
  }
  if (options?.sessionId) {
    filtered = filtered.filter(m => m.sessionId === options.sessionId);
  }
  if (options?.docId !== undefined) {
    filtered = filtered.filter(m => m.docId === options.docId);
  }
  if (options?.sinceTimestamp !== undefined) {
    const sinceTs = options.sinceTimestamp;
    filtered = filtered.filter(m => m.timestamp >= sinceTs);
  }
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  
  return filtered;
}

/**
 * Get aggregated RAG metrics stats
 */
export async function getAggregatedRagMetrics(sessionId?: string): Promise<{
  totalRetrievals: number;
  totalQueries: number;
  totalEmbeddings: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgRetrievalTimeMs: number;
  avgQueryTimeMs: number;
}> {
  let metrics = await db.ragMetrics.toArray();
  
  if (sessionId) {
    metrics = metrics.filter(m => m.sessionId === sessionId);
  }
  
  const retrievals = metrics.filter(m => m.type === 'retrieval');
  const queries = metrics.filter(m => m.type === 'query');
  const embeddings = metrics.filter(m => m.type === 'embedding_generated');
  
  const retrievalTimes = retrievals
    .map(m => (m.value as { latencyMs?: number })?.latencyMs)
    .filter((t): t is number => typeof t === 'number');
  
  const queryTimes = queries
    .map(m => (m.value as { latencyMs?: number })?.latencyMs)
    .filter((t): t is number => typeof t === 'number');
  
  return {
    totalRetrievals: retrievals.length,
    totalQueries: queries.length,
    totalEmbeddings: embeddings.length,
    cacheHits: metrics.filter(m => m.type === 'cache_hit').length,
    cacheMisses: metrics.filter(m => m.type === 'cache_miss').length,
    errors: metrics.filter(m => m.type === 'error').length,
    avgRetrievalTimeMs: retrievalTimes.length > 0 
      ? retrievalTimes.reduce((a, b) => a + b, 0) / retrievalTimes.length 
      : 0,
    avgQueryTimeMs: queryTimes.length > 0 
      ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length 
      : 0,
  };
}

/**
 * Clean up old RAG metrics (older than 3 days)
 */
export async function cleanupOldRagMetrics(): Promise<number> {
  const cutoffMs = Date.now() - (RETENTION_POLICY.METRICS_DAYS * 24 * 60 * 60 * 1000);
  const oldMetrics = await db.ragMetrics
    .where('timestamp')
    .below(cutoffMs)
    .toArray();
  
  const idsToDelete = oldMetrics.map(m => m.id!).filter(id => id !== undefined);
  await db.ragMetrics.bulkDelete(idsToDelete);
  
  console.log(`[DB] Cleaned up ${idsToDelete.length} old RAG metrics (>3 days)`);
  return idsToDelete.length;
}

/**
 * Clear all RAG metrics (for testing/maintenance)
 */
export async function clearAllRagMetrics(): Promise<void> {
  await db.ragMetrics.clear();
  console.log('[DB] Cleared all RAG metrics');
}

// ============================================================================
// System Logs Persistence (7-day retention)
// ============================================================================

/**
 * Save a system log entry to Dexie
 */
export async function saveSystemLog(log: Omit<SystemLog, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.systemLogs.add({
    ...log,
    createdAt: new Date(),
  });
  return id as number;
}

/**
 * Log helper functions for different levels
 */
export async function logDebug(category: SystemLog['category'], message: string, data?: Record<string, unknown>, sessionId?: string): Promise<void> {
  await saveSystemLog({ level: 'debug', category, message, data, sessionId, timestamp: Date.now() });
}

export async function logInfo(category: SystemLog['category'], message: string, data?: Record<string, unknown>, sessionId?: string): Promise<void> {
  await saveSystemLog({ level: 'info', category, message, data, sessionId, timestamp: Date.now() });
}

export async function logWarn(category: SystemLog['category'], message: string, data?: Record<string, unknown>, sessionId?: string): Promise<void> {
  await saveSystemLog({ level: 'warn', category, message, data, sessionId, timestamp: Date.now() });
}

export async function logError(category: SystemLog['category'], message: string, data?: Record<string, unknown>, sessionId?: string): Promise<void> {
  await saveSystemLog({ level: 'error', category, message, data, sessionId, timestamp: Date.now() });
}

/**
 * Get recent system logs, optionally filtered
 */
export async function getRecentSystemLogs(options?: {
  level?: SystemLog['level'];
  category?: SystemLog['category'];
  sessionId?: string;
  limit?: number;
  sinceTimestamp?: number;
}): Promise<SystemLog[]> {
  let results = await db.systemLogs.orderBy('timestamp').reverse().toArray();
  
  if (options?.level) {
    results = results.filter(l => l.level === options.level);
  }
  if (options?.category) {
    results = results.filter(l => l.category === options.category);
  }
  if (options?.sessionId) {
    results = results.filter(l => l.sessionId === options.sessionId);
  }
  if (options?.sinceTimestamp !== undefined) {
    const sinceTs = options.sinceTimestamp;
    results = results.filter(l => l.timestamp >= sinceTs);
  }
  if (options?.limit) {
    results = results.slice(0, options.limit);
  }
  
  return results;
}

/**
 * Clean up old system logs (older than 7 days)
 */
export async function cleanupOldSystemLogs(): Promise<number> {
  const cutoffMs = Date.now() - (RETENTION_POLICY.LOGS_DAYS * 24 * 60 * 60 * 1000);
  const oldLogs = await db.systemLogs
    .where('timestamp')
    .below(cutoffMs)
    .toArray();
  
  const idsToDelete = oldLogs.map(l => l.id!).filter(id => id !== undefined);
  await db.systemLogs.bulkDelete(idsToDelete);
  
  console.log(`[DB] Cleaned up ${idsToDelete.length} old system logs (>7 days)`);
  return idsToDelete.length;
}

/**
 * Clear all system logs (for testing/maintenance)
 */
export async function clearAllSystemLogs(): Promise<void> {
  await db.systemLogs.clear();
  console.log('[DB] Cleared all system logs');
}

/**
 * Run retention cleanup for both metrics and logs
 * Also runs document migration for v8 Session-Scoped RAG
 * Call this on app startup or periodically
 */
export async function runRetentionCleanup(): Promise<{ metricsDeleted: number; logsDeleted: number; docsMigrated: number }> {
  const [metricsDeleted, logsDeleted, docsMigrated] = await Promise.all([
    cleanupOldRagMetrics(),
    cleanupOldSystemLogs(),
    migrateDocumentsToV8SessionScoped(),
  ]);
  return { metricsDeleted, logsDeleted, docsMigrated };
}

/**
 * Migrate legacy documents to v8 Session-Scoped RAG format
 * Adds missing userId, originSessionId, activeSessions, accessCount, lastAccessedAt
 */
async function migrateDocumentsToV8SessionScoped(): Promise<number> {
  let migratedCount = 0;
  
  await db.transaction('rw', db.documents, async () => {
    // Find documents missing activeSessions array
    const legacyDocs = await db.documents
      .filter(doc => !doc.activeSessions || !Array.isArray(doc.activeSessions))
      .toArray();
    
    for (const doc of legacyDocs) {
      const now = new Date();
      await db.documents.update(doc.id!, {
        userId: doc.userId || doc.sessionId?.split('_')[0] || 'anonymous',
        originSessionId: doc.originSessionId || doc.sessionId,
        activeSessions: [doc.sessionId], // Activate in the original upload session
        accessCount: doc.accessCount || 1,
        lastAccessedAt: doc.lastAccessedAt || doc.createdAt || now,
        updatedAt: now,
      });
      migratedCount++;
    }
  });
  
  if (migratedCount > 0) {
    console.log(`[DB] Migrated ${migratedCount} documents to v8 Session-Scoped RAG format`);
  }
  
  return migratedCount;
}

/**
 * Get storage stats for metrics and logs tables
 */
export async function getMetricsAndLogsStats(): Promise<{
  ragMetrics: { count: number; oldestTimestamp: number | null };
  systemLogs: { count: number; oldestTimestamp: number | null };
}> {
  const [ragMetrics, systemLogs] = await Promise.all([
    db.ragMetrics.orderBy('timestamp').first(),
    db.systemLogs.orderBy('timestamp').first(),
  ]);
  
  const [ragCount, logsCount] = await Promise.all([
    db.ragMetrics.count(),
    db.systemLogs.count(),
  ]);
  
  return {
    ragMetrics: {
      count: ragCount,
      oldestTimestamp: ragMetrics?.timestamp ?? null,
    },
    systemLogs: {
      count: logsCount,
      oldestTimestamp: systemLogs?.timestamp ?? null,
    },
  };
}

export default db;
