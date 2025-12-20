/**
 * WatermarkOverlay Component
 * 
 * Adds watermark to images for FREE tier users.
 * Shows upgrade prompt on hover.
 */

'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface WatermarkOverlayProps {
  /** Whether to show watermark (typically tier === 'free') */
  showWatermark: boolean;
  /** Callback when upgrade button clicked */
  onUpgrade?: () => void;
  /** Children (the image) */
  children: React.ReactNode;
}

export function WatermarkOverlay({
  showWatermark,
  onUpgrade,
  children,
}: WatermarkOverlayProps) {
  const [isHovering, setIsHovering] = useState(false);
  
  if (!showWatermark) {
    return <>{children}</>;
  }
  
  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {children}
      
      {/* Watermark pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Diagonal watermark text */}
          <div className="transform -rotate-45 text-white/20 text-4xl font-bold tracking-[0.3em] whitespace-nowrap select-none">
            GOGGA PREVIEW
          </div>
        </div>
        {/* Corner watermarks */}
        <div className="absolute top-2 left-2 text-white/30 text-xs font-medium">
          PREVIEW
        </div>
        <div className="absolute bottom-2 right-2 text-white/30 text-xs font-medium">
          gogga.co.za
        </div>
      </div>
      
      {/* Hover upgrade prompt */}
      {isHovering && onUpgrade && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm transition-opacity">
          <div className="text-center p-4">
            <Sparkles className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-white font-medium mb-2">
              Remove watermark with JIVE
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpgrade();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 
                       text-sm font-medium rounded-lg hover:bg-neutral-100 transition-colors"
            >
              Upgrade for R49/mo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WatermarkOverlay;
