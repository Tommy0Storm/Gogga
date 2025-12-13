'use client'

/**
 * Streaming RAG Context Panel with React Suspense
 * Shows RAG sources progressively as they load
 */

import { use, Suspense } from 'react'
import { FileText, Loader2, Clock, Hash } from 'lucide-react'

interface RAGDocument {
  id: string
  name: string
  content: string
  relevanceScore: number
  chunkIndex?: number
}

interface RAGContext {
  documents: RAGDocument[]
  query: string
  totalChunks: number
  processingTime: number
}

interface StreamingRAGPanelProps {
  contextPromise: Promise<RAGContext | null>
}

/**
 * RAG Context Display Component (suspends until data ready)
 */
function RAGContextDisplay({ contextPromise }: StreamingRAGPanelProps) {
  const context = use(contextPromise) // Suspends until embeddings computed

  if (!context || context.documents.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No RAG context available for this query
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Found {context.documents.length} relevant sources
        </span>
        <span className="text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {context.processingTime.toFixed(2)}s
        </span>
      </div>

      <div className="space-y-2">
        {context.documents.map((doc, idx) => (
          <div
            key={doc.id}
            className="p-3 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {doc.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {(doc.relevanceScore * 100).toFixed(0)}% match
                  </span>
                </div>
                {doc.chunkIndex !== undefined && (
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Hash className="w-3 h-3" />
                    Chunk {doc.chunkIndex + 1}
                  </div>
                )}
                <p className="text-xs text-gray-600 line-clamp-2">
                  {doc.content.substring(0, 120)}...
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading Skeleton for RAG Panel
 */
export function RAGLoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Computing embeddings and searching documents...</span>
      </div>

      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-3 bg-gray-100 rounded-lg border border-gray-200"
        >
          <div className="flex gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-300 rounded w-3/4" />
              <div className="h-3 bg-gray-300 rounded w-full" />
              <div className="h-3 bg-gray-300 rounded w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Streaming RAG Panel with Suspense Boundary
 * Shows skeleton while embeddings compute, then streams in results
 */
export function StreamingRAGPanel({ contextPromise }: StreamingRAGPanelProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-gray-700" />
        <h3 className="text-sm font-semibold text-gray-900">
          Document Context
        </h3>
      </div>

      <Suspense fallback={<RAGLoadingSkeleton />}>
        <RAGContextDisplay contextPromise={contextPromise} />
      </Suspense>
    </div>
  )
}

/**
 * Compact inline RAG badge with document count
 * Shows loading state while computing
 */
export function RAGBadge({ contextPromise }: StreamingRAGPanelProps) {
  return (
    <Suspense
      fallback={
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          RAG
        </span>
      }
    >
      <RAGBadgeContent contextPromise={contextPromise} />
    </Suspense>
  )
}

function RAGBadgeContent({ contextPromise }: StreamingRAGPanelProps) {
  const context = use(contextPromise)

  if (!context || context.documents.length === 0) {
    return null
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
      <FileText className="w-3 h-3" />
      {context.documents.length} docs
    </span>
  )
}
