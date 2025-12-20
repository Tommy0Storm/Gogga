/**
 * UpscaleChoice Component
 * 
 * Image upscaling with V3 vs V4 Ultra selection.
 * Shows comparison preview and pricing.
 */

'use client';

import { useState, useCallback } from 'react';
import { ArrowUpCircle, Sparkles, Download, Loader2, Zap, Crown } from 'lucide-react';
import {
  type UserTier,
  type UpscaleFactor,
  type ImageUpscaleRequest,
  type ImageResponse,
  type GeneratedImage,
  upscaleImage,
  fileToBase64,
  downloadBase64Image,
  PRICING,
} from '../shared';
import { CostEstimate, TierGate, WatermarkOverlay } from '../shared';

interface UpscaleChoiceProps {
  tier: UserTier;
  /** Pre-loaded image to upscale */
  initialImage?: GeneratedImage;
  onUpgrade?: () => void;
}

type UpscaleVersion = 'v3' | 'v4';

const UPSCALE_OPTIONS: {
  version: UpscaleVersion;
  factor: UpscaleFactor;
  label: string;
  resolution: string;
  tier: UserTier;
  icon: typeof Zap;
}[] = [
  { version: 'v3', factor: 'x2', label: '2K Upscale', resolution: '~2048px', tier: 'jive', icon: Zap },
  { version: 'v3', factor: 'x3', label: '3K Upscale', resolution: '~3072px', tier: 'jive', icon: Zap },
  { version: 'v4', factor: 'x4', label: '4K Ultra', resolution: '~4096px', tier: 'jigga', icon: Crown },
];

export function UpscaleChoice({
  tier,
  initialImage,
  onUpgrade,
}: UpscaleChoiceProps) {
  // Source image
  const [sourceImage, setSourceImage] = useState<string | null>(initialImage?.data || null);
  const [selectedOption, setSelectedOption] = useState<typeof UPSCALE_OPTIONS[0] | null>(null);
  
  // Generation state
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [result, setResult] = useState<ImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64 = await fileToBase64(file);
      setSourceImage(base64);
      setResult(null);
      setError(null);
    } catch (err) {
      setError('Failed to load image');
    }
  }, []);
  
  const handleUpscale = useCallback(async () => {
    if (!sourceImage || !selectedOption) return;
    
    setIsUpscaling(true);
    setError(null);
    setResult(null);
    
    try {
      const request: ImageUpscaleRequest = {
        source_image: sourceImage,
        upscale_factor: selectedOption.factor,
      };
      
      const response = await upscaleImage(request, { userTier: tier });
      setResult(response);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscaling failed');
    } finally {
      setIsUpscaling(false);
    }
  }, [sourceImage, selectedOption, tier]);
  
  const handleDownload = useCallback((image: GeneratedImage) => {
    const filename = `gogga-upscaled-${selectedOption?.resolution || ''}-${Date.now()}.png`;
    downloadBase64Image(image.data, filename, image.mime_type);
  }, [selectedOption]);
  
  const canUseOption = (option: typeof UPSCALE_OPTIONS[0]) => {
    const tierOrder: UserTier[] = ['free', 'jive', 'jigga'];
    return tierOrder.indexOf(tier) >= tierOrder.indexOf(option.tier);
  };
  
  return (
    <TierGate
      tier={tier}
      requiredTier="jive"
      featureName="Image Upscaling"
      onUpgrade={onUpgrade}
    >
      <div className="space-y-6">
        {/* Upload / Preview */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Source Image
          </label>
          
          {sourceImage ? (
            <div className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img
                src={`data:image/png;base64,${sourceImage}`}
                alt="Source"
                className="w-full max-h-64 object-contain"
              />
              <button
                onClick={() => {
                  setSourceImage(null);
                  setResult(null);
                }}
                className="absolute top-2 right-2 px-3 py-1 bg-white/90 text-neutral-900 text-sm 
                         rounded-lg hover:bg-white transition-colors"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl 
                         p-6 text-center hover:border-primary-500 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="upscale-image-upload"
              />
              <label htmlFor="upscale-image-upload" className="cursor-pointer block">
                <ArrowUpCircle className="w-10 h-10 mx-auto mb-2 text-neutral-400" />
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Upload an image to upscale
                </p>
              </label>
            </div>
          )}
        </div>
        
        {/* Upscale options */}
        {sourceImage && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Upscale Quality
            </label>
            <div className="grid grid-cols-3 gap-3">
              {UPSCALE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isAvailable = canUseOption(option);
                const isSelected = selectedOption?.factor === option.factor;
                
                return (
                  <button
                    key={`${option.version}-${option.factor}`}
                    onClick={() => isAvailable && setSelectedOption(option)}
                    disabled={!isAvailable}
                    className={`relative p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : isAvailable
                        ? 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                        : 'border-neutral-200 dark:border-neutral-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {/* Tier badge */}
                    {option.tier === 'jigga' && (
                      <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 
                                     text-[10px] font-bold text-white rounded">
                        ULTRA
                      </span>
                    )}
                    
                    <Icon className={`w-6 h-6 mb-2 ${
                      isSelected ? 'text-primary-600' : 'text-neutral-400'
                    }`} />
                    
                    <div className="font-medium text-sm">{option.label}</div>
                    <div className="text-xs text-neutral-500">{option.resolution}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      R{option.version === 'v4' ? PRICING.UPSCALE_V4 : PRICING.UPSCALE_V3}
                    </div>
                    
                    {!isAvailable && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        {option.tier.toUpperCase()} required
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Cost estimate */}
        {sourceImage && selectedOption && (
          <CostEstimate
            operation="upscale"
            count={1}
            tier={tier}
            upscaleVersion={selectedOption.version}
          />
        )}
        
        {/* Upscale button */}
        {sourceImage && (
          <button
            onClick={handleUpscale}
            disabled={!selectedOption || isUpscaling}
            className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 dark:bg-white 
                     text-white dark:text-neutral-900 font-medium rounded-lg hover:bg-neutral-800 
                     dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isUpscaling ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Upscaling...
              </>
            ) : (
              <>
                <ArrowUpCircle className="w-5 h-5" />
                Upscale to {selectedOption?.resolution || '...'}
              </>
            )}
          </button>
        )}
        
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Result */}
        {result?.success && result.images.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Upscaled to {selectedOption?.resolution}
            </h3>
            
            <div className="relative group rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <WatermarkOverlay showWatermark={tier === 'free'} onUpgrade={onUpgrade}>
                {result.images[0] && (
                  <img
                    src={`data:${result.images[0].mime_type};base64,${result.images[0].data}`}
                    alt="Upscaled image"
                    className="w-full h-auto"
                  />
                )}
              </WatermarkOverlay>
              
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent 
                            opacity-0 group-hover:opacity-100 transition-opacity">
                {result.images[0] && (
                  <button
                    onClick={() => handleDownload(result.images[0]!)}
                    className="w-full flex items-center justify-center gap-1 py-1.5 bg-white/90 
                             text-neutral-900 text-sm rounded hover:bg-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download {selectedOption?.resolution}
                  </button>
                )}
              </div>
            </div>
            
            {/* Comparison hint */}
            <p className="text-xs text-neutral-500 text-center">
              Tip: Compare with original to see the quality improvement
            </p>
          </div>
        )}
      </div>
    </TierGate>
  );
}

export default UpscaleChoice;
