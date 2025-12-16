/**
 * GoggaSmart UI Components
 * 
 * - GoggaSmartButton: Brain icon button to open info/settings modal
 * - GoggaSmartModal: Info modal with explanation, stats, and reset option
 * - FeedbackButtons: Thumbs up/down for response feedback
 */

'use client';

import { useState, useCallback } from 'react';
import { Brain, ThumbsUp, ThumbsDown, Trash2, Info, Zap, TrendingUp, X, RotateCcw } from 'lucide-react';
import type { SkillbookStats } from '@/lib/goggaSmart';
import type { GoggaSmartSkill } from '@/lib/db';
import { SKILL_SECTIONS } from '@/hooks/useGoggaSmart';

// ============================================================================
// GoggaSmart Button (Brain icon that opens modal)
// ============================================================================

interface GoggaSmartButtonProps {
  isEnabled: boolean;
  stats: SkillbookStats | null;
  onClick: () => void;
}

export function GoggaSmartButton({ isEnabled, stats, onClick }: GoggaSmartButtonProps) {
  if (!isEnabled) return null;
  
  const skillCount = stats?.activeSkills ?? 0;
  const hasSkills = skillCount > 0;
  
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
        text-xs font-medium transition-all duration-200
        ${hasSkills 
          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 text-purple-700 hover:from-purple-100 hover:to-indigo-100 border border-purple-200' 
          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
        }
      `}
      title="GoggaSmart - Self-improving AI"
    >
      <Brain size={14} className={hasSkills ? 'text-purple-500' : 'text-gray-400'} />
      <span>Smart</span>
      {hasSkills && (
        <span className="ml-0.5 px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold">
          {skillCount}
        </span>
      )}
      {hasSkills && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      )}
    </button>
  );
}

// ============================================================================
// GoggaSmart Modal (Info, Stats, Reset)
// ============================================================================

interface GoggaSmartModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SkillbookStats | null;
  skills: GoggaSmartSkill[];
  onReset: () => Promise<void>;
  onRemoveSkill: (skillId: string) => Promise<void>;
  isLoading?: boolean;
}

export function GoggaSmartModal({ 
  isOpen, 
  onClose, 
  stats, 
  skills,
  onReset,
  onRemoveSkill,
  isLoading = false,
}: GoggaSmartModalProps) {
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  if (!isOpen) return null;
  
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setShowConfirmReset(false);
    } finally {
      setIsResetting(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Brain size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">GoggaSmart</h2>
              <p className="text-xs text-gray-500">Self-improving AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* How it works */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Info size={14} />
              How It Works
            </h3>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <p>
                <strong>GoggaSmart</strong> learns from your feedback to improve responses over time.
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>When you give <span className="text-green-600 font-medium">👍 thumbs up</span>, strategies that helped are reinforced</li>
                <li>When you give <span className="text-red-600 font-medium">👎 thumbs down</span>, strategies that failed are deprioritized</li>
                <li>Top strategies are automatically included in future conversations</li>
                <li>Your learning data is stored locally and never leaves your device</li>
              </ul>
            </div>
          </section>
          
          {/* Stats */}
          {stats && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <TrendingUp size={14} />
                Learning Stats
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.activeSkills}</div>
                  <div className="text-xs text-purple-500">Active Skills</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.totalHelpful}</div>
                  <div className="text-xs text-green-500">Helpful</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.totalHarmful}</div>
                  <div className="text-xs text-red-500">Harmful</div>
                </div>
              </div>
              
              {/* Section breakdown */}
              {Object.keys(stats.sectionCounts).length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-gray-500 font-medium">By Category:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.sectionCounts).map(([section, count]) => (
                      <span 
                        key={section}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs"
                      >
                        {section.replace('_', ' ')}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
          
          {/* Skills List */}
          {skills.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Zap size={14} />
                Learned Strategies ({skills.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {skills.map((skill, index) => {
                  const score = (skill.helpful || 0) - (skill.harmful || 0);
                  const sectionInfo = SKILL_SECTIONS.find(s => s.value === skill.section);
                  // Use id if available, fallback to skillId + index for uniqueness
                  const key = skill.id?.toString() || `${skill.skillId}-${index}`;
                  
                  return (
                    <div 
                      key={key}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-100 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded font-mono">
                              {skill.skillId}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                              {sectionInfo?.label || skill.section}
                            </span>
                            <span className={`text-[10px] font-bold ${score >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {score >= 0 ? '+' : ''}{score}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{skill.content}</p>
                        </div>
                        <button
                          onClick={() => onRemoveSkill(skill.skillId)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove skill"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          
          {/* Reset Section */}
          <section className="pt-4 border-t border-gray-100">
            {showConfirmReset ? (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-red-700 mb-3">
                  Are you sure? This will delete all learned strategies and start fresh.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isResetting ? 'Resetting...' : 'Yes, Reset'}
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                <RotateCcw size={14} />
                Reset Learning Data
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Feedback Buttons (Thumbs up/down on messages)
// ============================================================================

interface FeedbackButtonsProps {
  onFeedback: (feedback: 'thumbs_up' | 'thumbs_down') => Promise<void>;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function FeedbackButtons({ 
  onFeedback, 
  disabled = false,
  size = 'sm',
}: FeedbackButtonsProps) {
  const [submitted, setSubmitted] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleFeedback = useCallback(async (feedback: 'thumbs_up' | 'thumbs_down') => {
    if (disabled || isSubmitting || submitted) return;
    
    setIsSubmitting(true);
    try {
      await onFeedback(feedback);
      setSubmitted(feedback);
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, submitted, onFeedback]);
  
  const iconSize = size === 'sm' ? 12 : 14;
  const buttonClass = size === 'sm' 
    ? 'p-1 rounded' 
    : 'p-1.5 rounded-lg';
  
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback('thumbs_up')}
        disabled={disabled || isSubmitting || submitted !== null}
        className={`
          ${buttonClass} transition-all
          ${submitted === 'thumbs_up' 
            ? 'bg-green-100 text-green-600' 
            : submitted === 'thumbs_down'
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-300 hover:text-green-500 hover:bg-green-50'
          }
          ${disabled || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title="This was helpful"
      >
        <ThumbsUp size={iconSize} />
      </button>
      <button
        onClick={() => handleFeedback('thumbs_down')}
        disabled={disabled || isSubmitting || submitted !== null}
        className={`
          ${buttonClass} transition-all
          ${submitted === 'thumbs_down' 
            ? 'bg-red-100 text-red-600' 
            : submitted === 'thumbs_up'
              ? 'text-gray-200 cursor-not-allowed'
              : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
          }
          ${disabled || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title="This was not helpful"
      >
        <ThumbsDown size={iconSize} />
      </button>
    </div>
  );
}
