/**
 * GOGGA Animated Vector Visualization Components
 * 
 * Interactive and animated visualizations for vector embeddings,
 * similarity search results, and semantic clustering.
 * 
 * Features:
 * - Animated 3D vector space projection
 * - Similarity wave animations
 * - Particle system for vector clusters
 * - Real-time search result highlighting
 */

'use client';

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { 
  Activity, 
  Zap, 
  Sparkles, 
  Target, 
  Network,
  Box,
  Eye,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

import { useVectorAnimation, useSimilarityWave } from '@/lib/rxdb/monitoringHooks';

// ============================================================================
// Types
// ============================================================================

interface VectorPoint {
  id: string;
  embedding: number[];
  label: string;
  similarity?: number;
  cluster?: number;
  isQuery?: boolean;
}

interface AnimatedVectorSpaceProps {
  vectors: VectorPoint[];
  queryVector?: number[];
  onVectorClick?: (id: string) => void;
  showLabels?: boolean;
  colorMode?: 'similarity' | 'cluster' | 'gradient';
  animationSpeed?: number;
  className?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Project high-dimensional vector to 2D using PCA-like approach
 * Uses deterministic projection for consistent visualization
 */
function projectTo2D(
  embedding: number[],
  projectionMatrix: number[][]
): { x: number; y: number } {
  // Use first 2 principal components
  let x = 0;
  let y = 0;
  const row0 = projectionMatrix[0];
  const row1 = projectionMatrix[1];
  if (!row0 || !row1) return { x: 0, y: 0 };
  
  const dim = Math.min(embedding.length, row0.length);
  
  for (let i = 0; i < dim; i++) {
    const val = embedding[i] ?? 0;
    x += val * (row0[i] ?? 0);
    y += val * (row1[i] ?? 0);
  }
  
  return { x, y };
}

/**
 * Generate a deterministic projection matrix
 */
function generateProjectionMatrix(dimensions: number): number[][] {
  const row0: number[] = [];
  const row1: number[] = [];
  
  for (let i = 0; i < dimensions; i++) {
    // Use sin/cos for smooth projection
    row0.push(Math.cos(i * 0.1) * 0.1);
    row1.push(Math.sin(i * 0.1) * 0.1);
  }
  
  return [row0, row1];
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get color based on similarity score
 */
function getSimilarityColor(similarity: number): string {
  // Gradient from grey (low) to green (high)
  const hue = similarity * 120; // 0 = red, 120 = green
  const saturation = 60 + similarity * 40;
  const lightness = 40 + similarity * 20;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get color based on cluster ID
 */
function getClusterColor(clusterId: number): string {
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
  ] as const;
  return colors[clusterId % colors.length] ?? '#6366f1';
}

// ============================================================================
// Animated Vector Space Component
// ============================================================================

export const AnimatedVectorSpace: React.FC<AnimatedVectorSpaceProps> = ({
  vectors,
  queryVector,
  onVectorClick,
  showLabels = true,
  colorMode = 'similarity',
  animationSpeed = 1,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  
  const { frame, isAnimating, start, stop, setSpeed } = useVectorAnimation(30);

  // Generate projection matrix once
  const projectionMatrix = useMemo(() => {
    const dim = vectors[0]?.embedding?.length || 384;
    return generateProjectionMatrix(dim);
  }, [vectors]);

  // Calculate projected positions with rotation
  const projectedVectors = useMemo(() => {
    return vectors.map(v => {
      const base = projectTo2D(v.embedding, projectionMatrix);
      
      // Apply rotation
      const cos = Math.cos(rotation * Math.PI / 180);
      const sin = Math.sin(rotation * Math.PI / 180);
      const rotatedX = base.x * cos - base.y * sin;
      const rotatedY = base.x * sin + base.y * cos;
      
      // Calculate similarity if query vector exists
      let similarity = v.similarity;
      if (queryVector && !similarity) {
        similarity = cosineSimilarity(v.embedding, queryVector);
      }
      
      return {
        ...v,
        x: rotatedX,
        y: rotatedY,
        similarity,
      };
    });
  }, [vectors, projectionMatrix, rotation, queryVector]);

  // Normalize positions to canvas
  const normalizedVectors = useMemo(() => {
    if (projectedVectors.length === 0) return [];
    
    const xs = projectedVectors.map(p => p.x);
    const ys = projectedVectors.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    
    const padding = 40;
    const width = dimensions.width - padding * 2;
    const height = dimensions.height - padding * 2;
    
    return projectedVectors.map(p => ({
      ...p,
      canvasX: padding + ((p.x - minX) / rangeX) * width,
      canvasY: padding + ((p.y - minY) / rangeY) * height,
    }));
  }, [projectedVectors, dimensions]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(200, width), height: Math.max(150, height) });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Animation rotation
  useEffect(() => {
    if (isAnimating) {
      setRotation(frame * animationSpeed);
    }
  }, [frame, isAnimating, animationSpeed]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = gridSize; x < dimensions.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dimensions.height);
      ctx.stroke();
    }
    for (let y = gridSize; y < dimensions.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.width, y);
      ctx.stroke();
    }

    // Draw connections for similar vectors
    if (queryVector) {
      const topN = normalizedVectors
        .filter(v => !v.isQuery && v.similarity && v.similarity > 0.5)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, 5);
      
      const queryPoint = normalizedVectors.find(v => v.isQuery);
      if (queryPoint) {
        topN.forEach(v => {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(99, 102, 241, ${(v.similarity || 0) * 0.5})`;
          ctx.lineWidth = (v.similarity || 0) * 3;
          ctx.moveTo(queryPoint.canvasX, queryPoint.canvasY);
          ctx.lineTo(v.canvasX, v.canvasY);
          ctx.stroke();
        });
      }
    }

    // Draw vectors as points
    normalizedVectors.forEach((v, index) => {
      const isHovered = v.id === hoveredId;
      const baseRadius = v.isQuery ? 12 : 8;
      const radius = isHovered ? baseRadius + 4 : baseRadius;
      
      // Pulsing effect for query vector
      const pulseOffset = v.isQuery ? Math.sin(frame * 0.1) * 2 : 0;
      
      // Determine color
      let color: string;
      if (v.isQuery) {
        color = '#ef4444'; // Red for query
      } else if (colorMode === 'cluster' && v.cluster !== undefined) {
        color = getClusterColor(v.cluster);
      } else if (colorMode === 'similarity' && v.similarity !== undefined) {
        color = getSimilarityColor(v.similarity);
      } else {
        // Gradient based on position
        const t = index / normalizedVectors.length;
        color = `hsl(${200 + t * 60}, 70%, 50%)`;
      }

      // Draw glow for high similarity
      if (v.similarity && v.similarity > 0.7) {
        ctx.beginPath();
        ctx.arc(v.canvasX, v.canvasY, radius + 8 + pulseOffset, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();
      }

      // Draw point
      ctx.beginPath();
      ctx.arc(v.canvasX, v.canvasY, radius + pulseOffset, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = isHovered ? '#000' : '#fff';
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.stroke();

      // Draw label
      if (showLabels && (isHovered || v.isQuery)) {
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = '#1f2937';
        ctx.textAlign = 'center';
        ctx.fillText(
          v.label.slice(0, 20),
          v.canvasX,
          v.canvasY - radius - 8
        );
        
        // Draw similarity score
        if (v.similarity !== undefined && !v.isQuery) {
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillStyle = '#6b7280';
          ctx.fillText(
            `${Math.round(v.similarity * 100)}%`,
            v.canvasX,
            v.canvasY + radius + 16
          );
        }
      }
    });
  }, [normalizedVectors, dimensions, hoveredId, frame, colorMode, showLabels, queryVector]);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || normalizedVectors.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find closest point
    interface NormalizedVector {
      id: string;
      canvasX: number;
      canvasY: number;
    }
    let closest: NormalizedVector | null = null;
    let minDist = 30; // Max distance for hover

    for (const v of normalizedVectors) {
      const dist = Math.sqrt((v.canvasX - x) ** 2 + (v.canvasY - y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = v;
      }
    }

    setHoveredId(closest?.id ?? null);
  }, [normalizedVectors]);

  const handleClick = useCallback(() => {
    if (hoveredId && onVectorClick) {
      onVectorClick(hoveredId);
    }
  }, [hoveredId, onVectorClick]);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-white rounded-xl border border-primary-200 overflow-hidden ${className}`}
      style={{ minHeight: 300 }}
    >
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          onClick={() => isAnimating ? stop() : start()}
          className="p-2 bg-white/90 backdrop-blur rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors"
          title={isAnimating ? 'Pause rotation' : 'Start rotation'}
        >
          {isAnimating ? (
            <Pause className="w-4 h-4 text-primary-600" />
          ) : (
            <Play className="w-4 h-4 text-primary-600" />
          )}
        </button>
        <button
          onClick={() => setRotation(0)}
          className="p-2 bg-white/90 backdrop-blur rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors"
          title="Reset rotation"
        >
          <RotateCcw className="w-4 h-4 text-primary-600" />
        </button>
      </div>

      {/* Info badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 text-xs text-primary-600 bg-white/90 backdrop-blur px-2 py-1 rounded-lg border border-primary-200">
        <Box className="w-3 h-3" />
        <span>{vectors.length} vectors</span>
        <span className="text-primary-300">|</span>
        <span>384D → 2D</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 text-xs bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-primary-200">
        {queryVector && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-primary-600">Query</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-primary-600">High similarity</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-primary-400" />
          <span className="text-primary-600">Low similarity</span>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="cursor-crosshair"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

// ============================================================================
// Similarity Wave Animation
// ============================================================================

interface SimilarityWaveProps {
  results: Array<{ id: string; label: string; similarity: number; content?: string }>;
  onResultClick?: (id: string) => void;
  className?: string;
}

export const SimilarityWave: React.FC<SimilarityWaveProps> = ({
  results,
  onResultClick,
  className = '',
}) => {
  const similarities = useMemo(() => results.map(r => r.similarity), [results]);
  const { scales, opacities, isAnimating, trigger } = useSimilarityWave(similarities);

  useEffect(() => {
    trigger();
  }, [results]); // Trigger animation when results change

  if (results.length === 0) {
    return (
      <div className={`p-6 text-center text-primary-400 ${className}`}>
        No similar vectors found
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-primary-700 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Similarity Results
        </h4>
        <button
          onClick={trigger}
          disabled={isAnimating}
          className="p-1.5 text-primary-400 hover:text-primary-600 transition-colors"
          title="Replay animation"
        >
          <Sparkles className={`w-4 h-4 ${isAnimating ? 'animate-pulse' : ''}`} />
        </button>
      </div>

      {results.map((result, index) => (
        <button
          key={result.id}
          onClick={() => onResultClick?.(result.id)}
          className="w-full text-left p-3 rounded-lg border border-primary-200 bg-white hover:bg-primary-50 transition-all duration-200"
          style={{
            transform: `scale(${scales[index]})`,
            opacity: opacities[index],
            transitionDelay: `${index * 50}ms`,
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-primary-800 truncate flex-1 mr-2">
              {result.label}
            </span>
            <div className="flex items-center gap-2">
              <div 
                className="h-2 rounded-full bg-primary-200 overflow-hidden"
                style={{ width: 60 }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${result.similarity * 100}%`,
                    backgroundColor: getSimilarityColor(result.similarity),
                  }}
                />
              </div>
              <span className="text-sm font-bold text-primary-700 w-12 text-right">
                {Math.round(result.similarity * 100)}%
              </span>
            </div>
          </div>
          {result.content && (
            <p className="text-xs text-primary-500 line-clamp-2">
              {result.content}
            </p>
          )}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Animated Vector Bars (Mini Visualization)
// ============================================================================

interface AnimatedVectorBarsProps {
  vector: number[];
  maxBars?: number;
  height?: number;
  animate?: boolean;
  colorScheme?: 'grey' | 'gradient' | 'rainbow';
  className?: string;
}

export const AnimatedVectorBars: React.FC<AnimatedVectorBarsProps> = ({
  vector,
  maxBars = 20,
  height = 40,
  animate = true,
  colorScheme = 'gradient',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for entrance animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Normalize vector values
  const normalized = useMemo(() => {
    const slice = vector.slice(0, maxBars);
    const min = Math.min(...slice);
    const max = Math.max(...slice);
    const range = max - min || 1;
    return slice.map(v => (v - min) / range);
  }, [vector, maxBars]);

  const getBarColor = (value: number, index: number): string => {
    switch (colorScheme) {
      case 'rainbow':
        return `hsl(${index * (360 / normalized.length)}, 70%, 50%)`;
      case 'gradient':
        return `hsl(${200 + value * 60}, 70%, ${40 + value * 20}%)`;
      case 'grey':
      default:
        const grey = 100 + Math.round(value * 100);
        return `rgb(${grey}, ${grey}, ${grey})`;
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`flex items-end gap-0.5 ${className}`}
      style={{ height }}
    >
      {normalized.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-sm transition-all duration-500 ease-out"
          style={{
            height: animate && isVisible ? `${Math.max(value * 100, 5)}%` : '5%',
            backgroundColor: getBarColor(value, index),
            transitionDelay: `${index * 30}ms`,
          }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Cluster Network Visualization
// ============================================================================

interface ClusterNetworkProps {
  clusters: Array<{
    id: string;
    name: string;
    size: number;
    centroid: number[];
    similarity: number;
  }>;
  showConnections?: boolean;
  className?: string;
}

export const ClusterNetwork: React.FC<ClusterNetworkProps> = ({
  clusters,
  showConnections = true,
  className = '',
}) => {
  const { frame, isAnimating, start, stop } = useVectorAnimation(20);

  // Calculate positions in a circle
  const positions = useMemo(() => {
    const centerX = 150;
    const centerY = 100;
    const radius = 70;

    return clusters.map((cluster, index) => {
      const angle = (index / clusters.length) * Math.PI * 2 - Math.PI / 2;
      // Add subtle animation offset
      const animOffset = isAnimating ? Math.sin(frame * 0.05 + index) * 3 : 0;
      
      return {
        ...cluster,
        x: centerX + Math.cos(angle) * (radius + animOffset),
        y: centerY + Math.sin(angle) * (radius + animOffset),
      };
    });
  }, [clusters, frame, isAnimating]);

  if (clusters.length === 0) {
    return (
      <div className={`flex items-center justify-center h-48 ${className}`}>
        <p className="text-primary-400 text-sm">No clusters to display</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 300 200" className="w-full h-48">
        {/* Connections */}
        {showConnections && positions.map((cluster, i) => 
          positions.slice(i + 1).map((other, j) => {
            const similarity = cosineSimilarity(cluster.centroid, other.centroid);
            if (similarity < 0.3) return null;
            
            return (
              <line
                key={`${cluster.id}-${other.id}`}
                x1={cluster.x}
                y1={cluster.y}
                x2={other.x}
                y2={other.y}
                stroke={`rgba(99, 102, 241, ${similarity * 0.5})`}
                strokeWidth={similarity * 3}
                className="transition-all duration-300"
              />
            );
          })
        )}

        {/* Cluster nodes */}
        {positions.map((cluster, index) => {
          const radius = 15 + cluster.size * 2;
          const color = getClusterColor(index);
          
          return (
            <g key={cluster.id} className="cursor-pointer">
              {/* Glow */}
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={radius + 5}
                fill={`${color}22`}
                className="animate-pulse"
              />
              {/* Main circle */}
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={radius}
                fill={color}
                stroke="#fff"
                strokeWidth={2}
                className="transition-all duration-200 hover:scale-110"
              />
              {/* Label */}
              <text
                x={cluster.x}
                y={cluster.y + radius + 14}
                textAnchor="middle"
                className="text-xs fill-primary-700"
              >
                {cluster.name.slice(0, 12)}
              </text>
              {/* Size indicator */}
              <text
                x={cluster.x}
                y={cluster.y + 4}
                textAnchor="middle"
                className="text-xs fill-white font-bold"
              >
                {cluster.size}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Animation control */}
      <button
        onClick={() => isAnimating ? stop() : start()}
        className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-lg border border-primary-200 hover:bg-primary-50"
        title={isAnimating ? 'Stop animation' : 'Start animation'}
      >
        {isAnimating ? (
          <Pause className="w-3 h-3 text-primary-600" />
        ) : (
          <Network className="w-3 h-3 text-primary-600" />
        )}
      </button>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default AnimatedVectorSpace;
