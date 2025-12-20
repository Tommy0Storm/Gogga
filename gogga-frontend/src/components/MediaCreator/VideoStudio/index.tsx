/**
 * VideoStudio Container Component
 * 
 * Main video creation interface with form, progress tracking,
 * and sample gallery for FREE tier users.
 */

'use client';

import { useState, useCallback } from 'react';
import { Video, Film, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { VideoForm } from './VideoForm';
import { type VideoGenerateRequest } from '../shared/types';
import { VideoProgress } from './VideoProgress';
import { VideoPlayer } from './VideoPlayer';
import { SampleGallery } from './SampleGallery';
import { 
  type UserTier, 
  type VideoResponse,
  UpgradePrompt, 
  TierGate 
} from '../shared';
import { generateVideo, getVideoStatus } from '../shared/api';

interface VideoStudioProps {
  /** User's subscription tier */
  tier: UserTier;
  /** Monthly video quota */
  quota: { used: number; limit: number };
  /** Initial prompt to use */
  initialPrompt?: string;
  /** Reference image for img2vid */
  referenceImage?: string;
}

type VideoState = 
  | { status: 'idle' }
  | { status: 'generating'; operationId: string; prompt: string }
  | { status: 'completed'; response: VideoResponse }
  | { status: 'error'; message: string };

export function VideoStudio({
  tier,
  quota,
  initialPrompt = '',
  referenceImage,
}: VideoStudioProps) {
  const [state, setState] = useState<VideoState>({ status: 'idle' });
  const [showGallery, setShowGallery] = useState(tier === 'free');
  
  const isFree = tier === 'free';
  const quotaExhausted = quota.used >= quota.limit;
  
  // Handle video generation submit
  const handleSubmit = useCallback(async (data: VideoGenerateRequest) => {
    // Check quota
    if (quotaExhausted) {
      setState({ status: 'error', message: 'Monthly video quota exhausted' });
      return;
    }
    
    try {
      const response = await generateVideo({
        prompt: data.prompt,
        duration_seconds: data.duration_seconds,
        aspect_ratio: data.aspect_ratio,
        generate_audio: data.generate_audio,
        resolution: data.resolution,
        use_fast_model: data.use_fast_model,
        source_image: data.source_image,
      }, { userTier: tier });
      
      if (response.status === 'pending' || response.status === 'running') {
        // Video is generating asynchronously
        setState({
          status: 'generating',
          operationId: response.job_id || '',
          prompt: data.prompt,
        });
      } else if (response.status === 'completed') {
        // Immediate completion (unlikely for video)
        setState({ status: 'completed', response });
      } else {
        setState({ status: 'error', message: response.error || 'Generation failed' });
      }
    } catch (err) {
      setState({ 
        status: 'error', 
        message: err instanceof Error ? err.message : 'Video generation failed' 
      });
    }
  }, [tier, quotaExhausted]);
  
  // Handle video generation completion
  const handleComplete = useCallback((response: VideoResponse) => {
    setState({ status: 'completed', response });
  }, []);
  
  // Handle generation error
  const handleError = useCallback((error: string) => {
    setState({ status: 'error', message: error });
  }, []);
  
  // Handle job started callback from VideoForm
  const handleJobStarted = useCallback((response: VideoResponse) => {
    if (response.status === 'pending' || response.status === 'running') {
      setState({
        status: 'generating',
        operationId: response.job_id || '',
        prompt: response.prompt,
      });
    } else if (response.status === 'completed') {
      setState({ status: 'completed', response });
    } else {
      setState({ status: 'error', message: response.error || 'Generation failed' });
    }
  }, []);
  
  // Reset to start new video
  const handleReset = useCallback(() => {
    setState({ status: 'idle' });
    setShowGallery(false);
  }, []);
  
  // Handle background generation
  const handleBackground = useCallback(() => {
    // Could integrate with global notification system
    console.log('Video generation running in background');
  }, []);
  
  // Render content based on state
  const renderContent = () => {
    // FREE tier shows gallery only
    if (isFree) {
      return (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 
                        dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Video Generation is a Premium Feature
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Upgrade to JIVE (R49/month) or JIGGA (R149/month) to create stunning AI videos.
                  Check out the examples below to see what&apos;s possible!
                </p>
              </div>
            </div>
          </div>
          
          <SampleGallery tier={tier} />
        </div>
      );
    }
    
    // Quota exhausted
    if (quotaExhausted) {
      return (
        <div className="space-y-6">
          <UpgradePrompt
            type="quota_exhausted"
            currentTier={tier}
            featureName="Video Generation"
          />
          
          {/* Still show gallery for inspiration */}
          <SampleGallery tier={tier} onTryCreate={handleReset} />
        </div>
      );
    }
    
    // Based on generation state
    switch (state.status) {
      case 'idle':
        return (
          <div className="space-y-6">
            {showGallery ? (
              <SampleGallery tier={tier} onTryCreate={handleReset} />
            ) : (
              <VideoForm
                tier={tier}
                onJobStarted={handleJobStarted}
              />
            )}
            
            {/* Toggle between form and gallery */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowGallery(!showGallery)}
                className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 
                         flex items-center gap-1"
              >
                {showGallery ? (
                  <>
                    <Video className="w-4 h-4" />
                    Create New Video
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    View Example Gallery
                  </>
                )}
              </button>
            </div>
          </div>
        );
        
      case 'generating':
        return (
          <div className="space-y-6">
            <VideoProgress
              initialResponse={{
                success: true,
                job_id: state.operationId,
                status: 'pending',
                prompt: state.prompt || '',
                duration_seconds: 5,
                meta: { tier, model: 'veo', generate_audio: false },
              }}
              onComplete={handleComplete}
              onError={handleError}
              onRunInBackground={handleBackground}
            />
            
            {/* Info about generation */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 
                          dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800 dark:text-blue-200">
                    Video Generation in Progress
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    High-quality video generation typically takes 2-5 minutes. 
                    You can minimize this and continue chatting - we&apos;ll notify you when it&apos;s ready.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Prompt being used */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
              <div className="text-xs text-neutral-500 mb-1">Generating video for:</div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3">
                {state.prompt}
              </p>
            </div>
          </div>
        );
        
      case 'completed':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 
                          border border-green-200 dark:border-green-800 rounded-lg">
              <Sparkles className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Video generation complete!
              </span>
            </div>
            
            <VideoPlayer
              response={state.response}
              autoPlay={true}
              onGenerateNew={handleReset}
            />
          </div>
        );
        
      case 'error':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 
                          dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 dark:text-red-200">
                    Generation Failed
                  </h4>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {state.message}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleReset}
              className="w-full px-4 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 
                       rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 
                        dark:to-pink-900/30 rounded-lg">
            <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Video Studio
            </h2>
            <p className="text-sm text-neutral-500">
              Create stunning AI-generated videos with Veo 3.1
            </p>
          </div>
        </div>
        
        {/* Quota indicator */}
        {!isFree && (
          <div className="text-right">
            <div className="text-sm text-neutral-500">Monthly Quota</div>
            <div className="text-lg font-semibold text-neutral-900 dark:text-white">
              {quota.used} / {quota.limit}
            </div>
          </div>
        )}
      </div>
      
      {/* Main content */}
      {renderContent()}
    </div>
  );
}

// Export all VideoStudio components
export { VideoForm } from './VideoForm';
export { VideoProgress } from './VideoProgress';
export { VideoPlayer } from './VideoPlayer';
export { SampleGallery } from './SampleGallery';

export default VideoStudio;
