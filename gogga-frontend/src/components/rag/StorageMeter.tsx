'use client';

import { Database, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StorageMeterProps {
  usedDocs: number;
  maxDocs: number;
  usedMB: number;
  maxMB: number;
}

export function StorageMeter({ usedDocs, maxDocs, usedMB, maxMB }: StorageMeterProps) {
  const docPercent = maxDocs > 0 ? (usedDocs / maxDocs) * 100 : 0;
  const storagePercent = maxMB > 0 ? (usedMB / maxMB) * 100 : 0;
  const isNearLimit = docPercent > 80 || storagePercent > 80;

  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      {/* Documents */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="flex items-center gap-1.5 text-gray-600">
            <Database size={14} />
            Documents
          </span>
          <span className={cn('font-medium', isNearLimit && 'text-amber-600')}>
            {usedDocs} / {maxDocs}
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              docPercent > 90 ? 'bg-red-500' :
              docPercent > 70 ? 'bg-amber-500' : 'bg-primary-500'
            )}
            style={{ width: `${Math.min(docPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Storage */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="flex items-center gap-1.5 text-gray-600">
            <HardDrive size={14} />
            Storage
          </span>
          <span className={cn('font-medium', isNearLimit && 'text-amber-600')}>
            {usedMB.toFixed(1)} / {maxMB} MB
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              storagePercent > 90 ? 'bg-red-500' :
              storagePercent > 70 ? 'bg-amber-500' : 'bg-primary-500'
            )}
            style={{ width: `${Math.min(storagePercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
