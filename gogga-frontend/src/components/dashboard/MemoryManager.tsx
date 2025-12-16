/**
 * GOGGA RAG Dashboard - Long-Term Memory Manager
 * Manages persistent context that carries across all chat sessions
 * Monochrome design with grey gradients, Quicksand font
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Brain,
  User,
  FolderOpen,
  BookOpen,
  Tag,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  Info as FiInfo,
  Bot,
} from 'lucide-react';
import {
  db,
  type MemoryContext,
  type MemoryCategory,
  type MemorySource,
  createMemory,
  updateMemory,
  deleteMemory,
  getAllMemories,
  getMemoryStats,
  MEMORY_LIMITS,
} from '@/lib/db';

// ============================================================================
// Category Config
// ============================================================================

const CATEGORY_CONFIG: Record<MemoryCategory, { icon: React.ReactNode; label: string; description: string }> = {
  personal: {
    icon: <User className="w-4 h-4" />,
    label: 'Personal',
    description: 'Your preferences, communication style, about you',
  },
  project: {
    icon: <FolderOpen className="w-4 h-4" />,
    label: 'Project',
    description: 'Current projects, goals, tech stack, team info',
  },
  reference: {
    icon: <BookOpen className="w-4 h-4" />,
    label: 'Reference',
    description: 'Facts, documentation, standards to remember',
  },
  custom: {
    icon: <Tag className="w-4 h-4" />,
    label: 'Custom',
    description: 'Any other context you want the AI to know',
  },
};

// ============================================================================
// Memory Card Component
// ============================================================================

interface MemoryCardProps {
  memory: MemoryContext;
  onEdit: (memory: MemoryContext) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({
  memory,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const category = CATEGORY_CONFIG[memory.category];
  const isUserCreated = (memory.source || 'user') === 'user';
  const isGoggaCreated = memory.source === 'gogga';

  return (
    <div
      className={`
      border rounded-lg p-4 transition-all
      ${
        memory.isActive
          ? 'border-primary-300 bg-primary-50/50'
          : 'border-primary-200 bg-primary-100/30 opacity-60'
      }
    `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`p-1.5 rounded ${
              memory.isActive ? 'bg-primary-200' : 'bg-primary-100'
            }`}
          >
            {category.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-primary-900 truncate">
                {memory.title}
              </h4>
              {/* Source Badge */}
              {isGoggaCreated ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary-200 text-primary-600 rounded"
                  title="Created by Gogga AI"
                >
                  <Bot className="w-3 h-3" />
                  AI
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary-100 text-primary-500 rounded"
                  title="Created by you"
                >
                  <User className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-primary-500">
              <span>{category.label}</span>
              <span>•</span>
              <span>~{memory.tokenCount} tokens</span>
              <span>•</span>
              <span>Priority {memory.priority}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleActive(memory.id!, !memory.isActive)}
            className="p-1.5 rounded hover:bg-primary-200 transition-colors"
            title={memory.isActive ? 'Deactivate' : 'Activate'}
          >
            {memory.isActive ? (
              <ToggleRight className="w-5 h-5 text-sa-green" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-primary-400" />
            )}
          </button>
          <button
            onClick={() => onEdit(memory)}
            className="p-1.5 rounded hover:bg-primary-200 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-primary-600" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded hover:bg-red-100 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>

      {/* Content Preview / Expand */}
      <div className="mt-3">
        <div
          className={`text-sm text-primary-700 ${
            expanded ? '' : 'line-clamp-2'
          }`}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {memory.content}
        </div>
        {memory.content.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1"
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 mb-2">
            Delete this memory? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(memory.id!)}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 text-sm bg-primary-200 text-primary-700 rounded hover:bg-primary-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Memory Editor Modal
// ============================================================================

interface MemoryEditorProps {
  memory?: MemoryContext | null;
  onSave: (data: {
    title: string;
    content: string;
    category: MemoryCategory;
    priority: number;
  }) => void;
  onClose: () => void;
}

const MemoryEditor: React.FC<MemoryEditorProps> = ({
  memory,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(memory?.title || '');
  const [content, setContent] = useState(memory?.content || '');
  const [category, setCategory] = useState<MemoryCategory>(
    memory?.category || 'custom'
  );
  const [priority, setPriority] = useState(memory?.priority || 5);
  const [error, setError] = useState<string | null>(null);

  const estimatedTokens = Math.ceil(content.length / 4);
  const isOverLimit = content.length > MEMORY_LIMITS.MAX_CONTENT_LENGTH;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!content.trim()) {
      setError('Content is required');
      return;
    }
    if (isOverLimit) {
      setError(
        `Content too long. Max ${MEMORY_LIMITS.MAX_CONTENT_LENGTH} characters.`
      );
      return;
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      category,
      priority,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-primary-200">
          <h3 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {memory ? 'Edit Memory' : 'Add New Memory'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-primary-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]"
        >
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., My Coding Preferences"
              className="w-full px-3 py-2 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              maxLength={100}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-primary-700 mb-1">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                Object.entries(CATEGORY_CONFIG) as [
                  MemoryCategory,
                  (typeof CATEGORY_CONFIG)[MemoryCategory]
                ][]
              ).map(([key, config]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`
                    p-3 rounded-lg border text-left transition-all
                    ${
                      category === key
                        ? 'border-primary-400 bg-primary-100'
                        : 'border-primary-200 hover:border-primary-300'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {config.icon}
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  <p className="text-xs text-primary-500">
                    {config.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-primary-700">
                Content
              </label>
              <span
                className={`text-xs ${
                  isOverLimit ? 'text-red-500' : 'text-primary-500'
                }`}
              >
                {content.length}/{MEMORY_LIMITS.MAX_CONTENT_LENGTH} chars • ~
                {estimatedTokens} tokens
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter context you want the AI to remember..."
              rows={8}
              className={`
                w-full px-3 py-2 border rounded-lg resize-none font-mono text-sm
                focus:ring-2 focus:ring-primary-300 focus:border-primary-300
                ${
                  isOverLimit
                    ? 'border-red-300 bg-red-50'
                    : 'border-primary-200'
                }
              `}
            />
          </div>

          {/* Priority */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-primary-700">
                Priority
              </label>
              <span className="text-xs text-primary-500">
                {priority}/10 (higher = more important)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full accent-primary-600"
            />
            <div className="flex justify-between text-xs text-primary-400 mt-1">
              <span>Low priority</span>
              <span>High priority</span>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-primary-200 bg-primary-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-primary-700 hover:bg-primary-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isOverLimit}
            className="px-4 py-2 text-sm bg-primary-800 text-white rounded-lg hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {memory ? 'Save Changes' : 'Add Memory'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Memory Manager Component
// ============================================================================

interface MemoryManagerProps {
  tier?: 'free' | 'jive' | 'jigga';
  onRefresh?: () => void;
  onUpgrade?: () => void;
  compact?: boolean;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  tier = 'jigga',
  onRefresh,
  onUpgrade,
  compact = false,
}) => {
  const [memories, setMemories] = useState<MemoryContext[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    totalTokens: number;
    byCategory: Record<MemoryCategory, number>;
    bySource: Record<MemorySource, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryContext | null>(
    null
  );
  const [filter, setFilter] = useState<MemoryCategory | 'all'>('all');

  // Only JIGGA can use Long-Term Memory
  const canUseMemory = tier === 'jigga';

  const loadMemories = useCallback(async () => {
    if (!canUseMemory) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [allMemories, memoryStats] = await Promise.all([
        getAllMemories(),
        getMemoryStats(),
      ]);
      setMemories(allMemories);
      setStats(memoryStats);
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [canUseMemory]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleSave = async (data: {
    title: string;
    content: string;
    category: MemoryCategory;
    priority: number;
  }) => {
    if (!canUseMemory) return;
    try {
      if (editingMemory) {
        await updateMemory(editingMemory.id!, data);
      } else {
        await createMemory({
          title: data.title,
          content: data.content,
          category: data.category,
          priority: data.priority,
          source: 'user',
          isActive: true,
          tokenCount: Math.ceil(data.content.length / 4),
        });
      }
      setShowEditor(false);
      setEditingMemory(null);
      loadMemories();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save memory:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canUseMemory) return;
    try {
      await deleteMemory(id);
      loadMemories();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    if (!canUseMemory) return;
    try {
      await updateMemory(id, { isActive });
      loadMemories();
      onRefresh?.();
    } catch (error) {
      console.error('Failed to toggle memory:', error);
    }
  };

  const handleEdit = (memory: MemoryContext) => {
    if (!canUseMemory) return;
    setEditingMemory(memory);
    setShowEditor(true);
  };

  const filteredMemories =
    filter === 'all' ? memories : memories.filter((m) => m.category === filter);

  // Tier-locked preview for JIVE users
  if (!canUseMemory) {
    return (
      <div className="relative">
        {/* Blurred preview background */}
        <div className="absolute inset-0 pointer-events-none opacity-30 blur-sm">
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  Long-Term Memory
                </h3>
                <p className="text-sm text-primary-500">
                  Context that persists across all chat sessions
                </p>
              </div>
            </div>
            {/* Fake preview items */}
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-4 bg-primary-50 rounded-lg border border-primary-100"
                >
                  <div className="h-4 bg-primary-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-primary-100 rounded w-full mb-1" />
                  <div className="h-3 bg-primary-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upgrade overlay */}
        <div className="relative bg-gradient-to-br from-primary-50/95 to-white/95 backdrop-blur-sm border border-primary-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary-400" />
          </div>
          <h3 className="text-xl font-bold text-primary-900 mb-2">
            Long-Term Memory
          </h3>
          <p className="text-primary-600 mb-6 max-w-md mx-auto">
            Store persistent context that carries across all your chat sessions.
            Add personal preferences, project details, or reference information.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-6 text-sm text-primary-500">
            <span className="flex items-center gap-1 px-3 py-1 bg-primary-100 rounded-full">
              <Brain className="w-4 h-4" />
              Up to 20 memories
            </span>
            <span className="flex items-center gap-1 px-3 py-1 bg-primary-100 rounded-full">
              <FiInfo className="w-4 h-4" />
              Auto context injection
            </span>
            <span className="flex items-center gap-1 px-3 py-1 bg-primary-100 rounded-full">
              <Sparkles className="w-4 h-4" />
              Priority ranking
            </span>
          </div>
          <button
            onClick={onUpgrade}
            className="px-6 py-3 bg-primary-800 text-white rounded-lg hover:bg-primary-900 transition-colors font-medium flex items-center gap-2 mx-auto"
          >
            <Sparkles className="w-5 h-5" />
            Upgrade to JIGGA
          </button>
          <p className="text-xs text-primary-400 mt-3">
            Unlock Long-Term Memory, Vector Analytics, and more
          </p>
        </div>
      </div>
    );
  }

  const canAddMore = memories.length < MEMORY_LIMITS.MAX_MEMORIES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-300 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary-900 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Long-Term Memory
          </h3>
          <p className="text-sm text-primary-500">
            Context that persists across all chat sessions
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMemory(null);
            setShowEditor(true);
          }}
          disabled={!canAddMore}
          className="px-3 py-2 bg-primary-800 text-white rounded-lg hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Memory
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <div className="p-3 bg-primary-100 rounded-lg">
            <div className="text-2xl font-bold text-primary-900">
              {stats.total}
            </div>
            <div className="text-xs text-primary-600">Total Memories</div>
          </div>
          <div className="p-3 bg-primary-100 rounded-lg">
            <div className="text-2xl font-bold text-sa-green">
              {stats.active}
            </div>
            <div className="text-xs text-primary-600">Active</div>
          </div>
          <div className="p-3 bg-primary-100 rounded-lg">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary-500" />
              <span className="text-2xl font-bold text-primary-900">
                {stats.bySource?.user || 0}
              </span>
              <span className="text-lg text-primary-400">/</span>
              <Bot className="w-4 h-4 text-primary-400" />
              <span className="text-2xl font-bold text-primary-600">
                {stats.bySource?.gogga || 0}
              </span>
            </div>
            <div className="text-xs text-primary-600">You / AI</div>
          </div>
          <div className="p-3 bg-primary-100 rounded-lg">
            <div className="text-2xl font-bold text-primary-900">
              {stats.totalTokens}
            </div>
            <div className="text-xs text-primary-600">Est. Tokens</div>
          </div>
          <div className="p-3 bg-primary-100 rounded-lg">
            <div className="text-2xl font-bold text-primary-900">
              {MEMORY_LIMITS.MAX_TOTAL_TOKENS - stats.totalTokens}
            </div>
            <div className="text-xs text-primary-600">Tokens Left</div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            filter === 'all'
              ? 'bg-primary-800 text-white'
              : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
          }`}
        >
          All ({memories.length})
        </button>
        {(
          Object.entries(CATEGORY_CONFIG) as [
            MemoryCategory,
            (typeof CATEGORY_CONFIG)[MemoryCategory]
          ][]
        ).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
              filter === key
                ? 'bg-primary-800 text-white'
                : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
            }`}
          >
            {config.icon}
            {config.label} ({stats?.byCategory[key] || 0})
          </button>
        ))}
      </div>

      {/* Memory List */}
      {filteredMemories.length === 0 ? (
        <div className="text-center py-12 bg-primary-50 rounded-xl border border-dashed border-primary-200">
          <Sparkles className="w-12 h-12 text-primary-300 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-primary-700 mb-1">
            No memories yet
          </h4>
          <p className="text-sm text-primary-500 mb-4">
            Add context you want the AI to remember across all conversations
          </p>
          <button
            onClick={() => {
              setEditingMemory(null);
              setShowEditor(true);
            }}
            className="px-4 py-2 bg-primary-800 text-white rounded-lg hover:bg-primary-900 text-sm"
          >
            Add Your First Memory
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMemories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          ))}
        </div>
      )}

      {/* Limit Warning */}
      {!canAddMore && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          You&apos;ve reached the maximum of {MEMORY_LIMITS.MAX_MEMORIES}{' '}
          memories. Delete some to add more.
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <MemoryEditor
          memory={editingMemory}
          onSave={handleSave}
          onClose={() => {
            setShowEditor(false);
            setEditingMemory(null);
          }}
        />
      )}
    </div>
  );
};

export default MemoryManager;
