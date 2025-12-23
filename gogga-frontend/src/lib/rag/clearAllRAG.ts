/**
 * GOGGA Clear All RAG Documents
 * 
 * Bulk deletion of all RAG documents and their associated data.
 * Uses RxDB best practices:
 * 1. RxQuery.remove() to mark documents as deleted
 * 2. Cascading deletion of chunks and embeddings
 * 3. cleanup(0) to immediately purge from IndexedDB
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md
 */

import { getDatabase } from '../rxdb/database';

export interface ClearAllResult {
  deletedDocs: number;
  deletedChunks: number;
  deletedEmbeddings: number;
  durationMs: number;
}

/**
 * Clear all RAG documents and embeddings for the current user.
 * 
 * This is a destructive operation that:
 * 1. Deletes all documents where isRAGDocument = true
 * 2. Cascades to delete associated chunks
 * 3. Cascades to delete associated embeddings
 * 4. Purges deleted data from IndexedDB storage
 * 
 * @param userId - User ID to clear RAG documents for
 * @returns Summary of deleted items
 */
export async function clearAllRAGDocuments(userId: string): Promise<ClearAllResult> {
  const startTime = Date.now();
  const db = await getDatabase();
  
  // Step 1: Get all RAG Store document IDs for this user
  // RAG Store documents are identified by originSessionId === '' (empty string)
  const ragDocs = await db.documents.find({
    selector: { 
      userId,
      originSessionId: { $eq: '' }  // RAG Store = no origin session
    }
  }).exec();
  
  const docIds = ragDocs.map(d => d.id);
  const docCount = ragDocs.length;
  
  if (docCount === 0) {
    return {
      deletedDocs: 0,
      deletedChunks: 0,
      deletedEmbeddings: 0,
      durationMs: Date.now() - startTime,
    };
  }
  
  console.log(`[GOGGA RAG] Clearing ${docCount} RAG Store documents for user ${userId}`);
  
  // Step 2: Count and delete associated embeddings (before docs for referential integrity)
  const embeddingsToDelete = await db.vectorEmbeddings.find({
    selector: { documentId: { $in: docIds } }
  }).exec();
  const embeddingCount = embeddingsToDelete.length;
  
  if (embeddingCount > 0) {
    await db.vectorEmbeddings.find({
      selector: { documentId: { $in: docIds } }
    }).remove();
    console.log(`[GOGGA RAG] Deleted ${embeddingCount} embeddings`);
  }
  
  // Step 3: Count and delete associated chunks
  const chunksToDelete = await db.documentChunks.find({
    selector: { documentId: { $in: docIds } }
  }).exec();
  const chunkCount = chunksToDelete.length;
  
  if (chunkCount > 0) {
    await db.documentChunks.find({
      selector: { documentId: { $in: docIds } }
    }).remove();
    console.log(`[GOGGA RAG] Deleted ${chunkCount} chunks`);
  }
  
  // Step 4: Delete the RAG Store documents themselves
  await db.documents.find({
    selector: { 
      userId,
      originSessionId: { $eq: '' }  // RAG Store = no origin session
    }
  }).remove();
  console.log(`[GOGGA RAG] Deleted ${docCount} documents`);
  
  // Step 5: Purge deleted data from IndexedDB storage immediately
  // The 0 means purge all deleted docs regardless of when they were deleted
  try {
    await db.vectorEmbeddings.cleanup(0);
    await db.documentChunks.cleanup(0);
    await db.documents.cleanup(0);
    console.log(`[GOGGA RAG] Purged deleted data from storage`);
  } catch (error) {
    // Cleanup plugin might not be loaded - log but don't fail
    console.warn('[GOGGA RAG] Cleanup plugin not available:', error);
  }
  
  const durationMs = Date.now() - startTime;
  console.log(`[GOGGA RAG] Clear all complete in ${durationMs}ms`);
  
  return {
    deletedDocs: docCount,
    deletedChunks: chunkCount,
    deletedEmbeddings: embeddingCount,
    durationMs,
  };
}

/**
 * Clear a single RAG document and its associated data.
 * 
 * @param documentId - Document ID to delete
 * @returns True if document was found and deleted
 */
export async function clearRAGDocument(documentId: string): Promise<boolean> {
  const db = await getDatabase();
  
  // Find the document
  const doc = await db.documents.findOne({
    selector: { id: documentId }
  }).exec();
  
  if (!doc) {
    console.warn(`[GOGGA RAG] Document ${documentId} not found`);
    return false;
  }
  
  // Delete embeddings
  await db.vectorEmbeddings.find({
    selector: { documentId }
  }).remove();
  
  // Delete chunks
  await db.documentChunks.find({
    selector: { documentId }
  }).remove();
  
  // Delete document
  await doc.remove();
  
  console.log(`[GOGGA RAG] Cleared document ${documentId} and associated data`);
  return true;
}

/**
 * Get storage stats for RAG documents.
 * 
 * @param userId - User ID to get stats for
 * @returns Storage statistics
 */
export async function getRAGStorageStats(userId: string): Promise<{
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  estimatedSizeMB: number;
}> {
  const db = await getDatabase();
  
  // Get RAG Store documents (originSessionId === '' means persistent RAG Store)
  const ragDocs = await db.documents.find({
    selector: { 
      userId,
      originSessionId: { $eq: '' }  // RAG Store = no origin session
    }
  }).exec();
  
  const docIds = ragDocs.map(d => d.id);
  const documentCount = ragDocs.length;
  
  if (documentCount === 0) {
    return {
      documentCount: 0,
      chunkCount: 0,
      embeddingCount: 0,
      estimatedSizeMB: 0,
    };
  }
  
  // Count chunks
  const chunks = await db.documentChunks.find({
    selector: { documentId: { $in: docIds } }
  }).exec();
  const chunkCount = chunks.length;
  
  // Count embeddings
  const embeddings = await db.vectorEmbeddings.find({
    selector: { documentId: { $in: docIds } }
  }).exec();
  const embeddingCount = embeddings.length;
  
  // Estimate size: ~1KB per chunk text + ~1.5KB per embedding (384 floats * 4 bytes)
  const estimatedSizeMB = (chunkCount * 1 + embeddingCount * 1.5) / 1024;
  
  return {
    documentCount,
    chunkCount,
    embeddingCount,
    estimatedSizeMB,
  };
}
