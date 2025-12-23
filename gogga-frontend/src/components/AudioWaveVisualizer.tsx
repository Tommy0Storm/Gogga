/**
 * AudioWaveVisualizer
 * 
 * A smooth, HD quality sinewave audio visualizer for GoggaTalk.
 * Shows animated waves when speaking:
 * - White wave: Gogga is speaking (AI response)
 * - Blue wave: User is speaking (microphone active)
 * - Gray wave: Idle/muted state
 * 
 * Supports real-time audio amplitude when audioLevel prop is provided.
 * Uses CSS animations for smooth 60fps performance.
 * No canvas required - pure SVG for crisp HD quality.
 */

'use client';

import React, { useMemo, useEffect, useRef, useState } from 'react';

export type VisualizerState = 'idle' | 'user-speaking' | 'gogga-speaking';

interface AudioWaveVisualizerProps {
  /** Current visualization state */
  state: VisualizerState;
  /** Real-time audio level (0-1) - if provided, overrides automatic amplitude */
  audioLevel?: number;
  /** Width of the visualizer */
  width?: number;
  /** Height of the visualizer */
  height?: number;
  /** Custom className */
  className?: string;
  /** Show voice activity indicator dot */
  showActivityIndicator?: boolean;
}

/**
 * Generate smooth sine wave path for SVG
 * IMPROVED: Better audio level response for more visible wave movement
 */
function generateSinePath(
  width: number,
  height: number,
  amplitude: number,
  frequency: number,
  phase: number,
  audioLevel: number = 1 // Real-time audio level multiplier (0-1)
): string {
  const centerY = height / 2;
  const points: string[] = [];
  const step = 2; // Higher resolution for smoother curves

  // IMPROVED: Apply audio level with minimum 0.2 (was 0.1) for baseline wave visibility
  // and apply a boost factor (1.3x) to make audio level changes more dramatic
  const boostedAudioLevel = Math.min(1, audioLevel * 1.3);
  const effectiveAmplitude = amplitude * Math.max(0.2, boostedAudioLevel);

  for (let x = 0; x <= width; x += step) {
    const normalizedX = x / width;
    const y = centerY + Math.sin(normalizedX * Math.PI * 2 * frequency + phase) * effectiveAmplitude;
    points.push(`${x === 0 ? 'M' : 'L'} ${x} ${y}`);
  }

  return points.join(' ');
}

// Voice activity indicator component
// IMPROVED: Shows contextual status based on visualizer state
function VoiceActivityIndicator({ 
  isActive, 
  color,
  state 
}: { 
  isActive: boolean; 
  color: string;
  state: VisualizerState;
}) {
  // Determine status text based on state and activity
  const getStatusText = () => {
    switch (state) {
      case 'gogga-speaking':
        return isActive ? 'Gogga speaking...' : 'Gogga';
      case 'user-speaking':
        return isActive ? 'Listening...' : 'Ready';
      default:
        return 'Muted';
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div 
        className={`w-2 h-2 rounded-full transition-all duration-150 ${
          isActive ? 'scale-100' : 'scale-75 opacity-50'
        }`}
        style={{
          backgroundColor: color,
          boxShadow: isActive ? `0 0 8px ${color}` : 'none',
          animation: isActive ? 'voice-pulse 0.5s ease-in-out infinite' : 'none'
        }}
      />
      <span 
        className="text-xs font-medium transition-opacity duration-150"
        style={{ 
          color,
          opacity: isActive ? 1 : 0.5 
        }}
      >
        {getStatusText()}
      </span>
    </div>
  );
}

export function AudioWaveVisualizer({
  state,
  audioLevel,
  width = 200,
  height = 40,
  className = '',
  showActivityIndicator = false,
}: AudioWaveVisualizerProps) {
  // Smooth the audio level to prevent jittery animations
  const [smoothedLevel, setSmoothedLevel] = useState(0);
  const smoothingRef = useRef(0);
  
  // Speaking hold timer - keeps "Speaking" state for a brief period after audio drops
  // This prevents rapid flickering between Speaking/Silent during natural speech pauses
  const [isSpeakingHeld, setIsSpeakingHeld] = useState(false);
  const speakingHoldTimerRef = useRef<NodeJS.Timeout | null>(null);
  const SPEAKING_HOLD_MS = 600; // Hold speaking state for 600ms after audio drops
  const SPEAKING_THRESHOLD = 0.05; // Very sensitive detection for better responsiveness
  
  useEffect(() => {
    if (audioLevel !== undefined) {
      // IMPROVED: Even more responsive smoothing for visible wave movement
      // Rise: 0.75 (very quick response to voice), Fall: 0.35 (smooth but faster decay)
      // This makes the wave react more dynamically to speech patterns
      const isRising = audioLevel > smoothingRef.current;
      const smoothingFactor = isRising ? 0.75 : 0.35;
      smoothingRef.current = smoothingRef.current * (1 - smoothingFactor) + audioLevel * smoothingFactor;
      setSmoothedLevel(smoothingRef.current);
      
      // Speaking hold logic - if audio is above threshold, set speaking and reset timer
      if (smoothingRef.current > SPEAKING_THRESHOLD) {
        setIsSpeakingHeld(true);
        // Clear any existing hold timer
        if (speakingHoldTimerRef.current) {
          clearTimeout(speakingHoldTimerRef.current);
          speakingHoldTimerRef.current = null;
        }
      } else if (isSpeakingHeld && !speakingHoldTimerRef.current) {
        // Audio dropped below threshold - start hold timer
        speakingHoldTimerRef.current = setTimeout(() => {
          setIsSpeakingHeld(false);
          speakingHoldTimerRef.current = null;
        }, SPEAKING_HOLD_MS);
      }
    }
    
    return () => {
      if (speakingHoldTimerRef.current) {
        clearTimeout(speakingHoldTimerRef.current);
      }
    };
  }, [audioLevel, isSpeakingHeld]);
  
  // Determine effective audio level (use prop if provided, otherwise use state-based default)
  const effectiveAudioLevel = audioLevel !== undefined ? smoothedLevel : (state === 'idle' ? 0.3 : 1);
  
  // Voice activity detection - use held state for stable indicator
  const isVoiceActive = isSpeakingHeld || effectiveAudioLevel > SPEAKING_THRESHOLD;
  
  // Color based on state
  const colors = useMemo(() => {
    switch (state) {
      case 'gogga-speaking':
        return {
          primary: '#FFFFFF',     // White for Gogga
          secondary: '#E5E7EB',   // Light gray glow
          glow: 'rgba(255, 255, 255, 0.4)',
        };
      case 'user-speaking':
        return {
          primary: '#3B82F6',     // Blue for user
          secondary: '#60A5FA',   // Lighter blue
          glow: 'rgba(59, 130, 246, 0.4)',
        };
      default:
        return {
          primary: '#6B7280',     // Gray for idle
          secondary: '#9CA3AF',   // Light gray
          glow: 'rgba(107, 114, 128, 0.2)',
        };
    }
  }, [state]);

  // Animation class based on state
  const animationClass = state === 'idle' ? '' : 'animate-wave';
  const isActive = state !== 'idle';

  // Generate multiple wave paths for layered effect
  // IMPROVED: Higher amplitude multiplier (0.55) for more dramatic wave movement
  // This makes the wave visually respond more to voice input
  const baseAmplitude = isActive ? height * 0.55 : height * 0.15;

  return (
    <div 
      className={`relative ${className}`}
      style={{ width, height: showActivityIndicator ? height + 20 : height }}
    >
      {/* Voice Activity Indicator */}
      {showActivityIndicator && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <VoiceActivityIndicator 
            isActive={isActive && isVoiceActive} 
            color={colors.primary}
            state={state}
          />
        </div>
      )}
      
      <div style={{ marginTop: showActivityIndicator ? 20 : 0 }}>
        {/* Glow effect behind waves */}
        {isActive && (
          <div 
            className="absolute inset-0 blur-sm opacity-60"
            style={{
              background: `radial-gradient(ellipse at center, ${colors.glow} 0%, transparent 70%)`,
              marginTop: showActivityIndicator ? 20 : 0,
            }}
          />
        )}
        
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="relative"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Gradient for main wave */}
            <linearGradient id={`wave-gradient-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
              <stop offset="50%" stopColor={colors.primary} stopOpacity="1" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.3" />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id={`glow-${state}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background wave (subtle, behind) */}
          <g className={animationClass} style={{ '--wave-delay': '0s' } as React.CSSProperties}>
            <path
              d={generateSinePath(width, height, baseAmplitude * 0.5, 2, 0, effectiveAudioLevel)}
              fill="none"
              stroke={colors.secondary}
              strokeWidth="1"
            strokeLinecap="round"
            opacity="0.4"
          />
        </g>

        {/* Main wave */}
        <g 
          className={animationClass} 
          style={{ 
            '--wave-delay': '0.1s',
            filter: isActive ? `url(#glow-${state})` : undefined,
          } as React.CSSProperties}
        >
          <path
            d={generateSinePath(width, height, baseAmplitude, 3, 0.5, effectiveAudioLevel)}
            fill="none"
            stroke={`url(#wave-gradient-${state})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Foreground wave (sharper, on top) */}
        <g className={animationClass} style={{ '--wave-delay': '0.2s' } as React.CSSProperties}>
          <path
            d={generateSinePath(width, height, baseAmplitude * 0.7, 4, 1, effectiveAudioLevel)}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      </svg>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes wave-flow {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-${width / 3}px);
          }
        }

        @keyframes wave-pulse {
          0%, 100% {
            opacity: 1;
            transform: scaleY(1);
          }
          50% {
            opacity: 0.8;
            transform: scaleY(0.9);
          }
        }

        @keyframes voice-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
        }

        .animate-wave {
          animation: 
            wave-flow 1.5s linear infinite,
            wave-pulse 0.8s ease-in-out infinite;
          animation-delay: var(--wave-delay, 0s);
        }
      `}</style>
    </div>
  );
}

/**
 * Compact variant for inline use
 */
export function AudioWaveVisualizerCompact({
  state,
  audioLevel,
  className = '',
  showActivityIndicator = false,
}: {
  state: VisualizerState;
  audioLevel?: number;
  className?: string;
  showActivityIndicator?: boolean;
}) {
  return (
    <AudioWaveVisualizer
      state={state}
      audioLevel={audioLevel}
      width={120}
      height={24}
      className={className}
      showActivityIndicator={showActivityIndicator}
    />
  );
}

/**
 * Larger variant for prominent display
 */
export function AudioWaveVisualizerLarge({
  state,
  audioLevel,
  className = '',
  showActivityIndicator = false,
}: {
  state: VisualizerState;
  audioLevel?: number;
  className?: string;
  showActivityIndicator?: boolean;
}) {
  return (
    <AudioWaveVisualizer
      state={state}
      audioLevel={audioLevel}
      width={280}
      height={48}
      className={className}
      showActivityIndicator={showActivityIndicator}
    />
  );
}

export default AudioWaveVisualizer;
