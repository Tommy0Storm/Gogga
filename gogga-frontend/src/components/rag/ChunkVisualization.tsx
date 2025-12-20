'use client';

import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface UsedChunk {
  id: string;
  source: string;
  page?: number;
  content: string;
  score: number;  // 0-1 similarity score
}

interface ChunkVisualizationProps {
  chunks: UsedChunk[];
  title?: string;
  defaultExpanded?: boolean;
}

// Confidence badge component
function ConfidenceBadge({ score }: { score: number }) {
  const level = score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';
  const colors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  const labels = { high: 'High', medium: 'Medium', low: 'Low' };

  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium',
      colors[level]
    )}>
      {labels[level]} ({Math.round(score * 100)}%)
    </span>
  );
}

export function ChunkVisualization({ 
  chunks, 
  title = 'Sources Used',
  defaultExpanded = false 
}: ChunkVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (chunks.length === 0) return null;

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText size={16} />
          {title} ({chunks.length})
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="divide-y">
          {chunks.map((chunk) => (
            <div key={chunk.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-800">
                  {chunk.source}
                  {chunk.page && <span className="text-gray-500"> (p. {chunk.page})</span>}
                </span>
                
                {/* Confidence badge */}
                <ConfidenceBadge score={chunk.score} />
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export types for consumers
export type { UsedChunk };
