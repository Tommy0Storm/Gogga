/**
 * GoggaLogo Component
 * A cricket (gogga) inspired logo for the South African AI assistant
 * Features a stylized cricket/grasshopper silhouette with subtle SA colors
 */

'use client';

import React, { memo } from 'react';

interface GoggaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'monochrome' | 'animated';
  className?: string;
}

const sizes = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

export const GoggaLogo = memo(({ size = 'md', variant = 'default', className = '' }: GoggaLogoProps) => {
  const dimension = sizes[size];
  const isAnimated = variant === 'animated';
  // Light grey circle (#9CA3AF) for header variant
  // White background for header, dark for default
  const bgColor = variant === 'animated' ? '#FFFFFF' : '#262626';
  const strokeColor = variant === 'animated' ? '#E5E7EB' : '#404040';
  
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${isAnimated ? 'gogga-bounce' : ''} ${className}`}
      role="img"
      aria-label="Gogga AI Logo"
    >
      {/* Background circle with gradient */}
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgColor} />
          <stop offset="100%" stopColor={bgColor} />
        </linearGradient>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#525252" />
          <stop offset="100%" stopColor="#404040" />
        </linearGradient>
        <linearGradient id="wingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#737373" />
          <stop offset="100%" stopColor="#525252" />
        </linearGradient>
        {/* Subtle SA gold accent */}
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4d4d4" />
          <stop offset="50%" stopColor="#a3a3a3" />
          <stop offset="100%" stopColor="#737373" />
        </linearGradient>
      </defs>
      
      {/* Main circle background */}
      <circle cx="32" cy="32" r="30" fill="url(#bgGradient)" />
      <circle cx="32" cy="32" r="30" stroke={strokeColor} strokeWidth="1" fill="none" />
      
      {/* Cricket/Gogga body - stylized */}
      <g transform="translate(14, 16)">
        {/* Thorax (middle body) */}
        <ellipse 
          cx="18" 
          cy="18" 
          rx="8" 
          ry="10" 
          fill="url(#bodyGradient)"
          className={isAnimated ? 'gogga-pulse' : ''}
        />
        
        {/* Head */}
        <circle cx="18" cy="7" r="6" fill="url(#bodyGradient)" />
        
        {/* Eyes - two bright dots */}
        <circle cx="15" cy="6" r="2" fill="#fafafa" />
        <circle cx="21" cy="6" r="2" fill="#fafafa" />
        <circle cx="15" cy="6" r="1" fill="#262626" />
        <circle cx="21" cy="6" r="1" fill="#262626" />
        
        {/* Antennae */}
        <path
          d="M14 3 Q10 -2 6 0"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          className={isAnimated ? 'gogga-antenna-left' : ''}
        />
        <path
          d="M22 3 Q26 -2 30 0"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          className={isAnimated ? 'gogga-antenna-right' : ''}
        />
        
        {/* Wings (folded) */}
        <path
          d="M10 12 Q4 18 8 28 Q12 20 10 12"
          fill="url(#wingGradient)"
          opacity="0.8"
        />
        <path
          d="M26 12 Q32 18 28 28 Q24 20 26 12"
          fill="url(#wingGradient)"
          opacity="0.8"
        />
        
        {/* Abdomen (lower body) */}
        <ellipse cx="18" cy="28" rx="6" ry="5" fill="url(#bodyGradient)" />
        
        {/* Back legs (powerful cricket legs) */}
        <path
          d="M12 22 Q6 20 4 26 Q2 32 8 34"
          stroke="url(#accentGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className={isAnimated ? 'gogga-leg-left' : ''}
        />
        <path
          d="M24 22 Q30 20 32 26 Q34 32 28 34"
          stroke="url(#accentGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className={isAnimated ? 'gogga-leg-right' : ''}
        />
        
        {/* Front legs */}
        <path
          d="M12 16 Q8 14 6 18"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M24 16 Q28 14 30 18"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Middle legs */}
        <path
          d="M11 20 Q6 22 5 26"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M25 20 Q30 22 31 26"
          stroke="url(#accentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
      
      {/* Subtle outer glow ring */}
      <circle 
        cx="32" 
        cy="32" 
        r="31" 
        stroke="#404040" 
        strokeWidth="0.5" 
        fill="none" 
        opacity="0.5"
      />
    </svg>
  );
});

GoggaLogo.displayName = 'GoggaLogo';

// Smaller, simpler icon variant for tight spaces
export const GoggaIcon = memo(({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) => {
  const dimension = size === 'sm' ? 20 : 28;
  
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Gogga"
    >
      <circle cx="12" cy="12" r="11" fill="#262626" />
      {/* Simplified cricket */}
      <ellipse cx="12" cy="13" rx="4" ry="5" fill="#525252" />
      <circle cx="12" cy="8" r="3" fill="#525252" />
      <circle cx="10.5" cy="7.5" r="1" fill="#fafafa" />
      <circle cx="13.5" cy="7.5" r="1" fill="#fafafa" />
      {/* Legs */}
      <path d="M8 12 Q5 14 6 17" stroke="#a3a3a3" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M16 12 Q19 14 18 17" stroke="#a3a3a3" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Antennae */}
      <path d="M10 6 Q8 3 6 4" stroke="#a3a3a3" strokeWidth="0.75" strokeLinecap="round" fill="none" />
      <path d="M14 6 Q16 3 18 4" stroke="#a3a3a3" strokeWidth="0.75" strokeLinecap="round" fill="none" />
    </svg>
  );
});

GoggaIcon.displayName = 'GoggaIcon';

// Body-only cricket variant - no background, just the bug!
// Perfect for chat avatars and inline use
export const GoggaCricket = memo(({ 
  size = 'md', 
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  className?: string;
}) => {
  const dimensions = {
    sm: 28,
    md: 40,
    lg: 56,
  };
  const dimension = dimensions[size];
  
  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 36 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Gogga Cricket"
    >
      <defs>
        <linearGradient id="cricketBodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#525252" />
          <stop offset="100%" stopColor="#404040" />
        </linearGradient>
        <linearGradient id="cricketAccentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4d4d4" />
          <stop offset="50%" stopColor="#a3a3a3" />
          <stop offset="100%" stopColor="#737373" />
        </linearGradient>
        <linearGradient id="cricketWingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#737373" />
          <stop offset="100%" stopColor="#525252" />
        </linearGradient>
      </defs>
      
      {/* Cricket body - centered, larger for visibility */}
      <g transform="translate(0, 2)">
        {/* Thorax (middle body) */}
        <ellipse 
          cx="18" 
          cy="18" 
          rx="8" 
          ry="10" 
          fill="url(#cricketBodyGradient)"
        />
        
        {/* Head */}
        <circle cx="18" cy="7" r="6" fill="url(#cricketBodyGradient)" />
        
        {/* Eyes - two bright dots */}
        <circle cx="15" cy="6" r="2" fill="#fafafa" />
        <circle cx="21" cy="6" r="2" fill="#fafafa" />
        <circle cx="15" cy="6" r="1" fill="#262626" />
        <circle cx="21" cy="6" r="1" fill="#262626" />
        
        {/* Antennae */}
        <path
          d="M14 3 Q10 -2 6 0"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M22 3 Q26 -2 30 0"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Wings (folded) */}
        <path
          d="M10 12 Q4 18 8 28 Q12 20 10 12"
          fill="url(#cricketWingGradient)"
          opacity="0.8"
        />
        <path
          d="M26 12 Q32 18 28 28 Q24 20 26 12"
          fill="url(#cricketWingGradient)"
          opacity="0.8"
        />
        
        {/* Abdomen (lower body) */}
        <ellipse cx="18" cy="28" rx="6" ry="5" fill="url(#cricketBodyGradient)" />
        
        {/* Back legs (powerful cricket legs) */}
        <path
          d="M12 22 Q6 20 4 26 Q2 32 8 34"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M24 22 Q30 20 32 26 Q34 32 28 34"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Front legs */}
        <path
          d="M12 16 Q8 14 6 18"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M24 16 Q28 14 30 18"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        
        {/* Middle legs */}
        <path
          d="M11 20 Q6 22 5 26"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M25 20 Q30 22 31 26"
          stroke="url(#cricketAccentGradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
});

GoggaCricket.displayName = 'GoggaCricket';

// Text logo with icon
export const GoggaWordmark = memo(({ 
  size = 'md', 
  showIcon = true,
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg'; 
  showIcon?: boolean;
  className?: string;
}) => {
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <GoggaLogo size={size} />}
      <span className={`${textSizes[size]} font-bold tracking-tight text-primary-900`}>
        GOGGA
      </span>
    </div>
  );
});

GoggaWordmark.displayName = 'GoggaWordmark';

// PNG-based Gogga Icon - uses the transparent goggaicon.png
// Ideal for header branding and assistant avatars
// Uses native img tag for simplicity (Next/Image would require configuration for animation classes)
export const GoggaPngIcon = memo(({ 
  size = 'md', 
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg' | 'xl'; 
  className?: string;
}) => {
  const dimensions = {
    sm: 24,
    md: 40,
    lg: 56,
    xl: 64,
  };
  const dimension = dimensions[size];
  
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/images/goggaicon.png"
      alt="Gogga AI"
      width={dimension}
      height={dimension}
      className={`object-contain ${className}`}
      style={{ width: dimension, height: dimension }}
      loading="eager"
      decoding="async"
      onError={(e) => {
        // Fallback to SVG cricket if PNG fails
        e.currentTarget.style.display = 'none';
      }}
    />
  );
});

GoggaPngIcon.displayName = 'GoggaPngIcon';

// Animated PNG Icon variant with subtle bounce
// Perfect for header branding - preloaded for immediate visibility
export const GoggaPngIconAnimated = memo(({ 
  size = 'xl', 
  className = '' 
}: { 
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl'; 
  className?: string;
}) => {
  const dimensions = {
    sm: 24,
    md: 40,
    lg: 56,
    xl: 64,
    xxl: 77, // 20% larger than xl for header
  };
  const dimension = dimensions[size];
  
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/assets/images/goggaicon.png"
      alt="Gogga AI"
      width={dimension}
      height={dimension}
      className={`object-contain gogga-bounce ${className}`}
      style={{ width: dimension, height: dimension }}
      loading="eager"
      decoding="async"
      fetchPriority="high"
    />
  );
});

GoggaPngIconAnimated.displayName = 'GoggaPngIconAnimated';

export default GoggaLogo;
