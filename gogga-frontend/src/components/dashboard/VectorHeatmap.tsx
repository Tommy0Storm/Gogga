/**
 * GOGGA RAG Dashboard - Vector Heatmap Component
 * Visualizes embedding vectors as a color-coded heatmap
 * Monochrome design with grey gradients
 */

'use client';

import React, { useMemo } from 'react';
import { Lock, Grid3X3, Sparkles } from 'lucide-react';

interface VectorHeatmapProps {
  vectors: number[][];
  labels?: string[];
  maxDisplay?: number;
  colorScheme?: 'grey' | 'heat' | 'cool';
  showValues?: boolean;
  compact?: boolean;
  tier?: 'free' | 'jive' | 'jigga';
  onUpgrade?: () => void;
}

export const VectorHeatmap: React.FC<VectorHeatmapProps> = ({
  vectors,
  labels,
  maxDisplay = 20,
  colorScheme = 'grey',
  showValues = false,
  compact = false,
  tier = 'jigga',
  onUpgrade,
}) => {
  // Only JIGGA can see full vector analytics
  const canViewVectors = tier === 'jigga';

  // Normalize vectors to 0-1 range
  const normalized = useMemo(() => {
    if (!canViewVectors || vectors.length === 0) return [];

    // Get first N dimensions for display
    const displayVectors = vectors.map(v => v.slice(0, maxDisplay));
    
    // Find global min/max
    let min = Infinity;
    let max = -Infinity;
    for (const vec of displayVectors) {
      for (const val of vec) {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
    
    const range = max - min || 1;
    
    return displayVectors.map(vec => 
      vec.map(val => (val - min) / range)
    );
  }, [vectors, maxDisplay, canViewVectors]);

  const getColor = (value: number): string => {
    const intensity = Math.floor(value * 255);
    
    switch (colorScheme) {
      case 'heat':
        // Black to red to yellow
        if (value < 0.5) {
          return `rgb(${intensity * 2}, 0, 0)`;
        } else {
          return `rgb(255, ${(value - 0.5) * 510}, 0)`;
        }
      case 'cool':
        // Black to blue to cyan
        if (value < 0.5) {
          return `rgb(0, 0, ${intensity * 2})`;
        } else {
          return `rgb(0, ${(value - 0.5) * 510}, 255)`;
        }
      case 'grey':
      default:
        // Black to white gradient
        return `rgb(${intensity}, ${intensity}, ${intensity})`;
    }
  };

  // Deterministic color helper (avoid Math.random during render to prevent hydration mismatches)
  const getDeterministicColor = (seed: number): string => {
    // Simple deterministic generator using sin for consistent colors across server and client
    const r = Math.floor(Math.abs(Math.sin(seed + 1) * 10000) % 200);
    const g = Math.floor(Math.abs(Math.sin(seed + 2) * 10000) % 200);
    const b = Math.floor(Math.abs(Math.sin(seed + 3) * 10000) % 200);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Tier-locked preview for non-JIGGA users
  if (!canViewVectors) {
    return (
      <div className="relative">
        {/* Blurred preview */}
        <div className="absolute inset-0 pointer-events-none opacity-20 blur-sm">
          <div className="bg-white rounded-xl border border-primary-200 p-4">
            <div className="grid grid-cols-20 gap-1">
              {Array.from({ length: 60 }).map((_, i) => (
                <div 
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: getDeterministicColor(i) }}
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Upgrade overlay */}
        <div className="relative bg-gradient-to-br from-primary-50/95 to-white/95 backdrop-blur-sm border border-primary-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-primary-100 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary-400" />
          </div>
          <h4 className="text-lg font-bold text-primary-900 mb-2">
            Vector Analytics
          </h4>
          <p className="text-primary-600 text-sm mb-4 max-w-sm mx-auto">
            Visualize embedding vectors, similarity distributions, and semantic clustering patterns.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4 text-xs text-primary-500">
            <span className="flex items-center gap-1 px-2 py-1 bg-primary-100 rounded-full">
              <Grid3X3 className="w-3 h-3" />
              Heatmaps
            </span>
            <span className="flex items-center gap-1 px-2 py-1 bg-primary-100 rounded-full">
              <Sparkles className="w-3 h-3" />
              Similarity scores
            </span>
          </div>
          <button
            onClick={onUpgrade}
            className="px-4 py-2 bg-primary-800 text-white rounded-lg hover:bg-primary-900 transition-colors text-sm font-medium flex items-center gap-2 mx-auto"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to JIGGA
          </button>
        </div>
      </div>
    );
  }

  if (normalized.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-primary-50 rounded-lg border border-primary-200">
        <p className="text-sm text-primary-400">No vectors to display</p>
      </div>
    );
  }

  const cellSize = compact ? 8 : 12;
  const gap = compact ? 1 : 2;

  return (
    <div className="bg-white rounded-xl border border-primary-200 p-4 overflow-x-auto">
      <div className="flex flex-col gap-2">
        {/* Header with dimension labels */}
        <div className="flex items-center gap-1 mb-2" style={{ marginLeft: labels ? '80px' : '0' }}>
          {Array.from({ length: Math.min(maxDisplay, vectors[0]?.length ?? 0) }).map((_, i) => (
            <div
              key={i}
              className="text-xs text-primary-400 text-center"
              style={{ width: cellSize, minWidth: cellSize }}
            >
              {i % 5 === 0 ? i : ''}
            </div>
          ))}
        </div>

        {/* Heatmap rows */}
        {normalized.map((row, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-1">
            {labels && (
              <div className="w-20 text-xs text-primary-600 truncate pr-2 text-right">
                {labels[rowIndex] || `Doc ${rowIndex + 1}`}
              </div>
            )}
            <div className="flex" style={{ gap }}>
              {row.map((value, colIndex) => (
                <div
                  key={colIndex}
                  className="rounded-sm transition-all duration-150 hover:ring-2 hover:ring-primary-400"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getColor(value),
                  }}
                  title={showValues ? `[${colIndex}]: ${vectors[rowIndex]?.[colIndex]?.toFixed(4) ?? 'N/A'}` : undefined}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary-100">
          <span className="text-xs text-primary-500">Min</span>
          <div 
            className="flex-1 h-3 mx-3 rounded"
            style={{
              background: colorScheme === 'grey' 
                ? 'linear-gradient(to right, #000, #fff)'
                : colorScheme === 'heat'
                ? 'linear-gradient(to right, #000, #f00, #ff0)'
                : 'linear-gradient(to right, #000, #00f, #0ff)'
            }}
          />
          <span className="text-xs text-primary-500">Max</span>
        </div>

        {/* Info */}
        <div className="text-xs text-primary-400 text-center mt-2">
          Showing first {maxDisplay} of {vectors[0]?.length ?? 0} dimensions
        </div>
      </div>
    </div>
  );
};

/**
 * Vector Preview - Compact bar representation
 */
interface VectorPreviewProps {
  vector: number[];
  maxBars?: number;
  height?: number;
}

export const VectorPreview: React.FC<VectorPreviewProps> = ({
  vector,
  maxBars = 10,
  height = 32,
}) => {
  const normalized = useMemo(() => {
    const slice = vector.slice(0, maxBars);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const range = max - min || 1;
    return slice.map(v => (v - min) / range);
  }, [vector, maxBars]);

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {normalized.map((value, i) => (
        <div
          key={i}
          className="flex-1 bg-primary-600 rounded-t-sm transition-all duration-150"
          style={{ height: `${Math.max(value * 100, 5)}%` }}
        />
      ))}
    </div>
  );
};

/**
 * Similarity Score Display
 */
interface SimilarityScoreProps {
  score: number;
  label?: string;
  showPercentage?: boolean;
}

export const SimilarityScore: React.FC<SimilarityScoreProps> = ({
  score,
  label = 'Similarity',
  showPercentage = true,
}) => {
  const percentage = Math.round(score * 100);
  const width = `${percentage}%`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-primary-500">{label}</span>
        {showPercentage && (
          <span className="font-bold text-primary-800">{percentage}%</span>
        )}
      </div>
      <div className="h-2 bg-primary-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-600 rounded-full transition-all duration-300"
          style={{ width }}
        />
      </div>
    </div>
  );
};

/**
 * Vector Stats Card
 */
interface VectorStatsProps {
  dimension: number;
  magnitude?: number;
  sparsity?: number;
}

export const VectorStats: React.FC<VectorStatsProps> = ({
  dimension,
  magnitude,
  sparsity,
}) => {
  return (
    <div className="bg-primary-50 rounded-lg p-3 space-y-2">
      <div className="flex justify-between">
        <span className="text-xs text-primary-500">Dimension</span>
        <span className="text-xs font-bold text-primary-800">{dimension}</span>
      </div>
      {magnitude !== undefined && (
        <div className="flex justify-between">
          <span className="text-xs text-primary-500">Magnitude</span>
          <span className="text-xs font-bold text-primary-800">{magnitude.toFixed(4)}</span>
        </div>
      )}
      {sparsity !== undefined && (
        <div className="flex justify-between">
          <span className="text-xs text-primary-500">Sparsity</span>
          <span className="text-xs font-bold text-primary-800">{(sparsity * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

export default VectorHeatmap;
