'use client';

import { Cpu, Loader2, Check } from 'lucide-react';

interface ModelLoadingProgressProps {
  isLoading: boolean;
  progress: number;  // 0-100
  modelName?: string;
}

export function ModelLoadingProgress({ 
  isLoading, 
  progress, 
  modelName = 'E5 Embedding Model' 
}: ModelLoadingProgressProps) {
  if (!isLoading && progress === 100) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check size={16} />
        <span>{modelName} ready</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        {isLoading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Cpu size={16} />
        )}
        <span>Loading {modelName}...</span>
        <span className="text-gray-400">{Math.round(progress)}%</span>
      </div>
      
      {/* Animated progress bar */}
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
