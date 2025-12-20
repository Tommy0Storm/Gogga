'use client';

import { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  Database,
  MessageSquare,
  Sparkles,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Token budget allocation per tier (from RAG_SYSTEM_DESIGN.md)
const TOKEN_BUDGETS = {
  free: { systemPrompt: 500, state: 1000, sessionDoc: 2000, rag: 0, volatile: 4000, response: 4000 },
  jive: { systemPrompt: 1000, state: 2000, sessionDoc: 4000, rag: 3000, volatile: 6000, response: 5000 },
  jigga: { systemPrompt: 1500, state: 3000, sessionDoc: 4000, rag: 6000, volatile: 8000, response: 8000 },
} as const;

// Budget category metadata
const BUDGET_CATEGORIES = [
  { key: 'systemPrompt', label: 'System Prompt', icon: Cpu, color: 'bg-purple-500', description: 'Persona, instructions, tool definitions' },
  { key: 'state', label: 'Authoritative State', icon: Sparkles, color: 'bg-blue-500', description: 'User facts, preferences, BuddySystem' },
  { key: 'sessionDoc', label: 'Session Docs', icon: FileText, color: 'bg-green-500', description: 'Paperclip uploads (full text)' },
  { key: 'volatile', label: 'Conversation', icon: MessageSquare, color: 'bg-amber-500', description: 'Recent chat history' },
  { key: 'rag', label: 'RAG Context', icon: Database, color: 'bg-rose-500', description: 'Semantic search results' },
  { key: 'response', label: 'Response Budget', icon: Zap, color: 'bg-gray-500', description: 'Reserved for model output' },
] as const;

interface TokenUsage {
  systemPrompt: number;
  state: number;
  sessionDoc: number;
  volatile: number;
  rag: number;
  response: number;
}

interface RAGDebugPanelProps {
  tier: 'free' | 'jive' | 'jigga';
  currentUsage: Partial<TokenUsage>;
  isVisible?: boolean;
  className?: string;
}

/**
 * RAGDebugPanel - Token budget visualization for debugging
 * 
 * Shows current token allocation across all context categories:
 * 1. System Prompt (fixed, never evicted)
 * 2. Authoritative State (user facts, BuddySystem)
 * 3. Session Documents (paperclip uploads)
 * 4. Volatile Memory (conversation history)
 * 5. RAG Context (semantic search results)
 * 6. Response Budget (reserved for output)
 * 
 * @see docs/RAG_SYSTEM_DESIGN.md - Token Budget Allocation
 */
export function RAGDebugPanel({
  tier,
  currentUsage,
  isVisible = false,
  className,
}: RAGDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(isVisible);
  
  const budgets = TOKEN_BUDGETS[tier];
  const totalBudget = (Object.values(budgets) as number[]).reduce((a, b) => a + b, 0);
  const totalUsed = Object.entries(currentUsage).reduce(
    (sum, [, value]) => sum + (value || 0),
    0
  );
  const utilizationPercent = Math.round((totalUsed / totalBudget) * 100);

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Token Debug</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium uppercase',
            tier === 'jigga' ? 'bg-amber-100 text-amber-700' :
            tier === 'jive' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {tier}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick utilization indicator */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  utilizationPercent > 90 ? 'bg-red-500' :
                  utilizationPercent > 70 ? 'bg-amber-500' : 'bg-green-500'
                )}
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-12 text-right">
              {utilizationPercent}%
            </span>
          </div>
          
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Summary row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Context</span>
            <span className="font-medium">
              {totalUsed.toLocaleString()} / {totalBudget.toLocaleString()} tokens
            </span>
          </div>

          {/* Budget breakdown */}
          <div className="space-y-3">
            {BUDGET_CATEGORIES.map(({ key, label, icon: Icon, color, description }) => {
              const budget = budgets[key as keyof typeof budgets];
              const used = currentUsage[key as keyof TokenUsage] || 0;
              const percent = budget > 0 ? Math.round((used / budget) * 100) : 0;
              const isDisabled = budget === 0;

              return (
                <div
                  key={key}
                  className={cn('space-y-1', isDisabled && 'opacity-50')}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', color)} />
                      <Icon size={14} className="text-gray-400" />
                      <span className="text-gray-700">{label}</span>
                    </div>
                    <span className={cn(
                      'text-xs',
                      percent > 90 ? 'text-red-600 font-medium' :
                      percent > 70 ? 'text-amber-600' : 'text-gray-500'
                    )}>
                      {used.toLocaleString()} / {budget.toLocaleString()}
                      {budget > 0 && ` (${percent}%)`}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        color,
                        isDisabled && 'bg-gray-300'
                      )}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
              );
            })}
          </div>

          {/* Priority reminder */}
          <div className="pt-3 border-t">
            <p className="text-xs text-gray-500">
              <strong>Eviction priority:</strong> RAG → Volatile → Session Docs
              <br />
              <strong>Never evicted:</strong> System Prompt, State
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Export token budgets for use in other components
export { TOKEN_BUDGETS };
