/**
 * GOGGA Database Shim - RxDB Implementation
 * Drop-in replacement for db.ts using RxDB instead of Dexie
 *
 * This provides the same exports as db.ts but uses RxDB under the hood.
 * All functions maintain API compatibility for a seamless migration.
 *
 * IMPORTANT: Uses dynamic imports to avoid Dexie version conflicts.
 * RxDB bundles Dexie 4.0.10, but project may have different version.
 */

import type { ChatMessageMeta } from '../types/prisma-json';

// Type-only imports don't cause runtime conflicts
import type {
  DocumentDoc,
  DocumentChunkDoc,
  ChatSessionDoc,
  ChatMessageDoc,
  GeneratedImageDoc,
  UserPreferenceDoc,
  MemoryContextDoc,
  TokenUsageDoc,
  RagMetricDoc,
  SystemLogDoc,
  GoggaSmartSkillDoc,
  GoggaRxDatabase,
} from './rxdb/schemas';

// ============================================================================
// Lazy-loaded RxDB module (avoids Dexie version conflict at import time)
// ============================================================================

let _rxdbModule: typeof import('./rxdb/database') | null = null;

async function getRxDBModule() {
  if (!_rxdbModule) {
    _rxdbModule = await import('./rxdb/database');
  }
  return _rxdbModule;
}

export async function getDatabase(): Promise<GoggaRxDatabase> {
  const mod = await getRxDBModule();
  return mod.getDatabase();
}

/**
 * Force reset the database - use to recover from schema mismatch errors (DB6)
 * After calling this, the page MUST be refreshed to recreate the database
 */
export async function forceResetDatabase(): Promise<void> {
  const mod = await getRxDBModule();
  return mod.forceResetDatabase();
}

// ============================================================================
// ID Generators (local versions to avoid static import)
// ============================================================================

export function generateId(): string {
  // Matches RxDB generateId format: timestamp + random
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

// ============================================================================
// Re-export limits and constants (same as Dexie version)
// ============================================================================

export const RAG_LIMITS = {
  // Per-document limits
  MAX_DOCUMENT_SIZE_MB: 50,
  MAX_DOCUMENT_SIZE_BYTES: 50 * 1024 * 1024,

  // RAG pool limits (JIGGA only)
  MAX_TOTAL_STORAGE_MB: 250,
  MAX_TOTAL_STORAGE_BYTES: 250 * 1024 * 1024,
  MAX_DOCS_PER_USER_POOL: 200,

  // Per-session chat document limits (non-RAG temp uploads)
  MAX_SESSION_DOCS: 10,
  MAX_SESSION_STORAGE_MB: 50,
  MAX_SESSION_STORAGE_BYTES: 50 * 1024 * 1024,

  // Legacy (deprecated - use session limits instead)
  JIVE_MAX_DOCS_PER_SESSION: 0, // JIVE no longer has RAG
  JIGGA_MAX_DOCS_PER_SESSION: 10,
} as const;

export const RETENTION_POLICY = {
  METRICS_DAYS: 30,
  LOGS_DAYS: 7,
  TOKEN_USAGE_DAYS: 90,
} as const;

export const MEMORY_LIMITS = {
  MAX_MEMORIES: 50,
  MAX_ACTIVE_MEMORIES: 10,
  MAX_MEMORY_TOKENS: 2000,
  MAX_TOTAL_CONTEXT: 8000,
  MAX_TOTAL_TOKENS: 8000,
  MAX_CONTENT_LENGTH: 8000, // Max characters per memory
} as const;

export const GOGGA_SMART_LIMITS = {
  MAX_SKILLS_PER_USER: 100,
  MAX_SKILLS_IN_PROMPT: 15,
  MIN_SCORE_THRESHOLD: -3,
} as const;

// ============================================================================
// Type Definitions (matching Dexie interface structure)
// These are exposed for consumers - they map to RxDB docs internally
// ============================================================================

export interface Document {
  id?: string;
  userId: string;
  originSessionId: string;
  activeSessions: string[];
  accessCount: number;
  lastAccessedAt: Date;
  sessionId: string;
  filename: string;
  content: string;
  chunks: string[];
  chunkCount: number;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id?: string;
  documentId: string;
  sessionId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
}

export interface ChatSession {
  id?: string;
  tier: 'jive' | 'jigga';
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface ChatMessage {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tier: string;
  timestamp: Date;
  imageId?: number;
  thinking?: string;
  meta?: ChatMessageMeta;
}

export interface GeneratedImage {
  id?: number;
  sessionId: string;
  prompt: string;
  enhancedPrompt: string;
  thumbnailData: string;
  fullImageData: string;
  mimeType: string;
  width: number;
  height: number;
  tier: string;
  model: string;
  isDeleted: boolean;
  createdAt: Date;
}

export interface UserPreference {
  key: string;
  value: string;
}

export interface MemoryContext {
  id?: number;
  title: string;
  content: string;
  category: 'personal' | 'project' | 'reference' | 'custom';
  source: 'user' | 'gogga';
  isActive: boolean;
  priority: number;
  tokenCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenUsage {
  id?: number;
  date: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  updatedAt: Date;
}

export interface ToolUsage {
  id?: string;
  date: string;
  toolName: string;
  tier: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  totalExecutionTimeMs: number;
  avgExecutionTimeMs: number;
  updatedAt: Date;
}

export interface RagMetric {
  id?: string;
  metricId: string;
  type:
    | 'retrieval'
    | 'embedding_generated'
    | 'query'
    | 'cache_hit'
    | 'cache_miss'
    | 'error';
  timestamp: number;
  sessionId?: string;
  docId?: string;
  value: Record<string, unknown>;
  createdAt: Date;
}

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

export interface GoggaSmartSkill {
  id?: number;
  skillId: string;
  userId: string;
  section: string;
  content: string;
  helpful: number;
  harmful: number;
  neutral: number;
  context?: string; // Added in schema v1
  status: 'active' | 'archived' | 'under_review';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Supported RAG formats (same as Dexie version)
// ============================================================================

export const SUPPORTED_RAG_FORMATS = {
  // Text formats
  'text/plain': { ext: '.txt', name: 'Text' },
  'text/markdown': { ext: '.md', name: 'Markdown' },
  'application/x-markdown': { ext: '.md', name: 'Markdown' },
  'text/csv': { ext: '.csv', name: 'CSV' },
  'application/json': { ext: '.json', name: 'JSON' },

  // Document formats
  'application/pdf': { ext: '.pdf', name: 'PDF' },
  'application/msword': { ext: '.doc', name: 'Word (Legacy)' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: '.docx',
    name: 'Word',
  },
  'application/vnd.oasis.opendocument.text': {
    ext: '.odt',
    name: 'OpenDocument Text',
  },
  'application/rtf': { ext: '.rtf', name: 'Rich Text' },
  'text/rtf': { ext: '.rtf', name: 'Rich Text' },

  // Spreadsheet formats
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: '.xlsx',
    name: 'Excel',
  },
  'application/vnd.ms-excel': { ext: '.xls', name: 'Excel (Legacy)' },
  'application/vnd.oasis.opendocument.spreadsheet': {
    ext: '.ods',
    name: 'OpenDocument Spreadsheet',
  },

  // Apple formats (iWork)
  'application/vnd.apple.pages': { ext: '.pages', name: 'Apple Pages' },
  'application/vnd.apple.numbers': { ext: '.numbers', name: 'Apple Numbers' },
} as const;

/**
 * Blocked executable/dangerous file extensions
 * These are never allowed for upload
 */
export const BLOCKED_EXTENSIONS = [
  // Windows executables
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.pif',
  // Unix/Linux executables
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.csh',
  '.ksh',
  // macOS
  '.app',
  '.dmg',
  '.pkg',
  // Scripts that can execute
  '.ps1',
  '.psm1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.ws',
  '.wsf',
  '.wsc',
  '.wsh',
  // Java
  '.jar',
  '.class',
  // Python (only .py - .pyw is windowed)
  '.pyw',
  // Other dangerous
  '.reg',
  '.inf',
  '.lnk',
  '.url',
  '.hta',
] as const;

/**
 * Check if file extension is blocked (executable/dangerous)
 */
export function isBlockedExtension(filename: string): boolean {
  const ext = '.' + filename.toLowerCase().split('.').pop();
  return BLOCKED_EXTENSIONS.includes(
    ext as (typeof BLOCKED_EXTENSIONS)[number]
  );
}

export type SupportedMimeType = keyof typeof SUPPORTED_RAG_FORMATS;

export function isSupportedFormat(mimeType: string): boolean {
  return mimeType in SUPPORTED_RAG_FORMATS;
}

export function getSupportedExtensions(): string[] {
  return Object.values(SUPPORTED_RAG_FORMATS).map((f) => f.ext);
}

// ============================================================================
// Conversion helpers: RxDB <-> Dexie format
// ============================================================================

// Helper to convert DeepReadonlyObject to mutable (RxDB returns readonly docs)
function toMutable<T>(obj: T): T {
  return structuredClone(obj) as unknown as T;
}

// Wrapper that converts DeepReadonlyObject to mutable version
function docToDocument(doc: DocumentDoc | Record<string, unknown>): Document {
  const d = doc as DocumentDoc;
  console.log(
    '[db.ts] docToDocument - input id:',
    d.id,
    'filename:',
    d.filename
  );
  const result: Document = {
    id: d.id, // Keep string ID as-is (RxDB uses string IDs)
    userId: d.userId,
    originSessionId: d.originSessionId,
    activeSessions: [...(d.activeSessions || [])],
    accessCount: d.accessCount,
    lastAccessedAt: new Date(d.lastAccessedAt),
    sessionId: d.sessionId,
    filename: d.filename,
    content: d.content,
    chunks: [...(d.chunks || [])],
    chunkCount: d.chunkCount,
    size: d.size,
    mimeType: d.mimeType,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  };
  console.log('[db.ts] docToDocument - result id:', result.id);
  return result;
}

function sessionToChat(
  doc: ChatSessionDoc | Record<string, unknown>
): ChatSession {
  const d = doc as ChatSessionDoc;
  return {
    id: d.id,
    tier: d.tier,
    title: d.title,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
    messageCount: d.messageCount,
  };
}

function messageToChat(
  doc: ChatMessageDoc | Record<string, unknown>
): ChatMessage {
  const d = doc as ChatMessageDoc;
  const id = parseInt(d.id) || undefined;
  const imageId = d.imageId ? parseInt(d.imageId.toString()) : undefined;
  const result: ChatMessage = {
    sessionId: d.sessionId,
    role: d.role,
    content: d.content,
    tier: d.tier,
    timestamp: new Date(d.timestamp),
    meta: (d.meta || {}) as ChatMessageMeta,
  };
  if (id !== undefined) result.id = id;
  if (imageId !== undefined) result.imageId = imageId;
  if (d.thinking) result.thinking = d.thinking;
  return result;
}

function imageToGenerated(
  doc: GeneratedImageDoc | Record<string, unknown>
): GeneratedImage {
  const d = doc as GeneratedImageDoc;
  const id = parseInt(d.id) || undefined;
  const result: GeneratedImage = {
    sessionId: d.sessionId,
    prompt: d.prompt,
    enhancedPrompt: d.enhancedPrompt,
    thumbnailData: d.thumbnailData,
    fullImageData: d.fullImageData,
    mimeType: d.mimeType,
    width: d.width,
    height: d.height,
    tier: d.tier,
    model: d.model,
    isDeleted: d.isDeleted,
    createdAt: new Date(d.createdAt),
  };
  if (id !== undefined) result.id = id;
  return result;
}

function memoryToContext(
  doc: MemoryContextDoc | Record<string, unknown>
): MemoryContext {
  const d = doc as MemoryContextDoc;
  const id = parseInt(d.id) || undefined;
  const result: MemoryContext = {
    title: d.title,
    content: d.content,
    category: d.category as MemoryContext['category'],
    source: d.source as MemoryContext['source'],
    isActive: d.isActive,
    priority: d.priority,
    tokenCount: d.tokenCount,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  };
  if (id !== undefined) result.id = id;
  return result;
}

function skillToSmart(
  doc: GoggaSmartSkillDoc | Record<string, unknown>
): GoggaSmartSkill {
  const d = doc as GoggaSmartSkillDoc;
  const id = parseInt(d.id) || undefined;
  const result: GoggaSmartSkill = {
    skillId: d.skillId,
    userId: d.userId,
    section: d.section,
    content: d.content,
    helpful: d.helpful,
    harmful: d.harmful,
    neutral: d.neutral,
    context: d.context,
    status: d.status,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  };
  if (id !== undefined) result.id = id;
  return result;
}

// ============================================================================
// Database proxy object (for db.table access patterns)
// ============================================================================

class RxDBProxy {
  private _db: GoggaRxDatabase | null = null;

  private async getDb(): Promise<GoggaRxDatabase> {
    if (!this._db) {
      this._db = await getDatabase();
    }
    return this._db;
  }

  // Proxy access to collections
  get documents() {
    return new CollectionProxy(() => this.getDb().then((db) => db.documents));
  }
  get chunks() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.documentChunks)
    );
  }
  get sessions() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.chatSessions)
    );
  }
  get messages() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.chatMessages)
    );
  }
  get images() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.generatedImages)
    );
  }
  get preferences() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.userPreferences)
    );
  }
  get tokenUsage() {
    return new CollectionProxy(() => this.getDb().then((db) => db.tokenUsage));
  }
  get memories() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.memoryContexts)
    );
  }
  get ragMetrics() {
    return new CollectionProxy(() => this.getDb().then((db) => db.ragMetrics));
  }
  get systemLogs() {
    return new CollectionProxy(() => this.getDb().then((db) => db.systemLogs));
  }
  get skills() {
    return new CollectionProxy(() =>
      this.getDb().then((db) => db.goggaSmartSkills)
    );
  }

  // Compatibility stubs for DatabaseMaintenance component (legacy Dexie-like API)
  isOpen(): boolean {
    return this._db !== null;
  }

  get verno(): number {
    return 1; // RxDB uses schema versioning per-collection
  }

  async close(): Promise<void> {
    if (this._db) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this._db as any).destroy?.();
      this._db = null;
    }
  }

  async open(): Promise<void> {
    await this.getDb();
  }

  async delete(): Promise<void> {
    if (this._db) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this._db as any).remove?.();
      this._db = null;
    }
  }
}

// Collection proxy for Dexie-like API
class CollectionProxy<T> {
  constructor(private getCollection: () => Promise<any>) {}

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const docs = await col.find().exec();
    return docs.map((d: any) => d.toJSON());
  }

  async count(): Promise<number> {
    const col = await this.getCollection();
    return col.count().exec();
  }

  async get(id: string | number): Promise<T | undefined> {
    const col = await this.getCollection();
    const doc = await col.findOne(String(id)).exec();
    return doc?.toJSON();
  }

  async add(item: T): Promise<string> {
    const col = await this.getCollection();
    const doc = await col.insert(item as any);
    return doc.id;
  }

  async bulkAdd(items: T[]): Promise<string[]> {
    const col = await this.getCollection();
    const ids: string[] = [];
    for (const item of items) {
      const doc = await col.insert(item as any);
      ids.push(doc.id);
    }
    return ids;
  }

  async put(item: T): Promise<string> {
    const col = await this.getCollection();
    const doc = await col.upsert(item as any);
    return doc.id;
  }

  async update(id: string | number, changes: Partial<T>): Promise<void> {
    const col = await this.getCollection();
    const doc = await col.findOne(String(id)).exec();
    if (doc) {
      await doc.patch(changes);
    }
  }

  async delete(id: string | number): Promise<void> {
    const col = await this.getCollection();
    const doc = await col.findOne(String(id)).exec();
    if (doc) {
      await doc.remove();
    }
  }

  async bulkDelete(ids: (string | number)[]): Promise<void> {
    const col = await this.getCollection();
    for (const id of ids) {
      const doc = await col.findOne(String(id)).exec();
      if (doc) {
        await doc.remove();
      }
    }
  }

  async clear(): Promise<void> {
    const col = await this.getCollection();
    const docs = await col.find().exec();
    for (const doc of docs) {
      await doc.remove();
    }
  }

  where(fieldOrSelector: Record<string, unknown>): QueryBuilder<T>;
  where(fieldOrSelector: string): WhereClause<T>;
  where(
    fieldOrSelector: string | Record<string, unknown>
  ): QueryBuilder<T> | WhereClause<T> {
    if (typeof fieldOrSelector === 'object') {
      return new QueryBuilder<T>(this.getCollection, fieldOrSelector);
    }
    return new WhereClause<T>(this.getCollection, fieldOrSelector);
  }

  orderBy(field: string) {
    return new OrderByClause(this.getCollection, field);
  }
}

class WhereClause<T> {
  constructor(
    private getCollection: () => Promise<any>,
    private field: string
  ) {}

  equals(value: any) {
    return new QueryBuilder<T>(this.getCollection, { [this.field]: value });
  }

  aboveOrEqual(value: any) {
    return new QueryBuilder<T>(this.getCollection, {
      [this.field]: { $gte: value },
    });
  }

  above(value: any) {
    return new QueryBuilder<T>(this.getCollection, {
      [this.field]: { $gt: value },
    });
  }

  below(value: any) {
    return new QueryBuilder<T>(this.getCollection, {
      [this.field]: { $lt: value },
    });
  }

  belowOrEqual(value: any) {
    return new QueryBuilder<T>(this.getCollection, {
      [this.field]: { $lte: value },
    });
  }
}

class OrderByClause<T> {
  private _desc = false;
  private _limit?: number;
  constructor(
    private getCollection: () => Promise<any>,
    private field: string
  ) {}

  reverse() {
    this._desc = true;
    return this;
  }

  limit(count: number) {
    this._limit = count;
    return this;
  }

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const query = col.find({
      selector: {},
      sort: [{ [this.field]: this._desc ? 'desc' : 'asc' }],
      ...(this._limit ? { limit: this._limit } : {}),
    });
    const docs = await query.exec();
    return docs.map((d: any) => d.toJSON());
  }

  filter(fn: (item: T) => boolean) {
    return new FilteredQuery(this.getCollection, this.field, this._desc, fn);
  }
}

class FilteredQuery<T> {
  constructor(
    private getCollection: () => Promise<any>,
    private field: string,
    private desc: boolean,
    private filterFn: (item: T) => boolean
  ) {}

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const query = col.find({
      sort: [{ [this.field]: this.desc ? 'desc' : 'asc' }],
    });
    const docs = await query.exec();
    return docs.map((d: any) => d.toJSON()).filter(this.filterFn);
  }
}

class QueryBuilder<T> {
  constructor(
    private getCollection: () => Promise<any>,
    private selector: Record<string, any>
  ) {}

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const docs = await col.find({ selector: this.selector }).exec();
    return docs.map((d: any) => d.toJSON());
  }

  async first(): Promise<T | undefined> {
    const arr = await this.toArray();
    return arr[0];
  }

  async count(): Promise<number> {
    const col = await this.getCollection();
    return col.count({ selector: this.selector }).exec();
  }

  async delete(): Promise<number> {
    const col = await this.getCollection();
    const docs = await col.find({ selector: this.selector }).exec();
    let count = 0;
    for (const doc of docs) {
      try {
        // Skip if already deleted
        if (doc.deleted) continue;
        await doc.remove();
        count++;
      } catch (error) {
        // Handle CONFLICT errors gracefully - document was already deleted/modified
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'CONFLICT'
        ) {
          console.log('[RxDB] Skipping already deleted document:', doc.primary);
          continue;
        }
        throw error;
      }
    }
    return count;
  }

  async modify(changes: Partial<T> | ((item: T) => void)): Promise<void> {
    const col = await this.getCollection();
    const docs = await col.find({ selector: this.selector }).exec();
    for (const doc of docs) {
      try {
        // Skip if already deleted
        if (doc.deleted) continue;
        if (typeof changes === 'function') {
          const data = doc.toJSON();
          changes(data);
          await doc.patch(data);
        } else {
          await doc.patch(changes);
        }
      } catch (error) {
        // Handle CONFLICT errors gracefully - document was modified/deleted
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'CONFLICT'
        ) {
          console.log(
            '[RxDB] Skipping conflicted document in modify:',
            doc.primary
          );
          continue;
        }
        throw error;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  and(fieldOrFilter: string | ((item: any) => boolean), value?: unknown) {
    if (typeof fieldOrFilter === 'function') {
      // Dexie-style filter function
      return new FilteredQueryBuilder<T>(
        this.getCollection,
        this.selector,
        fieldOrFilter
      );
    }
    return new QueryBuilder<T>(this.getCollection, {
      ...this.selector,
      [fieldOrFilter]: value,
    });
  }

  sortBy(field: string) {
    return new SortedQuery(this.getCollection, this.selector, field);
  }
}

class FilteredQueryBuilder<T> {
  constructor(
    private getCollection: () => Promise<any>,
    private selector: Record<string, any>,
    private filterFn: (item: T) => boolean
  ) {}

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const docs = await col.find({ selector: this.selector }).exec();
    return docs.map((d: any) => d.toJSON() as T).filter(this.filterFn);
  }

  async first(): Promise<T | undefined> {
    const arr = await this.toArray();
    return arr[0];
  }

  async count(): Promise<number> {
    const arr = await this.toArray();
    return arr.length;
  }
}

class SortedQuery<T> {
  constructor(
    private getCollection: () => Promise<any>,
    private selector: Record<string, any>,
    private sortField: string
  ) {}

  async toArray(): Promise<T[]> {
    const col = await this.getCollection();
    const docs = await col
      .find({
        selector: this.selector,
        sort: [{ [this.sortField]: 'asc' }],
      })
      .exec();
    return docs.map((d: any) => d.toJSON());
  }
}

// Singleton proxy instance
export const db = new RxDBProxy();

// ============================================================================
// Session Management
// ============================================================================

/**
 * Generate a unique session ID (CANONICAL IMPLEMENTATION)
 * Format: "session-{base36_timestamp}-{random}" for human-readable sorting
 * 
 * This is the single source of truth for session ID generation.
 * The rxdb/database.ts version mirrors this format for consistency.
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `session-${timestamp}-${random}`;
}

export async function createChatSession(
  tier: 'jive' | 'jigga'
): Promise<ChatSession> {
  const rxdb = await getDatabase();
  const now = new Date().toISOString();
  const session: ChatSessionDoc = {
    id: generateSessionId(),
    tier,
    title: `Chat ${new Date().toLocaleDateString()}`,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };

  await rxdb.chatSessions.insert(session);
  return sessionToChat(session);
}

export async function getChatSessions(
  tier?: 'jive' | 'jigga'
): Promise<ChatSession[]> {
  const rxdb = await getDatabase();
  let query = rxdb.chatSessions.find({
    sort: [{ updatedAt: 'desc' }],
  });

  if (tier) {
    query = rxdb.chatSessions.find({
      selector: { tier },
      sort: [{ updatedAt: 'desc' }],
    });
  }

  const docs = await query.exec();
  return docs.map((d) => sessionToChat(toMutable(d.toJSON())));
}

export async function getSession(
  sessionId: string
): Promise<ChatSession | undefined> {
  const rxdb = await getDatabase();
  const doc = await rxdb.chatSessions.findOne(sessionId).exec();
  if (!doc) return undefined;
  return sessionToChat(toMutable(doc.toJSON()));
}

export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.chatSessions.findOne(sessionId).exec();
  if (doc) {
    await doc.patch({ title, updatedAt: new Date().toISOString() });
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const rxdb = await getDatabase();

  // Helper to safely remove a document (handles conflicts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeRemove = async (doc: any) => {
    try {
      if (doc.deleted) return;
      await doc.remove();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'CONFLICT'
      ) {
        console.log('[RxDB] Skipping already deleted:', doc.primary);
        return;
      }
      throw error;
    }
  };

  // Delete messages
  const messages = await rxdb.chatMessages
    .find({ selector: { sessionId } })
    .exec();
  for (const msg of messages) await safeRemove(msg);

  // Delete images
  const images = await rxdb.generatedImages
    .find({ selector: { sessionId } })
    .exec();
  for (const img of images) await safeRemove(img);

  // Delete documents that originated from this session
  const sessionDocs = await rxdb.documents
    .find({ selector: { originSessionId: sessionId } })
    .exec();
  for (const doc of sessionDocs) await safeRemove(doc);

  // Deactivate documents from this session (but originated elsewhere)
  const activeDocs = await rxdb.documents.find().exec();
  for (const doc of activeDocs) {
    const data = doc.toJSON();
    // Skip docs that were already deleted (originated from this session)
    if (data.originSessionId === sessionId) continue;
    if (data.activeSessions?.includes(sessionId)) {
      try {
        await doc.patch({
          activeSessions: data.activeSessions.filter(
            (id: string) => id !== sessionId
          ),
          updatedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'CONFLICT'
        ) {
          console.log(
            '[RxDB] Skipping conflicted document patch:',
            doc.primary
          );
          continue;
        }
        throw error;
      }
    }
  }

  // Delete chunks
  const chunks = await rxdb.documentChunks
    .find({ selector: { sessionId } })
    .exec();
  for (const chunk of chunks) await safeRemove(chunk);

  // Delete session
  const session = await rxdb.chatSessions.findOne(sessionId).exec();
  if (session) await safeRemove(session);
}

// ============================================================================
// Message Management
// ============================================================================

export async function saveMessage(
  sessionId: string,
  message: Omit<ChatMessage, 'id' | 'sessionId'>
): Promise<number> {
  const rxdb = await getDatabase();
  const id = generateId();

  const doc: ChatMessageDoc = {
    id,
    sessionId,
    role: message.role,
    content: message.content,
    tier: message.tier,
    timestamp: message.timestamp.toISOString(),
    meta: (message.meta ?? {}) as Record<string, unknown>,
  };

  // Only add optional properties if they have values
  if (message.imageId !== undefined) {
    doc.imageId = message.imageId.toString();
  }
  if (message.thinking) {
    doc.thinking = message.thinking;
  }

  await rxdb.chatMessages.insert(doc);

  // Update session
  const msgCount = await rxdb.chatMessages
    .count({ selector: { sessionId } })
    .exec();
  const session = await rxdb.chatSessions.findOne(sessionId).exec();
  if (session) {
    await session.patch({
      updatedAt: new Date().toISOString(),
      messageCount: msgCount,
    });
  }

  return parseInt(id) || Date.now();
}

export async function getSessionMessages(
  sessionId: string
): Promise<ChatMessage[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.chatMessages
    .find({
      selector: { sessionId },
      sort: [{ timestamp: 'asc' }],
    })
    .exec();
  return docs.map((d) => messageToChat(d.toJSON()));
}

// ============================================================================
// Image Management
// ============================================================================

export async function saveGeneratedImage(
  sessionId: string,
  image: Omit<GeneratedImage, 'id' | 'sessionId' | 'isDeleted' | 'createdAt'>
): Promise<number> {
  const rxdb = await getDatabase();
  const id = generateId();

  const doc: GeneratedImageDoc = {
    id,
    sessionId,
    prompt: image.prompt,
    enhancedPrompt: image.enhancedPrompt,
    thumbnailData: image.thumbnailData,
    fullImageData: image.fullImageData,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    tier: image.tier,
    model: image.model,
    isDeleted: false,
    createdAt: new Date().toISOString(),
  };

  await rxdb.generatedImages.insert(doc);
  return parseInt(id) || Date.now();
}

export async function getSessionImages(
  sessionId: string
): Promise<GeneratedImage[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.generatedImages
    .find({
      selector: { sessionId },
      sort: [{ createdAt: 'asc' }],
    })
    .exec();
  return docs.map((d) => imageToGenerated(d.toJSON()));
}

export async function softDeleteImage(imageId: number): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.generatedImages.findOne(String(imageId)).exec();
  if (doc) {
    await doc.patch({ isDeleted: true });
  }
}

export async function getImage(
  imageId: number
): Promise<GeneratedImage | undefined> {
  const rxdb = await getDatabase();
  const doc = await rxdb.generatedImages.findOne(String(imageId)).exec();
  return doc ? imageToGenerated(doc.toJSON()) : undefined;
}

// ============================================================================
// Document Management - Session-Scoped RAG
// ============================================================================

/**
 * Get documents active in a session - OPTIMIZED with indexed queries
 * No longer loads ALL documents into memory
 */
export async function getActiveDocumentsForSession(
  sessionId: string
): Promise<Document[]> {
  const rxdb = await getDatabase();
  
  // First try: Query by sessionId (indexed field) for legacy docs
  // and filter activeSessions in JS (RxDB doesn't support $elemMatch on arrays well)
  const docs = await rxdb.documents
    .find({
      selector: {
        $or: [
          { sessionId: sessionId },
          { originSessionId: sessionId },
        ],
      },
    })
    .exec();

  // Filter to only docs that have this session in activeSessions
  // or are legacy docs (activeSessions empty/undefined)
  const activeDocs = docs.filter((doc) => {
    const data = doc.toJSON();
    // Active in this session
    if (data.activeSessions?.includes(sessionId)) {
      return true;
    }
    // Legacy doc that belongs to this session
    if (
      data.sessionId === sessionId &&
      (!data.activeSessions || data.activeSessions.length === 0)
    ) {
      return true;
    }
    return false;
  });

  // Single conversion pass - no duplicate conversions
  return activeDocs.map((d) => docToDocument(d.toJSON() as DocumentDoc));
}

export async function getUserDocumentPool(userId: string): Promise<Document[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.documents
    .find({
      selector: { userId },
      sort: [{ lastAccessedAt: 'desc' }],
    })
    .exec();
  return docs.map((d) => docToDocument(toMutable(d.toJSON())));
}

export async function getUserDocumentCount(userId: string): Promise<number> {
  const rxdb = await getDatabase();
  return rxdb.documents.count({ selector: { userId } }).exec();
}

export async function activateDocumentForSession(
  docId: string,
  sessionId: string
): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.documents.findOne(docId).exec();
  if (doc) {
    const data = doc.toJSON();
    if (!data.activeSessions.includes(sessionId)) {
      await doc.patch({
        activeSessions: [...data.activeSessions, sessionId],
        accessCount: (data.accessCount || 0) + 1,
        lastAccessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export async function deactivateDocumentFromSession(
  docId: string,
  sessionId: string
): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.documents.findOne(docId).exec();
  if (doc) {
    const data = doc.toJSON();
    await doc.patch({
      activeSessions: data.activeSessions.filter(
        (id: string) => id !== sessionId
      ),
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function getOrphanedDocuments(
  userId: string
): Promise<Document[]> {
  const allDocs = await getUserDocumentPool(userId);
  return allDocs.filter(
    (doc) => !doc.activeSessions || doc.activeSessions.length === 0
  );
}

export async function deleteDocumentFromPool(docId: string): Promise<void> {
  const rxdb = await getDatabase();

  // Delete chunks
  const chunks = await rxdb.documentChunks
    .find({ selector: { documentId: docId } })
    .exec();
  for (const chunk of chunks) await chunk.remove();

  // Delete document
  const doc = await rxdb.documents.findOne(docId).exec();
  if (doc) await doc.remove();
}

export async function getSessionDocuments(
  sessionId: string
): Promise<Document[]> {
  return getActiveDocumentsForSession(sessionId);
}

export async function clearSessionDocuments(sessionId: string): Promise<void> {
  const rxdb = await getDatabase();

  // Deactivate documents
  const docs = await rxdb.documents.find().exec();
  for (const doc of docs) {
    const data = doc.toJSON();
    if (data.activeSessions?.includes(sessionId)) {
      await doc.patch({
        activeSessions: data.activeSessions.filter(
          (id: string) => id !== sessionId
        ),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Delete chunks
  const chunks = await rxdb.documentChunks
    .find({ selector: { sessionId } })
    .exec();
  for (const chunk of chunks) await chunk.remove();
}

// ============================================================================
// Stats & Utilities
// ============================================================================

export async function clearAllData(): Promise<void> {
  const rxdb = await getDatabase();

  const docsDocs = await rxdb.documents.find().exec();
  for (const d of docsDocs) await d.remove();

  const chunkDocs = await rxdb.documentChunks.find().exec();
  for (const d of chunkDocs) await d.remove();

  const msgDocs = await rxdb.chatMessages.find().exec();
  for (const d of msgDocs) await d.remove();

  const sessDocs = await rxdb.chatSessions.find().exec();
  for (const d of sessDocs) await d.remove();

  const imgDocs = await rxdb.generatedImages.find().exec();
  for (const d of imgDocs) await d.remove();
}

export async function getDocumentCount(): Promise<number> {
  const rxdb = await getDatabase();
  return rxdb.documents.count().exec();
}

export async function getTotalChunks(): Promise<number> {
  const rxdb = await getDatabase();
  return rxdb.documentChunks.count().exec();
}

export async function getStorageStats(sessionId?: string): Promise<{
  documents: number;
  chunks: number;
  messages: number;
  images: number;
  estimatedSizeMB: number;
}> {
  const rxdb = await getDatabase();

  let docCount: number;
  let chunkCount: number;
  let msgCount: number;
  let imgCount: number;

  if (sessionId) {
    const docs = await rxdb.documents.find().exec();
    docCount = docs.filter((d) =>
      d.toJSON().activeSessions?.includes(sessionId)
    ).length;
    chunkCount = await rxdb.documentChunks
      .count({ selector: { sessionId } })
      .exec();
    msgCount = await rxdb.chatMessages
      .count({ selector: { sessionId } })
      .exec();
    imgCount = await rxdb.generatedImages
      .count({ selector: { sessionId } })
      .exec();
  } else {
    docCount = await rxdb.documents.count().exec();
    chunkCount = await rxdb.documentChunks.count().exec();
    msgCount = await rxdb.chatMessages.count().exec();
    imgCount = await rxdb.generatedImages.count().exec();
  }

  const estimatedSizeMB =
    (chunkCount * 500 + imgCount * 100000) / (1024 * 1024);

  return {
    documents: docCount,
    chunks: chunkCount,
    messages: msgCount,
    images: imgCount,
    estimatedSizeMB,
  };
}

export async function getTotalRAGStorageBytes(): Promise<number> {
  const rxdb = await getDatabase();
  const docs = await rxdb.documents.find().exec();
  return docs.reduce((total, doc) => total + doc.toJSON().size, 0);
}

export async function getTotalRAGStorageMB(): Promise<number> {
  const bytes = await getTotalRAGStorageBytes();
  return bytes / (1024 * 1024);
}

export async function checkStorageLimits(
  fileSize: number,
  tier: 'jive' | 'jigga',
  sessionId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (fileSize > RAG_LIMITS.MAX_DOCUMENT_SIZE_BYTES) {
    return {
      allowed: false,
      reason: `Document exceeds ${RAG_LIMITS.MAX_DOCUMENT_SIZE_MB}MB limit`,
    };
  }

  const currentTotal = await getTotalRAGStorageBytes();
  if (currentTotal + fileSize > RAG_LIMITS.MAX_TOTAL_STORAGE_BYTES) {
    return {
      allowed: false,
      reason: `Would exceed ${RAG_LIMITS.MAX_TOTAL_STORAGE_MB}MB total storage limit`,
    };
  }

  const rxdb = await getDatabase();
  const docs = await rxdb.documents.find().exec();
  const sessionDocCount = docs.filter((d) =>
    d.toJSON().activeSessions?.includes(sessionId)
  ).length;
  const maxDocs =
    tier === 'jive'
      ? RAG_LIMITS.JIVE_MAX_DOCS_PER_SESSION
      : RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION;

  if (sessionDocCount >= maxDocs) {
    return {
      allowed: false,
      reason: `Session has ${sessionDocCount}/${maxDocs} documents`,
    };
  }

  return { allowed: true };
}

export async function getAllDocuments(): Promise<Document[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.documents
    .find({ sort: [{ createdAt: 'desc' }] })
    .exec();
  return docs.map((d) => docToDocument(toMutable(d.toJSON())));
}

export async function getDocumentsGroupedBySession(): Promise<
  Map<string, { session: ChatSession | null; documents: Document[] }>
> {
  const rxdb = await getDatabase();
  const allDocs = await rxdb.documents.find().exec();
  const allSessions = await rxdb.chatSessions.find().exec();

  const sessionMap = new Map(
    allSessions.map((s) => [s.id, sessionToChat(toMutable(s.toJSON()))])
  );
  const result = new Map<
    string,
    { session: ChatSession | null; documents: Document[] }
  >();

  for (const doc of allDocs) {
    const data = doc.toJSON();
    const sessionId = data.originSessionId || data.sessionId;

    if (!result.has(sessionId)) {
      result.set(sessionId, {
        session: sessionMap.get(sessionId) || null,
        documents: [],
      });
    }
    result.get(sessionId)!.documents.push(docToDocument(data));
  }

  return result;
}

export async function getDocumentsByIds(ids: number[]): Promise<Document[]> {
  const rxdb = await getDatabase();
  const docs = await Promise.all(
    ids.map((id) => rxdb.documents.findOne(String(id)).exec())
  );
  return docs.filter(Boolean).map((d) => docToDocument(d!.toJSON()));
}

export async function getStorageUsageBreakdown(): Promise<{
  documents: { count: number; sizeBytes: number };
  images: { count: number; estimatedSizeBytes: number };
  messages: { count: number };
  total: { estimatedSizeBytes: number; estimatedSizeMB: number };
}> {
  const rxdb = await getDatabase();

  const docs = await rxdb.documents.find().exec();
  const docSize = docs.reduce((sum, d) => sum + d.toJSON().size, 0);

  const imgCount = await rxdb.generatedImages.count().exec();
  const imgSize = imgCount * 100000; // ~100KB per image estimate

  const msgCount = await rxdb.chatMessages.count().exec();

  const totalBytes = docSize + imgSize;

  return {
    documents: { count: docs.length, sizeBytes: docSize },
    images: { count: imgCount, estimatedSizeBytes: imgSize },
    messages: { count: msgCount },
    total: {
      estimatedSizeBytes: totalBytes,
      estimatedSizeMB: totalBytes / (1024 * 1024),
    },
  };
}

// ============================================================================
// Token Usage Tracking
// ============================================================================

export async function trackTokenUsage(params: {
  tier: string;
  inputTokens: number;
  outputTokens: number;
  costZar: number;
}): Promise<void> {
  const rxdb = await getDatabase();
  const today = new Date().toISOString().split('T')[0] ?? '';

  // Try to find existing record for today+tier
  const existing = await rxdb.tokenUsage
    .find({
      selector: { date: today, tier: params.tier },
    })
    .exec();

  if (existing.length > 0) {
    const doc = existing[0];
    if (doc) {
      const data = doc.toJSON();
      await doc.patch({
        inputTokens: data.inputTokens + params.inputTokens,
        outputTokens: data.outputTokens + params.outputTokens,
        totalTokens:
          data.totalTokens + params.inputTokens + params.outputTokens,
        costZar: data.costZar + params.costZar,
        requestCount: data.requestCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    await rxdb.tokenUsage.insert({
      id: generateId(),
      date: today,
      tier: params.tier,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      costZar: params.costZar,
      requestCount: 1,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function getTodayTokenUsage(): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  byTier: Record<
    string,
    { input: number; output: number; cost: number; requests: number }
  >;
}> {
  const rxdb = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const docs = await rxdb.tokenUsage.find({ selector: { date: today } }).exec();

  const result = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costZar: 0,
    requestCount: 0,
    byTier: {} as Record<
      string,
      { input: number; output: number; cost: number; requests: number }
    >,
  };

  for (const doc of docs) {
    const data = doc.toJSON();
    result.inputTokens += data.inputTokens;
    result.outputTokens += data.outputTokens;
    result.totalTokens += data.totalTokens;
    result.costZar += data.costZar;
    result.requestCount += data.requestCount;
    result.byTier[data.tier] = {
      input: data.inputTokens,
      output: data.outputTokens,
      cost: data.costZar,
      requests: data.requestCount,
    };
  }

  return result;
}

export async function getTokenUsageHistory(
  days: number = 30
): Promise<TokenUsage[]> {
  const rxdb = await getDatabase();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const docs = await rxdb.tokenUsage
    .find({
      selector: { date: { $gte: cutoffStr } },
      sort: [{ date: 'desc' }],
    })
    .exec();

  return docs.map((d) => {
    const data = d.toJSON();
    return {
      id: parseInt(data.id) || undefined,
      date: data.date,
      tier: data.tier,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.totalTokens,
      costZar: data.costZar,
      requestCount: data.requestCount,
      updatedAt: new Date(data.updatedAt),
    };
  });
}

export async function getTotalTokenUsage(): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
}> {
  const rxdb = await getDatabase();
  const docs = await rxdb.tokenUsage.find().exec();

  return docs.reduce(
    (acc, doc) => {
      const data = doc.toJSON();
      return {
        inputTokens: acc.inputTokens + data.inputTokens,
        outputTokens: acc.outputTokens + data.outputTokens,
        totalTokens: acc.totalTokens + data.totalTokens,
        costZar: acc.costZar + data.costZar,
        requestCount: acc.requestCount + data.requestCount,
      };
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costZar: 0,
      requestCount: 0,
    }
  );
}

/**
 * Get token usage for the current month
 * Returns aggregated stats with by-tier breakdown
 */
export async function getMonthlyTokenUsage(): Promise<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costZar: number;
  requestCount: number;
  month: string;
  byTier: Record<
    string,
    { input: number; output: number; cost: number; requests: number }
  >;
}> {
  const rxdb = await getDatabase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const monthLabel = now.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });

  const docs = await rxdb.tokenUsage
    .find({
      selector: { date: { $gte: monthStartStr } },
    })
    .exec();

  const result = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costZar: 0,
    requestCount: 0,
    month: monthLabel,
    byTier: {} as Record<
      string,
      { input: number; output: number; cost: number; requests: number }
    >,
  };

  for (const doc of docs) {
    const data = doc.toJSON();
    result.inputTokens += data.inputTokens;
    result.outputTokens += data.outputTokens;
    result.totalTokens += data.totalTokens;
    result.costZar += data.costZar;
    result.requestCount += data.requestCount;

    // Aggregate by tier
    if (!result.byTier[data.tier]) {
      result.byTier[data.tier] = { input: 0, output: 0, cost: 0, requests: 0 };
    }
    const tierData = result.byTier[data.tier]!;
    tierData.input += data.inputTokens;
    tierData.output += data.outputTokens;
    tierData.cost += data.costZar;
    tierData.requests += data.requestCount;
  }

  return result;
}

// ============================================================================
// Tool Usage Analytics
// ============================================================================

/**
 * Track a tool call for analytics
 * Records tool name, tier, success status, and execution time
 */
export async function trackToolUsage(params: {
  toolName: string;
  tier: string;
  success: boolean;
  executionTimeMs?: number;
}): Promise<void> {
  const rxdb = await getDatabase();
  const today = new Date().toISOString().split('T')[0] ?? '';
  const compositeId = `${today}_${params.toolName}_${params.tier}`;

  // Try to find existing record for today+tool+tier
  const existing = await rxdb.toolUsage
    .find({
      selector: { id: compositeId },
    })
    .exec();

  if (existing.length > 0) {
    const doc = existing[0];
    if (doc) {
      const data = doc.toJSON();
      await doc.patch({
        callCount: data.callCount + 1,
        successCount: params.success
          ? data.successCount + 1
          : data.successCount,
        failureCount: params.success
          ? data.failureCount
          : data.failureCount + 1,
        totalExecutionTimeMs:
          data.totalExecutionTimeMs + (params.executionTimeMs ?? 0),
        avgExecutionTimeMs: Math.round(
          (data.totalExecutionTimeMs + (params.executionTimeMs ?? 0)) /
            (data.callCount + 1)
        ),
        updatedAt: new Date().toISOString(),
      });
    }
  } else {
    await rxdb.toolUsage.insert({
      id: compositeId,
      date: today,
      toolName: params.toolName,
      tier: params.tier,
      callCount: 1,
      successCount: params.success ? 1 : 0,
      failureCount: params.success ? 0 : 1,
      totalExecutionTimeMs: params.executionTimeMs ?? 0,
      avgExecutionTimeMs: params.executionTimeMs ?? 0,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Get most used tools with usage stats
 * Returns top N tools sorted by call count
 */
export async function getMostUsedTools(limit: number = 10): Promise<
  {
    toolName: string;
    callCount: number;
    successRate: number;
    avgExecutionTimeMs: number;
    tier: string;
  }[]
> {
  const rxdb = await getDatabase();
  const docs = await rxdb.toolUsage.find().exec();

  // Aggregate by tool name (across all dates and tiers)
  const toolAggregates = new Map<
    string,
    {
      callCount: number;
      successCount: number;
      totalExecutionTimeMs: number;
      tiers: Set<string>;
    }
  >();

  for (const doc of docs) {
    const data = doc.toJSON();
    const existing = toolAggregates.get(data.toolName) ?? {
      callCount: 0,
      successCount: 0,
      totalExecutionTimeMs: 0,
      tiers: new Set<string>(),
    };

    existing.callCount += data.callCount;
    existing.successCount += data.successCount;
    existing.totalExecutionTimeMs += data.totalExecutionTimeMs;
    existing.tiers.add(data.tier);
    toolAggregates.set(data.toolName, existing);
  }

  // Convert to array and sort by call count
  const sortedTools = Array.from(toolAggregates.entries())
    .map(([toolName, stats]) => ({
      toolName,
      callCount: stats.callCount,
      successRate:
        stats.callCount > 0
          ? Math.round((stats.successCount / stats.callCount) * 100)
          : 0,
      avgExecutionTimeMs:
        stats.callCount > 0
          ? Math.round(stats.totalExecutionTimeMs / stats.callCount)
          : 0,
      tier: Array.from(stats.tiers).join(', '),
    }))
    .sort((a, b) => b.callCount - a.callCount)
    .slice(0, limit);

  return sortedTools;
}

/**
 * Get tool usage for the current month
 */
export async function getMonthlyToolUsage(): Promise<{
  month: string;
  totalCalls: number;
  successRate: number;
  byTool: { toolName: string; callCount: number; successRate: number }[];
}> {
  const rxdb = await getDatabase();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];
  const monthLabel = now.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });

  const docs = await rxdb.toolUsage
    .find({
      selector: { date: { $gte: monthStartStr } },
    })
    .exec();

  let totalCalls = 0;
  let totalSuccess = 0;
  const toolAggregates = new Map<
    string,
    { callCount: number; successCount: number }
  >();

  for (const doc of docs) {
    const data = doc.toJSON();
    totalCalls += data.callCount;
    totalSuccess += data.successCount;

    const existing = toolAggregates.get(data.toolName) ?? {
      callCount: 0,
      successCount: 0,
    };
    existing.callCount += data.callCount;
    existing.successCount += data.successCount;
    toolAggregates.set(data.toolName, existing);
  }

  const byTool = Array.from(toolAggregates.entries())
    .map(([toolName, stats]) => ({
      toolName,
      callCount: stats.callCount,
      successRate:
        stats.callCount > 0
          ? Math.round((stats.successCount / stats.callCount) * 100)
          : 0,
    }))
    .sort((a, b) => b.callCount - a.callCount);

  return {
    month: monthLabel,
    totalCalls,
    successRate:
      totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 0,
    byTool,
  };
}

// ============================================================================
// Memory Context Management
// ============================================================================

export type MemoryCategory = MemoryContext['category'];
export type MemorySource = MemoryContext['source'];

export async function createMemory(
  memory: Omit<MemoryContext, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const rxdb = await getDatabase();
  const now = new Date().toISOString();
  const id = generateId();

  await rxdb.memoryContexts.insert({
    id,
    title: memory.title,
    content: memory.content,
    category: memory.category,
    source: memory.source,
    isActive: memory.isActive,
    priority: memory.priority,
    tokenCount: memory.tokenCount,
    createdAt: now,
    updatedAt: now,
  });

  return parseInt(id) || Date.now();
}

export async function updateMemory(
  id: number,
  updates: Partial<Omit<MemoryContext, 'id' | 'createdAt'>>
): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.memoryContexts.findOne(String(id)).exec();
  if (doc) {
    await doc.patch({ ...updates, updatedAt: new Date().toISOString() });
  }
}

export async function deleteMemory(id: number): Promise<void> {
  const rxdb = await getDatabase();
  const doc = await rxdb.memoryContexts.findOne(String(id)).exec();
  if (doc) await doc.remove();
}

export async function deleteGoggaMemory(id: number): Promise<boolean> {
  const rxdb = await getDatabase();
  const doc = await rxdb.memoryContexts.findOne(String(id)).exec();
  if (doc && doc.toJSON().source === 'gogga') {
    await doc.remove();
    return true;
  }
  return false;
}

export async function getMemoriesBySource(
  source: MemorySource
): Promise<MemoryContext[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.memoryContexts.find({ selector: { source } }).exec();
  return docs.map((d) => memoryToContext(toMutable(d.toJSON())));
}

export async function getAllMemories(): Promise<MemoryContext[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.memoryContexts.find().exec();
  return docs.map((d) => memoryToContext(toMutable(d.toJSON())));
}

export async function getActiveMemories(): Promise<MemoryContext[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.memoryContexts
    .find({
      selector: { isActive: true },
      sort: [{ priority: 'desc' }],
    })
    .exec();
  return docs.map((d) => memoryToContext(toMutable(d.toJSON())));
}

export async function getMemoriesByCategory(
  category: MemoryCategory
): Promise<MemoryContext[]> {
  const rxdb = await getDatabase();
  const docs = await rxdb.memoryContexts
    .find({
      selector: { category },
      sort: [{ priority: 'desc' }],
    })
    .exec();
  return docs.map((d) => memoryToContext(toMutable(d.toJSON())));
}

export async function getMemoryContextForLLM(
  maxTokens: number = MEMORY_LIMITS.MAX_TOTAL_TOKENS
): Promise<string> {
  const memories = await getActiveMemories();

  let totalTokens = 0;
  const included: MemoryContext[] = [];

  for (const memory of memories) {
    if (totalTokens + memory.tokenCount <= maxTokens) {
      included.push(memory);
      totalTokens += memory.tokenCount;
    }
  }

  if (included.length === 0) return '';

  return included.map((m) => `### ${m.title}\n${m.content}`).join('\n\n');
}

export async function getMemoryStats(): Promise<{
  total: number;
  active: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  totalTokens: number;
  activeTokens: number;
}> {
  const rxdb = await getDatabase();
  const docs = await rxdb.memoryContexts.find().exec();

  const stats = {
    total: docs.length,
    active: 0,
    byCategory: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    totalTokens: 0,
    activeTokens: 0,
  };

  for (const doc of docs) {
    const data = doc.toJSON();
    stats.totalTokens += data.tokenCount;

    if (data.isActive) {
      stats.active++;
      stats.activeTokens += data.tokenCount;
    }

    stats.byCategory[data.category] =
      (stats.byCategory[data.category] || 0) + 1;
    stats.bySource[data.source] = (stats.bySource[data.source] || 0) + 1;
  }

  return stats;
}

// ============================================================================
// RAG Metrics
// ============================================================================

export async function saveRagMetric(
  metric: Omit<RagMetric, 'id' | 'createdAt'>
): Promise<string> {
  const rxdb = await getDatabase();
  const id = generateId();

  await rxdb.ragMetrics.insert({
    id,
    metricId: metric.metricId,
    type: metric.type,
    timestamp: metric.timestamp,
    sessionId: metric.sessionId,
    docId: metric.docId?.toString(),
    value: metric.value,
    createdAt: new Date().toISOString(),
  });

  return id;
}

export async function getRecentRagMetrics(options?: {
  type?: RagMetric['type'];
  sessionId?: string;
  limit?: number;
  since?: number;
}): Promise<RagMetric[]> {
  const rxdb = await getDatabase();

  const selector: Record<string, any> = {};
  if (options?.type) selector.type = options.type;
  if (options?.sessionId) selector.sessionId = options.sessionId;
  if (options?.since) selector.timestamp = { $gte: options.since };

  const docs = await rxdb.ragMetrics
    .find({
      selector,
      sort: [{ timestamp: 'desc' }],
      limit: options?.limit || 100,
    })
    .exec();

  return docs.map((d) => {
    const data = d.toJSON();
    return {
      id: data.id,
      metricId: data.metricId,
      type: data.type as RagMetric['type'],
      timestamp: data.timestamp,
      sessionId: data.sessionId,
      docId: data.docId,
      value: data.value,
      createdAt: new Date(data.createdAt),
    };
  });
}

export async function getAggregatedRagMetrics(sessionId?: string): Promise<{
  totalQueries: number;
  totalRetrievals: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  avgRetrievalTime: number;
}> {
  const metrics = await getRecentRagMetrics({ sessionId });

  const result = {
    totalQueries: 0,
    totalRetrievals: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
    avgRetrievalTime: 0,
  };

  let totalTime = 0;
  let timeCount = 0;

  for (const m of metrics) {
    switch (m.type) {
      case 'query':
        result.totalQueries++;
        break;
      case 'retrieval':
        result.totalRetrievals++;
        if (m.value?.durationMs) {
          totalTime += m.value.durationMs as number;
          timeCount++;
        }
        break;
      case 'cache_hit':
        result.cacheHits++;
        break;
      case 'cache_miss':
        result.cacheMisses++;
        break;
      case 'error':
        result.errors++;
        break;
    }
  }

  if (timeCount > 0) result.avgRetrievalTime = totalTime / timeCount;

  return result;
}

export async function cleanupOldRagMetrics(): Promise<number> {
  const rxdb = await getDatabase();
  const cutoff =
    Date.now() - RETENTION_POLICY.METRICS_DAYS * 24 * 60 * 60 * 1000;

  const old = await rxdb.ragMetrics
    .find({
      selector: { timestamp: { $lt: cutoff } },
    })
    .exec();

  for (const doc of old) await doc.remove();
  return old.length;
}

export async function clearAllRagMetrics(): Promise<void> {
  const rxdb = await getDatabase();
  const docs = await rxdb.ragMetrics.find().exec();
  for (const d of docs) await d.remove();
}

// ============================================================================
// System Logs
// ============================================================================

export async function saveSystemLog(
  log: Omit<SystemLog, 'id' | 'createdAt'>
): Promise<number> {
  const rxdb = await getDatabase();
  const id = generateId();

  await rxdb.systemLogs.insert({
    id,
    level: log.level,
    category: log.category,
    message: log.message,
    data: log.data,
    sessionId: log.sessionId,
    timestamp: log.timestamp,
    createdAt: new Date().toISOString(),
  });

  return parseInt(id) || Date.now();
}

export async function logDebug(
  category: SystemLog['category'],
  message: string,
  data?: Record<string, unknown>,
  sessionId?: string
): Promise<void> {
  await saveSystemLog({
    level: 'debug',
    category,
    message,
    data,
    sessionId,
    timestamp: Date.now(),
  });
}

export async function logInfo(
  category: SystemLog['category'],
  message: string,
  data?: Record<string, unknown>,
  sessionId?: string
): Promise<void> {
  await saveSystemLog({
    level: 'info',
    category,
    message,
    data,
    sessionId,
    timestamp: Date.now(),
  });
}

export async function logWarn(
  category: SystemLog['category'],
  message: string,
  data?: Record<string, unknown>,
  sessionId?: string
): Promise<void> {
  await saveSystemLog({
    level: 'warn',
    category,
    message,
    data,
    sessionId,
    timestamp: Date.now(),
  });
}

export async function logError(
  category: SystemLog['category'],
  message: string,
  data?: Record<string, unknown>,
  sessionId?: string
): Promise<void> {
  await saveSystemLog({
    level: 'error',
    category,
    message,
    data,
    sessionId,
    timestamp: Date.now(),
  });
}

export async function getRecentSystemLogs(options?: {
  level?: SystemLog['level'];
  category?: SystemLog['category'];
  sessionId?: string;
  limit?: number;
  since?: number;
}): Promise<SystemLog[]> {
  const rxdb = await getDatabase();

  const selector: Record<string, any> = {};
  if (options?.level) selector.level = options.level;
  if (options?.category) selector.category = options.category;
  if (options?.sessionId) selector.sessionId = options.sessionId;
  if (options?.since) selector.timestamp = { $gte: options.since };

  const docs = await rxdb.systemLogs
    .find({
      selector,
      sort: [{ timestamp: 'desc' }],
      limit: options?.limit || 100,
    })
    .exec();

  return docs.map((d) => {
    const data = d.toJSON();
    return {
      id: parseInt(data.id) || undefined,
      level: data.level as SystemLog['level'],
      category: data.category as SystemLog['category'],
      message: data.message,
      data: data.data,
      sessionId: data.sessionId,
      timestamp: data.timestamp,
      createdAt: new Date(data.createdAt),
    };
  });
}

export async function cleanupOldSystemLogs(): Promise<number> {
  const rxdb = await getDatabase();
  const cutoff = Date.now() - RETENTION_POLICY.LOGS_DAYS * 24 * 60 * 60 * 1000;

  const old = await rxdb.systemLogs
    .find({
      selector: { timestamp: { $lt: cutoff } },
    })
    .exec();

  for (const doc of old) await doc.remove();
  return old.length;
}

export async function clearAllSystemLogs(): Promise<void> {
  const rxdb = await getDatabase();
  const docs = await rxdb.systemLogs.find().exec();
  for (const d of docs) await d.remove();
}

export async function runRetentionCleanup(): Promise<{
  metricsDeleted: number;
  logsDeleted: number;
  docsMigrated: number;
}> {
  const metricsDeleted = await cleanupOldRagMetrics();
  const logsDeleted = await cleanupOldSystemLogs();
  return { metricsDeleted, logsDeleted, docsMigrated: 0 };
}

export async function getMetricsAndLogsStats(): Promise<{
  metrics: { count: number; oldestTimestamp: number | null };
  logs: { count: number; oldestTimestamp: number | null };
}> {
  const rxdb = await getDatabase();

  const metrics = await rxdb.ragMetrics
    .find({ sort: [{ timestamp: 'asc' }] })
    .exec();
  const logs = await rxdb.systemLogs
    .find({ sort: [{ timestamp: 'asc' }] })
    .exec();

  return {
    metrics: {
      count: metrics.length,
      oldestTimestamp:
        metrics.length > 0 && metrics[0] ? metrics[0].toJSON().timestamp : null,
    },
    logs: {
      count: logs.length,
      oldestTimestamp:
        logs.length > 0 && logs[0] ? logs[0].toJSON().timestamp : null,
    },
  };
}

export default db;
