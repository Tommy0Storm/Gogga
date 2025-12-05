/**
 * GOGGA BuddyPanel - Dashboard Widget
 * Shows relationship status, buddy points, and language preferences
 * Monochrome design, Quicksand font, elegant & compact
 */

'use client';

import React, { useState } from 'react';
import { 
  Heart, Star, User, Globe, MessageCircle, 
  ChevronDown, ChevronUp, Sparkles, Settings
} from 'lucide-react';
import { useBuddySystem } from '@/hooks/useBuddySystem';
import type { SALanguage } from '@/lib/buddySystem';

// ============================================================================
// Relationship Badge
// ============================================================================

const RELATIONSHIP_CONFIG = {
  stranger: { label: 'New Friend', color: 'bg-primary-200', icon: '👋' },
  acquaintance: { label: 'Getting to Know You', color: 'bg-primary-300', icon: '🤝' },
  friend: { label: 'Good Friends', color: 'bg-sa-green/20', icon: '😊' },
  bestie: { label: 'Besties!', color: 'bg-sa-gold/20', icon: '💛' },
};

// ============================================================================
// Main Component
// ============================================================================

export const BuddyPanel: React.FC = () => {
  const { 
    profile, 
    stats, 
    isLoading, 
    greeting,
    sarcasticIntro,
    setUserName,
    setLanguage,
    setHumorEnabled,
    languages 
  } = useBuddySystem();

  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  if (isLoading) {
    return (
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 animate-pulse">
        <div className="h-6 bg-primary-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-primary-100 rounded w-2/3"></div>
      </div>
    );
  }

  if (!profile || !stats) return null;

  const relationship = RELATIONSHIP_CONFIG[stats.relationshipStatus];
  const nextMilestone = stats.relationshipStatus === 'stranger' ? 50 
    : stats.relationshipStatus === 'acquaintance' ? 200 
    : stats.relationshipStatus === 'friend' ? 500 
    : null;
  
  const progress = nextMilestone 
    ? Math.min(100, (stats.buddyPoints / nextMilestone) * 100) 
    : 100;

  const handleNameSave = async () => {
    if (nameInput.trim()) {
      await setUserName(nameInput.trim());
    }
    setEditingName(false);
    setNameInput('');
  };

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-primary-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${relationship.color}`}>
              <span className="text-lg">{relationship.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-primary-900">
                  {stats.name ? `Hey ${stats.name}!` : 'Buddy System'}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${relationship.color} text-primary-700`}>
                  {relationship.label}
                </span>
              </div>
              <p className="text-sm text-primary-600">{greeting}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1 text-sa-gold">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold">{stats.buddyPoints}</span>
              </div>
              <span className="text-xs text-primary-500">buddy points</span>
            </div>
            {expanded ? <ChevronUp className="w-5 h-5 text-primary-400" /> : <ChevronDown className="w-5 h-5 text-primary-400" />}
          </div>
        </div>

        {/* Progress to next level */}
        {nextMilestone && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-primary-500 mb-1">
              <span>Progress to {stats.relationshipStatus === 'stranger' ? 'Acquaintance' : stats.relationshipStatus === 'acquaintance' ? 'Friend' : 'Bestie'}</span>
              <span>{stats.buddyPoints}/{nextMilestone}</span>
            </div>
            <div className="h-1.5 bg-primary-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sa-green rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded Settings */}
      {expanded && (
        <div className="border-t border-primary-200 p-4 space-y-4 bg-white/50">
          {/* Sarcastic Intro Preview */}
          <div className="p-3 bg-primary-100/50 rounded-lg border border-primary-200">
            <div className="flex items-center gap-2 text-xs text-primary-500 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Current greeting style</span>
            </div>
            <p className="text-sm text-primary-700 italic">"{sarcasticIntro}"</p>
          </div>

          {/* Name Setting */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <User className="w-4 h-4" />
              Your Name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name..."
                  className="flex-1 px-3 py-1.5 text-sm border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green/50"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                />
                <button
                  onClick={handleNameSave}
                  className="px-3 py-1.5 text-sm bg-sa-green text-white rounded-lg hover:bg-sa-green/90"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="px-3 py-1.5 text-sm bg-primary-200 text-primary-700 rounded-lg hover:bg-primary-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setNameInput(stats.name || '');
                  setEditingName(true);
                }}
                className="w-full px-3 py-1.5 text-sm text-left border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors"
              >
                {stats.name || 'Click to set your name...'}
              </button>
            )}
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <Globe className="w-4 h-4" />
              Preferred Language
            </label>
            <select
              value={profile.preferredLanguage}
              onChange={(e) => setLanguage(e.target.value as SALanguage)}
              className="w-full px-3 py-1.5 text-sm border border-primary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sa-green/50 bg-white"
            >
              {Object.entries(languages).map(([code, lang]) => (
                <option key={code} value={code}>
                  {lang.name} - {lang.greeting}
                </option>
              ))}
            </select>
          </div>

          {/* Humor Toggle */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-primary-700">
              <MessageCircle className="w-4 h-4" />
              Sarcastic humor
            </label>
            <button
              onClick={() => setHumorEnabled(!profile.humorEnabled)}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${profile.humorEnabled ? 'bg-sa-green' : 'bg-primary-300'}
              `}
            >
              <div className={`
                absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                ${profile.humorEnabled ? 'left-7' : 'left-1'}
              `} />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-primary-200">
            <div className="text-center p-2 bg-primary-100/50 rounded">
              <div className="text-lg font-bold text-primary-800">{stats.totalInteractions}</div>
              <div className="text-xs text-primary-500">Chats</div>
            </div>
            <div className="text-center p-2 bg-primary-100/50 rounded">
              <div className="text-lg font-bold text-primary-800">{stats.daysSinceFirst}</div>
              <div className="text-xs text-primary-500">Days</div>
            </div>
            <div className="text-center p-2 bg-primary-100/50 rounded">
              <div className="text-lg font-bold text-primary-800">{stats.buddyPoints}</div>
              <div className="text-xs text-primary-500">Points</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuddyPanel;
