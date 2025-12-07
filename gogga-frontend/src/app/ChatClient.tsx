'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import AdminPanel from '@/components/AdminPanel';
import PromptManager from '@/components/PromptManager';
import FileUpload from '@/components/FileUpload';
import DocumentList from '@/components/DocumentList';
import ImageThumbnail from '@/components/ImageThumbnail';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { GoggaLogo, GoggaIcon, GoggaCricket } from '@/components/GoggaLogo';
import {
  FileStoreIcon,
  SendArrowIcon,
  ImageGenerateIcon,
  MagicWandIcon,
} from '@/components/GoggaIcons';
import {
  LocationPrompt,
  ManualLocationInput,
  LocationBadge,
} from '@/components/LocationPrompt';
import { useRAG, type Tier } from '@/hooks/useRAG';
import { useChatHistory, type Message } from '@/hooks/useChatHistory';
import { useImageStorage } from '@/hooks/useImageStorage';
import { useTokenTracking, formatTokenCount } from '@/hooks/useTokenTracking';
import { useLocation } from '@/hooks/useLocation';
import {
  softDeleteImage,
  RAG_LIMITS,
  type Document,
  getMemoryContextForLLM,
} from '@/lib/db';
import {
  executeToolCalls,
  formatToolResultsMessage,
  type ToolCall,
} from '@/lib/toolHandler';
import {
  Bot,
  User,
  Zap,
  Brain,
  Sparkles,
  Database,
  Clock,
  BookOpen,
  FileSearch,
  Plus,
  History,
  Trash2,
  ImageOff,
  FolderOpen,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Hash,
} from 'lucide-react';
import axios from 'axios';
import { useBuddySystem } from '@/hooks/useBuddySystem';
import { LanguageBadge } from '@/components/LanguageBadge';
import { WeatherSlidePanel } from '@/components/ChatComponents';
import { AccountMenu } from '@/components/AccountMenu';
import type { SALanguage } from '@/lib/buddySystem';

// Extended message with image and thinking support
interface ChatMessage extends Message {
  imageId?: number;
  thinking?: string; // JIGGA thinking block (collapsible in UI)
  detectedLanguage?: SALanguage; // Auto-detected SA language
  languageConfidence?: number;
}

const TIER_DISPLAY = {
  free: { name: 'FREE', icon: Zap, color: 'bg-gray-500' },
  jive: { name: 'JIVE', icon: Brain, color: 'bg-gray-600' },
  jigga: { name: 'JIGGA', icon: Sparkles, color: 'bg-gray-800' },
};

interface ChatClientProps {
  userEmail: string | null;
  userTier: string;
}

export function ChatClient({ userEmail, userTier }: ChatClientProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [useRAGContext, setUseRAGContext] = useState(true);
  const [ragMode, setRagMode] = useState<'analysis' | 'authoritative'>(
    'analysis'
  );
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(
    new Set()
  ); // Track expanded thinking blocks
  const [isAdmin, setIsAdmin] = useState(false); // Admin mode for PromptManager visibility
  const [historySelectMode, setHistorySelectMode] = useState(false); // Multi-select mode for history
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    new Set()
  ); // Selected sessions for bulk delete
  const scrollRef = useRef<HTMLDivElement>(null);

  // Local RAG hook (per-session, JIVE/JIGGA)
  const {
    sessionId: ragSessionId,
    documents,
    selectedDocIds,
    allDocuments,
    stats,
    storageUsage,
    isLoading: ragLoading,
    isEmbedding,
    uploadDocument,
    removeDocument,
    getContext,
    clearAllDocuments,
    newSession: newRAGSession,
    isRAGEnabled,
    canUpload,
    canSelectFromAllSessions,
    canUseSemanticRAG,
    selectDocuments,
    loadAllDocuments,
    getMaxDocsPerSession,
    getRemainingDocsSlots,
    initSemanticSearch,
  } = useRAG(tier);

  // Chat history hook (JIVE/JIGGA only)
  const {
    sessionId: chatSessionId,
    sessions,
    messages,
    addMessage,
    newSession: newChatSession,
    loadSession,
    deleteCurrentSession,
    deleteSessionById,
    deleteMultipleSessions,
    deleteAllSessions,
    clearMessages,
    isPersistenceEnabled,
  } = useChatHistory(tier);

  // Image storage hook
  const { saveImage, deleteImage } = useImageStorage();

  // Token tracking hook
  const {
    stats: tokenStats,
    track: trackTokens,
    refreshStats: refreshTokenStats,
  } = useTokenTracking();

  // Location hook (geolocation with user consent)
  const {
    userLocation,
    weatherData,
    showLocationPrompt,
    showManualLocation,
    manualLocationInput,
    isLoadingLocation,
    locationError,
    hasConsented: hasLocationConsent,
    retryCount,
    canRetry,
    requestLocation,
    retryLocation,
    declineLocation,
    setManualLocation,
    setLocationFromSuggestion,
    setManualLocationInput,
    setShowManualLocation,
    clearLocation,
    getLocationContext,
  } = useLocation(true); // Auto-prompt for location on first load

  // BuddySystem hook (language detection, relationship tracking)
  const {
    processMessage: processBuddyMessage,
    detectLanguage: detectMessageLanguage,
    getAIContext: getBuddyContext,
  } = useBuddySystem();

  // Local messages for FREE tier (not persisted)
  const [freeMessages, setFreeMessages] = useState<ChatMessage[]>([]);

  // Track when location was just determined (for weather panel auto-show)
  const [locationJustDetermined, setLocationJustDetermined] = useState(false);
  const previousLocationRef = useRef<typeof userLocation>(null);

  // External weather location (from AI tool call - triggers weather panel)
  const [externalWeatherLocation, setExternalWeatherLocation] = useState<{
    lat: number;
    lon: number;
    name: string;
  } | null>(null);

  // Detect when location transitions from null to a value
  useEffect(() => {
    if (previousLocationRef.current === null && userLocation !== null) {
      // Location was just determined!
      setLocationJustDetermined(true);
      // Reset after animation completes
      setTimeout(() => setLocationJustDetermined(false), 10000);
    }
    previousLocationRef.current = userLocation;
  }, [userLocation]);

  // Use appropriate messages based on tier
  const displayMessages = isPersistenceEnabled ? messages : freeMessages;

  // Load saved tier from localStorage (and fix any corrupted values)
  useEffect(() => {
    const rawTier = localStorage.getItem('gogga_tier');
    const savedTier = rawTier?.trim() as Tier | null;
    if (savedTier && ['free', 'jive', 'jigga'].includes(savedTier)) {
      setTier(savedTier);
      // Fix corrupted value if it had whitespace
      if (rawTier !== savedTier) {
        localStorage.setItem('gogga_tier', savedTier);
        console.log('[GOGGA] Fixed corrupted tier value in localStorage');
      }
    } else if (rawTier) {
      // Invalid tier value - reset to free
      localStorage.setItem('gogga_tier', 'free');
      console.log('[GOGGA] Reset invalid tier value to free');
    }
  }, []);

  // Auto-initialize semantic engine for JIGGA tier (preload model)
  useEffect(() => {
    if (canUseSemanticRAG && initSemanticSearch) {
      console.log('[GOGGA] JIGGA tier: Preloading semantic engine...');
      initSemanticSearch()
        .then((success) => {
          console.log('[GOGGA] Semantic engine initialized:', success);
        })
        .catch((err) => {
          console.warn('[GOGGA] Semantic engine init failed:', err);
        });
    }
  }, [canUseSemanticRAG, initSemanticSearch]);

  // Save tier changes
  const handleTierChange = useCallback((newTier: Tier) => {
    setTier(newTier);
    localStorage.setItem('gogga_tier', newTier);
    // Clear FREE tier messages when switching
    if (newTier === 'free') {
      setFreeMessages([]);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Get BuddySystem context (all paid tiers - includes name, relationship, preferences)
    let buddyContext: string | null = null;
    if (tier === 'jive' || tier === 'jigga') {
      try {
        buddyContext = await getBuddyContext();
        console.log(
          '[GOGGA] Fetched BuddySystem context:',
          buddyContext ? `${buddyContext.length} chars` : 'empty'
        );
      } catch (e) {
        console.error('[GOGGA] Failed to load BuddySystem context:', e);
      }
    }

    // Get Long-Term Memory context (JIGGA only, stored in Dexie)
    let memoryContext: string | null = null;
    if (tier === 'jigga') {
      try {
        memoryContext = await getMemoryContextForLLM();
        console.log(
          '[GOGGA] Fetched memory context:',
          memoryContext ? `${memoryContext.length} chars` : 'empty'
        );
      } catch (e) {
        console.error('[GOGGA] Failed to load memory context:', e);
      }
    } else {
      console.log(
        '[GOGGA] Skipping memory context (tier is',
        tier,
        ', need jigga)'
      );
    }

    // Get RAG context if enabled and has documents (current session OR selected from other sessions)
    let ragContext: string | null = null;
    const hasDocuments = documents.length > 0 || selectedDocIds.length > 0;

    if (isRAGEnabled && hasDocuments && useRAGContext) {
      const rawContext = await getContext(text);
      if (rawContext) {
        const modeInstruction =
          ragMode === 'authoritative'
            ? 'IMPORTANT: Only quote directly from the provided documents. Do not synthesize or interpret beyond what is explicitly stated.'
            : 'Analyze and synthesize information from the provided documents to give a comprehensive answer.';
        ragContext = `${modeInstruction}\n\n${rawContext}`;
      }
    }

    // Create user message with language detection
    const langDetection = detectMessageLanguage(text);
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      detectedLanguage: langDetection.language,
      languageConfidence: langDetection.confidence,
    };

    // Process message for BuddySystem (updates profile, relationship, etc.)
    await processBuddyMessage(text);

    // Add to appropriate message store
    if (isPersistenceEnabled) {
      await addMessage(userMsg);
    } else {
      setFreeMessages((prev) => [...prev, userMsg]);
    }

    setInput('');
    setIsLoading(true);

    try {
      // Build the full message with all context
      let messageToSend = text;

      // Add BuddySystem context first (user identity, relationship, preferences)
      if (buddyContext) {
        console.log(
          '[GOGGA] BuddySystem context found:',
          buddyContext.slice(0, 200) + '...'
        );
        messageToSend = `USER CONTEXT:\n${buddyContext}\n\n---\n\n${messageToSend}`;
      }

      // Add Long-Term Memory context (persistent user info)
      if (memoryContext) {
        console.log(
          '[GOGGA] Long-Term Memory context found:',
          memoryContext.slice(0, 200) + '...'
        );
        messageToSend = `${memoryContext}\n\n---\n\n${messageToSend}`;
      } else {
        console.log('[GOGGA] No Long-Term Memory context (tier:', tier, ')');
      }

      // Add RAG context (session documents)
      if (ragContext) {
        console.log(
          '[GOGGA] RAG context found:',
          ragContext.slice(0, 200) + '...'
        );
        messageToSend = `${ragContext}\n\n---\n\nUser Question: ${messageToSend}`;
      } else {
        console.log(
          '[GOGGA] No RAG context (RAG enabled:',
          isRAGEnabled,
          ', docs:',
          documents.length,
          ', useRAG:',
          useRAGContext,
          ')'
        );
      }

      // Add Location context (if user consented and location is available)
      const locationContext = getLocationContext();
      if (locationContext) {
        console.log('[GOGGA] Location context found:', locationContext);
        messageToSend = `${locationContext}\n\n---\n\n${messageToSend}`;
      }

      console.log(
        '[GOGGA] Final message length:',
        messageToSend.length,
        'chars'
      );

      // Build conversation history for context (last 10 messages max to avoid token limits)
      const historyForAPI = displayMessages.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const requestPayload = {
        message: messageToSend,
        user_id: 'demo_user_123',
        user_tier: tier.trim().toLowerCase(),
        history: historyForAPI.length > 0 ? historyForAPI : undefined,
      };
      console.log('[GOGGA] Request payload:', JSON.stringify(requestPayload));
      console.log('[GOGGA] History messages:', historyForAPI.length);

      const response = await axios.post('/api/v1/chat', requestPayload);

      const { data } = response;

      // Debug: Log the full response structure to see if tool_calls are there
      console.log('[GOGGA] Full API response:', {
        hasResponse: !!data.response,
        responseLength: data.response?.length,
        hasToolCalls: !!data.tool_calls,
        toolCallsCount: data.tool_calls?.length,
        meta: data.meta,
        allKeys: Object.keys(data),
      });

      // Track token usage if available
      if (data.meta?.tokens) {
        const inputTokens = data.meta.tokens.input || 0;
        const outputTokens = data.meta.tokens.output || 0;
        const costZar = data.meta.cost_zar || 0;
        await trackTokens(tier, inputTokens, outputTokens, costZar);
      }

      const botMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        thinking: data.thinking || undefined, // JIGGA thinking block
        meta: {
          cost_zar: data.meta?.cost_zar,
          model: data.meta?.model_used || data.meta?.model,
          layer: data.meta?.layer,
          latency_seconds: data.meta?.latency_seconds,
          tier: data.meta?.tier,
          provider: data.meta?.provider,
          rag_context: !!ragContext,
          memory_context: !!memoryContext, // Long-term memory was used
          buddy_context: !!buddyContext, // BuddySystem profile was used
          location_context: !!locationContext, // Location was included
          has_thinking: data.meta?.has_thinking || !!data.thinking,
          timestamp: new Date().toISOString(), // Response timestamp
        },
      };

      // Handle tool calls if present (JIGGA tier only)
      if (
        data.tool_calls &&
        Array.isArray(data.tool_calls) &&
        data.tool_calls.length > 0
      ) {
        console.log('[GOGGA] Tool calls received:', data.tool_calls);

        try {
          // Check if this is an image generation tool call
          const hasImageTool = data.tool_calls.some(
            (tc: { function?: { name?: string } }) => tc.function?.name === 'generate_image'
          );
          
          // Add temporary "painting" message for image generation
          if (hasImageTool && botMsg.content) {
            const tempContent = botMsg.content + '\n\n*🎨 GOGGA is painting your image...*';
            if (isPersistenceEnabled) {
              await addMessage({ ...botMsg, content: tempContent });
            } else {
              setFreeMessages((prev) => [...prev, { ...botMsg, content: tempContent }]);
            }
          }
          
          // Execute the tool calls on the frontend
          const toolResults = await executeToolCalls(
            data.tool_calls as ToolCall[]
          );
          console.log('[GOGGA] Tool results:', toolResults);

          // Add tool execution info to the message (no label for images)
          const toolSummary = formatToolResultsMessage(toolResults);
          if (toolSummary) {
            // Check if result contains images (no prefix) or memory operations (add prefix)
            const hasImages = toolSummary.includes('![Generated Image');
            const prefix = hasImages ? '' : '**Memory Updated:**\n';
            
            // Append tool results to the response
            botMsg.content = botMsg.content
              ? `${botMsg.content}\n\n---\n${prefix}${toolSummary}`
              : toolSummary;
          }

          // Mark that tools were executed
          if (botMsg.meta) {
            botMsg.meta.tools_executed = true;
          }
        } catch (toolError) {
          console.error('[GOGGA] Tool execution failed:', toolError);
        }
      }

      if (isPersistenceEnabled) {
        await addMessage(botMsg);
      } else {
        setFreeMessages((prev) => [...prev, botMsg]);
      }

      // Check for weather panel trigger from AI tool call
      if (data.weather_panel) {
        console.log(
          '[GOGGA] Weather panel triggered by AI:',
          data.weather_panel
        );
        setExternalWeatherLocation({
          lat: data.weather_panel.lat,
          lon: data.weather_panel.lon,
          name: data.weather_panel.name,
        });
        // Clear after panel has shown
        setTimeout(() => setExternalWeatherLocation(null), 10000);
      }
    } catch (error: any) {
      console.error('Chat Error:', error);
      const { response, message } = error;
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Eish! Something went wrong: ${
          response?.data?.detail || message
        }`,
      };

      if (isPersistenceEnabled) {
        await addMessage(errorMsg);
      } else {
        setFreeMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudio = (audioBlob: Blob) => {
    console.log('Audio recorded:', audioBlob.size, 'bytes');
    alert('Audio Captured! Transcription coming soon.');
  };

  const handleFileUpload = async (file: File) => {
    // Both JIVE and JIGGA can upload documents
    if (tier === 'jive' || tier === 'jigga') {
      try {
        console.log(`[GOGGA] ${tier.toUpperCase()} uploading:`, file.name);
        await uploadDocument(file);
        console.log(`[GOGGA] Upload complete:`, file.name);
      } catch (error: any) {
        console.error(`[GOGGA] Upload failed:`, error);
        alert(`Upload failed: ${error.message}`);
      }
    }
  };

  const enhancePrompt = async () => {
    if (!input.trim()) return;

    setIsEnhancing(true);
    try {
      const response = await axios.post('/api/v1/chat/enhance', {
        prompt: input,
        user_id: 'demo_user_123',
      });

      if (response.data.success && response.data.enhanced_prompt) {
        setInput(response.data.enhanced_prompt);
      }
    } catch (error) {
      console.error('Enhance error:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const generateImage = async () => {
    if (!input.trim()) return;

    setIsGeneratingImage(true);
    const originalPrompt = input;
    const userMsg: ChatMessage = { role: 'user', content: `🖼️ ${input}` };

    if (isPersistenceEnabled) {
      await addMessage(userMsg);
    } else {
      setFreeMessages((prev) => [...prev, userMsg]);
    }
    setInput('');

    try {
      const response = await axios.post('/api/v1/images/generate', {
        prompt: originalPrompt,
        user_id: 'demo_user_123',
        user_tier: tier.toLowerCase(),
        enhance_prompt: true,
      });

      const { data } = response;

      // Determine if we have actual image data
      let imageId: number | undefined;
      let botContent = '';

      if (data.image_data) {
        // Check if it's base64 image data
        const isBase64Image =
          data.image_data.startsWith('/9j/') ||
          data.image_data.startsWith('iVBOR') ||
          (data.image_data.length > 1000 && !data.image_data.includes(' '));

        if (isBase64Image && chatSessionId) {
          // Save image to Dexie and get ID
          imageId = await saveImage(
            chatSessionId,
            originalPrompt,
            data.enhanced_prompt,
            data.image_data,
            tier,
            data.meta?.generation_model || 'unknown'
          );
          botContent = `__IMAGE_ID__:${imageId}\n\n**Enhanced prompt:** ${data.enhanced_prompt}`;
        } else if (isBase64Image) {
          // No session (FREE tier) - display inline
          const mimeType = data.image_data.startsWith('/9j/')
            ? 'image/jpeg'
            : 'image/png';
          botContent = `![Generated Image](data:${mimeType};base64,${data.image_data})\n\n**Enhanced prompt:** ${data.enhanced_prompt}`;
        } else {
          // Text description (LongCat FREE tier)
          botContent = `**Image Description:**\n\n${data.image_data}\n\n**Enhanced prompt:** ${data.enhanced_prompt}`;
        }
      } else {
        botContent = `Image generated!\n\n**Enhanced prompt:** ${data.enhanced_prompt}`;
      }

      const botMsg: ChatMessage = {
        role: 'assistant',
        content: botContent,
        imageId,
        meta: {
          tier: tier,
          provider: data.meta?.pipeline || 'unknown',
          model: data.meta?.generation_model || 'unknown',
        },
      };

      if (isPersistenceEnabled) {
        await addMessage(botMsg);
      } else {
        setFreeMessages((prev) => [...prev, botMsg]);
      }
    } catch (error: any) {
      console.error('Image error:', error);
      const { response, message } = error;
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Eish! Image generation failed: ${
          response?.data?.detail || message
        }`,
      };

      if (isPersistenceEnabled) {
        await addMessage(errorMsg);
      } else {
        setFreeMessages((prev) => [...prev, errorMsg]);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleNewChat = async () => {
    if (isPersistenceEnabled) {
      await newChatSession();
    } else {
      setFreeMessages([]);
    }
    // Also reset RAG session for JIGGA
    if (tier === 'jigga') {
      newRAGSession();
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    await softDeleteImage(imageId);
  };

  const handleOpenDocSelector = async () => {
    await loadAllDocuments();
    setShowDocSelector(true);
  };

  const handleSelectDoc = async (docId: number) => {
    const newSelected = selectedDocIds.includes(docId)
      ? selectedDocIds.filter((id) => id !== docId)
      : [...selectedDocIds, docId];

    try {
      await selectDocuments(newSelected);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const totalDocsActive = documents.length + selectedDocIds.length;

  const TierIcon = TIER_DISPLAY[tier].icon;

  // Toggle thinking block visibility
  const toggleThinking = (messageIndex: number) => {
    setExpandedThinking((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex);
      } else {
        newSet.add(messageIndex);
      }
      return newSet;
    });
  };

  // Render message content with image support, markdown, and collapsible thinking
  const renderMessageContent = (msg: ChatMessage, messageIndex: number) => {
    const isUser = msg.role === 'user';

    // Extract thinking from message - either from dedicated field or from content
    let thinkingContent = (msg as ChatMessage).thinking || '';
    let mainContent = msg.content;

    // If no thinking field, try to extract from content (fallback)
    if (!thinkingContent && msg.content) {
      const thinkMatch = msg.content.match(
        /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/i
      );
      if (thinkMatch) {
        thinkingContent = thinkMatch[1].trim();
        mainContent = msg.content
          .replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, '')
          .trim();
      }
    }

    const hasThinking = !!thinkingContent;
    const isThinkingExpanded = expandedThinking.has(messageIndex);

    // Check for image reference
    if (msg.content.startsWith('__IMAGE_ID__:') && msg.imageId) {
      const parts = msg.content.split('\n\n');
      const promptPart = parts.slice(1).join('\n\n');

      return (
        <div>
          <ImageThumbnail
            imageId={msg.imageId}
            onDelete={() => handleDeleteImage(msg.imageId!)}
          />
          {promptPart && (
            <div className="mt-3">
              <MarkdownRenderer
                content={promptPart}
                variant={isUser ? 'user' : 'assistant'}
              />
            </div>
          )}
        </div>
      );
    }

    // Check for inline base64 image (FREE tier)
    if (msg.content.includes('![Generated Image](data:image')) {
      const match = msg.content.match(
        /!\[Generated Image\]\((data:image\/[^)]+)\)/
      );
      if (match) {
        const imageSrc = match[1];
        const textAfter = msg.content.replace(match[0], '').trim();

        return (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageSrc}
              alt="Generated"
              className="max-w-full rounded-xl shadow-md cursor-pointer hover:opacity-90 transition-opacity"
              style={{ maxHeight: '400px' }}
            />
            {textAfter && (
              <div className="mt-3">
                <MarkdownRenderer
                  content={textAfter}
                  variant={isUser ? 'user' : 'assistant'}
                />
              </div>
            )}
          </div>
        );
      }
    }

    // Regular text content with thinking block (JIGGA)
    return (
      <div>
        {/* Collapsible Thinking Block */}
        {hasThinking && (
          <div className="mb-3">
            <button
              onClick={() => toggleThinking(messageIndex)}
              className="flex items-center gap-2 text-xs text-primary-500 hover:text-primary-700 transition-colors mb-2 group"
            >
              <Brain
                size={14}
                className="text-primary-400 group-hover:text-primary-600"
              />
              <span className="font-medium">Reasoning</span>
              {isThinkingExpanded ? (
                <ChevronUp size={14} className="text-primary-400" />
              ) : (
                <ChevronDown size={14} className="text-primary-400" />
              )}
            </button>
            {isThinkingExpanded && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-xs text-primary-600 mb-3 animate-fadeIn">
                <MarkdownRenderer
                  content={thinkingContent}
                  variant="assistant"
                  className="prose-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Main Response - use cleaned content */}
        <MarkdownRenderer
          content={mainContent}
          variant={isUser ? 'user' : 'assistant'}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-primary-50">
      {/* Header */}
      <header className="bg-primary-800 text-white px-4 py-3 shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-4">
          <GoggaLogo size="xl" variant="animated" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">GOGGA</h1>
            <span className="text-xs text-primary-300 font-medium">
              South African AI
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            className="header-btn"
            title="New chat session"
          >
            <Plus size={16} />
            <span>New</span>
          </button>

          {/* History Button (JIVE/JIGGA only) */}
          {isPersistenceEnabled && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`header-btn ${showHistory ? 'bg-primary-500' : ''}`}
              title="Chat history"
            >
              <History size={16} />
              <span>{sessions.length}</span>
            </button>
          )}

          {/* Location Badge */}
          <LocationBadge
            location={userLocation}
            weather={weatherData}
            onClick={() => {
              if (!userLocation) {
                setShowManualLocation(true);
              }
            }}
            onEdit={() => {
              // Pre-fill with current location when editing
              if (userLocation) {
                setManualLocationInput(
                  userLocation.city || userLocation.street || ''
                );
              }
              setShowManualLocation(true);
            }}
            onClear={clearLocation}
          />

          {/* Token Count Display */}
          <div
            className="header-btn bg-primary-700/50 cursor-default"
            title={`Today: ${formatTokenCount(
              tokenStats.today.totalTokens
            )} tokens | All time: ${formatTokenCount(
              tokenStats.allTime.totalTokens
            )} tokens`}
          >
            <Hash size={14} className="text-primary-300" />
            <span className="text-sm font-medium">
              {tokenStats.isLoading
                ? '...'
                : formatTokenCount(tokenStats.allTime.totalTokens)}
            </span>
          </div>

          {/* Account Menu (replaces simple tier badge) */}
          {userEmail ? (
            <AccountMenu
              userEmail={userEmail}
              currentTier={userTier as 'FREE' | 'JIVE' | 'JIGGA'}
            />
          ) : (
            <div className={`header-btn font-bold ${TIER_DISPLAY[tier].color}`}>
              <TierIcon size={16} />
              <span>{TIER_DISPLAY[tier].name}</span>
            </div>
          )}
          <span className="header-btn bg-primary-600/50 text-[10px]">
            Beta v1.0
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* History Sidebar (JIVE/JIGGA) */}
        {isPersistenceEnabled && showHistory && (
          <div className="w-72 border-r border-primary-200 bg-white overflow-y-auto flex flex-col">
            {/* Header with actions */}
            <div className="p-3 border-b border-primary-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary-700">
                Chat History
              </h3>
              <div className="flex items-center gap-1">
                {/* Toggle select mode */}
                <button
                  onClick={() => {
                    setHistorySelectMode(!historySelectMode);
                    setSelectedSessions(new Set());
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    historySelectMode
                      ? 'bg-primary-200 text-primary-700'
                      : 'hover:bg-primary-100 text-primary-500'
                  }`}
                  title={
                    historySelectMode
                      ? 'Cancel selection'
                      : 'Select chats to delete'
                  }
                >
                  <span className="material-icons text-lg">
                    {historySelectMode ? 'close' : 'checklist'}
                  </span>
                </button>
                {/* Delete all */}
                {sessions.length > 1 && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          'Delete ALL chat history? This cannot be undone.'
                        )
                      ) {
                        deleteAllSessions();
                        setHistorySelectMode(false);
                        setSelectedSessions(new Set());
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-100 text-primary-500 hover:text-red-600 transition-colors"
                    title="Delete all chats"
                  >
                    <span className="material-icons text-lg">delete_sweep</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bulk delete bar (when in select mode with selections) */}
            {historySelectMode && selectedSessions.size > 0 && (
              <div className="p-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <span className="text-sm text-red-700">
                  {selectedSessions.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedSessions(new Set())}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                  <button
                    onClick={async () => {
                      if (
                        confirm(
                          `Delete ${selectedSessions.size} selected chat(s)?`
                        )
                      ) {
                        await deleteMultipleSessions(
                          Array.from(selectedSessions)
                        );
                        setSelectedSessions(new Set());
                        setHistorySelectMode(false);
                      }
                    }}
                    className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <span className="material-icons text-sm">delete</span>
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Session list */}
            <div className="flex-1 overflow-y-auto divide-y divide-primary-100">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative flex items-stretch hover:bg-primary-50 transition-colors ${
                    session.id === chatSessionId ? 'bg-primary-100' : ''
                  }`}
                >
                  {/* Checkbox (select mode) */}
                  {historySelectMode && (
                    <label className="flex items-center px-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.id!)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedSessions);
                          if (e.target.checked) {
                            newSelected.add(session.id!);
                          } else {
                            newSelected.delete(session.id!);
                          }
                          setSelectedSessions(newSelected);
                        }}
                        className="w-4 h-4 rounded border-primary-300 text-primary-600 focus:ring-primary-500"
                      />
                    </label>
                  )}

                  {/* Session button */}
                  <button
                    onClick={() => {
                      if (historySelectMode) {
                        // Toggle selection in select mode
                        const newSelected = new Set(selectedSessions);
                        if (newSelected.has(session.id!)) {
                          newSelected.delete(session.id!);
                        } else {
                          newSelected.add(session.id!);
                        }
                        setSelectedSessions(newSelected);
                      } else {
                        loadSession(session.id!);
                      }
                    }}
                    className="flex-1 p-3 text-left"
                  >
                    <div className="text-sm font-medium text-primary-800 truncate pr-8">
                      {session.title}
                    </div>
                    <div className="text-xs text-primary-500 mt-1">
                      {session.messageCount} messages •{' '}
                      {new Date(session.updatedAt).toLocaleDateString()}
                    </div>
                  </button>

                  {/* Delete button (individual, visible on hover when not in select mode) */}
                  {!historySelectMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this chat?')) {
                          deleteSessionById(session.id!);
                        }
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg 
                               opacity-0 group-hover:opacity-100 hover:bg-red-100 
                               text-primary-400 hover:text-red-600 transition-all"
                      title="Delete this chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {displayMessages.length === 0 && (
              <div className="text-center text-primary-400 mt-16 animate-fadeIn">
                <div className="mb-6">
                  <GoggaLogo size="xl" variant="animated" className="mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-primary-700 mb-2">
                  Sawubona!
                </h2>
                <p className="text-base text-primary-500 mb-1">
                  How can I help you today?
                </p>
                <p className="text-sm text-primary-400 mb-8">
                  Legal questions, code, translations, or just a lekker chat.
                </p>

                <div className="flex justify-center gap-6 flex-wrap">
                  <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-primary-200 min-w-[140px] hover-lift">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Zap size={20} className="text-primary-600" />
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      FREE
                    </span>
                    <span className="text-xs text-primary-500">Llama 3.3</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-primary-200 min-w-[140px] hover-lift">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Brain size={20} className="text-primary-600" />
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      JIVE
                    </span>
                    <span className="text-xs text-primary-500">
                      Cerebras + CePO
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-primary-200 min-w-[140px] hover-lift">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Sparkles size={20} className="text-primary-600" />
                    </div>
                    <span className="text-sm font-bold text-primary-700">
                      JIGGA
                    </span>
                    <span className="text-xs text-primary-500">
                      Qwen 3 32B + RAG
                    </span>
                  </div>
                </div>

                {tier !== 'free' && (
                  <p className="text-xs text-primary-400 mt-6 flex items-center justify-center gap-1">
                    <Database size={12} />
                    Chat history saved for {tier.toUpperCase()} tier
                  </p>
                )}
              </div>
            )}

            {displayMessages.map((m, i) => (
              <div
                key={i}
                className={`flex ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                } chat-bubble`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${
                    m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar - clean with no background for bot */}
                  <div
                    className={`flex-shrink-0 flex items-center justify-center ${
                      m.role === 'user'
                        ? 'w-8 h-8 rounded-full bg-primary-800'
                        : 'w-10 h-10'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <User size={16} className="text-white" />
                    ) : (
                      <GoggaCricket size="md" />
                    )}
                  </div>

                  <div
                    className={`message-bubble ${
                      m.role === 'user'
                        ? 'message-bubble-user'
                        : 'message-bubble-assistant'
                    }`}
                  >
                    {renderMessageContent(m as ChatMessage, i)}

                    {/* Language Badge for user messages (shows detected SA language) */}
                    {m.role === 'user' &&
                      (m as ChatMessage).detectedLanguage &&
                      (m as ChatMessage).detectedLanguage !== 'en' && (
                        <div className="mt-1 flex justify-end">
                          <LanguageBadge
                            language={(m as ChatMessage).detectedLanguage!}
                            confidence={(m as ChatMessage).languageConfidence}
                          />
                        </div>
                      )}

                    {/* Metadata Display - Clean button indicators */}
                    {m.meta && (
                      <div className="message-meta">
                        {m.meta.tier && (
                          <button
                            type="button"
                            className="meta-badge meta-badge-tier"
                          >
                            {m.meta.tier}
                          </button>
                        )}
                        {/* Layer badge - different display for each tier */}
                        {m.meta.layer && (
                          <button type="button" className="meta-badge">
                            {m.meta.layer === 'jive_speed' ? (
                              <>
                                <Zap size={12} />
                                <span>Speed</span>
                              </>
                            ) : m.meta.layer === 'jive_reasoning' ? (
                              <>
                                <Brain size={12} />
                                <span>CePO</span>
                              </>
                            ) : m.meta.layer === 'jigga_think' ? (
                              <>
                                <Brain size={12} />
                                <span>Thinking</span>
                              </>
                            ) : m.meta.layer === 'jigga_fast' ? (
                              <>
                                <Zap size={12} />
                                <span>Fast</span>
                              </>
                            ) : (
                              <>
                                <Brain size={12} />
                                <span>{m.meta.layer}</span>
                              </>
                            )}
                          </button>
                        )}
                        {m.meta.latency_seconds && (
                          <button type="button" className="meta-badge">
                            <Clock size={12} />
                            <span>{m.meta.latency_seconds.toFixed(2)}s</span>
                          </button>
                        )}
                        {/* Timestamp display */}
                        {m.meta.timestamp && (
                          <button
                            type="button"
                            className="meta-badge text-[10px] opacity-60"
                            title={new Date(m.meta.timestamp).toLocaleString()}
                          >
                            <span>
                              {new Date(m.meta.timestamp).toLocaleTimeString(
                                [],
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                            </span>
                          </button>
                        )}
                        {m.meta.cost_zar !== undefined &&
                          m.meta.cost_zar > 0 && (
                            <button type="button" className="meta-badge">
                              <span>R{m.meta.cost_zar.toFixed(4)}</span>
                            </button>
                          )}
                        {m.meta.rag_context && (
                          <button
                            type="button"
                            className="meta-badge meta-badge-rag"
                          >
                            <Database size={12} />
                            <span>RAG</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start chat-bubble">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    <GoggaCricket size="md" />
                  </div>
                  <div className="message-bubble message-bubble-assistant">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-primary-500">Thinking</span>
                      <div className="flex gap-1">
                        <span className="thinking-dot w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                        <span className="thinking-dot w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                        <span className="thinking-dot w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-primary-200">
            {/* RAG Mode Toggle - JIVE/JIGGA tiers */}
            {canUpload && (
              <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 flex-wrap">
                {/* RAG Mode Button */}
                {tier === 'jigga' && (
                  <button
                    onClick={() =>
                      setRagMode(
                        ragMode === 'analysis' ? 'authoritative' : 'analysis'
                      )
                    }
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                      totalDocsActive > 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {ragMode === 'analysis' ? (
                      <FileSearch size={12} />
                    ) : (
                      <BookOpen size={12} />
                    )}
                    <span>
                      {ragMode === 'analysis' ? 'Analysis' : 'Authoritative'}
                    </span>
                    {totalDocsActive > 0 && (
                      <span className="text-[10px] opacity-70">
                        ({totalDocsActive} docs)
                      </span>
                    )}
                  </button>
                )}

                {/* Storage Usage */}
                {(tier === 'jive' || tier === 'jigga') && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <HardDrive size={10} />
                    <span>
                      {storageUsage.totalMB.toFixed(1)}/{storageUsage.maxMB}MB (
                      {documents.length}/{getMaxDocsPerSession()} docs)
                    </span>
                  </div>
                )}

                {/* RAG Help Text */}
                <span className="text-[10px] text-gray-400 flex-1">
                  {tier === 'jive' &&
                    documents.length === 0 &&
                    'Upload up to 5 docs for this chat'}
                  {tier === 'jigga' &&
                    totalDocsActive === 0 &&
                    'Upload or select docs from all sessions'}
                  {tier === 'jigga' &&
                    totalDocsActive > 0 &&
                    ragMode === 'analysis' &&
                    'AI analyzes from docs'}
                  {tier === 'jigga' &&
                    totalDocsActive > 0 &&
                    ragMode === 'authoritative' &&
                    'AI quotes directly'}
                </span>
              </div>
            )}

            <div className="max-w-4xl mx-auto flex items-center gap-2">
              {/* Left buttons - aligned center with 48px height */}
              <div className="flex items-center gap-2 h-12">
                <AudioRecorder onAudioReady={handleAudio} />

                {/* File Upload (JIVE/JIGGA) */}
                {tier !== 'free' && (
                  <FileUpload
                    tier={tier}
                    onUpload={handleFileUpload}
                    disabled={isLoading || ragLoading}
                    isEmbedding={isEmbedding}
                  />
                )}
              </div>

              {/* Input Container with Wand inside */}
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize
                    e.target.style.height = 'auto';
                    const maxHeight = window.innerHeight * 0.5;
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, maxHeight) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  className="input-field pr-14 h-12 min-h-[48px] max-h-[50vh] resize-none overflow-y-auto py-3"
                  placeholder={
                    tier === 'jigga' && documents.length > 0
                      ? `Ask about your documents (${ragMode} mode)...`
                      : 'Type your message...'
                  }
                  disabled={isLoading || isGeneratingImage}
                  rows={1}
                />

                {/* Enhance Button - Inside Input with Sparkle Animation */}
                <button
                  onClick={enhancePrompt}
                  disabled={!input.trim() || isEnhancing || isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-primary-400 hover:text-primary-700 disabled:text-primary-200 disabled:cursor-not-allowed transition-all group"
                  aria-label="Enhance prompt with AI"
                  title="✨ Enhance your prompt with AI magic"
                >
                  {isEnhancing ? (
                    <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                  ) : (
                    <div className="relative wand-animate">
                      <MagicWandIcon
                        size={20}
                        className="group-hover:scale-110 transition-transform"
                      />
                    </div>
                  )}
                </button>
              </div>

              {/* Right buttons - aligned center with 48px height */}
              <div className="flex items-center gap-2 h-12">
                {/* Image Generation Button */}
                <button
                  onClick={generateImage}
                  disabled={!input.trim() || isGeneratingImage || isLoading}
                  className="action-btn h-12 w-12 bg-primary-200 text-primary-800 hover:bg-primary-300"
                  aria-label="Generate image"
                  title={`Generate image (${
                    tier === 'free' ? 'LongCat FREE' : 'FLUX 1.1 Pro'
                  })`}
                >
                  {isGeneratingImage ? (
                    <div className="animate-spin h-5 w-5 border-2 border-primary-800 border-t-transparent rounded-full" />
                  ) : (
                    <ImageGenerateIcon size={20} />
                  )}
                </button>

                {/* Send Button */}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading || isGeneratingImage}
                  className="action-btn h-12 w-12 bg-primary-800 text-white hover:bg-primary-700 disabled:bg-primary-300"
                  aria-label="Send message"
                >
                  <SendArrowIcon size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar for JIVE/JIGGA RAG */}
        {canUpload && (
          <div className="w-72 border-l border-primary-200 bg-white p-3 overflow-y-auto hidden lg:block">
            {/* Header with FileStore Icon */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-primary-100">
              <FileStoreIcon size={20} className="text-primary-600" />
              <span className="font-semibold text-primary-800 text-sm">
                Document Store
              </span>
            </div>

            {/* JIGGA: Browse All Documents Button */}
            {canSelectFromAllSessions && (
              <button
                onClick={handleOpenDocSelector}
                className="w-full flex items-center justify-center gap-2 text-sm px-3 py-2 mb-3 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors border border-primary-200"
                title="Select documents from all sessions"
              >
                <FolderOpen size={16} />
                <span>Browse All Docs</span>
                {selectedDocIds.length > 0 && (
                  <span className="bg-primary-500 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                    {selectedDocIds.length}
                  </span>
                )}
              </button>
            )}

            {/* Current Session Documents */}
            {documents.length > 0 ? (
              <DocumentList
                documents={documents}
                onRemove={removeDocument}
                onClearAll={clearAllDocuments}
                stats={stats}
                isLoading={ragLoading}
              />
            ) : (
              <div className="text-center text-primary-400 py-4 text-sm">
                <Database size={24} className="mx-auto mb-2 opacity-50" />
                <p>No documents in this session</p>
                <p className="text-xs mt-1">Upload files to enable RAG</p>
              </div>
            )}

            {/* Selected docs from other sessions (JIGGA) */}
            {selectedDocIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-primary-200">
                <div className="text-xs font-bold text-primary-600 mb-2">
                  Selected from other sessions ({selectedDocIds.length})
                </div>
                <div className="space-y-1">
                  {allDocuments
                    .filter((d) => selectedDocIds.includes(d.id!))
                    .map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between text-xs p-2 bg-blue-50 rounded"
                      >
                        <span className="truncate flex-1">{doc.filename}</span>
                        <button
                          onClick={() => handleSelectDoc(doc.id!)}
                          className="text-red-400 hover:text-red-600 ml-2"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Panel */}
      <AdminPanel
        tier={tier}
        onTierChange={handleTierChange}
        onAdminChange={setIsAdmin}
        documentCount={documents.length}
        ragEnabled={
          isRAGEnabled && (documents.length > 0 || selectedDocIds.length > 0)
        }
      />

      {/* Prompt Manager (Admin only) */}
      {isAdmin && <PromptManager />}

      {/* Document Selector Modal (JIGGA only) */}
      {showDocSelector && canSelectFromAllSessions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-primary-200 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-primary-800">Select Documents</h3>
                <p className="text-xs text-primary-500 mt-1">
                  Choose up to{' '}
                  {RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION - documents.length}{' '}
                  more documents ({selectedDocIds.length} selected,{' '}
                  {documents.length} in session)
                </p>
              </div>
              <button
                onClick={() => setShowDocSelector(false)}
                className="text-primary-400 hover:text-primary-600"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {allDocuments.length === 0 ? (
                <div className="text-center text-primary-400 py-8">
                  <FolderOpen size={48} className="mx-auto mb-2 opacity-50" />
                  <p>No documents found across sessions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allDocuments
                    .filter((doc) => !documents.some((d) => d.id === doc.id)) // Exclude current session docs
                    .map((doc) => {
                      const isSelected = selectedDocIds.includes(doc.id!);
                      const canSelect =
                        isSelected ||
                        documents.length + selectedDocIds.length <
                          RAG_LIMITS.JIGGA_MAX_DOCS_PER_SESSION;

                      return (
                        <button
                          key={doc.id}
                          onClick={() => canSelect && handleSelectDoc(doc.id!)}
                          disabled={!canSelect && !isSelected}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300'
                              : canSelect
                              ? 'bg-white border-primary-200 hover:border-primary-400'
                              : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              disabled={!canSelect && !isSelected}
                              className="accent-primary-600"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-primary-800 truncate">
                                {doc.filename}
                              </div>
                              <div className="text-xs text-primary-500 mt-1">
                                {(doc.size / 1024).toFixed(1)}KB •{' '}
                                {doc.chunkCount} chunks •{' '}
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-primary-200 flex justify-between items-center">
              <div className="text-xs text-primary-500">
                <HardDrive size={12} className="inline mr-1" />
                Storage: {storageUsage.totalMB.toFixed(1)}/{storageUsage.maxMB}
                MB ({storageUsage.usedPercent.toFixed(0)}%)
              </div>
              <button
                onClick={() => setShowDocSelector(false)}
                className="px-4 py-2 bg-primary-800 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Permission Prompt Modal */}
      <LocationPrompt
        show={showLocationPrompt}
        isLoading={isLoadingLocation}
        error={locationError}
        canRetry={canRetry}
        retryCount={retryCount}
        onAllow={requestLocation}
        onRetry={retryLocation}
        onDeny={declineLocation}
        onManualEntry={() => {
          declineLocation();
          setShowManualLocation(true);
        }}
      />

      {/* Manual Location Entry Modal */}
      <ManualLocationInput
        show={showManualLocation}
        value={manualLocationInput}
        isLoading={isLoadingLocation}
        isDetecting={isLoadingLocation}
        error={locationError}
        onChange={setManualLocationInput}
        onSubmit={() => setManualLocation(manualLocationInput)}
        onSelectSuggestion={(suggestion) => {
          // Use direct location setting with coordinates (skips geocoding, fetches weather)
          setLocationFromSuggestion(suggestion);
        }}
        onAutoDetect={() => {
          // Close manual modal and trigger auto-detection
          setShowManualLocation(false);
          setManualLocationInput('');
          requestLocation();
        }}
        onCancel={() => {
          setShowManualLocation(false);
          setManualLocationInput('');
        }}
      />

      {/* Gogga Weather - Slides out from right edge */}
      <WeatherSlidePanel
        latitude={userLocation?.lat}
        longitude={userLocation?.lon}
        locationName={userLocation?.city || userLocation?.displayName}
        locationJustDetermined={locationJustDetermined}
        autoHideDelay={5000}
        externalLocation={externalWeatherLocation}
      />
    </div>
  );
}
