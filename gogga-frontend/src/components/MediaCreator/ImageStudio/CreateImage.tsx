/**
 * CreateImage Component
 * 
 * Text-to-image generation interface.
 * Prompt → Settings → Cost Estimate → Generate → Results
 */

'use client';

import { useState, useCallback } from 'react';
import { Wand2, Sparkles, Download, Edit, ArrowUpCircle, Loader2, Settings2 } from 'lucide-react';
import {
  type UserTier,
  type AspectRatio,
  type ImageCreateRequest,
  type ImageResponse,
  type GeneratedImage,
  generateImage,
  downloadBase64Image,
} from '../shared';
import { CostEstimate, QuotaIndicator, WatermarkOverlay, TierGate } from '../shared';

interface CreateImageProps {
  tier: UserTier;
  onEdit?: (image: GeneratedImage) => void;
  onUpscale?: (image: GeneratedImage) => void;
  onUpgrade?: () => void;
  quota?: { used: number; limit: number };
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: '1:1', label: 'Square', icon: '◻' },
  { value: '16:9', label: 'Landscape', icon: '▭' },
  { value: '9:16', label: 'Portrait', icon: '▯' },
  { value: '4:3', label: 'Standard', icon: '▭' },
  { value: '3:4', label: 'Tall', icon: '▯' },
];

const STYLE_PRESETS = [
  { id: 'none', label: 'None', prompt: '' },
  { id: 'photo', label: 'Photorealistic', prompt: ', photorealistic, 8k, detailed' },
  { id: 'art', label: 'Digital Art', prompt: ', digital art, trending on artstation' },
  { id: 'anime', label: 'Anime', prompt: ', anime style, studio ghibli' },
  { id: 'sketch', label: 'Sketch', prompt: ', pencil sketch, black and white' },
  { id: 'oil', label: 'Oil Painting', prompt: ', oil painting, classical art' },
];

export function CreateImage({
  tier,
  onEdit,
  onUpscale,
  onUpgrade,
  quota,
}: CreateImageProps) {
  // Form state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [sampleCount, setSampleCount] = useState(1);
  const [stylePreset, setStylePreset] = useState('none');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    
    try {
      // Apply style preset to prompt
      const style = STYLE_PRESETS.find(s => s.id === stylePreset);
      const fullPrompt = prompt + (style?.prompt || '');
      
      const request: ImageCreateRequest = {
        prompt: fullPrompt,
        aspect_ratio: aspectRatio,
        sample_count: sampleCount,
        negative_prompt: negativePrompt || undefined,
      };
      
      const response = await generateImage(request, { userTier: tier });
      setResult(response);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, sampleCount, negativePrompt, stylePreset, tier]);
  
  const handleDownload = useCallback((image: GeneratedImage, index: number) => {
    const filename = `gogga-image-${Date.now()}-${index + 1}.png`;
    downloadBase64Image(image.data, filename, image.mime_type);
  }, []);
  
  return (
    <div className="space-y-6">
      {/* Quota indicator */}
      {quota && (
        <QuotaIndicator
          used={quota.used}
          limit={quota.limit}
          label="Images this month"
        />
      )}
      
      {/* Prompt input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Describe your image
        </label>
        <textarea
          id="create-image-prompt"
          name="create-image-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A majestic lion standing on Table Mountain at sunset, golden hour lighting..."
          className="w-full h-24 px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 
                   dark:border-neutral-700 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 
                   focus:border-transparent transition-all"
          disabled={isGenerating}
        />
        <div className="flex justify-between text-xs text-neutral-500">
          <span>{prompt.length}/2000</span>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            <Settings2 className="w-3 h-3" />
            {showAdvanced ? 'Hide' : 'Show'} advanced
          </button>
        </div>
      </div>
      
      {/* Style presets */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Style
        </label>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRESETS.map((style) => (
            <button
              key={style.id}
              onClick={() => setStylePreset(style.id)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                stylePreset === style.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
              disabled={isGenerating}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Aspect ratio */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Aspect Ratio
        </label>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => setAspectRatio(ratio.value)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                aspectRatio === ratio.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
              disabled={isGenerating}
            >
              <span className="text-lg">{ratio.icon}</span>
              <span className="block text-xs mt-0.5">{ratio.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Advanced options */}
      {showAdvanced && (
        <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          {/* Number of images */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Number of images: {sampleCount}
            </label>
            <input
              id="create-image-sample-count"
              name="create-image-sample-count"
              type="range"
              min={1}
              max={4}
              value={sampleCount}
              onChange={(e) => setSampleCount(Number(e.target.value))}
              className="w-full"
              disabled={isGenerating}
            />
            <div className="flex justify-between text-xs text-neutral-500">
              <span>1</span>
              <span>4</span>
            </div>
          </div>
          
          {/* Negative prompt */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Negative prompt (what to avoid)
            </label>
            <input
              id="create-image-negative-prompt"
              name="create-image-negative-prompt"
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="blurry, low quality, distorted..."
              className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 
                       dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary-500"
              disabled={isGenerating}
            />
          </div>
        </div>
      )}
      
      {/* Cost estimate */}
      <CostEstimate
        operation="create"
        count={sampleCount}
        tier={tier}
      />
      
      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 dark:bg-white 
                 text-white dark:text-neutral-900 font-medium rounded-lg hover:bg-neutral-800 
                 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5" />
            Generate Image{sampleCount > 1 ? 's' : ''}
          </>
        )}
      </button>
      
      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      {/* Results */}
      {result?.success && result.images.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Generated {result.images.length} image{result.images.length > 1 ? 's' : ''}
          </h3>
          
          <div className={`grid gap-4 ${result.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {result.images.map((image, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <WatermarkOverlay showWatermark={tier === 'free'} onUpgrade={onUpgrade}>
                  <img
                    src={`data:${image.mime_type};base64,${image.data}`}
                    alt={`Generated image ${index + 1}`}
                    className="w-full h-auto"
                  />
                </WatermarkOverlay>
                
                {/* Action buttons */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/60 to-transparent 
                              opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(image, index)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white/90 
                               text-neutral-900 text-sm rounded hover:bg-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(image)}
                        className="p-1.5 bg-white/90 text-neutral-900 rounded hover:bg-white transition-colors"
                        title="Edit image"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {onUpscale && (
                      <button
                        onClick={() => onUpscale(image)}
                        className="p-1.5 bg-white/90 text-neutral-900 rounded hover:bg-white transition-colors"
                        title="Upscale image"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Cost summary */}
          <div className="text-xs text-neutral-500 text-center">
            Cost: R{result.meta.cost_zar.toFixed(2)} • Model: {result.meta.model}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateImage;
