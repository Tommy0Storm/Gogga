'use client';

import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RAGActivityIndicatorProps {
  isSearching: boolean;
  resultCount?: number;
}

export function RAGActivityIndicator({ isSearching, resultCount }: RAGActivityIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Database 
          size={18} 
          className={cn(
            'transition-colors',
            isSearching ? 'text-primary-600' : 'text-gray-400'
          )} 
        />
        
        {/* Pulse animation when searching */}
        {isSearching && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
        )}
      </div>
      
      {resultCount !== undefined && (
        <span className="text-xs text-gray-500">
          {isSearching ? 'Searching...' : `${resultCount} matches`}
        </span>
      )}
    </div>
  );
}
