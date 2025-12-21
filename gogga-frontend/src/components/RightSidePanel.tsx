/**
 * RightSidePanel
 * 
 * Unified slide-out panel from the right edge:
 * - Documents (Session Docs + RAG Store)
 * - Tools (ToolShed with icon grid for forcing)
 * - Smart (GoggaSmart stats and skills)
 * 
 * Monochrome design with grey gradients, Quicksand font.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Upload, Trash2, Lock, Shield, BookOpen, Paperclip, AlertTriangle, Info, FileSearch, Wrench, Brain, Zap, Target, TrendingUp, RotateCcw, ChevronRight, Calculator, Code, Image, Search } from 'lucide-react';
import { useDocumentStore } from '@/lib/documentStore';
import { useRightPanel } from '@/hooks/useRightPanel';
import { RAGUploadButton } from '@/components/rag/RAGUploadButton';
import { useToolShed, TOOL_CATEGORIES, getFilteredTools, type ToolCategory } from '@/lib/toolshedStore';
import { useGoggaSmart } from '@/hooks/useGoggaSmart';
import { getToolIcon } from '@/lib/iconMapping';

// Documents Tab Content
interface DocumentsTabContentProps {
  documents: import('@/lib/db').Document[];
  selectedDocIds: string[];
  isLoading: boolean;
  isEmbedding: boolean;
  isRAGEnabled: boolean;
  canUpload: boolean;
  tier: 'free' | 'jive' | 'jigga';
  maxDocsPerSession: number;
  storageUsage: { totalMB: number; maxMB: number; usedPercent: number; remainingMB: number };
  onUpload: (file: File) => Promise<void>;
  onRemove: (docId: string) => Promise<void>;
  // RAG Store props (Phase 2)
  ragDocuments?: import('@/lib/db').Document[];
  onRAGUpload?: (file: File) => Promise<void>;
  onRAGRemove?: (docId: string) => Promise<void>;
  onClearAllRAG?: () => Promise<void>;
  // RAG Controls
  ragMode: 'analysis' | 'authoritative';
  useRAGForChat: boolean;
  onRagModeChange: (mode: 'analysis' | 'authoritative') => void;
  onUseRAGForChatChange: (enabled: boolean) => void;
}

function DocumentsTabContent({
  documents,
  selectedDocIds,
  isLoading,
  isEmbedding,
  isRAGEnabled,
  canUpload,
  tier,
  maxDocsPerSession,
  storageUsage,
  onUpload,
  onRemove,
  ragDocuments = [],
  onRAGUpload,
  onRAGRemove,
  onClearAllRAG,
  ragMode,
  useRAGForChat,
  onRagModeChange,
  onUseRAGForChatChange,
}: DocumentsTabContentProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [activeSection, setActiveSection] = React.useState<'session' | 'rag'>('session');
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    try {
      await onUpload(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // FREE tier - show limited session doc access with upgrade message
  if (tier === 'free') {
    return (
      <div className="space-y-6">
        {/* Session Documents - FREE tier gets 1 doc enticement */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Paperclip size={16} className="text-gray-600" />
            <h3 className="font-medium text-gray-800">Session Documents</h3>
          </div>
          <div className="text-xs text-gray-500 mb-3">
            Try it out! Upload 1 document for this chat session.
          </div>
          
          {documents.length === 0 ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.md,.json,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isEmbedding}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isLoading || isEmbedding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                    {isEmbedding ? 'Processing...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload Document (1 max)
                  </>
                )}
              </button>
              {uploadError && (
                <p className="text-xs text-red-500 mt-1">{uploadError}</p>
              )}
            </div>
          ) : documents[0] ? (() => {
            const doc = documents[0];
            return (
              <div className="p-3 rounded-lg border border-gray-200 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800 truncate" title={doc.filename}>
                      {doc.filename}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(doc.size / 1024).toFixed(1)}KB • {doc.chunkCount} chunks
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(doc.id!)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Remove document"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })() : null}
        </div>

        {/* RAG Store - Locked for FREE */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={16} className="text-gray-400" />
            <h3 className="font-medium text-gray-400">RAG Store</h3>
            <Lock size={12} className="text-gray-400" />
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-xs text-gray-500">Upgrade for persistent document storage</p>
            <div className="mt-3 space-y-1 text-xs text-gray-600">
              <p><strong>JIVE:</strong> 1 RAG doc (5MB)</p>
              <p><strong>JIGGA:</strong> 200 RAG docs (250MB)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const remainingSlots = maxDocsPerSession - documents.length;
  const canUploadRAG = tier === 'jive' || tier === 'jigga';
  const ragLimit = tier === 'jive' ? 1 : 200;

  return (
    <div className="space-y-4">
      {/* Storage Usage Bar */}
      <div className="text-xs text-gray-500">
        <div className="flex justify-between mb-1">
          <span>Storage</span>
          <span>{storageUsage.totalMB.toFixed(1)}MB / {storageUsage.maxMB}MB</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${storageUsage.usedPercent > 80 ? 'bg-red-400' : 'bg-gray-600'}`}
            style={{ width: `${Math.min(storageUsage.usedPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* RAG Controls Section */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">Use RAG in Chat</span>
            <div className="group relative">
              <Info size={14} className="text-gray-400 cursor-help" />
              <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                When enabled, your documents will be used to enhance AI responses with relevant context.
              </div>
            </div>
          </div>
          <button
            onClick={() => onUseRAGForChatChange(!useRAGForChat)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              useRAGForChat ? 'bg-gray-800' : 'bg-gray-300'
            }`}
            title={useRAGForChat ? 'RAG is enabled - click to disable' : 'RAG is disabled - click to enable'}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              useRAGForChat ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {/* RAG Mode Toggle - Only for JIGGA */}
        {tier === 'jigga' && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-700">RAG Mode</span>
              <div className="group relative">
                <Info size={12} className="text-gray-400 cursor-help" />
                <div className="absolute left-0 bottom-full mb-2 w-56 p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <strong>Analysis:</strong> AI synthesizes information from your documents.<br/>
                  <strong>Authoritative:</strong> AI quotes directly from documents, reducing hallucinations.
                </div>
              </div>
            </div>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => onRagModeChange('analysis')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs transition-colors ${
                  ragMode === 'analysis' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="AI analyzes and synthesizes information from your documents"
              >
                <FileSearch size={12} />
                Analysis
              </button>
              <button
                onClick={() => onRagModeChange('authoritative')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs transition-colors ${
                  ragMode === 'authoritative' 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="AI quotes directly from your documents for accuracy"
              >
                <Shield size={12} />
                Authoritative
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveSection('session')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-sm transition-colors ${
            activeSection === 'session' 
              ? 'bg-white text-gray-800 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Paperclip size={14} />
          Session ({documents.length})
        </button>
        <button
          onClick={() => setActiveSection('rag')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded text-sm transition-colors ${
            activeSection === 'rag' 
              ? 'bg-white text-gray-800 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen size={14} />
          RAG Store ({ragDocuments.length})
        </button>
      </div>

      {/* Session Documents Section */}
      {activeSection === 'session' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            Documents for this chat session only. Cleared on chat reset.
          </div>

          {/* Upload Button */}
          {canUpload && remainingSlots > 0 && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.md,.json,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isEmbedding}
                className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isLoading || isEmbedding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                    {isEmbedding ? 'Processing...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload Session Doc
                  </>
                )}
              </button>
              {uploadError && (
                <p className="text-xs text-red-500 mt-1">{uploadError}</p>
              )}
              <p className="text-xs text-gray-400 mt-1 text-center">
                {remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining
              </p>
            </div>
          )}

          {/* Session Document List */}
          {documents.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <Paperclip size={20} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">No session documents</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div
                  key={doc.id ?? `session-doc-${index}`}
                  className="p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(doc.size / 1024).toFixed(1)}KB • {doc.chunkCount} chunks
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(doc.id!)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* RAG Store Section */}
      {activeSection === 'rag' && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            Persistent documents available across all chat sessions.
          </div>

          {/* RAG Upload Button Component */}
          <RAGUploadButton 
            tier={tier}
            currentDocCount={ragDocuments.length}
            currentStorageMB={storageUsage.totalMB}
            onUpload={async (file) => {
              if (onRAGUpload) {
                try {
                  await onRAGUpload(file);
                  return { success: true };
                } catch (error) {
                  return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
                }
              }
              return { success: false, error: 'RAG upload handler not configured' };
            }}
          />

          {/* RAG Document List */}
          {ragDocuments.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <BookOpen size={20} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">No RAG documents</p>
              <p className="text-xs mt-1">Add documents to your permanent knowledge base</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ragDocuments.map((doc, index) => (
                <div
                  key={doc.id ?? `rag-doc-${index}`}
                  className="p-3 rounded-lg border border-blue-100 bg-blue-50/30 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={12} className="text-blue-500 flex-shrink-0" />
                        <div className="font-medium text-sm text-gray-800 truncate" title={doc.filename}>
                          {doc.filename}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(doc.size / 1024).toFixed(1)}KB • {doc.chunkCount} chunks
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {onRAGRemove && (
                      <button
                        onClick={() => onRAGRemove(String(doc.id))}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove from RAG store"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier Info */}
          <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
            {tier === 'jive' && (
              <p>JIVE: 1 RAG document (enticement). Upgrade to JIGGA for 200 docs + semantic search.</p>
            )}
            {tier === 'jigga' && (
              <p>JIGGA: {ragDocuments.length}/{ragLimit} RAG documents with semantic search.</p>
            )}
          </div>

          {/* Clear All RAG Button - JIGGA only */}
          {tier === 'jigga' && ragDocuments.length > 0 && onClearAllRAG && (
            <div className="mt-3">
              {showClearConfirm ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 mb-2">
                    <AlertTriangle size={16} />
                    <span className="font-medium text-sm">Delete all RAG documents?</span>
                  </div>
                  <p className="text-xs text-red-600 mb-3">
                    This will permanently delete {ragDocuments.length} document(s) and their embeddings. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        setIsClearing(true);
                        try {
                          await onClearAllRAG();
                          setShowClearConfirm(false);
                        } catch (error) {
                          console.error('Failed to clear RAG documents:', error);
                        } finally {
                          setIsClearing(false);
                        }
                      }}
                      disabled={isClearing}
                      className="flex-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-1"
                    >
                      {isClearing ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={12} />
                          Delete All
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      disabled={isClearing}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full px-3 py-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 size={12} />
                  Clear All RAG Documents
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tools Tab Content - Enterprise-grade tool selection panel
// ============================================================================

interface ToolsTabContentProps {
  tier: 'free' | 'jive' | 'jigga';
}

function ToolsTabContent({ tier }: ToolsTabContentProps) {
  const { tools, isLoadingTools, fetchTools, forcedTool, forceTool, clearForcedTool } = useToolShed();
  const [activeCategory, setActiveCategory] = useState<ToolCategory>('all');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  
  const isPaidTier = tier === 'jive' || tier === 'jigga';
  
  // Fetch tools on mount
  useEffect(() => {
    if (tools.length === 0 && isPaidTier) {
      fetchTools(tier);
    }
  }, [tier, tools.length, fetchTools, isPaidTier]);
  
  const filteredTools = getFilteredTools(tools, activeCategory, tier);
  
  // FREE tier upgrade teaser
  if (!isPaidTier) {
    return (
      <div className="space-y-6">
        {/* Premium Feature Banner */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 text-white">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                <Wrench size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">AI Tools</h3>
                <p className="text-xs text-gray-400">Premium Feature</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              Force specific AI capabilities for your queries. Math solver, code execution, image generation, and more.
            </p>
            
            {/* Tool Preview Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { icon: Calculator, label: 'Math' },
                { icon: Code, label: 'Code' },
                { icon: Image, label: 'Images' },
                { icon: Search, label: 'Search' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center p-2 bg-white/5 rounded-lg">
                  <Icon size={18} className="text-gray-400 mb-1" />
                  <span className="text-[9px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>
            
            <a
              href="/upgrade"
              className="block w-full py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg text-center hover:bg-gray-100 transition-colors"
            >
              Upgrade to Unlock
            </a>
          </div>
        </div>
        
        {/* Feature List */}
        <div className="space-y-2">
          {[
            'GoggaSolve - Advanced math & calculations',
            'Code execution with Python runtime',
            'AI image generation (JIGGA)',
            'Memory tools for context persistence',
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
              <Lock size={12} className="text-gray-400" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Active Tool Indicator - Prominent when forced */}
      {forcedTool && (
        <div className="p-4 bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-600 rounded-lg">
                <Target size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-primary-500 font-medium uppercase tracking-wide">Active Tool</p>
                <p className="text-sm font-semibold text-primary-800">{forcedTool.tool.name}</p>
              </div>
            </div>
            <button
              onClick={clearForcedTool}
              className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-800 hover:bg-primary-200 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
      
      {/* Category Filter - Pill style */}
      <div className="flex flex-wrap gap-1.5">
        {TOOL_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              activeCategory === cat.id
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={cat.description}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>
      
      {/* Tools List - Card layout for better UX */}
      {isLoadingTools ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="relative">
            <div className="w-10 h-10 border-3 border-gray-200 rounded-full" />
            <div className="absolute inset-0 w-10 h-10 border-3 border-gray-800 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-gray-500">Loading tools...</p>
        </div>
      ) : filteredTools.length > 0 ? (
        <div className="space-y-2">
          {filteredTools.map((tool) => {
            const IconComponent = getToolIcon(tool.name);
            const isForced = forcedTool?.tool.name === tool.name;
            const isExpanded = expandedTool === tool.name;
            
            return (
              <div
                key={tool.name}
                className={`group rounded-xl border transition-all duration-200 ${
                  isForced
                    ? 'bg-primary-50 border-primary-300 shadow-md'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Tool Header */}
                <div 
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={() => setExpandedTool(isExpanded ? null : tool.name)}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    isForced ? 'bg-primary-600' : 'bg-gray-100 group-hover:bg-gray-200'
                  }`}>
                    <IconComponent size={18} className={isForced ? 'text-white' : 'text-gray-600'} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm font-medium ${isForced ? 'text-primary-800' : 'text-gray-800'}`}>
                        {tool.name}
                      </h4>
                      {isForced && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary-600 text-white rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{tool.description}</p>
                  </div>
                  
                  <ChevronRight 
                    size={16} 
                    className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                  />
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-100">
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      {tool.description}
                    </p>
                    
                    {/* Examples if available */}
                    {tool.examples && tool.examples.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Examples</p>
                        <div className="space-y-1">
                          {tool.examples.slice(0, 2).map((ex, i) => (
                            <div key={i} className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                              {ex.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isForced) {
                          clearForcedTool();
                        } else {
                          forceTool(tool);
                        }
                        setExpandedTool(null);
                      }}
                      className={`w-full py-2 text-xs font-semibold rounded-lg transition-colors ${
                        isForced
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isForced ? 'Remove Force' : 'Force This Tool'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 bg-gray-100 rounded-xl mb-3">
            <Wrench size={24} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">No tools available</p>
          <p className="text-xs text-gray-400 mt-1">Try a different category</p>
        </div>
      )}
      
      {/* Footer Info */}
      <div className="pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Forcing a tool ensures it will be used for your next message. 
          The AI will integrate the tool&apos;s output into its response.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Smart Tab Content - GoggaSmart stats and skills
// ============================================================================

interface SmartTabContentProps {
  tier: 'free' | 'jive' | 'jigga';
}

function SmartTabContent({ tier }: SmartTabContentProps) {
  const {
    isEnabled,
    stats,
    skills,
    resetSkillbook,
    removeSkill,
  } = useGoggaSmart({ tier });
  
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetSkillbook();
      setShowResetConfirm(false);
    } finally {
      setIsResetting(false);
    }
  };
  
  if (!isEnabled) {
    // Show enticing upgrade teaser for FREE tier users
    return (
      <div className="space-y-4 py-4">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-4 text-white shadow-lg">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={20} className="text-purple-200" />
              <span className="text-xs font-medium text-purple-200">PREMIUM FEATURE</span>
            </div>
            <h3 className="text-lg font-bold mb-1">GoggaSmart™</h3>
            <p className="text-sm text-purple-100">
              AI that learns and improves from YOUR feedback
            </p>
          </div>
        </div>
        
        {/* Features List */}
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
            <div className="p-1.5 bg-purple-100 rounded-md">
              <Target size={14} className="text-purple-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-800">Personal AI Memory</h4>
              <p className="text-xs text-gray-500 mt-0.5">Remembers your preferences and communication style</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
            <div className="p-1.5 bg-indigo-100 rounded-md">
              <TrendingUp size={14} className="text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-800">Learns From Feedback</h4>
              <p className="text-xs text-gray-500 mt-0.5">Thumbs up/down trains your personal AI skills</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
            <div className="p-1.5 bg-blue-100 rounded-md">
              <Zap size={14} className="text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-800">Gets Smarter Over Time</h4>
              <p className="text-xs text-gray-500 mt-0.5">The more you use it, the better it understands you</p>
            </div>
          </div>
        </div>
        
        {/* CTA */}
        <div className="pt-2">
          <button className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
            <span>Upgrade to JIVE</span>
            <ChevronRight size={16} />
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">Starting at R49/month</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* What is GoggaSmart */}
      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
        <div className="flex items-start gap-2">
          <Brain size={16} className="text-purple-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-purple-800">Self-Improving AI</h3>
            <p className="text-xs text-purple-600 mt-1">
              GoggaSmart learns from your feedback. Thumbs up/down on responses helps Gogga improve for you.
            </p>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.activeSkills ?? 0}</div>
            <div className="text-xs text-gray-500">Active Skills</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-800">{stats.totalFeedback ?? 0}</div>
            <div className="text-xs text-gray-500">Feedback Given</div>
          </div>
        </div>
      )}
      
      {/* Skills List */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
          <TrendingUp size={14} />
          Learned Skills
        </h4>
        {skills.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <Zap size={20} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">No skills learned yet</p>
            <p className="text-xs mt-1">Use feedback buttons to teach Gogga</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {skills.slice(0, 10).map((skill) => (
              <div
                key={skill.id}
                className="p-2 bg-white border border-gray-100 rounded-lg flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 truncate">{skill.section || 'Unknown'}</div>
                  <div className="text-[10px] text-gray-400">
                    Score: {(skill.weight ?? 0).toFixed(2)} • Uses: {skill.usageCount ?? 0}
                  </div>
                </div>
                <button
                  onClick={() => removeSkill(skill.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Remove skill"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Reset Button */}
      <div className="border-t border-gray-100 pt-3">
        {showResetConfirm ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 mb-2">Reset all learned skills?</p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-red-400"
              >
                {isResetting ? 'Resetting...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <RotateCcw size={12} />
            Reset GoggaSmart
          </button>
        )}
      </div>
    </div>
  );
}

// Vertical Tab Button - Stacked with vertical text
interface VerticalTabProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function VerticalTab({ icon, label, isActive, onClick }: VerticalTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-4 px-2 rounded-l-lg transition-all w-10 ${
        isActive
          ? 'bg-white text-gray-800 shadow-lg -translate-x-1'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
      }`}
      title={label}
    >
      {icon}
      {/* Vertical text - rotated 180deg so it reads top-to-bottom */}
      <span 
        className="text-[9px] font-medium mt-2 whitespace-nowrap"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
      >
        {label}
      </span>
    </button>
  );
}

// Main Panel Component
export function RightSidePanel() {
  const { isOpen, activeTab, closePanel, setActiveTab } = useRightPanel();
  
  // Document store for synced document state
  const {
    documents,
    sessionDocuments,
    ragDocuments,
    selectedDocIds,
    isLoading: isLoadingDocs,
    isEmbedding,
    isRAGEnabled,
    canUpload,
    tier,
    maxDocsPerSession,
    storageUsage,
    onUploadDocument,
    onRemoveDocument,
    onRAGUpload,
    onRAGRemove,
    onClearAllRAG,
    // RAG Controls
    ragMode,
    useRAGForChat,
    setRagMode,
    setUseRAGForChat,
  } = useDocumentStore();
  
  // Use sessionDocuments for display (session-scoped), fallback to documents for legacy
  const displayDocuments = sessionDocuments.length > 0 ? sessionDocuments : documents;
  
  // Check if paid tier for tools/smart tabs
  const isPaidTier = tier === 'jive' || tier === 'jigga';
  
  // Get tab title
  const getTabTitle = () => {
    switch (activeTab) {
      case 'documents': return 'Documents';
      case 'tools': return 'Tools';
      case 'smart': return 'GoggaSmart';
      default: return 'Panel';
    }
  };

  return (
    <>
      {/* Vertical Tab Strip (Always Visible on Right Edge) */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1">
        <VerticalTab
          icon={<FileText size={18} />}
          label="Docs"
          isActive={isOpen && activeTab === 'documents'}
          onClick={() => {
            if (isOpen && activeTab === 'documents') {
              closePanel();
            } else {
              setActiveTab('documents');
            }
          }}
        />
        {/* Tools Tab - Always visible (teaser for FREE) */}
        <VerticalTab
          icon={<Wrench size={18} />}
          label="Tools"
          isActive={isOpen && activeTab === 'tools'}
          onClick={() => {
            if (isOpen && activeTab === 'tools') {
              closePanel();
            } else {
              setActiveTab('tools');
            }
          }}
        />
        {/* Smart Tab - Always visible (teaser for FREE) */}
        <VerticalTab
          icon={<Brain size={18} />}
          label="Smart"
          isActive={isOpen && activeTab === 'smart'}
          onClick={() => {
            if (isOpen && activeTab === 'smart') {
              closePanel();
            } else {
              setActiveTab('smart');
            }
          }}
        />
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={closePanel}
        />
      )}

      {/* Panel - slides from right, tabs stay on edge */}
      <div
        className={`fixed top-0 h-full w-80 bg-white shadow-2xl z-40 transform transition-transform duration-300 ease-out ${
          isOpen ? 'right-10' : '-right-80'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 font-quicksand">
            {getTabTitle()}
          </h2>
          <button
            onClick={closePanel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Content - Based on active tab */}
        <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">
          {activeTab === 'documents' && (
            <DocumentsTabContent
              documents={displayDocuments}
              selectedDocIds={selectedDocIds}
              isLoading={isLoadingDocs}
              isEmbedding={isEmbedding}
              isRAGEnabled={isRAGEnabled}
              canUpload={canUpload}
              tier={tier}
              maxDocsPerSession={maxDocsPerSession}
              storageUsage={storageUsage}
              onUpload={async (file) => {
                if (onUploadDocument) await onUploadDocument(file);
              }}
              onRemove={async (docId) => {
                if (onRemoveDocument) await onRemoveDocument(docId);
              }}
              ragDocuments={ragDocuments}
              onRAGUpload={onRAGUpload ? async (file) => {
                await onRAGUpload(file);
              } : undefined}
              onRAGRemove={onRAGRemove ? async (docId) => {
                await onRAGRemove(docId);
              } : undefined}
              onClearAllRAG={onClearAllRAG ? async () => {
                await onClearAllRAG();
              } : undefined}
              ragMode={ragMode}
              useRAGForChat={useRAGForChat}
              onRagModeChange={setRagMode}
              onUseRAGForChatChange={setUseRAGForChat}
            />
          )}
          
          {activeTab === 'tools' && (
            <ToolsTabContent tier={tier} />
          )}
          
          {activeTab === 'smart' && (
            <SmartTabContent tier={tier} />
          )}
        </div>
      </div>
    </>
  );
}

export default RightSidePanel;
