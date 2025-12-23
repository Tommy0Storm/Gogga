/**
 * GOGGA RxDB Advanced Features
 * High-value features enabled by RxDB's capabilities
 * 
 * Features:
 * 1. Semantic Session Search - Find sessions by topic similarity
 * 2. Similar Sessions Widget - Show related past conversations
 * 3. Document Clustering - Group docs by embedding proximity
 * 4. Offline Queue - Queue messages when offline
 * 5. Conversation Insights - Token usage analytics
 * 6. Hybrid Search - Combine keyword + vector search
 * 7. Memory Graph - Cross-reference memories and sessions
 */

import { getDatabase, generateId } from './database';
import { findSimilarVectors } from './vectorCollection';
import { generateQueryEmbedding } from './embeddingPipeline';
import { cosineSimilarity } from '../embeddingEngine';
import type { ChatSessionDoc, MemoryContextDoc, OfflineQueueDoc } from './schemas';

// ============================================================================
// 1. Semantic Session Search
// ============================================================================

/**
 * Search sessions by semantic similarity to a query
 * Finds past conversations about similar topics
 */
export async function searchSessionsBySimilarity(
  query: string,
  topK: number = 5
): Promise<Array<ChatSessionDoc & { score: number }>> {
  const db = await getDatabase();
  
  // Generate query embedding
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Get all sessions with title embeddings
  const sessions = await db.chatSessions.find().exec();
  
  // Calculate similarity for each session
  const results: Array<ChatSessionDoc & { score: number }> = [];
  
  for (const session of sessions) {
    const titleEmbedding = session.titleEmbedding;
    if (!titleEmbedding || titleEmbedding.length === 0) {
      continue;
    }
    
    // Convert to mutable array for indexing
    const embeddingArray = [...titleEmbedding];
    
    // Cosine similarity
    const dotProduct = queryEmbedding.reduce(
      (sum, a, i) => sum + a * (embeddingArray[i] ?? 0),
      0
    );
    
    // Create result with explicit type casting to avoid exactOptionalPropertyTypes issue
    const sessionData = session.toJSON();
    const result: ChatSessionDoc & { score: number } = {
      id: sessionData.id,
      tier: sessionData.tier,
      title: sessionData.title,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      messageCount: sessionData.messageCount,
      score: dotProduct,
    };
    
    // Only add titleEmbedding if it exists
    if (sessionData.titleEmbedding) {
      result.titleEmbedding = [...sessionData.titleEmbedding];
    }
    
    results.push(result);
  }
  
  // Sort by score and return top K
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Get similar sessions to the current one
 * For "You might also like" widget
 */
export async function getSimilarSessions(
  sessionId: string,
  topK: number = 3
): Promise<Array<ChatSessionDoc & { score: number }>> {
  const db = await getDatabase();
  
  // Get current session
  const currentSession = await db.chatSessions.findOne(sessionId).exec();
  if (!currentSession || !currentSession.titleEmbedding) {
    return [];
  }
  
  // Get all other sessions
  const sessions = await db.chatSessions.find({
    selector: { id: { $ne: sessionId } }
  }).exec();
  
  // Convert current session embedding to mutable array
  const currentEmbedding = [...currentSession.titleEmbedding];
  
  // Calculate similarity
  const results: Array<ChatSessionDoc & { score: number }> = [];
  
  for (const session of sessions) {
    const titleEmbedding = session.titleEmbedding;
    if (!titleEmbedding || titleEmbedding.length === 0) {
      continue;
    }
    
    // Convert to mutable array
    const sessionEmbedding = [...titleEmbedding];
    
    const dotProduct = currentEmbedding.reduce(
      (sum, a, i) => sum + a * (sessionEmbedding[i] ?? 0),
      0
    );
    
    // Create result with explicit fields
    const sessionData = session.toJSON();
    const result: ChatSessionDoc & { score: number } = {
      id: sessionData.id,
      tier: sessionData.tier,
      title: sessionData.title,
      createdAt: sessionData.createdAt,
      updatedAt: sessionData.updatedAt,
      messageCount: sessionData.messageCount,
      score: dotProduct,
    };
    
    if (sessionData.titleEmbedding) {
      result.titleEmbedding = [...sessionData.titleEmbedding];
    }
    
    results.push(result);
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ============================================================================
// 2. Document Clustering
// ============================================================================

interface DocumentCluster {
  id: string;
  name: string;
  documentIds: string[];
  centroid?: number[];
  averageSimilarity: number;
}

/**
 * Cluster documents by embedding similarity
 * Uses simple agglomerative clustering
 */
export async function clusterDocuments(
  numClusters: number = 5
): Promise<DocumentCluster[]> {
  const db = await getDatabase();
  const vectors = await db.vectorEmbeddings.find().exec();
  
  if (vectors.length === 0) {
    return [];
  }
  
  // Group vectors by document - convert DeepReadonlyArray to mutable array
  const docVectors = new Map<string, number[][]>();
  for (const vec of vectors) {
    const existing = docVectors.get(vec.documentId) || [];
    // Convert DeepReadonlyArray to mutable number[]
    existing.push([...vec.embedding]);
    docVectors.set(vec.documentId, existing);
  }
  
  // Calculate document centroids (average of chunk embeddings)
  const docCentroids = new Map<string, number[]>();
  for (const [docId, embeddings] of docVectors) {
    const firstEmbedding = embeddings[0];
    if (!firstEmbedding) continue;
    
    const centroid = firstEmbedding.map((_, i) => 
      embeddings.reduce((sum, emb) => sum + (emb[i] ?? 0), 0) / embeddings.length
    );
    docCentroids.set(docId, centroid);
  }
  
  // Simple k-means style clustering
  const docIds = Array.from(docCentroids.keys());
  if (docIds.length <= numClusters) {
    // Each doc is its own cluster
    return docIds.map((docId, idx) => {
      const centroid = docCentroids.get(docId);
      const result: DocumentCluster = {
        id: generateId(),
        name: `Cluster ${idx + 1}`,
        documentIds: [docId],
        averageSimilarity: 1.0,
      };
      if (centroid) {
        result.centroid = centroid;
      }
      return result;
    });
  }
  
  // Initialize cluster centers randomly
  const shuffled = [...docIds].sort(() => Math.random() - 0.5);
  const clusterCenters = shuffled.slice(0, numClusters).map(id => {
    const centroid = docCentroids.get(id);
    return centroid ? [...centroid] : [];
  });
  
  // Assign documents to nearest cluster
  const assignments = new Map<number, string[]>();
  for (let i = 0; i < numClusters; i++) {
    assignments.set(i, []);
  }
  
  for (const docId of docIds) {
    const docCentroid = docCentroids.get(docId);
    if (!docCentroid) continue;
    
    let bestCluster = 0;
    let bestSimilarity = -1;
    
    for (let i = 0; i < clusterCenters.length; i++) {
      const clusterCenter = clusterCenters[i];
      if (!clusterCenter) continue;
      
      const similarity = docCentroid.reduce(
        (sum, a, j) => sum + a * (clusterCenter[j] ?? 0),
        0
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = i;
      }
    }
    
    const clusterDocs = assignments.get(bestCluster);
    if (clusterDocs) {
      clusterDocs.push(docId);
    }
  }
  
  // Build cluster objects
  const clusters: DocumentCluster[] = [];
  for (let i = 0; i < numClusters; i++) {
    const docIdsInCluster = assignments.get(i) || [];
    if (docIdsInCluster.length === 0) continue;
    
    // Calculate cluster centroid
    const centroids = docIdsInCluster
      .map(id => docCentroids.get(id))
      .filter((c): c is number[] => c !== undefined);
    
    if (centroids.length === 0) continue;
    
    const firstCentroid = centroids[0];
    if (!firstCentroid) continue;
    
    const clusterCentroid = firstCentroid.map((_, j) =>
      centroids.reduce((sum, c) => sum + (c[j] ?? 0), 0) / centroids.length
    );
    
    // Calculate average similarity within cluster
    let totalSimilarity = 0;
    for (const centroid of centroids) {
      totalSimilarity += centroid.reduce(
        (sum, a, j) => sum + a * (clusterCentroid[j] ?? 0),
        0
      );
    }
    
    clusters.push({
      id: generateId(),
      name: `Cluster ${i + 1}`,
      documentIds: docIdsInCluster,
      centroid: clusterCentroid,
      averageSimilarity: totalSimilarity / centroids.length,
    });
  }
  
  return clusters;
}

/**
 * Get document clusters (cached)
 */
export async function getDocumentClusters(): Promise<DocumentCluster[]> {
  return clusterDocuments();
}

// ============================================================================
// 3. Offline Queue
// ============================================================================

/**
 * Add item to offline queue
 */
export async function addToOfflineQueue(
  type: 'message' | 'image_request',
  payload: Record<string, unknown>
): Promise<string> {
  const db = await getDatabase();
  
  const doc: OfflineQueueDoc = {
    id: generateId(),
    type,
    payload,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
  
  await db.offlineQueue.insert(doc);
  return doc.id;
}

/**
 * Process offline queue items
 */
export async function processOfflineQueue(
  processor: (item: OfflineQueueDoc) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  const db = await getDatabase();
  
  const pending = await db.offlineQueue.find({
    selector: { status: 'pending' }
  }).exec();
  
  let processed = 0;
  let failed = 0;
  
  for (const item of pending) {
    try {
      // Mark as sending
      await item.patch({ status: 'sending', lastAttempt: new Date().toISOString() });
      
      // Process
      const success = await processor(item.toJSON());
      
      if (success) {
        await item.remove();
        processed++;
      } else {
        await item.patch({
          status: 'failed',
          retryCount: item.retryCount + 1,
          error: 'Processing returned false',
        });
        failed++;
      }
    } catch (error) {
      await item.patch({
        status: 'failed',
        retryCount: item.retryCount + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      failed++;
    }
  }
  
  return { processed, failed };
}

/**
 * Get offline queue status
 */
export async function getOfflineQueueStatus(): Promise<{
  pending: number;
  failed: number;
  oldest?: string;
}> {
  const db = await getDatabase();
  
  const [pending, failed] = await Promise.all([
    db.offlineQueue.count({ selector: { status: 'pending' } }).exec(),
    db.offlineQueue.count({ selector: { status: 'failed' } }).exec(),
  ]);
  
  // Get oldest pending item
  const oldestItem = await db.offlineQueue.findOne({
    selector: { status: 'pending' },
    sort: [{ createdAt: 'asc' }],
  }).exec();
  
  // Build result, only including oldest if it exists
  const result: { pending: number; failed: number; oldest?: string } = {
    pending,
    failed,
  };
  
  if (oldestItem?.createdAt) {
    result.oldest = oldestItem.createdAt;
  }
  
  return result;
}

// ============================================================================
// 4. Conversation Insights (Dashboard)
// ============================================================================

interface ConversationInsight {
  totalSessions: number;
  totalMessages: number;
  totalTokens: number;
  totalCostZar: number;
  averageMessagesPerSession: number;
  mostActiveDay: string;
  topTier: string;
}

/**
 * Get conversation insights for dashboard
 */
export async function getConversationInsights(): Promise<ConversationInsight> {
  const db = await getDatabase();
  
  const [sessions, messages, tokenUsage] = await Promise.all([
    db.chatSessions.find().exec(),
    db.chatMessages.find().exec(),
    db.tokenUsage.find().exec(),
  ]);
  
  // Aggregate token usage
  let totalTokens = 0;
  let totalCostZar = 0;
  const dayUsage = new Map<string, number>();
  const tierUsage = new Map<string, number>();
  
  for (const usage of tokenUsage) {
    totalTokens += usage.totalTokens;
    totalCostZar += usage.costZar;
    
    const dayCount = dayUsage.get(usage.date) || 0;
    dayUsage.set(usage.date, dayCount + usage.requestCount);
    
    const tierCount = tierUsage.get(usage.tier) || 0;
    tierUsage.set(usage.tier, tierCount + usage.totalTokens);
  }
  
  // Find most active day
  let mostActiveDay = '';
  let maxDayCount = 0;
  for (const [day, count] of dayUsage) {
    if (count > maxDayCount) {
      maxDayCount = count;
      mostActiveDay = day;
    }
  }
  
  // Find top tier
  let topTier = 'jive';
  let maxTierCount = 0;
  for (const [tier, count] of tierUsage) {
    if (count > maxTierCount) {
      maxTierCount = count;
      topTier = tier;
    }
  }
  
  return {
    totalSessions: sessions.length,
    totalMessages: messages.length,
    totalTokens,
    totalCostZar,
    averageMessagesPerSession: sessions.length > 0 
      ? messages.length / sessions.length 
      : 0,
    mostActiveDay,
    topTier,
  };
}

/**
 * Get daily token usage for chart
 */
export async function getDailyTokenUsage(
  days: number = 7
): Promise<Array<{ date: string; input: number; output: number; total: number }>> {
  const db = await getDatabase();
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const startStr = startDate.toISOString().split('T')[0];
  
  const usage = await db.tokenUsage.find({
    selector: { date: { $gte: startStr } }
  }).exec();
  
  // Aggregate by date
  const dailyMap = new Map<string, { input: number; output: number; total: number }>();
  
  for (const u of usage) {
    const existing = dailyMap.get(u.date) || { input: 0, output: 0, total: 0 };
    existing.input += u.inputTokens;
    existing.output += u.outputTokens;
    existing.total += u.totalTokens;
    dailyMap.set(u.date, existing);
  }
  
  // Convert to array sorted by date
  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get topic distribution from session titles
 */
export async function getTopicDistribution(): Promise<Array<{ topic: string; count: number }>> {
  const db = await getDatabase();
  const sessions = await db.chatSessions.find().exec();
  
  // Simple word frequency analysis on titles
  const wordCounts = new Map<string, number>();
  const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'chat', 'and', 'or', 'but', 'if']);
  
  for (const session of sessions) {
    const words = session.title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    
    for (const word of words) {
      const count = wordCounts.get(word) || 0;
      wordCounts.set(word, count + 1);
    }
  }
  
  // Return top 10 topics
  return Array.from(wordCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ============================================================================
// 5. Hybrid Search (Keyword + Vector)
// ============================================================================

interface HybridSearchResult {
  documentId: string;
  chunkIndex: number;
  text: string;
  keywordScore: number;
  vectorScore: number;
  combinedScore: number;
}

/**
 * Hybrid search combining keyword and vector similarity
 */
export async function hybridSearch(
  query: string,
  topK: number = 10,
  keywordWeight: number = 0.3
): Promise<HybridSearchResult[]> {
  const db = await getDatabase();
  
  // 1. Keyword search using text matching
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  const allVectors = await db.vectorEmbeddings.find().exec();
  const keywordResults = new Map<string, { docId: string; chunkIndex: number; text: string; score: number }>();
  
  for (const vec of allVectors) {
    const textLower = vec.text.toLowerCase();
    let keywordScore = 0;
    
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        keywordScore += 1;
      }
    }
    
    if (keywordScore > 0) {
      keywordResults.set(vec.id, {
        docId: vec.documentId,
        chunkIndex: vec.chunkIndex,
        text: vec.text,
        score: keywordScore / queryWords.length, // Normalize
      });
    }
  }
  
  // 2. Vector search
  const queryEmbedding = await generateQueryEmbedding(query);
  const vectorResults = await findSimilarVectors(queryEmbedding, topK * 2);
  
  // 3. Combine results
  const combined = new Map<string, HybridSearchResult>();
  
  // Add keyword results
  for (const [id, result] of keywordResults) {
    combined.set(`${result.docId}-${result.chunkIndex}`, {
      documentId: result.docId,
      chunkIndex: result.chunkIndex,
      text: result.text,
      keywordScore: result.score,
      vectorScore: 0,
      combinedScore: result.score * keywordWeight,
    });
  }
  
  // Add/merge vector results
  for (const vr of vectorResults) {
    const key = `${vr.documentId}-${vr.chunkIndex}`;
    const existing = combined.get(key);
    
    if (existing) {
      existing.vectorScore = vr.score;
      existing.combinedScore = existing.keywordScore * keywordWeight + vr.score * (1 - keywordWeight);
    } else {
      combined.set(key, {
        documentId: vr.documentId,
        chunkIndex: vr.chunkIndex,
        text: vr.text,
        keywordScore: 0,
        vectorScore: vr.score,
        combinedScore: vr.score * (1 - keywordWeight),
      });
    }
  }
  
  // Sort by combined score and return top K
  return Array.from(combined.values())
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK);
}

// ============================================================================
// 6. Memory Graph
// ============================================================================

interface MemoryGraphNode {
  id: string;
  type: 'memory' | 'session' | 'document';
  title: string;
  connections: string[];
}

interface MemoryGraph {
  nodes: MemoryGraphNode[];
  edges: Array<{ from: string; to: string; weight: number }>;
}

/**
 * Build a graph of related memories, sessions, and documents
 */
export async function getMemoryGraph(): Promise<MemoryGraph> {
  const db = await getDatabase();
  
  const [memories, sessions, documents] = await Promise.all([
    db.memoryContexts.find().exec(),
    db.chatSessions.find().exec(),
    db.documents.find().exec(),
  ]);
  
  const nodes: MemoryGraphNode[] = [];
  const edges: Array<{ from: string; to: string; weight: number }> = [];
  
  // Add memory nodes
  for (const mem of memories) {
    nodes.push({
      id: `memory-${mem.id}`,
      type: 'memory',
      title: mem.title,
      connections: [],
    });
  }
  
  // Add session nodes
  for (const session of sessions) {
    nodes.push({
      id: `session-${session.id}`,
      type: 'session',
      title: session.title,
      connections: [],
    });
  }
  
  // Add document nodes
  for (const doc of documents) {
    nodes.push({
      id: `doc-${doc.id}`,
      type: 'document',
      title: doc.filename,
      connections: [],
    });
  }
  
  // Create edges based on session relationships
  for (const doc of documents) {
    const sessionNode = nodes.find(n => n.id === `session-${doc.sessionId}`);
    if (sessionNode) {
      const docNode = nodes.find(n => n.id === `doc-${doc.id}`);
      if (docNode) {
        edges.push({
          from: docNode.id,
          to: sessionNode.id,
          weight: 1.0,
        });
        docNode.connections.push(sessionNode.id);
        sessionNode.connections.push(docNode.id);
      }
    }
  }
  
  return { nodes, edges };
}

/**
 * Find memories related to a given memory by content similarity
 */
export async function findRelatedMemories(
  memoryId: string,
  topK: number = 5
): Promise<Array<MemoryContextDoc & { score: number }>> {
  const db = await getDatabase();
  
  const memory = await db.memoryContexts.findOne(memoryId).exec();
  if (!memory || !memory.embedding) {
    return [];
  }
  
  // Convert to mutable array
  const memoryEmbedding = [...memory.embedding];
  
  const allMemories = await db.memoryContexts.find({
    selector: { id: { $ne: memoryId } }
  }).exec();
  
  const results: Array<MemoryContextDoc & { score: number }> = [];
  
  for (const mem of allMemories) {
    if (!mem.embedding) continue;
    
    // Convert to mutable array
    const memEmbedding = [...mem.embedding];
    
    const score = memoryEmbedding.reduce(
      (sum, a, i) => sum + a * (memEmbedding[i] ?? 0),
      0
    );
    
    // Build result explicitly
    const memData = mem.toJSON();
    const result: MemoryContextDoc & { score: number } = {
      id: memData.id,
      title: memData.title,
      content: memData.content,
      category: memData.category,
      source: memData.source,
      isActive: memData.isActive,
      priority: memData.priority,
      tokenCount: memData.tokenCount,
      createdAt: memData.createdAt,
      updatedAt: memData.updatedAt,
      score,
    };
    
    if (memData.embedding) {
      result.embedding = [...memData.embedding];
    }
    
    results.push(result);
  }
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
