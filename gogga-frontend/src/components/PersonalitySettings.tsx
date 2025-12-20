'use client'

/**
 * GOGGA - Personality Settings Component
 * 
 * Compact personality, language, and context settings for the main chat page.
 * Can be embedded in AccountMenu or used standalone.
 */

import React, { useState } from 'react'
import { 
  MessageCircle, 
  Globe,
  ChevronDown,
  ChevronUp,
  Brain,
  Heart
} from 'lucide-react'
import { useBuddySystem } from '@/hooks/useBuddySystem'
import type { SALanguage } from '@/lib/buddySystem'

// ============================================================================
// Types
// ============================================================================

interface PersonalitySettingsProps {
  /** Compact mode for dropdown embedding */
  compact?: boolean
  /** Callback when settings are changed */
  onSettingsChange?: () => void
}

// ============================================================================
// Personality Mode Descriptions
// ============================================================================

const PERSONALITY_MODES = {
  system: {
    name: 'System',
    description: 'Balanced and professional',
    icon: '⚖️',
    details: 'Neutral tone that adapts to context. Professional for work, casual for chat.',
  },
  dark: {
    name: 'Dark Gogga',
    description: 'Witty and sarcastic',
    icon: '😏',
    details: 'SA-style sarcasm with a helpful heart. Jokes about load shedding included.',
  },
  goody: {
    name: 'Goody Gogga',
    description: 'Uplifting and encouraging',
    icon: '🌟',
    details: 'Positive vibes only! Celebrates your wins and supports you through challenges.',
  },
} as const

// ============================================================================
// Main Component
// ============================================================================

export const PersonalitySettings: React.FC<PersonalitySettingsProps> = ({
  compact = false,
  onSettingsChange
}) => {
  const {
    profile,
    stats,
    isLoading,
    setLanguage,
    setPersonalityMode,
    languages,
  } = useBuddySystem()

  const [showLanguages, setShowLanguages] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  if (isLoading || !profile) {
    return (
      <div className="p-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-100 rounded"></div>
      </div>
    )
  }

  const currentMode = profile.personalityMode || 'goody'
  const modeInfo = PERSONALITY_MODES[currentMode as keyof typeof PERSONALITY_MODES] || PERSONALITY_MODES.goody

  const handleModeChange = (mode: 'system' | 'dark' | 'goody') => {
    setPersonalityMode(mode)
    onSettingsChange?.()
  }

  const handleLanguageChange = (lang: SALanguage) => {
    setLanguage(lang)
    setShowLanguages(false)
    onSettingsChange?.()
  }

  // Compact mode for dropdown embedding
  if (compact) {
    return (
      <div className="space-y-3">
        {/* Personality Mode - Compact */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span className="flex items-center gap-1">
              <MessageCircle size={12} />
              Personality
            </span>
            <span className="text-xs">{modeInfo.icon} {modeInfo.name}</span>
          </div>
          <div className="flex gap-1">
            {Object.entries(PERSONALITY_MODES).map(([key, mode]) => (
              <button
                key={key}
                onClick={() => handleModeChange(key as 'system' | 'dark' | 'goody')}
                className={`
                  flex-1 px-2 py-1.5 text-xs rounded-md border transition-all
                  ${currentMode === key 
                    ? 'bg-gray-800 text-white border-gray-900' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }
                `}
                title={mode.details}
              >
                {mode.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Language - Compact Dropdown */}
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span className="flex items-center gap-1">
              <Globe size={12} />
              Language
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-gray-900 border border-gray-200 rounded-md bg-white hover:bg-gray-50"
            >
              <span>{languages[profile.preferredLanguage]?.name || 'English'}</span>
              <ChevronDown size={14} className={`text-gray-500 transition-transform ${showLanguages ? 'rotate-180' : ''}`} />
            </button>
            {showLanguages && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {Object.entries(languages).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => handleLanguageChange(code as SALanguage)}
                    className={`
                      w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50
                      ${profile.preferredLanguage === code ? 'bg-gray-100 font-medium' : ''}
                    `}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Buddy Status - Mini */}
        {stats && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-red-400" />
              {stats.buddyPoints} buddy points
            </span>
            <span className="text-gray-400">
              {stats.relationshipStatus === 'stranger' ? '👋 New' :
               stats.relationshipStatus === 'acquaintance' ? '🤝 Acquaintance' :
               stats.relationshipStatus === 'friend' ? '😊 Friend' : '💛 Bestie'}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Full mode for standalone use
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-full border border-gray-200">
              <Brain size={20} className="text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Gogga Personality</h3>
              <p className="text-sm text-gray-500">
                {modeInfo.icon} {modeInfo.name} - {modeInfo.description}
              </p>
            </div>
          </div>
          {showDetails ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Settings */}
      {showDetails && (
        <div className="p-4 space-y-4">
          {/* Personality Mode */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <MessageCircle size={16} />
              Personality Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PERSONALITY_MODES).map(([key, mode]) => (
                <button
                  key={key}
                  onClick={() => handleModeChange(key as 'system' | 'dark' | 'goody')}
                  className={`
                    px-3 py-3 text-sm rounded-lg border transition-all
                    ${currentMode === key 
                      ? key === 'system' ? 'bg-gray-600 text-white border-gray-700 shadow-md' :
                        key === 'dark' ? 'bg-gray-900 text-white border-gray-950 shadow-md' :
                        'bg-green-600 text-white border-green-700 shadow-md'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="text-lg mb-1">{mode.icon}</div>
                  <div className="font-semibold">{mode.name}</div>
                  <div className="text-xs opacity-80">{mode.description}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 italic mt-2">
              {modeInfo.details}
            </p>
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Globe size={16} />
              Preferred Language
            </label>
            <select
              id="preferred-language"
              name="preferred-language"
              value={profile.preferredLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as SALanguage)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white"
            >
              {Object.entries(languages).map(([code, lang]) => (
                <option key={code} value={code}>
                  {lang.name} - {lang.greeting}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              Gogga speaks all 11 SA languages! Switch freely mid-conversation.
            </p>
          </div>

          {/* Buddy Stats */}
          {stats && (
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <Heart size={16} className="text-red-400" />
                Buddy Relationship
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-800">{stats.buddyPoints}</div>
                  <div className="text-xs text-gray-500">Points</div>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-800">{stats.totalInteractions}</div>
                  <div className="text-xs text-gray-500">Chats</div>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg">
                    {stats.relationshipStatus === 'stranger' ? '👋' :
                     stats.relationshipStatus === 'acquaintance' ? '🤝' :
                     stats.relationshipStatus === 'friend' ? '😊' : '💛'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">{stats.relationshipStatus}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PersonalitySettings
