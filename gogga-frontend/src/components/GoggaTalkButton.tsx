/**
 * GoggaTalkButton
 * 
 * SA Flag colored speech button that launches GoggaTalk terminal voice chat.
 * Replaces the microphone button with a beautiful SA flag gradient button.
 */

'use client';

import React, { useState } from 'react';

interface GoggaTalkButtonProps {
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GoggaTalkButton({ 
  onClick, 
  disabled = false,
  size = 'md',
  className = ''
}: GoggaTalkButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const sizes = {
    sm: { button: 'w-10 h-10', icon: 16 },
    md: { button: 'w-12 h-12', icon: 20 },
    lg: { button: 'w-14 h-14', icon: 24 },
  };

  const { button: buttonSize, icon: iconSize } = sizes[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`
        ${buttonSize}
        relative
        rounded-full
        overflow-hidden
        transition-all
        duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isPressed ? 'scale-95' : isHovered ? 'scale-105 shadow-lg' : 'scale-100'}
        ${className}
      `}
      title="GoggaTalk - Voice Chat in 11 SA Languages"
      style={{
        // SA Flag gradient background
        background: `linear-gradient(
          135deg,
          #007A4D 0%,    /* Green */
          #007A4D 16%,
          #FFB612 16%,   /* Gold/Yellow */
          #FFB612 33%,
          #DE3831 33%,   /* Red */
          #DE3831 50%,
          #FFFFFF 50%,   /* White */
          #FFFFFF 66%,
          #002395 66%,   /* Blue */
          #002395 83%,
          #000000 83%    /* Black */
        )`,
        boxShadow: isHovered 
          ? '0 4px 20px rgba(0, 122, 77, 0.4), 0 0 0 2px rgba(255, 182, 18, 0.5)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Transparent Chat Bubble Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          width={iconSize} 
          height={iconSize} 
          viewBox="0 0 24 24" 
          fill="none"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        >
          {/* Chat bubble outline */}
          <path 
            d="M4 6C4 4.89543 4.89543 4 6 4H18C19.1046 4 20 4.89543 20 6V14C20 15.1046 19.1046 16 18 16H9L5 20V6Z" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
          {/* Three dots inside bubble */}
          <circle cx="8" cy="10" r="1.5" fill="white" />
          <circle cx="12" cy="10" r="1.5" fill="white" />
          <circle cx="16" cy="10" r="1.5" fill="white" />
        </svg>
      </div>

      {/* Animated pulse ring when hovered */}
      {isHovered && !disabled && (
        <div 
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: 'rgba(0, 122, 77, 0.3)',
            animationDuration: '1.5s',
          }}
        />
      )}
    </button>
  );
}

/**
 * GoggaTalkBadge
 * 
 * Small badge showing "11 Languages" below the button
 * Uses SA flag mini-banner instead of emoji
 */
export function GoggaTalkBadge() {
  return (
    <div className="text-center mt-1 flex items-center justify-center gap-1">
      {/* Mini SA flag indicator */}
      <div className="flex w-4 h-2 rounded-sm overflow-hidden">
        <div className="flex-1 bg-red-600" />
        <div className="flex-1 bg-blue-600" />
        <div className="flex-1 bg-green-600" />
        <div className="flex-1 bg-yellow-500" />
        <div className="flex-1 bg-black" />
        <div className="flex-1 bg-white border-r border-gray-300" />
      </div>
      <span className="text-[9px] font-medium text-gray-500 tracking-wide">
        11 Languages
      </span>
    </div>
  );
}

/**
 * ScreenShareButton
 * 
 * Button to toggle screen sharing for GoggaTalk
 */
interface ScreenShareButtonProps {
  onClick: () => void;
  isSharing?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScreenShareButton({ 
  onClick, 
  isSharing = false,
  disabled = false,
  size = 'md',
  className = ''
}: ScreenShareButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const sizes = {
    sm: { button: 'w-10 h-10', icon: 16 },
    md: { button: 'w-12 h-12', icon: 20 },
    lg: { button: 'w-14 h-14', icon: 24 },
  };

  const { button: buttonSize, icon: iconSize } = sizes[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={`
        ${buttonSize}
        relative
        rounded-full
        overflow-hidden
        transition-all
        duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${isPressed ? 'scale-95' : isHovered ? 'scale-105 shadow-lg' : 'scale-100'}
        ${className}
      `}
      title={isSharing ? "Stop Screen Share" : "Share Screen with Gogga"}
      style={{
        background: isSharing 
          ? 'linear-gradient(135deg, #DE3831 0%, #B91C1C 100%)'  // Red when active
          : 'linear-gradient(135deg, #374151 0%, #1F2937 100%)',  // Gray when inactive
        boxShadow: isHovered 
          ? isSharing 
            ? '0 4px 20px rgba(222, 56, 49, 0.4), 0 0 0 2px rgba(222, 56, 49, 0.5)'
            : '0 4px 20px rgba(55, 65, 81, 0.4), 0 0 0 2px rgba(107, 114, 128, 0.5)'
          : '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Screen Share Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          width={iconSize} 
          height={iconSize} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        >
          {/* Monitor/Screen */}
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
          {/* Share arrow or stop icon */}
          {isSharing ? (
            // Stop icon (square)
            <rect x="9" y="7" width="6" height="6" fill="white" stroke="none" />
          ) : (
            // Share/broadcast icon
            <>
              <path d="M12 7v6" />
              <path d="M9 10l3-3 3 3" />
            </>
          )}
        </svg>
      </div>
      
      {/* Pulsing ring when sharing */}
      {isSharing && (
        <div 
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: '#DE3831' }}
        />
      )}
    </button>
  );
}

/**
 * GoggaTalkButtonWithLabel
 * 
 * Complete button with label for use in chat input area
 */
export function GoggaTalkButtonWithLabel({ 
  onClick,
  disabled = false,
}: { 
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <GoggaTalkButton onClick={onClick} disabled={disabled} size="md" />
      <GoggaTalkBadge />
    </div>
  );
}

export default GoggaTalkButton;
