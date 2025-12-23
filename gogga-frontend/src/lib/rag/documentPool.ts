/**
 * GOGGA Document Pool Manager
 * 
 * Manages user's persistent document pool (max 100 docs).
 * Documents belong to users, not sessions. Sessions borrow documents temporarily.
 * 
 * Key concepts:
 * - originSessionId: Where doc was uploaded (frozen)
 * - activeSessions[]: Which sessions can RAG-search this doc
 * - Pool limit: 100 docs per user (hard limit)
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

import type { DocumentDoc, VectorEmbeddingDoc } from '../rxdb/schemas';
import { getDatabase } from '../rxdb/database';

// Pool limits
export const POOL_LIMITS = {
  MAX_DOCS_PER_USER: 100,
  ORPHAN_WARNING_THRESHOLD: 10, // Warn when this many orphaned docs
} as const;

// Document with computed properties
export interface PoolDocument extends DocumentDoc {
  isOrphaned: boolean;  // activeSessions.length === 0
  sessionCount: number; // Number of active sessions
}

// Pool statistics
export interface PoolStats {
  totalDocs: number;
  totalSize: number;           // Bytes
  activeDocsCount: number;     // Docs with at least 1 active session
  orphanedDocsCount: number;   // Docs with no active sessions
  availableSlots: number;      // MAX_DOCS - totalDocs
}

// Pool operation result
export interface PoolOperationResult {
  success: boolean;
  message: string;
  docId?: string;
  stats?: PoolStats;
}

/**
 * DocumentPoolManager - Singleton for user document pool operations
 * 
 * Pattern: Lazy singleton with RxDB integration
 */
export class DocumentPoolManager {
  private static instance: DocumentPoolManager | null = null;
  private userId: string | null = null;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  static getInstance(): DocumentPoolManager {
    if (!DocumentPoolManager.instance) {
      DocumentPoolManager.instance = new DocumentPoolManager();
    }
    return DocumentPoolManager.instance;
  }
  
  /**
   * Initialize with user context
   */
  async init(userId: string): Promise<void> {
    this.userId = userId;
  }
  
  /**
   * Get all documents in user's pool
   */
  async getPool(): Promise<PoolDocument[]> {
    if (!this.userId) {
      throw new Error('DocumentPoolManager not initialized - call init(userId) first');
    }
    
    const db = await getDatabase();
    const docs = await db.documents.find({
      selector: { userId: this.userId },
    }).exec();
    
    return docs.map((doc: any) => this.toPoolDocument(doc.toJSON() as DocumentDoc));
  }
  
  /**
   * Get pool statistics
   */
  async getStats(): Promise<PoolStats> {
    const docs = await this.getPool();
    
    const totalSize = docs.reduce((sum, doc) => sum + (doc.size || 0), 0);
    const activeDocsCount = docs.filter(doc => !doc.isOrphaned).length;
    const orphanedDocsCount = docs.filter(doc => doc.isOrphaned).length;
    
    return {
      totalDocs: docs.length,
      totalSize,
      activeDocsCount,
      orphanedDocsCount,
      availableSlots: POOL_LIMITS.MAX_DOCS_PER_USER - docs.length,
    };
  }
  
  /**
   * Check if user can upload more documents
   */
  async canUpload(): Promise<{ allowed: boolean; count: number; message?: string }> {
    const stats = await this.getStats();
    
    if (stats.totalDocs >= POOL_LIMITS.MAX_DOCS_PER_USER) {
      return {
        allowed: false,
        count: stats.totalDocs,
        message: `Document pool is full (${stats.totalDocs}/${POOL_LIMITS.MAX_DOCS_PER_USER}). Delete some documents to continue.`,
      };
    }
    
    return {
      allowed: true,
      count: stats.totalDocs,
    };
  }
  
  /**
   * Get documents active in a specific session
   */
  async getActiveDocsForSession(sessionId: string): Promise<PoolDocument[]> {
    const pool = await this.getPool();
    
    // CRITICAL INVARIANT: Filter by activeSessions, NOT originSessionId
    return pool.filter(doc => doc.activeSessions?.includes(sessionId));
  }
  
  /**
   * Get orphaned documents (not active in any session)
   */
  async getOrphanedDocs(): Promise<PoolDocument[]> {
    const pool = await this.getPool();
    return pool.filter(doc => doc.isOrphaned);
  }
  
  /**
   * Activate a document for a session (add to activeSessions[])
   */
  async activateDocForSession(docId: string, sessionId: string): Promise<PoolOperationResult> {
    if (!this.userId) {
      return { success: false, message: 'Not initialized' };
    }
    
    try {
      const db = await getDatabase();
      const doc = await db.documents.findOne(docId).exec();
      
      if (!doc) {
        return { success: false, message: 'Document not found' };
      }
      
      const currentSessions: string[] = (doc as any).activeSessions || [];
      if (currentSessions.includes(sessionId)) {
        return { success: true, message: 'Already active', docId };
      }
      
      // Update activeSessions
      await (doc as any).patch({
        activeSessions: [...currentSessions, sessionId],
        accessCount: ((doc as any).accessCount || 0) + 1,
        lastAccessedAt: new Date().toISOString(),
      });
      
      return { success: true, message: 'Document activated for session', docId };
    } catch (error) {
      console.error('[DocumentPoolManager] activateDocForSession error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Deactivate a document from a session (remove from activeSessions[])
   */
  async deactivateDocFromSession(docId: string, sessionId: string): Promise<PoolOperationResult> {
    if (!this.userId) {
      return { success: false, message: 'Not initialized' };
    }
    
    try {
      const db = await getDatabase();
      const doc = await db.documents.findOne(docId).exec();
      
      if (!doc) {
        return { success: false, message: 'Document not found' };
      }
      
      const currentSessions: string[] = (doc as any).activeSessions || [];
      if (!currentSessions.includes(sessionId)) {
        return { success: true, message: 'Already inactive', docId };
      }
      
      // Remove session from activeSessions
      await (doc as any).patch({
        activeSessions: currentSessions.filter((id: string) => id !== sessionId),
      });
      
      return { success: true, message: 'Document deactivated from session', docId };
    } catch (error) {
      console.error('[DocumentPoolManager] deactivateDocFromSession error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Add a new document to the pool
   * Called after file upload and chunking
   */
  async addDocument(
    doc: Omit<DocumentDoc, 'id' | 'userId' | 'accessCount' | 'lastAccessedAt'>
  ): Promise<PoolOperationResult> {
    if (!this.userId) {
      return { success: false, message: 'Not initialized' };
    }
    
    // Check pool limit
    const canUploadResult = await this.canUpload();
    if (!canUploadResult.allowed) {
      return { success: false, message: canUploadResult.message! };
    }
    
    try {
      const db = await getDatabase();
      const { generateId } = await import('../db');
      const id = generateId();
      
      const newDoc: DocumentDoc = {
        ...doc,
        id,
        userId: this.userId,
        accessCount: 0,
        lastAccessedAt: new Date().toISOString(),
      };
      
      await db.documents.insert(newDoc);
      
      const stats = await this.getStats();
      return { 
        success: true, 
        message: 'Document added to pool', 
        docId: id,
        stats,
      };
    } catch (error) {
      console.error('[DocumentPoolManager] addDocument error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Delete a document from the pool (with cascade to vectors)
   * Preserves authoritative facts (marks sourceRemoved)
   */
  async deleteDocument(docId: string): Promise<PoolOperationResult> {
    if (!this.userId) {
      return { success: false, message: 'Not initialized' };
    }
    
    try {
      const db = await getDatabase();
      
      // Delete vectors for this document
      const vectors = await db.vectorEmbeddings.find({
        selector: { documentId: docId },
      }).exec();
      
      for (const vec of vectors) {
        await vec.remove();
      }
      
      // Delete document chunks if they exist
      const chunks = await db.documentChunks.find({
        selector: { documentId: docId },
      }).exec();
      
      for (const chunk of chunks) {
        await chunk.remove();
      }
      
      // Delete the document itself
      const doc = await db.documents.findOne(docId).exec();
      if (doc) {
        await doc.remove();
      }
      
      const stats = await this.getStats();
      return { 
        success: true, 
        message: 'Document deleted from pool', 
        docId,
        stats,
      };
    } catch (error) {
      console.error('[DocumentPoolManager] deleteDocument error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Delete all documents in the pool (JIGGA only - Clear All RAG)
   */
  async deleteAllDocuments(): Promise<PoolOperationResult> {
    if (!this.userId) {
      return { success: false, message: 'Not initialized' };
    }
    
    try {
      const db = await getDatabase();
      
      // Get all user's documents
      const docs = await db.documents.find({
        selector: { userId: this.userId },
      }).exec();
      
      let deletedCount = 0;
      
      for (const doc of docs) {
        const docId = (doc as any).id;
        
        // Delete vectors
        const vectors = await db.vectorEmbeddings.find({
          selector: { documentId: docId },
        }).exec();
        
        for (const vec of vectors) {
          await vec.remove();
        }
        
        // Delete chunks
        const chunks = await db.documentChunks.find({
          selector: { documentId: docId },
        }).exec();
        
        for (const chunk of chunks) {
          await chunk.remove();
        }
        
        // Delete document
        await doc.remove();
        deletedCount++;
      }
      
      const stats = await this.getStats();
      return { 
        success: true, 
        message: `Deleted ${deletedCount} documents from pool`, 
        stats,
      };
    } catch (error) {
      console.error('[DocumentPoolManager] deleteAllDocuments error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Suggest documents for cleanup (LRU-based)
   */
  async suggestCleanup(count = 5): Promise<PoolDocument[]> {
    const pool = await this.getPool();
    
    // Sort by last access time (oldest first), then by access count (lowest first)
    const sorted = [...pool].sort((a, b) => {
      const aTime = new Date(a.lastAccessedAt || 0).getTime();
      const bTime = new Date(b.lastAccessedAt || 0).getTime();
      
      if (aTime !== bTime) {
        return aTime - bTime; // Oldest first
      }
      
      return (a.accessCount || 0) - (b.accessCount || 0); // Least used first
    });
    
    // Prioritize orphaned docs
    const orphaned = sorted.filter(doc => doc.isOrphaned);
    const active = sorted.filter(doc => !doc.isOrphaned);
    
    return [...orphaned, ...active].slice(0, count);
  }
  
  /**
   * Convert raw DocumentDoc to PoolDocument with computed fields
   */
  private toPoolDocument(doc: DocumentDoc): PoolDocument {
    const activeSessions = doc.activeSessions || [];
    
    return {
      ...doc,
      isOrphaned: activeSessions.length === 0,
      sessionCount: activeSessions.length,
    };
  }
  
  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    DocumentPoolManager.instance = null;
  }
}

// Export singleton accessor
export function getDocumentPoolManager(): DocumentPoolManager {
  return DocumentPoolManager.getInstance();
}
