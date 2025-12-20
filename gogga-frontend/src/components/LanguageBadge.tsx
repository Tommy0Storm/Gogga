/**
 * LanguageBadge - Subtle language indicator for chat messages
 * 
 * Shows detected SA language with a small graphical flag.
 * Non-intrusive, tooltip shows full language name.
 * Uses CSS flags instead of emojis for consistency.
 */

'use client';

import { SA_LANGUAGES, type SALanguage } from '@/lib/buddySystem';

interface LanguageBadgeProps {
  language: SALanguage;
  confidence?: number;
  className?: string;
  showName?: boolean;
  showForEnglish?: boolean; // Show badge even for English (for user messages)
}

// Language colors for visual differentiation (no emojis)
const LANGUAGE_COLORS: Record<SALanguage, string> = {
  en: 'bg-blue-500',      // English - Blue
  af: 'bg-orange-500',    // Afrikaans - Orange
  zu: 'bg-green-600',     // Zulu - Green
  xh: 'bg-cyan-500',      // Xhosa - Cyan
  nso: 'bg-yellow-500',   // Northern Sotho - Yellow
  tn: 'bg-purple-500',    // Tswana - Purple
  st: 'bg-red-500',       // Sotho - Red
  ts: 'bg-pink-500',      // Tsonga - Pink
  ss: 'bg-indigo-500',    // Swati - Indigo
  ve: 'bg-teal-500',      // Venda - Teal
  nr: 'bg-amber-500',     // Ndebele - Amber
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
  showName = false,
  showForEnglish = false 
}: LanguageBadgeProps) {
  const langInfo = SA_LANGUAGES[language];
  const colorClass = LANGUAGE_COLORS[language];
  const shortCode = SHORT_CODES[language];
  
  // Only show badge for non-English languages unless showForEnglish is true
  if (language === 'en' && !showForEnglish) {
    return null;
  }

  return (
    <span 
      className={`inline-flex items-center gap-1 text-xs text-gray-500 ${className}`}
      title={`${langInfo.name}${confidence ? ` (${confidence}% confidence)` : ''}`}
    >
      {/* Color dot indicator instead of flag emoji */}
      <span className={`w-2 h-2 rounded-full ${colorClass}`} />
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
