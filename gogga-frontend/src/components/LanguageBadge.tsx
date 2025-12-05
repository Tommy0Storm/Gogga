/**
 * LanguageBadge - Subtle language indicator for chat messages
 * 
 * Shows detected SA language with a small flag/icon.
 * Non-intrusive, tooltip shows full language name.
 */

'use client';

import { SA_LANGUAGES, type SALanguage } from '@/lib/buddySystem';

interface LanguageBadgeProps {
  language: SALanguage;
  confidence?: number;
  className?: string;
  showName?: boolean;
}

// Language flag emojis (using closest available)
const LANGUAGE_FLAGS: Record<SALanguage, string> = {
  en: '🇬🇧',
  af: '🇿🇦',
  zu: '🇿🇦',
  xh: '🇿🇦',
  nso: '🇿🇦',
  tn: '🇿🇦',
  st: '🇿🇦',
  ts: '🇿🇦',
  ss: '🇿🇦',
  ve: '🇿🇦',
  nr: '🇿🇦',
};

// Short codes for display
const SHORT_CODES: Record<SALanguage, string> = {
  en: 'EN',
  af: 'AF',
  zu: 'ZU',
  xh: 'XH',
  nso: 'NSO',
  tn: 'TN',
  st: 'ST',
  ts: 'TS',
  ss: 'SS',
  ve: 'VE',
  nr: 'NR',
};

export function LanguageBadge({ 
  language, 
  confidence, 
  className = '',
  showName = false 
}: LanguageBadgeProps) {
  const langInfo = SA_LANGUAGES[language];
  const flag = LANGUAGE_FLAGS[language];
  const shortCode = SHORT_CODES[language];
  
  // Only show badge for non-English languages (English is default)
  if (language === 'en') {
    return null;
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 text-xs text-gray-500 ${className}`}
      title={`${langInfo.name}${confidence ? ` (${confidence}% confidence)` : ''}`}
    >
      <span className="text-[10px]">{flag}</span>
      <span className="font-medium text-gray-600">{shortCode}</span>
      {showName && (
        <span className="text-gray-400 hidden sm:inline">
          {langInfo.name}
        </span>
      )}
    </span>
  );
}

export default LanguageBadge;
