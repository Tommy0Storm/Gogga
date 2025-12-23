/**
 * ReadAloudButton
 * 
 * Speaker button for JIGGA tier that reads assistant messages aloud
 * using Gemini TTS with the Charon voice (same as GoggaTalk for consistency).
 * 
 * Opens a full audio player modal with:
 * - Play/Pause/Stop controls
 * - Seekable progress bar
 * - Time display
 * 
 * Displays in the message meta bar next to the copy button.
 */
'use client';

import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { AudioPlayerModal } from './AudioPlayerModal';

interface ReadAloudButtonProps {
  /** The text content to read aloud */
  text: string;
  /** Optional class name overrides */
  className?: string;
}

export function ReadAloudButton({ text, className = '' }: ReadAloudButtonProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  const handleClick = () => {
    setShowPlayer(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`meta-badge cursor-pointer transition-all duration-200 hover:bg-primary-200 ${className}`}
        title="Read aloud"
      >
        <Volume2 size={12} />
      </button>

      {showPlayer && (
        <AudioPlayerModal
          text={text}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </>
  );
}

/**
 * ReadAloudButtonWrapper
 * 
 * Wrapper that only renders ReadAloudButton for JIGGA tier.
 * Use this in ChatClient to conditionally show the button.
 */
interface ReadAloudButtonWrapperProps extends ReadAloudButtonProps {
  tier: string;
}

export function ReadAloudButtonWrapper({ tier, ...props }: ReadAloudButtonWrapperProps) {
  // Only show for JIGGA tier
  if (tier !== 'jigga') {
    return null;
  }

  return <ReadAloudButton {...props} />;
}
