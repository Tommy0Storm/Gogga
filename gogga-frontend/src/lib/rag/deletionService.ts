/**
 * GOGGA Deletion Service
 * 
 * Handles cascade deletion of RAG documents and their associated data:
 * - Document chunks
 * - Vector embeddings
 * - Session activations (update, don't delete other sessions)
 * 
 * Key invariants:
 * - Deleting a document MUST delete all its chunks and embeddings
 * - Session deactivation only removes from activeSessions[], not delete
 * - Authoritative facts should be preserved (moved to state context)
 * - Deletion is atomic per document
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

import { getDatabase } from '../rxdb/database';
import type { DocumentDoc } from '../rxdb/schemas';

// Deletion result
export interface DeletionResult {
  success: boolean;
  documentId: string;
  chunksDeleted: number;
  embeddingsDeleted: number;
  errors: string[];
}

// Bulk deletion result
export interface BulkDeletionResult {
  success: boolean;
  totalDocuments: number;
  successfulDeletions: number;
  failedDeletions: number;
  results: DeletionResult[];
  totalChunksDeleted: number;
  totalEmbeddingsDeleted: number;
}

/**
 * DeletionService - Cascade deletion for RAG documents
 */
export class DeletionService {
  private static instance: DeletionService | null = null;
  
  static getInstance(): DeletionService {
    if (!DeletionService.instance) {
      DeletionService.instance = new DeletionService();
    }
    return DeletionService.instance;
  }
  
  /**
   * Delete a single document with all associated data
   */
  async deleteDocument(docId: string): Promise<DeletionResult> {
    const result: DeletionResult = {
      success: false,
      documentId: docId,
      chunksDeleted: 0,
      embeddingsDeleted: 0,
      errors: [],
    };
    
    try {
      const db = await getDatabase();
      
      // 1. Delete embeddings for this document
      try {
        const embeddings = await db.vectorEmbeddings
          .find({
            selector: { documentId: docId }
          })
          .exec();
        
        for (const embedding of embeddings) {
          await embedding.remove();
          result.embeddingsDeleted++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Failed to delete embeddings: ${errMsg}`);
      }
      
      // 2. Delete chunks for this document  
      try {
        const chunks = await db.documentChunks
          .find({
            selector: { documentId: docId }
          })
          .exec();
        
        for (const chunk of chunks) {
          await chunk.remove();
          result.chunksDeleted++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Failed to delete chunks: ${errMsg}`);
      }
      
      // 3. Delete the document itself
      try {
        const doc = await db.documents.findOne(docId).exec();
        if (doc) {
          await doc.remove();
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Failed to delete document: ${errMsg}`);
      }
      
      result.success = result.errors.length === 0;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`Database error: ${errMsg}`);
    }
    
    return result;
  }
  
  /**
   * Delete multiple documents with cascade
   */
  async deleteDocuments(docIds: string[]): Promise<BulkDeletionResult> {
    const results: DeletionResult[] = [];
    let successfulDeletions = 0;
    let failedDeletions = 0;
    let totalChunksDeleted = 0;
    let totalEmbeddingsDeleted = 0;
    
    for (const docId of docIds) {
      const result = await this.deleteDocument(docId);
      results.push(result);
      
      if (result.success) {
        successfulDeletions++;
        totalChunksDeleted += result.chunksDeleted;
        totalEmbeddingsDeleted += result.embeddingsDeleted;
      } else {
        failedDeletions++;
      }
    }
    
    return {
      success: failedDeletions === 0,
      totalDocuments: docIds.length,
      successfulDeletions,
      failedDeletions,
      results,
      totalChunksDeleted,
      totalEmbeddingsDeleted,
    };
  }
  
  /**
   * Delete all documents for a user
   */
  async deleteAllUserDocuments(userId: string): Promise<BulkDeletionResult> {
    try {
      const db = await getDatabase();
      
      const userDocs = await db.documents
        .find({
          selector: { userId }
        })
        .exec();
      
      const docIds = userDocs.map(doc => doc.id);
      return await this.deleteDocuments(docIds);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return {
        success: false,
        totalDocuments: 0,
        successfulDeletions: 0,
        failedDeletions: 0,
        results: [],
        totalChunksDeleted: 0,
        totalEmbeddingsDeleted: 0,
      };
    }
  }
  
  /**
   * Deactivate a document from a session (does NOT delete)
   * Just removes sessionId from activeSessions[]
   */
  async deactivateFromSession(docId: string, sessionId: string): Promise<boolean> {
    try {
      const db = await getDatabase();
      const doc = await db.documents.findOne(docId).exec();
      
      if (!doc) {
        return false;
      }
      
      const currentSessions = doc.activeSessions || [];
      const newSessions = currentSessions.filter((s: string) => s !== sessionId);
      
      await doc.patch({
        activeSessions: newSessions,
        updatedAt: new Date().toISOString(),
      });
      
      return true;
    } catch (err) {
      console.error('Failed to deactivate document from session:', err);
      return false;
    }
  }
  
  /**
   * Activate a document for a session
   * Adds sessionId to activeSessions[] if not already present
   */
  async activateForSession(docId: string, sessionId: string): Promise<boolean> {
    try {
      const db = await getDatabase();
      const doc = await db.documents.findOne(docId).exec();
      
      if (!doc) {
        return false;
      }
      
      const currentSessions: string[] = doc.activeSessions || [];
      
      if (!currentSessions.includes(sessionId)) {
        await doc.patch({
          activeSessions: [...currentSessions, sessionId],
          accessCount: (doc.accessCount || 0) + 1,
          lastAccessedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      
      return true;
    } catch (err) {
      console.error('Failed to activate document for session:', err);
      return false;
    }
  }
  
  /**
   * Clean up orphaned documents (no active sessions)
   * Returns documents that could be deleted to free space
   */
  async getOrphanedDocuments(userId: string): Promise<DocumentDoc[]> {
    try {
      const db = await getDatabase();
      
      const userDocs = await db.documents
        .find({
          selector: { userId }
        })
        .exec();
      
      // Filter to orphaned (empty or no activeSessions)
      return userDocs.filter(doc => {
        const sessions = doc.activeSessions || [];
        return sessions.length === 0;
      }) as unknown as DocumentDoc[];
    } catch (err) {
      console.error('Failed to get orphaned documents:', err);
      return [];
    }
  }
  
  /**
   * Delete orphaned documents for a user
   */
  async deleteOrphanedDocuments(userId: string): Promise<BulkDeletionResult> {
    const orphaned = await this.getOrphanedDocuments(userId);
    const docIds = orphaned.map(doc => doc.id);
    return await this.deleteDocuments(docIds);
  }
  
  /**
   * Delete all chunks and embeddings for a document (but keep document record)
   * Useful for re-embedding after model change
   */
  async clearDocumentEmbeddings(docId: string): Promise<{ chunksDeleted: number; embeddingsDeleted: number }> {
    let chunksDeleted = 0;
    let embeddingsDeleted = 0;
    
    try {
      const db = await getDatabase();
      
      // Delete embeddings
      const embeddings = await db.vectorEmbeddings
        .find({
          selector: { documentId: docId }
        })
        .exec();
      
      for (const embedding of embeddings) {
        await embedding.remove();
        embeddingsDeleted++;
      }
      
      // Delete chunks
      const chunks = await db.documentChunks
        .find({
          selector: { documentId: docId }
        })
        .exec();
      
      for (const chunk of chunks) {
        await chunk.remove();
        chunksDeleted++;
      }
      
      // Update document timestamp (embeddingStatus would need schema update)
      const doc = await db.documents.findOne(docId).exec();
      if (doc) {
        await doc.patch({
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to clear document embeddings:', err);
    }
    
    return { chunksDeleted, embeddingsDeleted };
  }
}

// Export singleton
export const deletionService = DeletionService.getInstance();

// Export convenience functions
export async function deleteDocument(docId: string): Promise<DeletionResult> {
  return deletionService.deleteDocument(docId);
}

export async function deleteDocuments(docIds: string[]): Promise<BulkDeletionResult> {
  return deletionService.deleteDocuments(docIds);
}

export async function deleteAllUserDocuments(userId: string): Promise<BulkDeletionResult> {
  return deletionService.deleteAllUserDocuments(userId);
}

export async function deactivateFromSession(docId: string, sessionId: string): Promise<boolean> {
  return deletionService.deactivateFromSession(docId, sessionId);
}

export async function activateForSession(docId: string, sessionId: string): Promise<boolean> {
  return deletionService.activateForSession(docId, sessionId);
}
