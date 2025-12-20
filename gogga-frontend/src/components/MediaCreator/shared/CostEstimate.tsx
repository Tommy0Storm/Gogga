/**
 * CostEstimate Component
 * 
 * Displays estimated cost for media generation operations.
 * Shows both ZAR and approximate USD.
 */

'use client';

import { Calculator, AlertCircle } from 'lucide-react';
import { PRICING, type UserTier, type UpscaleFactor } from './types';

interface CostEstimateProps {
  /** Type of operation */
  operation: 'create' | 'edit' | 'upscale' | 'video';
  /** Number of items (images or video seconds) */
  count: number;
  /** User tier (free tier shows "Preview" instead of cost) */
  tier: UserTier;
  /** For upscale: which version */
  upscaleVersion?: 'v3' | 'v4';
  /** For video: include audio */
  withAudio?: boolean;
  /** Show compact version */
  compact?: boolean;
}

function calculateCost(
  operation: CostEstimateProps['operation'],
  count: number,
  upscaleVersion?: 'v3' | 'v4',
  withAudio?: boolean
): number {
  switch (operation) {
    case 'create':
      return count * PRICING.IMAGE_CREATE;
    case 'edit':
      return count * PRICING.IMAGE_EDIT;
    case 'upscale':
      return count * (upscaleVersion === 'v4' ? PRICING.UPSCALE_V4 : PRICING.UPSCALE_V3);
    case 'video':
      return count * (withAudio ? PRICING.VIDEO_AUDIO : PRICING.VIDEO_ONLY);
    default:
      return 0;
  }
}

export function CostEstimate({
  operation,
  count,
  tier,
  upscaleVersion = 'v3',
  withAudio = false,
  compact = false,
}: CostEstimateProps) {
  // Free tier shows preview badge
  if (tier === 'free') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded font-medium">
          Preview
        </span>
        {!compact && (
          <span className="text-neutral-500">Watermarked</span>
        )}
      </div>
    );
  }
  
  const cost = calculateCost(operation, count, upscaleVersion, withAudio);
  const usd = cost / 18.5; // Approximate USD
  
  if (compact) {
    return (
      <span className="text-xs text-neutral-500">
        ~R{cost.toFixed(2)}
      </span>
    );
  }
  
  return (
    <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
      <Calculator className="w-4 h-4 text-neutral-400" />
      <div className="flex-1">
        <div className="text-sm font-medium text-neutral-900 dark:text-white">
          Estimated Cost: R{cost.toFixed(2)}
        </div>
        <div className="text-xs text-neutral-500">
          ≈ ${usd.toFixed(3)} USD • {count} {operation === 'video' ? 'seconds' : count === 1 ? 'image' : 'images'}
        </div>
      </div>
    </div>
  );
}

/**
 * QuotaIndicator Component
 * 
 * Shows remaining quota for the current billing period.
 */

interface QuotaIndicatorProps {
  used: number;
  limit: number;
  label: string;
  unit?: string;
}

export function QuotaIndicator({ used, limit, label, unit = '' }: QuotaIndicatorProps) {
  const remaining = Math.max(0, limit - used);
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isLow = percentage >= 80;
  const isExhausted = remaining === 0;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className={`font-medium ${isExhausted ? 'text-red-500' : isLow ? 'text-yellow-500' : 'text-neutral-900 dark:text-white'}`}>
          {remaining}{unit} left
        </span>
      </div>
      <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isExhausted ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {isExhausted && (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          Quota exhausted - upgrade for more
        </div>
      )}
    </div>
  );
}

export default CostEstimate;
