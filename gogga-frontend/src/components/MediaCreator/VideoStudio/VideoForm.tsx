/**
 * VideoForm Component
 * 
 * Video generation request form.
 * Prompt + settings → cost estimate → generate
 */

'use client';

import { useState, useCallback } from 'react';
import { Video, Upload, Music, Zap, Settings2, Loader2 } from 'lucide-react';
import {
  type UserTier,
  type VideoDuration,
  type VideoResolution,
  type VideoGenerateRequest,
  type VideoResponse,
  generateVideo,
  fileToBase64,
  PRICING,
} from '../shared';
import { CostEstimate, TierGate, QuotaIndicator } from '../shared';

interface VideoFormProps {
  tier: UserTier;
  onJobStarted: (response: VideoResponse) => void;
  onUpgrade?: () => void;
  quota?: { used: number; limit: number };
}

const DURATION_OPTIONS: { value: VideoDuration; label: string }[] = [
  { value: 4, label: '4 seconds' },
  { value: 6, label: '6 seconds' },
  { value: 8, label: '8 seconds' },
];

const RESOLUTION_OPTIONS: { value: VideoResolution; label: string; tier: UserTier }[] = [
  { value: '720p', label: 'HD (720p)', tier: 'jive' },
  { value: '1080p', label: 'Full HD (1080p)', tier: 'jigga' },
];

export function VideoForm({
  tier,
  onJobStarted,
  onUpgrade,
  quota,
}: VideoFormProps) {
  // Form state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [duration, setDuration] = useState<VideoDuration>(6);
  const [resolution, setResolution] = useState<VideoResolution>('720p');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [generateAudio, setGenerateAudio] = useState(false);
  const [useFastModel, setUseFastModel] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Reference image
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64 = await fileToBase64(file);
      setReferenceImage(base64);
    } catch (err) {
      setError('Failed to load image');
    }
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const request: VideoGenerateRequest = {
        prompt,
        source_image: referenceImage || undefined,
        aspect_ratio: aspectRatio,
        duration_seconds: duration,
        generate_audio: generateAudio,
        negative_prompt: negativePrompt || undefined,
        resolution,
        use_fast_model: useFastModel,
      };
      
      const response = await generateVideo(request, { userTier: tier });
      
      if (response.success && response.job_id) {
        onJobStarted(response);
      } else {
        setError(response.error || 'Failed to start video generation');
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [prompt, referenceImage, aspectRatio, duration, generateAudio, negativePrompt, resolution, useFastModel, tier, onJobStarted]);
  
  // Calculate cost
  const estimatedCost = duration * (generateAudio ? PRICING.VIDEO_AUDIO : PRICING.VIDEO_ONLY);
  
  // Check tier access
  const canUseAudio = tier !== 'free';
  const canUse1080p = tier === 'jigga';
  
  return (
    <TierGate
      tier={tier}
      requiredTier="jive"
      featureName="Video Generation"
      onUpgrade={onUpgrade}
    >
      <div className="space-y-6">
        {/* Quota indicator */}
        {quota && (
          <QuotaIndicator
            used={quota.used}
            limit={quota.limit}
            label="Video minutes this month"
            unit=" min"
          />
        )}
        
        {/* Prompt */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Describe your video
          </label>
          <textarea
            id="video-form-prompt"
            name="video-form-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A drone shot flying over Cape Town's coastline at golden hour, waves crashing against rocks..."
            className="w-full h-24 px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 
                     dark:border-neutral-700 rounded-lg resize-none focus:ring-2 focus:ring-primary-500"
            disabled={isSubmitting}
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
        
        {/* Reference image (optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Reference Image (optional)
          </label>
          {referenceImage ? (
            <div className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 h-32">
              <img
                src={`data:image/png;base64,${referenceImage}`}
                alt="Reference"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setReferenceImage(null)}
                className="absolute top-2 right-2 px-2 py-1 bg-white/90 text-neutral-900 text-xs 
                         rounded hover:bg-white transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg 
                         p-4 text-center hover:border-primary-500 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-reference-upload"
              />
              <label htmlFor="video-reference-upload" className="cursor-pointer block">
                <Upload className="w-6 h-6 mx-auto mb-1 text-neutral-400" />
                <p className="text-xs text-neutral-500">
                  Add image for image-to-video
                </p>
              </label>
            </div>
          )}
        </div>
        
        {/* Duration */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Duration
          </label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                  duration === opt.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                }`}
                disabled={isSubmitting}
              >
                {opt.label}
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
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                aspectRatio === '16:9'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
              disabled={isSubmitting}
            >
              <span className="text-lg">▭</span>
              <span className="block text-xs mt-0.5">Landscape (16:9)</span>
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                aspectRatio === '9:16'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
              }`}
              disabled={isSubmitting}
            >
              <span className="text-lg">▯</span>
              <span className="block text-xs mt-0.5">Portrait (9:16)</span>
            </button>
          </div>
        </div>
        
        {/* Audio toggle */}
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-neutral-400" />
            <div>
              <div className="text-sm font-medium text-neutral-900 dark:text-white">
                Generate Audio
              </div>
              <div className="text-xs text-neutral-500">
                AI-generated sound effects and music
              </div>
            </div>
          </div>
          <button
            onClick={() => canUseAudio && setGenerateAudio(!generateAudio)}
            disabled={!canUseAudio}
            className={`relative w-10 h-6 rounded-full transition-colors ${
              generateAudio ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
            } ${!canUseAudio ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                generateAudio ? 'translate-x-4' : ''
              }`}
            />
          </button>
        </div>
        {!canUseAudio && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 -mt-4">
            Audio generation requires JIVE or higher
          </p>
        )}
        
        {/* Advanced options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
            {/* Resolution */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Resolution
              </label>
              <div className="flex gap-2">
                {RESOLUTION_OPTIONS.map((opt) => {
                  const isAvailable = tier === 'jigga' || opt.value === '720p';
                  return (
                    <button
                      key={opt.value}
                      onClick={() => isAvailable && setResolution(opt.value)}
                      disabled={!isAvailable}
                      className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                        resolution === opt.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-neutral-700'
                      } ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {opt.label}
                      {!isAvailable && (
                        <span className="block text-[10px] text-yellow-600">JIGGA</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Fast model toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-neutral-400" />
                <div>
                  <div className="text-sm font-medium">Fast Mode</div>
                  <div className="text-xs text-neutral-500">Quicker but no audio</div>
                </div>
              </div>
              <button
                onClick={() => setUseFastModel(!useFastModel)}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  useFastModel ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    useFastModel ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
            
            {/* Negative prompt */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Negative prompt
              </label>
              <input
                id="video-negative-prompt"
                name="video-negative-prompt"
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="blurry, distorted, low quality..."
                className="w-full px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 
                         dark:border-neutral-700 rounded-lg"
                disabled={isSubmitting}
              />
            </div>
          </div>
        )}
        
        {/* Cost estimate */}
        <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div>
            <div className="text-sm font-medium text-neutral-900 dark:text-white">
              Estimated Cost: R{estimatedCost.toFixed(2)}
            </div>
            <div className="text-xs text-neutral-500">
              {duration}s × R{(generateAudio ? PRICING.VIDEO_AUDIO : PRICING.VIDEO_ONLY).toFixed(2)}/s
              {generateAudio && ' (with audio)'}
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            ~${(estimatedCost / 18.5).toFixed(2)} USD
          </div>
        </div>
        
        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isSubmitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 dark:bg-white 
                   text-white dark:text-neutral-900 font-medium rounded-lg hover:bg-neutral-800 
                   dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Video className="w-5 h-5" />
              Generate {duration}s Video
            </>
          )}
        </button>
        
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </TierGate>
  );
}

export default VideoForm;
