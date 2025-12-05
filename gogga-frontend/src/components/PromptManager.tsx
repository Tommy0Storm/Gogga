/**
 * PromptManager Component
 * Admin panel component for viewing and managing GOGGA system prompts
 * Part of the admin panel - toggle with Ctrl+Shift+P when admin mode is active
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, RefreshCw, ChevronDown, ChevronRight, 
  Copy, Check, Zap, Brain, Sparkles, Eye
} from 'lucide-react';

interface PromptInfo {
  key: string;
  name: string;
  description: string;
  model: string;
  editable: boolean;
  prompt_preview: string;
}

interface PromptDetail {
  key: string;
  name: string;
  description: string;
  model: string;
  full_prompt: string;
}

interface PromptListResponse {
  prompts: PromptInfo[];
  base_prompts: {
    gogga_base: string;
    cepo_identity: string;
    qwen_identity: string;
  };
}

const TIER_ICONS: Record<string, typeof Zap> = {
  free_text: Zap,
  jive_speed: Brain,
  jive_reasoning: Brain,
  jigga_think: Sparkles,
  jigga_fast: Sparkles,
  enhance_prompt: FileText,
};

const TIER_COLORS: Record<string, string> = {
  free_text: 'bg-gray-500',
  jive_speed: 'bg-gray-600',
  jive_reasoning: 'bg-gray-700',
  jigga_think: 'bg-gray-800',
  jigga_fast: 'bg-gray-700',
  enhance_prompt: 'bg-gray-500',
};

export function PromptManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptListResponse | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptDetail | null>(null);
  const [expandedBase, setExpandedBase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  // Check if admin mode is active
  useEffect(() => {
    const checkAdmin = () => {
      const isAdmin = localStorage.getItem('gogga_admin') === 'true';
      setShowPanel(isAdmin);
    };
    
    checkAdmin();
    window.addEventListener('storage', checkAdmin);
    return () => window.removeEventListener('storage', checkAdmin);
  }, []);

  // Keyboard shortcut: Ctrl+Shift+P for prompt manager
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (showPanel) {
          setIsOpen(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [showPanel]);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/prompts/');
      if (!res.ok) {
        console.warn(
          '[PromptManager] Prompts endpoint not available:',
          res.status
        );
        setPrompts(null);
        return;
      }
      const data = await res.json();
      setPrompts(data);
    } catch (err) {
      console.warn(
        '[PromptManager] Failed to fetch prompts (endpoint may not exist):',
        err
      );
      setPrompts(null); // Set null to prevent repeated fetch attempts
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchPromptDetail = useCallback(async (key: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/prompts/${key}`);
      const data = await res.json();
      setSelectedPrompt(data);
    } catch (err) {
      console.error('Failed to fetch prompt detail:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !prompts) {
      fetchPrompts();
    }
  }, [isOpen, prompts, fetchPrompts]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!showPanel) {
    return null;
  }

  return (
    <>
      {/* Toggle Button - Fixed position */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-4 left-4 z-50 p-3 rounded-full shadow-lg transition-all ${
          isOpen ? 'bg-gray-800 text-white' : 'bg-white text-gray-800 border border-gray-300'
        }`}
        title="Prompt Manager (Ctrl+Shift+P)"
        aria-label="Toggle prompt manager"
      >
        <FileText size={20} />
      </button>

      {/* Prompt Manager Panel */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 z-50 w-[500px] max-h-[80vh] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={16} />
              <span className="font-bold text-sm">System Prompts</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchPrompts}
                disabled={isLoading}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Admin</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {prompts ? (
              <div className="divide-y divide-gray-100">
                {/* Tier Prompts */}
                <div className="p-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Tier Prompts</h3>
                  <div className="space-y-2">
                    {prompts.prompts.map((p) => {
                      const Icon = TIER_ICONS[p.key] || FileText;
                      const color = TIER_COLORS[p.key] || 'bg-gray-500';
                      
                      return (
                        <button
                          key={p.key}
                          onClick={() => fetchPromptDetail(p.key)}
                          className={`w-full p-3 rounded-lg border transition-all text-left ${
                            selectedPrompt?.key === p.key
                              ? 'border-gray-400 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1 rounded ${color} text-white`}>
                              <Icon size={12} />
                            </div>
                            <span className="text-sm font-bold text-gray-800">{p.name}</span>
                          </div>
                          <p className="text-xs text-gray-500">{p.description}</p>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">{p.model}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Base Prompts (Collapsible) */}
                <div className="p-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Base Prompts</h3>
                  <div className="space-y-2">
                    {Object.entries({
                      gogga_base: 'GOGGA Base Identity',
                      cepo_identity: 'CePO Advocate Identity',
                      qwen_identity: 'Qwen Legal Champion Identity',
                    }).map(([key, name]) => (
                      <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedBase(expandedBase === key ? null : key)}
                          className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                          <span className="text-sm font-medium text-gray-700">{name}</span>
                          {expandedBase === key ? (
                            <ChevronDown size={14} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                          )}
                        </button>
                        {expandedBase === key && (
                          <div className="p-3 bg-gray-50 border-t border-gray-200">
                            <div className="flex justify-end mb-2">
                              <button
                                onClick={() => copyToClipboard(
                                  prompts.base_prompts[key as keyof typeof prompts.base_prompts],
                                  key
                                )}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                              >
                                {copied === key ? <Check size={12} /> : <Copy size={12} />}
                                {copied === key ? 'Copied!' : 'Copy preview'}
                              </button>
                            </div>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-2 rounded border border-gray-200 max-h-40 overflow-y-auto">
                              {prompts.base_prompts[key as keyof typeof prompts.base_prompts]}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">
                {isLoading ? (
                  <RefreshCw size={24} className="animate-spin mx-auto" />
                ) : (
                  <p className="text-sm">Click refresh to load prompts</p>
                )}
              </div>
            )}
          </div>

          {/* Selected Prompt Detail Panel */}
          {selectedPrompt && (
            <div className="border-t border-gray-200 bg-gray-50 max-h-[40%] overflow-y-auto flex-shrink-0">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-gray-500" />
                    <span className="text-sm font-bold text-gray-700">{selectedPrompt.name}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(selectedPrompt.full_prompt, 'detail')}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    {copied === 'detail' ? <Check size={12} /> : <Copy size={12} />}
                    {copied === 'detail' ? 'Copied!' : 'Copy full prompt'}
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                  {selectedPrompt.full_prompt}
                </pre>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-100 text-[10px] text-gray-400 text-center flex-shrink-0">
            Ctrl+Shift+P to toggle • Prompts are read-only
          </div>
        </div>
      )}
    </>
  );
}

export default PromptManager;
