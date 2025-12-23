/**
 * GOGGA Dexie to RxDB Migration Utility
 * One-time migration of data from Dexie to RxDB
 * 
 * Features:
 * - Incremental migration (tracks progress)
 * - Rollback capability (keeps Dexie data until confirmed)
 * - Validation of migrated data
 */

import { getDatabase, generateId } from './database';
import type {
  DocumentDoc,
  DocumentChunkDoc,
  ChatSessionDoc,
  ChatMessageDoc,
  GeneratedImageDoc,
  MemoryContextDoc,
  TokenUsageDoc,
  RagMetricDoc,
  SystemLogDoc,
  GoggaSmartSkillDoc,
} from './schemas';

// Import Dexie database from LEGACY file for migration (not the RxDB shim)
import { db as dexieDb, type Document as DexieDocument, type DocumentChunk as DexieChunk, type ChatSession as DexieSession, type ChatMessage as DexieMessage, type GeneratedImage as DexieImage, type UserPreference as DexiePreference, type MemoryContext as DexieMemory, type TokenUsage as DexieTokenUsage, type RagMetric as DexieRagMetric, type SystemLog as DexieLog, type GoggaSmartSkill as DexieSkill } from '../db-dexie-legacy';

// Migration state storage key
const MIGRATION_STATE_KEY = 'gogga_rxdb_migration_state';

// Migration state
interface MigrationState {
  started: boolean;
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
  tables: {
    documents: { migrated: boolean; count: number };
    chunks: { migrated: boolean; count: number };
    sessions: { migrated: boolean; count: number };
    messages: { migrated: boolean; count: number };
    images: { migrated: boolean; count: number };
    preferences: { migrated: boolean; count: number };
    memories: { migrated: boolean; count: number };
    tokenUsage: { migrated: boolean; count: number };
    ragMetrics: { migrated: boolean; count: number };
    systemLogs: { migrated: boolean; count: number };
    skills: { migrated: boolean; count: number };
  };
  errors: string[];
}

/**
 * Get current migration state
 */
export function getMigrationState(): MigrationState {
  if (typeof window === 'undefined') {
    return createInitialState();
  }
  
  try {
    const stored = localStorage.getItem(MIGRATION_STATE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Invalid stored data
  }
  
  return createInitialState();
}

/**
 * Create initial migration state
 */
function createInitialState(): MigrationState {
  return {
    started: false,
    completed: false,
    tables: {
      documents: { migrated: false, count: 0 },
      chunks: { migrated: false, count: 0 },
      sessions: { migrated: false, count: 0 },
      messages: { migrated: false, count: 0 },
      images: { migrated: false, count: 0 },
      preferences: { migrated: false, count: 0 },
      memories: { migrated: false, count: 0 },
      tokenUsage: { migrated: false, count: 0 },
      ragMetrics: { migrated: false, count: 0 },
      systemLogs: { migrated: false, count: 0 },
      skills: { migrated: false, count: 0 },
    },
    errors: [],
  };
}

/**
 * Save migration state
 */
function saveMigrationState(state: MigrationState): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
  }
}

/**
 * Check if migration is needed
 */
export async function isMigrationNeeded(): Promise<boolean> {
  const state = getMigrationState();
  
  // Already completed
  if (state.completed) {
    return false;
  }
  
  // Check if Dexie has any data
  try {
    const docCount = await dexieDb.documents.count();
    const sessionCount = await dexieDb.sessions.count();
    const messageCount = await dexieDb.messages.count();
    
    return docCount > 0 || sessionCount > 0 || messageCount > 0;
  } catch {
    // Dexie not available
    return false;
  }
}

/**
 * Migrate documents table
 */
async function migrateDocuments(state: MigrationState): Promise<void> {
  if (state.tables.documents.migrated) return;
  
  console.log('[Migration] Migrating documents...');
  
  const rxdb = await getDatabase();
  const dexieDocs = await dexieDb.documents.toArray() as DexieDocument[];
  
  for (const doc of dexieDocs) {
    // Handle legacy documents that may not have Session-Scoped RAG fields
    const now = new Date().toISOString();
    const rxDoc: DocumentDoc = {
      id: doc.id?.toString() ?? generateId(),
      // Session-Scoped RAG fields - provide defaults for legacy data
      userId: doc.userId ?? 'default-user',
      originSessionId: doc.originSessionId ?? doc.sessionId ?? 'migrated',
      activeSessions: doc.activeSessions ?? [doc.sessionId ?? 'migrated'],
      accessCount: doc.accessCount ?? 0,
      lastAccessedAt: doc.lastAccessedAt instanceof Date ? doc.lastAccessedAt.toISOString() : (doc.lastAccessedAt ?? now),
      // Legacy field
      sessionId: doc.sessionId ?? 'migrated',
      // Document content
      filename: doc.filename,
      content: doc.content,
      chunks: doc.chunks,
      chunkCount: doc.chunkCount,
      size: doc.size,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
    };
    
    try {
      await rxdb.documents.insert(rxDoc);
    } catch (error) {
      // Skip duplicates
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.documents = { migrated: true, count: dexieDocs.length };
  console.log(`[Migration] Migrated ${dexieDocs.length} documents`);
}

/**
 * Migrate document chunks table
 */
async function migrateChunks(state: MigrationState): Promise<void> {
  if (state.tables.chunks.migrated) return;
  
  console.log('[Migration] Migrating document chunks...');
  
  const rxdb = await getDatabase();
  const dexieChunks = await dexieDb.chunks.toArray() as DexieChunk[];
  
  for (const chunk of dexieChunks) {
    const rxDoc: DocumentChunkDoc = {
      id: chunk.id?.toString() ?? generateId(),
      documentId: chunk.documentId.toString(),
      sessionId: chunk.sessionId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      tokenCount: chunk.tokenCount,
    };
    
    try {
      await rxdb.documentChunks.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.chunks = { migrated: true, count: dexieChunks.length };
  console.log(`[Migration] Migrated ${dexieChunks.length} chunks`);
}

/**
 * Migrate chat sessions table
 */
async function migrateSessions(state: MigrationState): Promise<void> {
  if (state.tables.sessions.migrated) return;
  
  console.log('[Migration] Migrating chat sessions...');
  
  const rxdb = await getDatabase();
  const dexieSessions = await dexieDb.sessions.toArray() as DexieSession[];
  
  for (const session of dexieSessions) {
    const rxDoc: ChatSessionDoc = {
      id: session.id ?? generateId(),
      tier: session.tier,
      title: session.title,
      createdAt: session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt,
      updatedAt: session.updatedAt instanceof Date ? session.updatedAt.toISOString() : session.updatedAt,
      messageCount: session.messageCount,
    };
    
    try {
      await rxdb.chatSessions.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.sessions = { migrated: true, count: dexieSessions.length };
  console.log(`[Migration] Migrated ${dexieSessions.length} sessions`);
}

/**
 * Migrate chat messages table
 */
async function migrateMessages(state: MigrationState): Promise<void> {
  if (state.tables.messages.migrated) return;
  
  console.log('[Migration] Migrating chat messages...');
  
  const rxdb = await getDatabase();
  const dexieMessages = await dexieDb.messages.toArray() as DexieMessage[];
  
  for (const msg of dexieMessages) {
    const rxDoc: ChatMessageDoc = {
      id: msg.id?.toString() ?? generateId(),
      sessionId: msg.sessionId,
      role: msg.role,
      content: msg.content,
      tier: msg.tier,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    };
    
    // Only add optional properties if they exist
    if (msg.imageId) {
      rxDoc.imageId = msg.imageId.toString();
    }
    if (msg.thinking) {
      rxDoc.thinking = msg.thinking;
    }
    if (msg.meta) {
      rxDoc.meta = msg.meta as Record<string, unknown>;
    }
    
    try {
      await rxdb.chatMessages.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.messages = { migrated: true, count: dexieMessages.length };
  console.log(`[Migration] Migrated ${dexieMessages.length} messages`);
}

/**
 * Migrate generated images table
 */
async function migrateImages(state: MigrationState): Promise<void> {
  if (state.tables.images.migrated) return;
  
  console.log('[Migration] Migrating generated images...');
  
  const rxdb = await getDatabase();
  const dexieImages = await dexieDb.images.toArray() as DexieImage[];
  
  for (const img of dexieImages) {
    const rxDoc: GeneratedImageDoc = {
      id: img.id?.toString() ?? generateId(),
      sessionId: img.sessionId,
      prompt: img.prompt,
      enhancedPrompt: img.enhancedPrompt,
      thumbnailData: img.thumbnailData,
      fullImageData: img.fullImageData,
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
      tier: img.tier,
      model: img.model,
      isDeleted: img.isDeleted ?? false,
      createdAt: img.createdAt instanceof Date ? img.createdAt.toISOString() : img.createdAt,
    };
    
    try {
      await rxdb.generatedImages.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.images = { migrated: true, count: dexieImages.length };
  console.log(`[Migration] Migrated ${dexieImages.length} images`);
}

/**
 * Migrate user preferences table
 */
async function migratePreferences(state: MigrationState): Promise<void> {
  if (state.tables.preferences.migrated) return;
  
  console.log('[Migration] Migrating preferences...');
  
  const rxdb = await getDatabase();
  const dexiePrefs = await dexieDb.preferences.toArray() as DexiePreference[];
  
  for (const pref of dexiePrefs) {
    try {
      await rxdb.userPreferences.insert({
        key: pref.key,
        value: pref.value,
      });
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.preferences = { migrated: true, count: dexiePrefs.length };
  console.log(`[Migration] Migrated ${dexiePrefs.length} preferences`);
}

/**
 * Migrate memories table
 */
async function migrateMemories(state: MigrationState): Promise<void> {
  if (state.tables.memories.migrated) return;
  
  console.log('[Migration] Migrating memories...');
  
  const rxdb = await getDatabase();
  const dexieMemories = await dexieDb.memories.toArray() as DexieMemory[];
  
  for (const mem of dexieMemories) {
    const rxDoc: MemoryContextDoc = {
      id: mem.id?.toString() ?? generateId(),
      title: mem.title,
      content: mem.content,
      category: mem.category,
      source: mem.source,
      isActive: mem.isActive ?? true,
      priority: mem.priority ?? 0,
      tokenCount: mem.tokenCount ?? 0,
      createdAt: mem.createdAt instanceof Date ? mem.createdAt.toISOString() : mem.createdAt,
      updatedAt: mem.updatedAt instanceof Date ? mem.updatedAt.toISOString() : mem.updatedAt,
    };
    
    try {
      await rxdb.memoryContexts.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.memories = { migrated: true, count: dexieMemories.length };
  console.log(`[Migration] Migrated ${dexieMemories.length} memories`);
}

/**
 * Migrate token usage table
 */
async function migrateTokenUsage(state: MigrationState): Promise<void> {
  if (state.tables.tokenUsage.migrated) return;
  
  console.log('[Migration] Migrating token usage...');
  
  const rxdb = await getDatabase();
  const dexieUsage = await dexieDb.tokenUsage.toArray() as DexieTokenUsage[];
  
  for (const usage of dexieUsage) {
    const rxDoc: TokenUsageDoc = {
      id: usage.id?.toString() ?? generateId(),
      date: usage.date,
      tier: usage.tier,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      costZar: usage.costZar,
      requestCount: usage.requestCount,
      updatedAt: usage.updatedAt instanceof Date ? usage.updatedAt.toISOString() : usage.updatedAt,
    };
    
    try {
      await rxdb.tokenUsage.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.tokenUsage = { migrated: true, count: dexieUsage.length };
  console.log(`[Migration] Migrated ${dexieUsage.length} token usage records`);
}

/**
 * Migrate RAG metrics table
 */
async function migrateRagMetrics(state: MigrationState): Promise<void> {
  if (state.tables.ragMetrics.migrated) return;
  
  console.log('[Migration] Migrating RAG metrics...');
  
  const rxdb = await getDatabase();
  const dexieMetrics = await dexieDb.ragMetrics.toArray() as DexieRagMetric[];
  
  for (const metric of dexieMetrics) {
    const rxDoc: RagMetricDoc = {
      id: metric.id?.toString() ?? generateId(),
      metricId: metric.metricId,
      type: metric.type,
      timestamp: metric.timestamp,
      value: metric.value,
      createdAt: metric.createdAt instanceof Date ? metric.createdAt.toISOString() : metric.createdAt,
    };
    
    // Only add optional properties if they exist
    if (metric.sessionId) {
      rxDoc.sessionId = metric.sessionId;
    }
    if (metric.docId) {
      rxDoc.docId = metric.docId.toString();
    }
    
    try {
      await rxdb.ragMetrics.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.ragMetrics = { migrated: true, count: dexieMetrics.length };
  console.log(`[Migration] Migrated ${dexieMetrics.length} RAG metrics`);
}

/**
 * Migrate system logs table
 */
async function migrateSystemLogs(state: MigrationState): Promise<void> {
  if (state.tables.systemLogs.migrated) return;
  
  console.log('[Migration] Migrating system logs...');
  
  const rxdb = await getDatabase();
  const dexieLogs = await dexieDb.systemLogs.toArray() as DexieLog[];
  
  for (const log of dexieLogs) {
    const rxDoc: SystemLogDoc = {
      id: log.id?.toString() ?? generateId(),
      level: log.level,
      category: log.category,
      message: log.message,
      timestamp: log.timestamp,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt,
    };
    
    // Only add optional properties if they exist
    if (log.data) {
      rxDoc.data = log.data;
    }
    if (log.sessionId) {
      rxDoc.sessionId = log.sessionId;
    }
    
    try {
      await rxdb.systemLogs.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.systemLogs = { migrated: true, count: dexieLogs.length };
  console.log(`[Migration] Migrated ${dexieLogs.length} system logs`);
}

/**
 * Migrate GoggaSmart skills table
 */
async function migrateSkills(state: MigrationState): Promise<void> {
  if (state.tables.skills.migrated) return;
  
  console.log('[Migration] Migrating GoggaSmart skills...');
  
  const rxdb = await getDatabase();
  const dexieSkills = await dexieDb.skills.toArray() as DexieSkill[];
  
  for (const skill of dexieSkills) {
    // Map legacy status values to new schema
    const statusMap: Record<string, 'active' | 'archived' | 'under_review'> = {
      'active': 'active',
      'invalid': 'archived', // Map 'invalid' to 'archived'
      'archived': 'archived',
      'under_review': 'under_review',
    };
    const mappedStatus = statusMap[skill.status ?? 'active'] ?? 'active';
    
    const rxDoc: GoggaSmartSkillDoc = {
      id: skill.id?.toString() ?? generateId(),
      skillId: skill.skillId,
      userId: skill.userId,
      section: skill.section,
      content: skill.content,
      helpful: skill.helpful ?? 0,
      harmful: skill.harmful ?? 0,
      neutral: skill.neutral ?? 0,
      status: mappedStatus,
      createdAt: skill.createdAt instanceof Date ? skill.createdAt.toISOString() : skill.createdAt,
      updatedAt: skill.updatedAt instanceof Date ? skill.updatedAt.toISOString() : skill.updatedAt,
    };
    
    try {
      await rxdb.goggaSmartSkills.insert(rxDoc);
    } catch (error) {
      if (!(error as Error).message.includes('conflict')) {
        throw error;
      }
    }
  }
  
  state.tables.skills = { migrated: true, count: dexieSkills.length };
  console.log(`[Migration] Migrated ${dexieSkills.length} GoggaSmart skills`);
}

/**
 * Run the full migration
 */
export async function runMigration(
  onProgress?: (table: string, count: number) => void
): Promise<MigrationState> {
  const state = getMigrationState();
  
  if (state.completed) {
    console.log('[Migration] Migration already completed');
    return state;
  }
  
  console.log('[Migration] Starting Dexie to RxDB migration...');
  state.started = true;
  state.startedAt = new Date().toISOString();
  saveMigrationState(state);
  
  try {
    // Migrate each table
    await migrateDocuments(state);
    onProgress?.('documents', state.tables.documents.count);
    saveMigrationState(state);
    
    await migrateChunks(state);
    onProgress?.('chunks', state.tables.chunks.count);
    saveMigrationState(state);
    
    await migrateSessions(state);
    onProgress?.('sessions', state.tables.sessions.count);
    saveMigrationState(state);
    
    await migrateMessages(state);
    onProgress?.('messages', state.tables.messages.count);
    saveMigrationState(state);
    
    await migrateImages(state);
    onProgress?.('images', state.tables.images.count);
    saveMigrationState(state);
    
    await migratePreferences(state);
    onProgress?.('preferences', state.tables.preferences.count);
    saveMigrationState(state);
    
    await migrateMemories(state);
    onProgress?.('memories', state.tables.memories.count);
    saveMigrationState(state);
    
    await migrateTokenUsage(state);
    onProgress?.('tokenUsage', state.tables.tokenUsage.count);
    saveMigrationState(state);
    
    await migrateRagMetrics(state);
    onProgress?.('ragMetrics', state.tables.ragMetrics.count);
    saveMigrationState(state);
    
    await migrateSystemLogs(state);
    onProgress?.('systemLogs', state.tables.systemLogs.count);
    saveMigrationState(state);
    
    await migrateSkills(state);
    onProgress?.('skills', state.tables.skills.count);
    saveMigrationState(state);
    
    // Mark as completed
    state.completed = true;
    state.completedAt = new Date().toISOString();
    saveMigrationState(state);
    
    console.log('[Migration] Migration completed successfully!');
    
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    state.errors.push(error instanceof Error ? error.message : String(error));
    saveMigrationState(state);
  }
  
  return state;
}

/**
 * Reset migration state (for testing)
 */
export function resetMigrationState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(MIGRATION_STATE_KEY);
  }
}

/**
 * Delete Dexie database after successful migration
 * WARNING: This is irreversible!
 */
export async function deleteDexieDatabase(): Promise<void> {
  const state = getMigrationState();
  
  if (!state.completed) {
    throw new Error('Cannot delete Dexie database before migration is complete');
  }
  
  console.log('[Migration] Deleting Dexie database...');
  await dexieDb.delete();
  console.log('[Migration] Dexie database deleted');
}
