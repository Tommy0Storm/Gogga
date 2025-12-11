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
      {/* Speech/Sound Wave Icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          width={iconSize} 
          height={iconSize} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        >
          {/* Speech bubble with sound waves */}
          <path d="M12 18.5C15.5 18.5 18.5 15.5 18.5 12C18.5 8.5 15.5 5.5 12 5.5" />
          <path d="M12 14.5C13.38 14.5 14.5 13.38 14.5 12C14.5 10.62 13.38 9.5 12 9.5" />
          <circle cx="8" cy="12" r="2" fill="white" />
          {/* Sound waves */}
          <path d="M19 9C20.5 10.5 20.5 13.5 19 15" opacity="0.7" />
          <path d="M21 7C23.5 9.5 23.5 14.5 21 17" opacity="0.5" />
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
 */
export function GoggaTalkBadge() {
  return (
    <div className="text-center mt-1">
      <span className="text-[9px] font-medium text-gray-500 tracking-wide">
        🇿🇦 11 Languages
      </span>
    </div>
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
