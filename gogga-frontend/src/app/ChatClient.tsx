'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { GoggaTalkButton, ScreenShareButton } from '@/components/GoggaTalkButton';
import { GoggaTalkTerminal } from '@/components/GoggaTalkTerminal';
import AdminPanel from '@/components/AdminPanel';
import PromptManager from '@/components/PromptManager';
import DocumentList from '@/components/DocumentList';
import ImageThumbnail from '@/components/ImageThumbnail';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { GoggaLogo, GoggaIcon, GoggaCricket } from '@/components/GoggaLogo';
import { GoggaSpinner } from '@/components/GoggaSpinner';
import IconGeneratorModal from '@/components/IconGeneratorModal';
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
import { useOptimisticMessages, type OptimisticMessage } from '@/hooks/useOptimisticMessages';
import { StreamingRAGPanel, RAGLoadingSkeleton } from '@/components/StreamingRAGPanel';
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
  FileText,
  Plus,
  History,
  Trash2,
  ImageOff,
  FolderOpen,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Hash,
  Terminal,
  Bug,
  Paperclip,
  Copy,
  Wrench,
  ArrowUpCircle,
  MessageSquare,
  Scale,
  Code,
  Languages,
  Check,
  Smile,
  MoreHorizontal,
  Settings,
  ChevronRight,
} from 'lucide-react';
import axios from 'axios';
import { useBuddySystem } from '@/hooks/useBuddySystem';
import { LanguageBadge } from '@/components/LanguageBadge';
import { WeatherSlidePanel, GoggaForecast } from '@/components/ChatComponents';
import { AccountMenu } from '@/components/AccountMenu';
import { ReportIssueModal } from '@/components/ReportIssueModal';
import { useConsoleCapture } from '@/hooks/useConsoleCapture';
import { ChatTerminal, type TerminalLog } from '@/components/ChatTerminal';
import type { SALanguage } from '@/lib/buddySystem';
import { ForcedToolBadge } from '@/components/toolshed';
import { useToolShed } from '@/lib/toolshedStore';
import { useDocumentStore } from '@/lib/documentStore';
import { ReadAloudButtonWrapper } from '@/components/ReadAloudButton';
import { RightSidePanel } from '@/components/RightSidePanel';
import { ExportModal, ExportButton } from '@/components/ExportModal';
import { useGoggaSmart } from '@/hooks/useGoggaSmart';
import { GoggaSmartButton, GoggaSmartModal, FeedbackButtons } from '@/components/GoggaSmartUI';
import { useRightPanel } from '@/hooks/useRightPanel';
import { 
  fetchWeatherForecast, 
  hasShownWeatherToday, 
  markWeatherShownToday,
  getWeatherComment,
  type WeatherForecast 
} from '@/lib/weatherService';

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

// Helper for daily weather greeting
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

interface ChatClientProps {
  userEmail: string | null;
  userTier: string;
  isTester?: boolean;
}

export function ChatClient({ userEmail, userTier, isTester = false }: ChatClientProps) {
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
  const [forceModel, setForceModel] = useState<'auto' | '32b' | '235b'>('auto'); // JIGGA model override
  const [historySelectMode, setHistorySelectMode] = useState(false); // Multi-select mode for history
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    new Set()
  ); // Selected sessions for bulk delete
  const [historySearch, setHistorySearch] = useState(''); // Search filter for chat history
  // Live terminal state for math tool execution
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [terminalActive, setTerminalActive] = useState(false);
  // GoggaTalk voice chat state
  const [goggaTalkVisible, setGoggaTalkVisible] = useState(false);
  const [toolsRunning, setToolsRunning] = useState<string[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreamingThinking, setIsStreamingThinking] = useState(false);
  // Store last GoggaSolve session to show in completed message
  const [lastGoggaSolveLogs, setLastGoggaSolveLogs] = useState<TerminalLog[]>(
    []
  );
  const [lastGoggaSolveThinking, setLastGoggaSolveThinking] = useState('');
  // Report issue modal state (testers only)
  const [showReportIssue, setShowReportIssue] = useState(false);
  // PDF export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  // Icon Studio modal state
  const [showIconStudio, setShowIconStudio] = useState(false);
  // Copy feedback state (tracks which message was just copied)
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  // AI Power dropdown state
  const [showAIPowerDropdown, setShowAIPowerDropdown] = useState(false);
  // Chat Options modal state (New/History/Export grouped)
  const [showChatOptionsModal, setShowChatOptionsModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // AbortController for streaming - cancels API calls on navigation/unmount
  // Synergy: Saves Cerebras API costs when user navigates away
  const abortControllerRef = useRef<AbortController | null>(null);

  // Console capture hook for debug reports (testers only)
  const { getCapture } = useConsoleCapture();

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
    // RAG Store (persistent, cross-session)
    ragStoreDocuments,
    uploadToRAGStore,
    removeFromRAGStore,
    clearRAGStore,
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
    promptLocation,
    setManualLocation,
    setLocationFromSuggestion,
    setManualLocationInput,
    setShowManualLocation,
    clearLocation,
    getLocationContext,
  } = useLocation(true); // Auto-prompt for location on first load

  // BuddySystem hook (language detection, relationship tracking, personality)
  const {
    profile,
    processMessage: processBuddyMessage,
    detectLanguage: detectMessageLanguage,
    getAIContext: getBuddyContext,
  } = useBuddySystem();

  // GoggaSmart hook (self-improving AI learning system)
  const {
    isEnabled: isGoggaSmartEnabled,
    isLoading: goggaSmartLoading,
    skills: goggaSmartSkills,
    stats: goggaSmartStats,
    promptContext: goggaSmartPrompt,
    applyFeedback: applyGoggaSmartFeedback,
    resetSkillbook: resetGoggaSmart,
    removeSkill: removeGoggaSmartSkill,
    getUsedSkillIds,
    setUsedSkillIds,
  } = useGoggaSmart({ tier });

  // State for GoggaSmart modal
  const [showGoggaSmartModal, setShowGoggaSmartModal] = useState(false);

  // ToolShed hook (tool forcing for JIVE/JIGGA)
  const { forcedTool, fetchTools, clearForcedTool } = useToolShed();

  // RightSidePanel hook (for triggering Tools/Docs/Weather panel)
  const { togglePanel: toggleRightPanel, isOpen: isRightPanelOpen, setActiveTab: setRightPanelTab } = useRightPanel();

  // Document store sync (for RightSidePanel)
  // Use selectors to get stable function references
  const syncDocumentState = useDocumentStore((state) => state.syncState);
  const setUploadHandler = useDocumentStore((state) => state.setUploadHandler);
  const setRemoveHandler = useDocumentStore((state) => state.setRemoveHandler);
  const setSelectHandler = useDocumentStore((state) => state.setSelectHandler);
  const setLoadAllHandler = useDocumentStore((state) => state.setLoadAllHandler);
  // RAG Store handlers
  const setRAGUploadHandler = useDocumentStore((state) => state.setRAGUploadHandler);
  const setRAGRemoveHandler = useDocumentStore((state) => state.setRAGRemoveHandler);
  const setClearAllRAGHandler = useDocumentStore((state) => state.setClearAllRAGHandler);
  const setSessionDocuments = useDocumentStore((state) => state.setSessionDocuments);
  const setRAGDocuments = useDocumentStore((state) => state.setRAGDocuments);
  // RAG Controls sync (for RightSidePanel to control)
  const storeSetRagMode = useDocumentStore((state) => state.setRagMode);
  const storeSetUseRAGForChat = useDocumentStore((state) => state.setUseRAGForChat);
  const storeRagMode = useDocumentStore((state) => state.ragMode);
  const storeUseRAGForChat = useDocumentStore((state) => state.useRAGForChat);

  // Fetch tools when tier changes or on mount for paid tiers
  useEffect(() => {
    if (tier === 'jive' || tier === 'jigga') {
      fetchTools(tier);
    }
  }, [tier, fetchTools]);

  // Sync RAG controls with store (bidirectional)
  // When local state changes, update store
  useEffect(() => {
    storeSetRagMode(ragMode);
  }, [ragMode, storeSetRagMode]);
  
  useEffect(() => {
    storeSetUseRAGForChat(useRAGContext);
  }, [useRAGContext, storeSetUseRAGForChat]);
  
  // When store changes (from RightSidePanel), update local state
  useEffect(() => {
    if (storeRagMode !== ragMode) {
      setRagMode(storeRagMode);
    }
  }, [storeRagMode, ragMode]);
  
  useEffect(() => {
    if (storeUseRAGForChat !== useRAGContext) {
      setUseRAGContext(storeUseRAGForChat);
    }
  }, [storeUseRAGForChat, useRAGContext]);

  // Sync RAG state with document store for RightSidePanel
  useEffect(() => {
    syncDocumentState({
      documents,
      selectedDocIds,
      allDocuments,
      isLoading: ragLoading,
      isEmbedding,
      storageUsage,
      tier,
      isRAGEnabled,
      canUpload,
      maxDocsPerSession: getMaxDocsPerSession(),
    });
    // Sync session vs RAG documents separately
    setSessionDocuments(documents);
    setRAGDocuments(ragStoreDocuments);
  }, [syncDocumentState, documents, selectedDocIds, allDocuments, ragLoading, isEmbedding, storageUsage, tier, isRAGEnabled, canUpload, getMaxDocsPerSession, setSessionDocuments, setRAGDocuments, ragStoreDocuments]);

  // Set up action handlers for document store
  useEffect(() => {
    // Session document handlers
    setUploadHandler(uploadDocument);
    setRemoveHandler(removeDocument);
    setSelectHandler(selectDocuments);
    setLoadAllHandler(loadAllDocuments);
    // RAG Store handlers
    setRAGUploadHandler(uploadToRAGStore);
    setRAGRemoveHandler(removeFromRAGStore);
    setClearAllRAGHandler(clearRAGStore);

    return () => {
      // Cleanup handlers on unmount
      setUploadHandler(null);
      setRemoveHandler(null);
      setSelectHandler(null);
      setLoadAllHandler(null);
      setRAGUploadHandler(null);
      setRAGRemoveHandler(null);
      setClearAllRAGHandler(null);
      // Synergy: Abort any in-flight streaming request to save API costs
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [setUploadHandler, setRemoveHandler, setSelectHandler, setLoadAllHandler, uploadDocument, removeDocument, selectDocuments, loadAllDocuments, setRAGUploadHandler, setRAGRemoveHandler, setClearAllRAGHandler, uploadToRAGStore, removeFromRAGStore, clearRAGStore]);

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

  // ═══ 7-Day Forecast Modal State ═══
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [forecastData, setForecastData] = useState<WeatherForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const dailyWeatherPromptShown = useRef(false);

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
  const baseMessages = isPersistenceEnabled ? messages : freeMessages;
  const currentSessionTitle = sessions.find((s) => s.id === chatSessionId)?.title;
  
  // Wrap with optimistic updates for instant UI feedback
  const {
    messages: displayMessages,
    addOptimisticMessage,
    markAsError,
  } = useOptimisticMessages(baseMessages as ChatMessage[]);

  // DEBUG: Log whenever displayMessages changes
  useEffect(() => {
    console.log('[GOGGA] displayMessages updated:', {
      count: displayMessages.length,
      isPersistenceEnabled,
      lastMessage: displayMessages[
        displayMessages.length - 1
      ]?.content?.substring(0, 50),
    });
  }, [displayMessages, isPersistenceEnabled]);

  // Load tier from localStorage, with session tier as fallback
  // localStorage is trusted because it can be updated via PayFast flow
  // before the session is refreshed
  useEffect(() => {
    const validTiers: Tier[] = ['free', 'jive', 'jigga'];
    const tierRank = { free: 0, jive: 1, jigga: 2 };
    
    // Get localStorage tier
    const rawTier = localStorage.getItem('gogga_tier');
    const localTier = rawTier?.trim().toLowerCase() as Tier | null;
    
    // Get session tier (normalized to lowercase)
    const sessionTier = userTier?.toLowerCase().trim() as Tier;
    
    // Use localStorage tier if valid, else use session tier
    if (localTier && validTiers.includes(localTier)) {
      // localStorage is set - use it if it's >= session tier
      // This handles the case where localStorage is updated by PayFast
      // before the session is refreshed
      if (!sessionTier || !validTiers.includes(sessionTier) ||
          tierRank[localTier] >= tierRank[sessionTier]) {
        setTier(localTier);
        console.log('[GOGGA] Using localStorage tier:', localTier);
      } else {
        // Session tier is higher - upgrade localStorage
        setTier(sessionTier);
        localStorage.setItem('gogga_tier', sessionTier);
        console.log('[GOGGA] Upgraded tier from session:', sessionTier);
      }
      // Fix corrupted value if it had whitespace
      if (rawTier !== localTier) {
        localStorage.setItem('gogga_tier', localTier);
        console.log('[GOGGA] Fixed corrupted tier value in localStorage');
      }
    } else if (sessionTier && validTiers.includes(sessionTier)) {
      // No valid localStorage tier - use session tier
      setTier(sessionTier);
      localStorage.setItem('gogga_tier', sessionTier);
      console.log('[GOGGA] Initialized tier from session:', sessionTier);
    } else if (rawTier) {
      // Invalid tier value - reset to free
      setTier('free');
      localStorage.setItem('gogga_tier', 'free');
      console.log('[GOGGA] Reset invalid tier value to free');
    }
  }, [userTier]);

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

  // ═══ 7-Day Forecast Handlers ═══
  const loadForecast = useCallback(async () => {
    if (!userLocation?.lat || !userLocation?.lon) {
      setForecastError('Location not available. Please set your location first.');
      return;
    }
    
    setForecastLoading(true);
    setForecastError(null);
    
    try {
      const forecast = await fetchWeatherForecast(
        userLocation.lat,
        userLocation.lon
      );
      setForecastData(forecast);
    } catch (err) {
      console.error('[ChatClient] Failed to load forecast:', err);
      setForecastError(err instanceof Error ? err.message : 'Failed to load weather');
    } finally {
      setForecastLoading(false);
    }
  }, [userLocation?.lat, userLocation?.lon]);

  const handleShowForecast = useCallback(() => {
    setShowForecastModal(true);
    loadForecast();
  }, [loadForecast]);

  const handleRefreshForecast = useCallback(() => {
    loadForecast();
  }, [loadForecast]);

  // ═══ Daily Weather Prompt (once per day on first app use) ═══
  useEffect(() => {
    // Only trigger once, only if we have location, only if not already shown today
    if (
      dailyWeatherPromptShown.current ||
      !userLocation?.lat ||
      !userLocation?.lon ||
      hasShownWeatherToday()
    ) {
      return;
    }

    // Mark as triggered (even if it fails, we don't want to spam)
    dailyWeatherPromptShown.current = true;

    // Delay slightly to let the app settle
    const timer = setTimeout(async () => {
      try {
        const forecast = await fetchWeatherForecast(
          userLocation.lat,
          userLocation.lon
        );
        
        // Mark as shown today
        markWeatherShownToday();
        
        // Get a funny comment
        const comment = getWeatherComment(forecast);
        const location = forecast.location;
        const current = forecast.current;
        
        // Create a Gogga weather greeting message
        const weatherGreeting = `☀️ **Good ${getTimeOfDay()}, ek het jou ${location.name} weer gekry!**

${comment}

🌡️ **${Math.round(current.temp_c)}°C** (feels like ${Math.round(current.feelslike_c)}°C) — ${current.condition.text}
💨 Wind: ${Math.round(current.wind_kph)} km/h ${current.wind_dir} | 💧 Humidity: ${current.humidity}%

*Tap the location button → "7-Day Forecast" for the full week!*`;
        
        // Add as a Gogga assistant message
        const weatherMsg: ChatMessage = {
          role: 'assistant',
          content: weatherGreeting,
        };
        
        if (isPersistenceEnabled) {
          await addMessage(weatherMsg);
        } else {
          setFreeMessages(prev => [...prev, {
            id: Date.now(),
            role: 'assistant' as const,
            content: weatherGreeting,
            timestamp: new Date().toISOString(),
          }]);
        }
      } catch (err) {
        console.warn('[ChatClient] Failed to load daily weather:', err);
        // Don't show error to user, just skip the weather greeting
      }
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.lat, userLocation?.lon, isPersistenceEnabled]);

  // Auto-scroll to bottom only when message count changes
  const prevMessageCountRef = useRef(displayMessages.length);
  useEffect(() => {
    // Only scroll if message count changed (new message added)
    // Skip if user is focused on input to prevent scroll during typing
    const messageCountChanged = prevMessageCountRef.current !== displayMessages.length;
    const isInputFocused = document.activeElement === textareaRef.current;
    
    if (scrollRef.current && messageCountChanged && !isInputFocused) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = displayMessages.length;
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
      // Pass authoritative mode to getContext - formatting is handled in ragManager
      ragContext = await getContext(text, { authoritative: ragMode === 'authoritative' });
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

    // Persist user message immediately (no optimistic - causes duplicates)
    try {
      if (isPersistenceEnabled) {
        await addMessage(userMsg);
      } else {
        setFreeMessages((prev) => [...prev, userMsg]);
      }
    } catch (error) {
      console.error('[GOGGA] Failed to persist user message:', error);
      // Show error to user
      alert('Failed to save message. Please try again.');
      return;
    }

    setInput('');
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
    }
    setIsLoading(true);

    // Note: No optimistic bot placeholder - we use isLoading state instead
    // This prevents the stuck "thinking" indicators that were appearing

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

      // Add GoggaSmart context (learned skills and preferences)
      if (goggaSmartPrompt) {
        console.log(
          '[GOGGA] GoggaSmart context found:',
          goggaSmartPrompt.slice(0, 200) + '...'
        );
        messageToSend = `${goggaSmartPrompt}\n\n---\n\n${messageToSend}`;
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

      // Detect language from user message for backend routing
      const langDetection = detectMessageLanguage(text);
      console.log('[GOGGA] Language detection:', langDetection.language, 'confidence:', langDetection.confidence);

      const requestPayload = {
        message: messageToSend,
        user_id: userEmail || 'anonymous',
        user_tier: tier.trim().toLowerCase(),
        history: historyForAPI.length > 0 ? historyForAPI : undefined,
        force_layer:
          tier === 'jigga' && forceModel !== 'auto' ? forceModel : undefined,
        force_tool: forcedTool?.tool.name || undefined, // ToolShed: Force specific tool
        // GOGGA Voice: Personality and language for authentic SA experience
        personality_mode: profile?.personalityMode || 'goody',
        detected_language: langDetection.language,
      };
      console.log('[GOGGA] Request payload:', JSON.stringify(requestPayload));
      console.log('[GOGGA] History messages:', historyForAPI.length);
      console.log('[GOGGA] Personality mode:', profile?.personalityMode || 'goody');
      if (forcedTool) {
        console.log('[GOGGA] Forced tool:', forcedTool.tool.name);
      }

      let data: {
        response: string;
        thinking?: string;
        tool_calls?: ToolCall[];
        meta?: Record<string, unknown>;
        weather_panel?: { lat: number; lon: number; name: string };
      };

      // Use SSE streaming for JIVE/JIGGA tiers (live tool execution logs)
      if (tier === 'jive' || tier === 'jigga') {
        // Clear terminal state - only activate when tools actually start
        setTerminalLogs([]);
        setTerminalActive(false);
        setToolsRunning([]);
        setToolCount(0);
        setStreamingThinking('');
        setIsStreamingThinking(false);

        // Use relative URL to proxy through Next.js API route (avoids CORS/mixed content)
        // Create AbortController for this request - enables cancellation on navigation
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;
        
        const sseResponse = await fetch(
          `/api/v1/chat/stream-with-tools`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal, // Synergy: cacheSignal-like abort propagation
          }
        );

        if (!sseResponse.ok) {
          throw new Error(
            `HTTP ${sseResponse.status}: ${sseResponse.statusText}`
          );
        }

        const reader = sseResponse.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';
        let accumulatedThinking = '';
        let responseMeta: Record<string, unknown> = {};
        let collectedLogs: TerminalLog[] = [];
        let collectedToolCalls: ToolCall[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              // Guard against malformed JSON in SSE data
              const jsonData = line.slice(6);
              if (!jsonData.trim() || jsonData.trim() === '') continue;
              
              const eventData = JSON.parse(jsonData);
              
              // Guard against undefined eventData.type
              if (!eventData || typeof eventData.type !== 'string') {
                console.warn('[GOGGA] SSE received event without type:', eventData);
                continue;
              }

              switch (eventData.type) {
                case 'meta':
                  responseMeta = {
                    ...responseMeta,
                    tier: eventData.tier,
                    layer: eventData.layer,
                    model: eventData.model,
                    // Capture detected_language from initial meta event
                    ...(eventData.detected_language
                      ? { detected_language: eventData.detected_language }
                      : {}),
                  };
                  break;

                case 'tool_start':
                  // Only activate terminal when tools actually start
                  setTerminalActive(true);
                  setToolsRunning(eventData.tools || []);
                  const startLog = {
                    level: 'info' as const,
                    message: `[>] Starting: ${(eventData.tools || []).join(
                      ', '
                    )}`,
                  };
                  collectedLogs.push(startLog);
                  setTerminalLogs((prev) => [...prev, startLog]);
                  break;

                case 'tool_log':
                  const toolLog = {
                    level: (eventData.level || 'info') as TerminalLog['level'],
                    message: eventData.message,
                    icon: eventData.icon,
                  };
                  collectedLogs.push(toolLog);
                  setTerminalLogs((prev) => [...prev, toolLog]);
                  break;

                case 'tool_complete':
                  setToolsRunning([]);
                  setToolCount(eventData.count || 0);
                  const completeLog = {
                    level: 'success' as const,
                    message: `[+] ${eventData.count || 1
                      } calculation(s) completed`,
                  };
                  collectedLogs.push(completeLog);
                  setTerminalLogs((prev) => [...prev, completeLog]);
                  break;

                case 'thinking_start':
                  setIsStreamingThinking(true);
                  break;

                case 'thinking':
                  accumulatedThinking += eventData.content || '';
                  setStreamingThinking(accumulatedThinking);
                  break;

                case 'thinking_end':
                  setIsStreamingThinking(false);
                  break;

                case 'content':
                  accumulatedContent += eventData.content || '';
                  // Check for reasoning tags in content (think, thinking, reflection, plan)
                  const reasoningOpenTags = ['<think>', '<thinking>', '<reflection>', '<plan>'];
                  const reasoningCloseTags = ['</think>', '</thinking>', '</reflection>', '</plan>'];
                  const hasOpenTag = reasoningOpenTags.some(tag => accumulatedContent.includes(tag));
                  const hasCloseTag = reasoningCloseTags.some(tag => accumulatedContent.includes(tag));
                  
                  if (hasOpenTag && !isStreamingThinking) {
                    setIsStreamingThinking(true);
                  }
                  if (hasCloseTag && isStreamingThinking) {
                    setIsStreamingThinking(false);
                    // Extract all reasoning sections from content
                    const thinkingPatterns = [
                      /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi,
                      /<reflection>([\s\S]*?)<\/reflection>/gi,
                      /<plan>([\s\S]*?)<\/plan>/gi,
                    ];
                    let extractedThinking = '';
                    for (const pattern of thinkingPatterns) {
                      const matches = accumulatedContent.matchAll(pattern);
                      for (const match of matches) {
                        extractedThinking += (match[1] || '') + '\n\n';
                      }
                    }
                    if (extractedThinking.trim()) {
                      accumulatedThinking = extractedThinking.trim();
                      setStreamingThinking(accumulatedThinking);
                    }
                  }
                  break;

                case 'done':
                  responseMeta = {
                    ...responseMeta,
                    latency_seconds: eventData.latency,
                    math_tools_executed: eventData.math_tools_executed,
                    math_tool_count: eventData.math_tool_count,
                    cost_zar: eventData.cost,
                    tokens: eventData.tokens,
                    // Capture detected_language from SSE stream
                    ...(eventData.detected_language
                      ? { detected_language: eventData.detected_language }
                      : {}),
                  };
                  // Capture any tool calls (charts, images) for frontend execution
                  if (
                    eventData.tool_calls &&
                    Array.isArray(eventData.tool_calls)
                  ) {
                    console.log(
                      '[GOGGA] SSE received tool_calls:',
                      eventData.tool_calls
                    );
                    collectedToolCalls = eventData.tool_calls;
                  }
                  // Add final log
                  const doneLog = {
                    level: 'success' as const,
                    message: `[+] Response complete (${eventData.latency?.toFixed(2) || '?'
                      }s)`,
                  };
                  collectedLogs.push(doneLog);
                  setTerminalLogs((prev) => [...prev, doneLog]);
                  break;

                case 'error':
                  // Log the full error for debugging
                  console.error('[GOGGA] SSE stream error event:', eventData);
                  throw new Error(eventData.message || eventData.error || 'Stream error');
                  
                default:
                  // Log unknown event types for debugging but don't crash
                  console.debug('[GOGGA] SSE unknown event type:', eventData.type, eventData);
                  break;
              }
            } catch (parseError) {
              // Distinguish between JSON parse errors and thrown errors
              const error = parseError as Error;
              const isStreamError = error.message === 'Stream error' || 
                                    error.message?.includes('Stream error');
              
              if (isStreamError) {
                // This was a deliberate error from the 'error' case above
                throw parseError;
              }
              
              // JSON parse error or other issue - log and continue
              if (error instanceof SyntaxError) {
                // JSON parsing failed - likely incomplete chunk, skip silently
                continue;
              }
              
              // Unexpected error - log but don't crash
              console.warn('[GOGGA] SSE parse warning:', error.message);
              continue;
            }
          }
        }

        // Deactivate terminal but preserve logs for display
        setTerminalActive(false);
        setIsStreamingThinking(false);
        // Save logs and thinking for the message
        setLastGoggaSolveLogs(collectedLogs);
        setLastGoggaSolveThinking(accumulatedThinking);

        // Clean all reasoning/thinking tags from content - handle all OptiLLM/CePO variations
        let cleanContent = accumulatedContent
          // Complete blocks for all reasoning tag types
          .replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, '')
          .replace(/<reflection>([\s\S]*?)<\/reflection>/gi, '')
          .replace(/<plan>([\s\S]*?)<\/plan>/gi, '')
          .replace(/<output>([\s\S]*?)<\/output>/gi, (_, content) => content) // Keep output content, remove tags
          // Unclosed tags at end
          .replace(/<think(?:ing)?>([\s\S]*)$/gi, '')
          .replace(/<reflection>([\s\S]*)$/gi, '')
          .replace(/<plan>([\s\S]*)$/gi, '')
          // Orphaned closing tags
          .replace(/<\/think(?:ing)?>/gi, '')
          .replace(/<\/reflection>/gi, '')
          .replace(/<\/plan>/gi, '')
          .replace(/<\/output>/gi, '')
          // Orphaned opening tags
          .replace(/<think(?:ing)?>/gi, '')
          .replace(/<reflection>/gi, '')
          .replace(/<plan>/gi, '')
          .replace(/<output>/gi, '')
          .trim();

        // DEBUG: Log what we accumulated vs what we cleaned
        console.log('[GOGGA] SSE accumulated content:', {
          rawLength: accumulatedContent.length,
          cleanedLength: cleanContent.length,
          rawPreview: accumulatedContent.substring(0, 200),
          cleanedPreview: cleanContent.substring(0, 200),
          hasThinkTags: accumulatedContent.includes('<think'),
        });

        // CRITICAL FIX: Frontend fallback for empty responses
        // If the backend returned empty content (due to bugs or model issues),
        // provide a user-friendly fallback instead of showing a blank message
        if (!cleanContent || cleanContent.trim() === '') {
          console.warn('[GOGGA] Empty response from backend - applying fallback');
          cleanContent = "I apologize, but I couldn't generate a response. Please try again or rephrase your question. If this persists, try simplifying your request.";
        }

        data = {
          response: cleanContent,
          ...(accumulatedThinking ? { thinking: accumulatedThinking } : {}),
          meta: responseMeta,
          ...(collectedToolCalls.length > 0
            ? { tool_calls: collectedToolCalls }
            : {}),
        };

        console.log('[GOGGA] SSE stream complete:', {
          responseLength: cleanContent.length,
          hasThinking: !!accumulatedThinking,
          logsCount: collectedLogs.length,
          toolCallsCount: collectedToolCalls.length,
          meta: responseMeta,
        });
      } else {
        // FREE tier: use standard axios POST
        const response = await axios.post('/api/v1/chat', requestPayload);
        data = response.data;
      }

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
      if (data.meta?.tokens && typeof data.meta.tokens === 'object') {
        const tokens = data.meta.tokens as { input?: number; output?: number };
        const inputTokens = tokens.input || 0;
        const outputTokens = tokens.output || 0;
        const costZar = (data.meta.cost_zar as number) || 0;
        await trackTokens(tier, inputTokens, outputTokens, costZar);
      }

      let botMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        ...(data.thinking ? { thinking: data.thinking } : {}), // JIGGA thinking block
        meta: {
          ...(data.meta?.cost_zar !== undefined
            ? { cost_zar: data.meta.cost_zar as number }
            : {}),
          ...(data.meta?.model_used || data.meta?.model
            ? { model: (data.meta.model_used || data.meta.model) as string }
            : {}),
          ...(data.meta?.layer
            ? {
                layer: data.meta.layer as
                  | 'speed'
                  | 'complex'
                  | 'free_text'
                  | 'jive_speed'
                  | 'jive_reasoning'
                  | 'jigga_think'
                  | 'jigga_fast'
                  | 'jigga_multilingual'
                  | 'reasoning',
              }
            : {}),
          ...(data.meta?.latency_seconds !== undefined
            ? { latency_seconds: data.meta.latency_seconds as number }
            : {}),
          ...(data.meta?.tier
            ? {
                tier: data.meta.tier as
                  | 'FREE'
                  | 'JIVE'
                  | 'JIGGA'
                  | 'free'
                  | 'jive'
                  | 'jigga',
              }
            : {}),
          ...(data.meta?.provider ? { provider: data.meta.provider as string } : {}),
          rag_context: !!ragContext,
          memory_context: !!memoryContext, // Long-term memory was used
          buddy_context: !!buddyContext, // BuddySystem profile was used
          location_context: !!locationContext, // Location was included
          ...(data.meta?.has_thinking !== undefined || data.thinking
            ? { has_thinking: (data.meta?.has_thinking as boolean) || !!data.thinking }
            : {}),
          timestamp: new Date().toISOString(), // Response timestamp
          // Server-detected language (more accurate than client-side)
          ...(data.meta?.detected_language
            ? { detected_language: data.meta.detected_language as { code: string; name: string; confidence: number; is_hybrid: boolean; family: string } }
            : {}),
          // Math tools executed on backend
          ...(data.meta?.math_tools_executed
            ? { math_tools_executed: data.meta.math_tools_executed as string[] }
            : {}),
          ...(data.meta?.math_tool_count !== undefined
            ? { math_tool_count: data.meta.math_tool_count as number }
            : {}),
        },
        // NOTE: Server detected_language is for the USER's input, not the response
        // Don't apply it to assistant message - the badge would be misleading
        // The server uses this to know what language to respond in, not to label the response
      };

      // Handle tool calls if present (JIGGA tier only)
      // IMPORTANT: We need to work with a mutable copy of botMsg because state updates
      // may freeze the original object (Immer/React). Create a deep clone for tool handling.
      // Use JSON parse/stringify to ensure we get a fully mutable object (structuredClone 
      // might not be available in all environments, and spread might preserve frozen state)
      let mutableBotMsg: typeof botMsg = JSON.parse(JSON.stringify(botMsg));
      
      if (
        data.tool_calls &&
        Array.isArray(data.tool_calls) &&
        data.tool_calls.length > 0
      ) {
        console.log('[GOGGA] Tool calls received (raw):', data.tool_calls);

        try {
          // Normalize tool calls - backend may send {function: {name, arguments}, id}
          // but toolHandler expects {name, arguments, id}
          const normalizedToolCalls: ToolCall[] = data.tool_calls.map(
            (tc: {
              function?: { name?: string; arguments?: Record<string, unknown> };
              name?: string;
              arguments?: Record<string, unknown>;
              id: string;
            }) => ({
              id: tc.id,
              name: tc.function?.name || tc.name || 'unknown',
              arguments: tc.function?.arguments || tc.arguments || {},
            })
          );
          console.log('[GOGGA] Tool calls normalized:', normalizedToolCalls);

          // Check if this is an image generation tool call
          const hasImageTool = normalizedToolCalls.some(
            (tc) => tc.name === 'generate_image'
          );

          // Add temporary "painting" message for image generation
          // Use a separate temp object to avoid state freezing issues
          if (hasImageTool && mutableBotMsg.content) {
            const tempMsg = { 
              ...mutableBotMsg, 
              content: mutableBotMsg.content + '\n\n*🎨 GOGGA is painting your image...*',
              meta: { ...mutableBotMsg.meta }
            };
            if (isPersistenceEnabled) {
              await addMessage(tempMsg);
            } else {
              setFreeMessages((prev) => [...prev, tempMsg]);
            }
          }

          // Execute the tool calls on the frontend
          // Use `tier` (localStorage state) for consistency with chat API requests
          // This ensures the same tier is used for both the chat and tool execution
          const toolResults = await executeToolCalls(normalizedToolCalls, tier);
          console.log('[GOGGA] Tool results:', toolResults);

          // Add tool execution info to the message (no label for images)
          const toolSummary = formatToolResultsMessage(toolResults);
          if (toolSummary) {
            // Check if result contains images (no prefix) or memory operations (add prefix)
            const hasImages = toolSummary.includes('![Generated Image');
            const prefix = ''; // No prefix - results speak for themselves

            // Append tool results to the response - modify our mutable copy
            mutableBotMsg.content = mutableBotMsg.content
              ? `${mutableBotMsg.content}\n\n---\n${prefix}${toolSummary}`
              : toolSummary;
          }

          // Mark that tools were executed on our mutable copy
          mutableBotMsg.meta = { ...mutableBotMsg.meta, tools_executed: true };
        } catch (toolError) {
          console.error('[GOGGA] Tool execution failed:', toolError);
        }
      }
      
      // Use the mutable copy for the rest of the function
      botMsg = mutableBotMsg;

      // Auto-inject contextual images for long CePO/Qwen responses
      // Only for informal educational content, every 2nd-3rd response
      if (data.meta?.layer && (tier === 'jive' || tier === 'jigga')) {
        const { processResponseForImages } = await import(
          '@/lib/autoImageInjector'
        );
        const responseCount =
          displayMessages.filter((m) => m.role === 'assistant').length + 1;
        botMsg.content = processResponseForImages(
          botMsg.content,
          text,
          tier,
          data.meta.layer as string,
          responseCount
        );
      }

      // DEBUG: Log the bot message before saving
      console.log('[GOGGA] About to save botMsg:', {
        role: botMsg.role,
        contentLength: botMsg.content?.length,
        contentPreview: botMsg.content?.substring(0, 100),
        hasContent: !!botMsg.content,
          ...(data.meta?.cost_zar !== undefined
            ? { cost_zar: data.meta.cost_zar as number }
            : {}),
          ...(data.meta?.model_used || data.meta?.model
            ? { model: (data.meta.model_used || data.meta.model) as string }
            : {}),
          ...(data.meta?.layer
            ? {
                layer: data.meta.layer as
                  | 'speed'
                  | 'complex'
                  | 'free_text'
                  | 'jive_speed'
                  | 'jive_reasoning'
                  | 'jigga_think'
                  | 'jigga_fast'
                  | 'jigga_multilingual'
                  | 'reasoning',
              }
            : {}),
          ...(data.meta?.provider ? { provider: data.meta.provider as string } : {}),
          rag_context: !!ragContext,
          memory_context: !!memoryContext, // Long-term memory was used
          buddy_context: !!buddyContext, // BuddySystem profile was used
          location_context: !!locationContext, // Location was included
          ...(data.meta?.has_thinking !== undefined || data.thinking
            ? { has_thinking: (data.meta?.has_thinking as boolean) || !!data.thinking }
            : {}),
          timestamp: new Date().toISOString(), // Response timestamp
          // Math tools executed on backend
          ...(data.meta?.math_tools_executed
            ? { math_tools_executed: data.meta.math_tools_executed as string[] }
            : {}),
          ...(data.meta?.math_tool_count !== undefined
            ? { math_tool_count: data.meta.math_tool_count as number }
            : {}),
      });

      // Set thinking content for display in ChatTerminal (for non-streaming CePO responses)
      if (data.thinking) {
        setLastGoggaSolveThinking(data.thinking);
      }

      // Save bot message to persistence
      if (isPersistenceEnabled) {
        await addMessage(botMsg);
      } else {
        setFreeMessages((prev) => [...prev, botMsg]);
      }
    } catch (error: any) {
      // Synergy: Gracefully handle abort (user navigated away)
      if (error?.name === 'AbortError') {
        console.log('[GOGGA] Request aborted - user navigated away, API cost saved');
        return; // Don't show error message for intentional abort
      }
      
      const { response, message } = error;
      const errorMessage = `Eish! Something went wrong: ${response?.data?.detail || message}`;
      
      // Persist error message so user sees what happened
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: errorMessage,
      };
      
      try {
        if (isPersistenceEnabled) {
          await addMessage(errorMsg);
        } else {
          setFreeMessages((prev) => [...prev, errorMsg]);
        }
      } catch (persistError) {
        console.error('[GOGGA] Failed to persist error message:', persistError);
      }
      
      console.log('[GOGGA] Error response saved:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudio = (audioBlob: Blob) => {
    console.log('Audio recorded:', audioBlob.size, 'bytes');
    alert('Audio Captured! Transcription coming soon.');
  };

  const enhancePrompt = async () => {
    if (!input.trim()) return;

    setIsEnhancing(true);
    try {
      const response = await axios.post('/api/v1/chat/enhance', {
        prompt: input,
        user_id: userEmail || 'anonymous',
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

    // Persist user message immediately (no optimistic - causes duplicates)
    try {
      if (isPersistenceEnabled) {
        await addMessage(userMsg);
      } else {
        setFreeMessages((prev) => [...prev, userMsg]);
      }
    } catch (error) {
      console.error('[GOGGA] Failed to persist image request:', error);
      alert('Failed to save message. Please try again.');
      setIsGeneratingImage(false);
      return;
    }
    
    setInput('');

    // Note: No optimistic placeholder - isGeneratingImage state shows loading

    try {
      const response = await axios.post('/api/v1/images/generate', {
        prompt: originalPrompt,
        user_id: userEmail || 'anonymous',
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
        content: data.response,
        ...(data.thinking ? { thinking: data.thinking } : {}), // JIGGA thinking block
        meta: {
          ...(data.meta?.cost_zar !== undefined
            ? { cost_zar: data.meta.cost_zar as number }
            : {}),
          ...(data.meta?.model_used || data.meta?.model
            ? { model: (data.meta.model_used || data.meta.model) as string }
            : {}),
          ...(data.meta?.layer
            ? {
                layer: data.meta.layer as
                  | 'speed'
                  | 'complex'
                  | 'free_text'
                  | 'jive_speed'
                  | 'jive_reasoning'
                  | 'jigga_think'
                  | 'jigga_fast'
                  | 'jigga_multilingual'
                  | 'reasoning',
              }
            : {}),
          ...(data.meta?.provider ? { provider: data.meta.provider as string } : {}),
          ...(data.meta?.latency_seconds !== undefined
            ? { latency_seconds: data.meta.latency_seconds as number }
            : {}),
          ...(data.meta?.tier
            ? {
                tier: data.meta.tier as
                  | 'FREE'
                  | 'JIVE'
                  | 'JIGGA'
                  | 'free'
                  | 'jive'
                  | 'jigga',
              }
            : {}),
          ...(data.meta?.has_thinking !== undefined || data.thinking
            ? { has_thinking: (data.meta?.has_thinking as boolean) || !!data.thinking }
            : {}),
          ...(data.meta?.math_tools_executed
            ? { math_tools_executed: data.meta.math_tools_executed as string[] }
            : {}),
          ...(data.meta?.math_tool_count !== undefined
            ? { math_tool_count: data.meta.math_tool_count as number }
            : {}),
          timestamp: new Date().toISOString(), // Response timestamp
        },
      };
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
    // Reset input and textarea height
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    await softDeleteImage(imageId);
  };

  const handleOpenDocSelector = async () => {
    await loadAllDocuments();
    setShowDocSelector(true);
  };

  const handleSelectDoc = async (docId: string) => {
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
  const renderMessageContent = (msg: OptimisticMessage, messageIndex: number) => {
    const isUser = msg.role === 'user';

    // Show pending indicator for optimistic messages
    if (msg.isPending) {
      return (
        <div className="flex items-center gap-2 text-neutral-400">
          <GoggaSpinner size="sm" />
          <span className="text-sm">
            {msg.role === 'assistant' ? 'GOGGA is thinking...' : 'Sending...'}
          </span>
        </div>
      );
    }

    // Show error state for failed messages
    if (msg.isError) {
      return (
        <div className="text-red-500">
          <p className="font-medium">Error</p>
          <p className="text-sm">{msg.errorMessage || 'Something went wrong'}</p>
        </div>
      );
    }

    // Extract thinking from message - either from dedicated field or from content
    let thinkingContent = msg.thinking || '';
    let mainContent = msg.content;

    // If no thinking field, try to extract from content (fallback)
    if (!thinkingContent && msg.content) {
      const thinkMatch = msg.content.match(
        /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/i
      );
      if (thinkMatch) {
        thinkingContent = thinkMatch[1]?.trim() || '';
      }
    }

    // Always strip think tags from main content (handles all variations)
    mainContent = msg.content
      .replace(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi, '')
      .replace(/<think(?:ing)?>([\s\S]*)$/gi, '') // Unclosed tags
      .replace(/<\/think(?:ing)?>/gi, '') // Orphaned closing tags
      .replace(/<think(?:ing)?>/gi, '') // Orphaned opening tags
      .trim();

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

    // Check for tool-generated images (Pollinations + AI Horde)
    if (msg.content.includes('__TOOL_IMAGES__:')) {
      const ToolImageThumbnail =
        require('@/components/ToolImageThumbnail').default;
      const parts = msg.content.split('__TOOL_IMAGES__:');
      const elements: React.ReactNode[] = [];

      parts.forEach((part, idx) => {
        if (idx === 0 && part.trim()) {
          // Text before first image marker
          elements.push(
            <MarkdownRenderer
              key={`text-${idx}`}
              content={part.trim()}
              variant={isUser ? 'user' : 'assistant'}
            />
          );
        } else if (idx > 0) {
          // Parse image JSON and remaining text
          const newlineIdx = part.indexOf('\n');
          const jsonStr = newlineIdx > 0 ? part.slice(0, newlineIdx) : part;
          const textAfter =
            newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : '';

          try {
            const imageData = JSON.parse(jsonStr);
            elements.push(
              <div key={`images-${idx}`} className="flex flex-wrap gap-2 my-2">
                {imageData.urls.map((url: string, i: number) => (
                  <ToolImageThumbnail
                    key={url}
                    imageUrl={url}
                    prompt={imageData.prompt}
                    provider={imageData.providers?.[i]}
                  />
                ))}
              </div>
            );
          } catch {
            // Fallback: show as markdown
            elements.push(
              <MarkdownRenderer
                key={`fallback-${idx}`}
                content={part}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }

          if (textAfter) {
            elements.push(
              <MarkdownRenderer
                key={`textafter-${idx}`}
                content={textAfter}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }
        }
      });

      return <div>{elements}</div>;
    }

    // Check for tool-generated charts (both __TOOL_CHART__: and TOOL_CHART: formats)
    if (
      msg.content.includes('__TOOL_CHART__:') ||
      msg.content.includes('TOOL_CHART:')
    ) {
      const ChartRenderer = require('@/components/ChartRenderer').default;
      // Normalize both formats to split properly
      const normalizedContent = msg.content.replace(
        /TOOL_CHART:/g,
        '__TOOL_CHART__:'
      );
      const parts = normalizedContent.split('__TOOL_CHART__:');
      const elements: React.ReactNode[] = [];

      parts.forEach((part, idx) => {
        if (idx === 0 && part.trim()) {
          // Text before first chart marker
          elements.push(
            <MarkdownRenderer
              key={`text-${idx}`}
              content={part.trim()}
              variant={isUser ? 'user' : 'assistant'}
            />
          );
        } else if (idx > 0) {
          // Parse chart JSON and remaining text
          const newlineIdx = part.indexOf('\n');
          const jsonStr = newlineIdx > 0 ? part.slice(0, newlineIdx) : part;
          const textAfter =
            newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : '';

          try {
            const chartData = JSON.parse(jsonStr);
            elements.push(
              <div key={`chart-${idx}`} className="my-3">
                <ChartRenderer chartData={chartData} />
              </div>
            );
          } catch {
            // Fallback: show as markdown
            elements.push(
              <MarkdownRenderer
                key={`fallback-${idx}`}
                content={part}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }

          if (textAfter) {
            elements.push(
              <MarkdownRenderer
                key={`textafter-${idx}`}
                content={textAfter}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }
        }
      });

      return <div>{elements}</div>;
    }

    // Check for tool-generated math results
    if (msg.content.includes('__TOOL_MATH__:')) {
      const MathResultDisplay =
        require('@/components/display/MathResultDisplay').default;
      const parts = msg.content.split('__TOOL_MATH__:');
      const elements: React.ReactNode[] = [];

      parts.forEach((part, idx) => {
        if (idx === 0 && part.trim()) {
          // Text before first math marker
          elements.push(
            <MarkdownRenderer
              key={`text-${idx}`}
              content={part.trim()}
              variant={isUser ? 'user' : 'assistant'}
            />
          );
        } else if (idx > 0) {
          // Parse math JSON and remaining text
          const newlineIdx = part.indexOf('\n');
          const jsonStr = newlineIdx > 0 ? part.slice(0, newlineIdx) : part;
          const textAfter =
            newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : '';

          try {
            const mathData = JSON.parse(jsonStr);
            elements.push(
              <div key={`math-${idx}`} className="my-3">
                <MathResultDisplay result={mathData} />
              </div>
            );
          } catch {
            // Fallback: show as markdown
            elements.push(
              <MarkdownRenderer
                key={`fallback-${idx}`}
                content={part}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }

          if (textAfter) {
            elements.push(
              <MarkdownRenderer
                key={`textafter-${idx}`}
                content={textAfter}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }
        }
      });

      return <div>{elements}</div>;
    }

    // Check for tool-generated video results
    if (msg.content.includes('__TOOL_VIDEO__:')) {
      const parts = msg.content.split('__TOOL_VIDEO__:');
      const elements: React.ReactNode[] = [];

      parts.forEach((part, idx) => {
        if (idx === 0 && part.trim()) {
          elements.push(
            <MarkdownRenderer
              key={`text-${idx}`}
              content={part.trim()}
              variant={isUser ? 'user' : 'assistant'}
            />
          );
        } else if (idx > 0) {
          const newlineIdx = part.indexOf('\n');
          const jsonStr = newlineIdx > 0 ? part.slice(0, newlineIdx) : part;
          const textAfter =
            newlineIdx > 0 ? part.slice(newlineIdx + 1).trim() : '';

          try {
            const videoData = JSON.parse(jsonStr);
            elements.push(
              <div key={`video-${idx}`} className="my-3 p-4 bg-primary-50 rounded-xl border border-primary-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 bg-primary-200 rounded-full flex items-center justify-center">
                    🎬
                  </div>
                  <div>
                    <div className="font-bold text-primary-900">Video Generation</div>
                    <div className="text-sm text-primary-600">
                      {videoData.status === 'pending' || videoData.status === 'processing'
                        ? 'Processing... This takes 30-60 seconds'
                        : videoData.status === 'completed'
                        ? 'Ready to play'
                        : videoData.status === 'failed'
                        ? 'Generation failed'
                        : videoData.message || 'Status unknown'}
                    </div>
                  </div>
                </div>
                {videoData.video_url && (
                  <video
                    src={videoData.video_url}
                    controls
                    className="w-full max-w-lg rounded-lg shadow-md"
                    style={{ maxHeight: '400px' }}
                  />
                )}
                {videoData.status === 'failed' && videoData.message && (
                  <div className="mt-2 text-sm text-red-600">{videoData.message}</div>
                )}
                {videoData.job_id && videoData.status !== 'completed' && videoData.status !== 'failed' && (
                  <div className="mt-2 text-xs text-primary-400">Job ID: {videoData.job_id}</div>
                )}
              </div>
            );
          } catch {
            elements.push(
              <MarkdownRenderer
                key={`fallback-${idx}`}
                content={part}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }

          if (textAfter) {
            elements.push(
              <MarkdownRenderer
                key={`textafter-${idx}`}
                content={textAfter}
                variant={isUser ? 'user' : 'assistant'}
              />
            );
          }
        }
      });

      return <div>{elements}</div>;
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-300 font-medium">
                South African AI
              </span>
              {/* Beta v3 with smile tooth icon */}
              <span className="flex items-center gap-1 text-[10px] text-primary-400">
                <Smile size={12} className="text-primary-400" />
                Beta v3
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ═══ Chat Options Dropdown ═══ */}
          <div className="relative">
            <button
              onClick={() => setShowChatOptionsModal(!showChatOptionsModal)}
              className="header-btn"
              title="Chat options"
            >
              <MoreHorizontal size={16} />
              <span className="hidden sm:inline">Chat</span>
              <ChevronDown size={12} className={`transition-transform ${showChatOptionsModal ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Chat Options Dropdown Menu */}
            {showChatOptionsModal && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowChatOptionsModal(false)} 
                />
                <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                  {/* New Chat */}
                  <button
                    onClick={() => { handleNewChat(); setShowChatOptionsModal(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Plus size={14} className="text-gray-500" />
                    <div className="flex-1">
                      <div className="font-medium">New Chat</div>
                      <div className="text-[10px] text-gray-400">Ctrl+Shift+N</div>
                    </div>
                  </button>
                  
                  {/* History (JIVE/JIGGA) */}
                  {isPersistenceEnabled && (
                    <button
                      onClick={() => { setShowHistory(!showHistory); setShowChatOptionsModal(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <History size={14} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="font-medium">History</div>
                        <div className="text-[10px] text-gray-400">{sessions.length} sessions</div>
                      </div>
                      {showHistory && <Check size={14} className="text-primary-600" />}
                    </button>
                  )}
                  
                  {/* Export (JIVE/JIGGA) */}
                  {isPersistenceEnabled && (
                    <button
                      onClick={() => { setShowExportModal(true); setShowChatOptionsModal(false); }}
                      disabled={!chatSessionId}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText size={14} className="text-gray-500" />
                      <div className="flex-1">
                        <div className="font-medium">Export PDF</div>
                        <div className="text-[10px] text-gray-400">Save conversation</div>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ═══ Separator ═══ */}
          <div className="w-px h-6 bg-primary-600/30" />

          {/* ═══ Context Group ═══ */}
          <div className="flex items-center gap-1.5">
            {/* Location Badge */}
            <LocationBadge
              location={userLocation}
              weather={weatherData}
              onClick={() => {
                if (!userLocation) {
                  promptLocation();
                }
              }}
              onEdit={() => {
                if (userLocation) {
                  setManualLocationInput(
                    userLocation.city || userLocation.street || ''
                  );
                }
                setShowManualLocation(true);
              }}
              onClear={clearLocation}
              onShowForecast={handleShowForecast}
            />

            {/* Token Count - Prominent display badge */}
            <div className="relative group">
              <div
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 rounded-lg transition-all cursor-default shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-center w-5 h-5 bg-amber-500 rounded-md shadow-inner">
                  <Hash size={12} className="text-white" />
                </div>
                <div className="flex flex-col items-start leading-none">
                  <span className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wider">Tokens</span>
                  <span className="text-sm font-bold text-amber-100">
                    {tokenStats.isLoading ? '...' : formatTokenCount(tokenStats.allTime.totalTokens)}
                  </span>
                </div>
              </div>
              
              {/* Hover Popup */}
              <div className="absolute top-full right-0 mt-2 w-64 p-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="text-sm text-white font-semibold mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 bg-amber-500 rounded-md flex items-center justify-center">
                    <Hash size={14} className="text-white" />
                  </div>
                  Token Usage
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-2.5 bg-gray-800 rounded-lg">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Today</div>
                    <div className="text-lg font-bold text-white">
                      {formatTokenCount(tokenStats.today.totalTokens)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-gray-800 rounded-lg">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">All Time</div>
                    <div className="text-lg font-bold text-amber-400">
                      {formatTokenCount(tokenStats.allTime.totalTokens)}
                    </div>
                  </div>
                </div>
                
                {/* Breakdown */}
                <div className="border-t border-gray-700 pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-blue-400 rounded-full" />
                      Input Tokens
                    </span>
                    <span className="text-xs font-medium text-gray-200">
                      {formatTokenCount(tokenStats.allTime.inputTokens)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      Output Tokens
                    </span>
                    <span className="text-xs font-medium text-gray-200">
                      {formatTokenCount(tokenStats.allTime.outputTokens)}
                    </span>
                  </div>
                </div>
                
                {/* Arrow pointer */}
                <div className="absolute -top-1.5 right-6 w-3 h-3 bg-gray-900 border-l border-t border-gray-700 rotate-45" />
              </div>
            </div>
          </div>

          {/* ═══ Separator ═══ */}
          <div className="w-px h-6 bg-primary-600/30" />

          {/* ═══ Account Group ═══ */}
          <div className="flex items-center gap-1.5">
            {/* Upgrade CTA for FREE tier */}
            {tier === 'free' && userEmail && (
              <a
                href="/upgrade"
                className="header-btn bg-linear-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 border border-primary-400/30"
                title="Upgrade to JIVE or JIGGA for more features"
              >
                <ArrowUpCircle size={14} />
                <span className="text-xs font-semibold">Upgrade</span>
              </a>
            )}

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
          </div>

          {/* ═══ Tester Report Button ═══ */}
          {isTester && (
            <button
              onClick={() => setShowReportIssue(true)}
              className="header-btn bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30"
              title="Report an issue (Tester)"
            >
              <Bug size={14} />
              <span className="text-xs">Report</span>
            </button>
          )}
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
                  className={`p-1.5 rounded-lg transition-colors ${historySelectMode
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

            {/* Search box for history */}
            {sessions.length > 3 && (
              <div className="p-2 border-b border-primary-100">
                <div className="relative">
                  <FileSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-primary-400" />
                  <input
                    type="text"
                    placeholder="Search chats..."
                    value={historySearch}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-primary-50 border border-primary-200 rounded-lg focus:outline-none focus:border-primary-400 transition-colors"
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
              </div>
            )}

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
              {sessions
                .filter((session) => 
                  !historySearch || session.title.toLowerCase().includes(historySearch.toLowerCase())
                )
                .map((session) => (
                <div
                  key={session.id}
                  className={`group relative flex items-stretch hover:bg-primary-50 transition-colors ${session.id === chatSessionId ? 'bg-primary-100' : ''
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
              <div className="text-center text-primary-400 mt-12 animate-fadeIn max-w-2xl mx-auto">
                <div className="mb-6">
                  <GoggaLogo size="xl" variant="animated" className="mx-auto" />
                </div>
                <h2 className="text-2xl font-bold text-primary-700 mb-2">
                  Sawubona!
                </h2>
                <p className="text-base text-primary-500 mb-1">
                  How can I help you today?
                </p>
                <p className="text-sm text-primary-400 mb-6">
                  Legal questions, code, translations, or just a lekker chat.
                </p>

                {/* Quick Suggestion Prompts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 text-left">
                  <button
                    onClick={() => setInput('Explain my rights under CCMA for unfair dismissal')}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-primary-200 hover:border-primary-400 hover:shadow-md transition-all text-left group"
                  >
                    <Scale size={18} className="text-primary-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-primary-700 group-hover:text-primary-800">CCMA Rights</span>
                      <p className="text-xs text-primary-400 mt-0.5">Unfair dismissal & labour law</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setInput('Write a Python function to validate SA ID numbers')}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-primary-200 hover:border-primary-400 hover:shadow-md transition-all text-left group"
                  >
                    <Code size={18} className="text-primary-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-primary-700 group-hover:text-primary-800">SA ID Validator</span>
                      <p className="text-xs text-primary-400 mt-0.5">Python code for ID validation</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setInput('Translate "How much does this cost?" to Zulu, Xhosa, and Sotho')}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-primary-200 hover:border-primary-400 hover:shadow-md transition-all text-left group"
                  >
                    <Languages size={18} className="text-primary-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-primary-700 group-hover:text-primary-800">Translate</span>
                      <p className="text-xs text-primary-400 mt-0.5">11 SA languages supported</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setInput('What documents do I need for a SASSA grant application?')}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-primary-200 hover:border-primary-400 hover:shadow-md transition-all text-left group"
                  >
                    <MessageSquare size={18} className="text-primary-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-sm font-medium text-primary-700 group-hover:text-primary-800">SASSA Help</span>
                      <p className="text-xs text-primary-400 mt-0.5">Grant applications & more</p>
                    </div>
                  </button>
                </div>

                {/* Tier Cards */}
                <div className="flex justify-center gap-4 flex-wrap mb-6">
                  <div className={`flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border min-w-28 hover-lift ${tier === 'free' ? 'border-primary-400 ring-2 ring-primary-200' : 'border-primary-200'}`}>
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Zap size={18} className="text-primary-600" />
                    </div>
                    <span className="text-xs font-bold text-primary-700">FREE</span>
                    <span className="text-[10px] text-primary-500">Llama 3.3</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border min-w-28 hover-lift ${tier === 'jive' ? 'border-primary-400 ring-2 ring-primary-200' : 'border-primary-200'}`}>
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Brain size={18} className="text-primary-600" />
                    </div>
                    <span className="text-xs font-bold text-primary-700">JIVE</span>
                    <span className="text-[10px] text-primary-500">Cerebras + CePO</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border min-w-28 hover-lift ${tier === 'jigga' ? 'border-primary-400 ring-2 ring-primary-200' : 'border-primary-200'}`}>
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Sparkles size={18} className="text-primary-600" />
                    </div>
                    <span className="text-xs font-bold text-primary-700">JIGGA</span>
                    <span className="text-[10px] text-primary-500">Qwen 32B + RAG</span>
                  </div>
                </div>

                {tier !== 'free' && (
                  <p className="text-xs text-primary-400 flex items-center justify-center gap-1">
                    <Database size={12} />
                    Chat history saved for {tier.toUpperCase()} tier
                  </p>
                )}

                {tier === 'free' && (
                  <p className="text-xs text-primary-500">
                    <a href="/upgrade" className="underline hover:text-primary-700 font-medium">Upgrade to JIVE or JIGGA</a>
                    {' '}for document uploads, chat history & advanced AI
                  </p>
                )}
              </div>
            )}

            {displayMessages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'
                  } chat-bubble`}
              >
                <div
                  className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                >
                  {/* Avatar - clean with no background for bot */}
                  <div
                    className={`shrink-0 flex items-center justify-center ${m.role === 'user'
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
                    className={`message-bubble group ${m.role === 'user'
                        ? 'message-bubble-user'
                        : 'message-bubble-assistant'
                      }`}
                  >
                    {renderMessageContent(m, i)}

                    {/* Language Badge for user messages (always show to indicate detection) */}
                    {m.role === 'user' &&
                      (m.detectedLanguage as SALanguage | undefined) && (
                      <div className="mt-1 flex justify-end">
                        <LanguageBadge
                          language={m.detectedLanguage as SALanguage}
                          {...(m.languageConfidence !== undefined
                            ? { confidence: m.languageConfidence }
                            : {})}
                          showForEnglish={true}
                        />
                      </div>
                    )}

                    {/* Language Badge for assistant messages (server-detected language) */}
                    {m.role === 'assistant' &&
                      m.detectedLanguage &&
                      m.detectedLanguage !== 'en' && (
                      <div className="mt-1 flex justify-start">
                        <LanguageBadge
                          language={m.detectedLanguage as SALanguage}
                          {...(m.languageConfidence !== undefined
                            ? { confidence: m.languageConfidence }
                            : {})}
                        />
                      </div>
                    )}

                    {/* Metadata Display - Clean badge indicators (semantic spans, not buttons) */}
                    {m.meta && (
                      <div className="message-meta">
                        {m.meta.tier && (
                          <span className="meta-badge meta-badge-tier">
                            {m.meta.tier}
                          </span>
                        )}
                        {/* Layer badge - different display for each tier */}
                        {m.meta.layer && (
                          <span className="meta-badge">
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
                                <span>32B Think</span>
                              </>
                            ) : m.meta.layer === 'jigga_fast' ? (
                              <>
                                <Zap size={12} />
                                <span>32B Fast</span>
                              </>
                            ) : m.meta.layer === 'jigga_multilingual' ? (
                              <>
                                <Sparkles size={12} />
                                <span>235B</span>
                              </>
                            ) : (
                              <>
                                <Brain size={12} />
                                <span>{m.meta.layer}</span>
                              </>
                            )}
                          </span>
                        )}
                        {m.meta.latency_seconds && (
                          <span className="meta-badge">
                            <Clock size={12} />
                            <span>{m.meta.latency_seconds.toFixed(2)}s</span>
                          </span>
                        )}
                        {/* Timestamp display */}
                        {m.meta.timestamp && (
                          <span
                            className="meta-badge text-[10px] opacity-60"
                            title={new Date(m.meta.timestamp).toLocaleString()}
                          >
                            {new Date(m.meta.timestamp).toLocaleTimeString(
                              [],
                              { hour: '2-digit', minute: '2-digit' }
                            )}
                          </span>
                        )}
                        {m.meta.cost_zar !== undefined &&
                          m.meta.cost_zar > 0 && (
                            <span className="meta-badge">
                              R{m.meta.cost_zar.toFixed(4)}
                            </span>
                          )}
                        {m.meta.rag_context && (
                          <span className="meta-badge meta-badge-rag">
                            <Database size={12} />
                            <span>RAG</span>
                          </span>
                        )}
                        {m.meta.math_tool_count &&
                          m.meta.math_tool_count > 0 && (
                            <span
                              className="meta-badge bg-primary-100 text-primary-700"
                              title={`GoggaSolve: ${m.meta.math_tools_executed?.join(', ') ||
                                'calculations'
                                }`}
                            >
                              <Terminal size={12} />
                              <span>GoggaSolve×{m.meta.math_tool_count}</span>
                            </span>
                          )}
                        {/* Copy to clipboard button - with visual feedback */}
                        {m.role === 'assistant' && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(m.content);
                              setCopiedMessageIndex(i);
                              // Reset after 2 seconds
                              setTimeout(() => setCopiedMessageIndex(null), 2000);
                            }}
                            className={`meta-badge cursor-pointer transition-all duration-200 ${
                              copiedMessageIndex === i 
                                ? 'bg-green-100 text-green-700' 
                                : 'hover:bg-primary-200'
                            }`}
                            title={copiedMessageIndex === i ? 'Copied!' : 'Copy response to clipboard'}
                          >
                            {copiedMessageIndex === i ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}
                        {/* Read aloud button - JIGGA only */}
                        {m.role === 'assistant' && (
                          <ReadAloudButtonWrapper tier={tier} text={m.content} />
                        )}
                      </div>
                    )}

                    {/* GoggaSmart Feedback Buttons (JIVE/JIGGA only) - Show on hover */}
                    {m.role === 'assistant' && isGoggaSmartEnabled && m.content && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
                        <FeedbackButtons
                          onFeedback={async (feedback) => {
                            // Get skill IDs that were used in this response
                            const usedIds = getUsedSkillIds();
                            if (usedIds.length > 0) {
                              await applyGoggaSmartFeedback(usedIds, feedback);
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* GoggaSolve Terminal for completed messages with math tools OR thinking content */}
                    {m.role === 'assistant' &&
                      ((m.meta?.math_tool_count && m.meta.math_tool_count > 0 && lastGoggaSolveLogs.length > 0) ||
                       lastGoggaSolveThinking) &&
                      i === displayMessages.length - 1 && (
                        <div className="mt-3">
                          <ChatTerminal
                            logs={lastGoggaSolveLogs}
                            isActive={false}
                            toolCount={m.meta?.math_tool_count || 0}
                            thinkingContent={lastGoggaSolveThinking}
                            isThinking={false}
                          />
                        </div>
                      )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <>
                <div className="flex justify-start chat-bubble">
                  <div className="flex gap-3 w-full max-w-2xl">
                    <div className="shrink-0 w-10 h-10 flex items-center justify-center">
                      <GoggaCricket size="md" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="message-bubble message-bubble-assistant">
                        <div className="flex items-center justify-center py-2">
                          <span className="text-sm text-primary-400">Processing...</span>
                        </div>
                      </div>
                      {/* GoggaSolve Terminal (JIVE/JIGGA only) - shows for math tools OR AI thinking */}
                      {(tier === 'jive' || tier === 'jigga') &&
                        (terminalActive || terminalLogs.length > 0 || isStreamingThinking || streamingThinking) && (
                          <ChatTerminal
                            logs={terminalLogs}
                            isActive={terminalActive}
                            toolsRunning={toolsRunning}
                            toolCount={toolCount}
                            thinkingContent={streamingThinking}
                            isThinking={isStreamingThinking}
                          />
                        )}
                    </div>
                  </div>
                </div>
                {/* Pinned center overlay spinner */}
                <GoggaSpinner overlay size="md" />
              </>
            )}

            {/* GoggaTalk Voice Terminal - Now a centered modal */}
            {goggaTalkVisible && (
              <GoggaTalkTerminal
                isVisible={goggaTalkVisible}
                onClose={() => setGoggaTalkVisible(false)}
                userTier={userTier}
              />
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-primary-200">
            {/* JIGGA AI Power Dropdown + Forced Tool Badge */}
            {canUpload && (
              <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 flex-wrap">
                {/* JIGGA Model Dropdown - Clean clickable button */}
                {tier === 'jigga' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAIPowerDropdown(!showAIPowerDropdown)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                      title="Select AI power level"
                    >
                      {forceModel === 'auto' && <Zap size={12} className="text-primary-600" />}
                      {forceModel === '32b' && <Brain size={12} className="text-primary-600" />}
                      {forceModel === '235b' && <Sparkles size={12} className="text-primary-600" />}
                      <span>
                        {forceModel === 'auto' ? 'Auto' : forceModel === '32b' ? 'Fast' : 'Max'}
                      </span>
                      <ChevronDown size={12} className={`transition-transform ${showAIPowerDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Dropdown menu */}
                    {showAIPowerDropdown && (
                      <>
                        {/* Backdrop to close on click outside */}
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowAIPowerDropdown(false)} 
                        />
                        <div className="absolute bottom-full left-0 mb-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
                          <button
                            onClick={() => { setForceModel('auto'); setShowAIPowerDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              forceModel === 'auto' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <Zap size={14} className={forceModel === 'auto' ? 'text-primary-600' : 'text-gray-400'} />
                            <div className="flex-1">
                              <div className="font-medium">Auto</div>
                              <div className="text-[10px] text-gray-400">Smart routing • Best for most</div>
                            </div>
                            {forceModel === 'auto' && <Check size={14} className="text-primary-600" />}
                          </button>
                          <button
                            onClick={() => { setForceModel('32b'); setShowAIPowerDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              forceModel === '32b' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <Brain size={14} className={forceModel === '32b' ? 'text-primary-600' : 'text-gray-400'} />
                            <div className="flex-1">
                              <div className="font-medium">Fast</div>
                              <div className="text-[10px] text-gray-400">Qwen 32B • Code & reasoning</div>
                            </div>
                            {forceModel === '32b' && <Check size={14} className="text-primary-600" />}
                          </button>
                          <button
                            onClick={() => { setForceModel('235b'); setShowAIPowerDropdown(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              forceModel === '235b' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <Sparkles size={14} className={forceModel === '235b' ? 'text-primary-600' : 'text-gray-400'} />
                            <div className="flex-1">
                              <div className="font-medium">Max</div>
                              <div className="text-[10px] text-gray-400">Qwen 235B • SA languages & legal</div>
                            </div>
                            {forceModel === '235b' && <Check size={14} className="text-primary-600" />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Forced Tool Badge (shows when a tool is forced via ToolShed) */}
            {forcedTool && (
              <div className="max-w-4xl mx-auto mb-2">
                <ForcedToolBadge
                  toolName={forcedTool.tool.name}
                  onClear={clearForcedTool}
                />
              </div>
            )}

            <div className="max-w-4xl mx-auto flex items-center gap-2">
              {/* Left buttons - aligned center with 48px height */}
              <div className="flex items-center gap-2 h-12">
                {/* GoggaTalk - SA Flag Speech Button for voice chat with label */}
                <div className="flex flex-col items-center gap-0.5">
                  <GoggaTalkButton
                    onClick={() => {
                      console.log('🦗 GoggaTalk button clicked!');
                      // Toggle GoggaTalk terminal visibility
                      setGoggaTalkVisible(prev => !prev);
                    }}
                    disabled={isLoading}
                    size="sm"
                  />
                  <span className="text-[9px] text-primary-500 font-medium">Voice</span>
                </div>

                {/* Paperclip - Opens Documents Panel for RAG uploads */}
                {tier !== 'free' && (
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={() => {
                        setRightPanelTab('documents');
                      }}
                      disabled={isLoading}
                      className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary-100 hover:bg-primary-200 text-primary-700 transition-colors disabled:opacity-50"
                      title="Upload documents for RAG"
                    >
                      <Paperclip size={18} />
                    </button>
                    <span className="text-[9px] text-primary-500 font-medium">Docs</span>
                  </div>
                )}
              </div>

              {/* Input Container with Wand inside */}
              <div className="flex-1 relative">
                <textarea
                  id="chat-message-input"
                  name="chat-message-input"
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize without causing scroll jumps
                    // Store current scroll position
                    const scrollContainer = e.target.closest('.overflow-y-auto');
                    const scrollTop = scrollContainer?.scrollTop ?? 0;
                    
                    // Set to auto to measure content, then set actual height
                    e.target.style.height = 'auto';
                    const maxHeight = window.innerHeight * 0.5;
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, maxHeight) + 'px';
                    // Reset to min height if empty
                    if (!e.target.value.trim()) {
                      e.target.style.height = '48px';
                    }
                    
                    // Restore scroll position to prevent jump
                    if (scrollContainer) {
                      scrollContainer.scrollTop = scrollTop;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  className="input-field pr-14 h-12 min-h-12 max-h-[50vh] resize-none overflow-y-auto py-3"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-primary-700 hover:text-primary-900 disabled:text-primary-400 disabled:cursor-not-allowed transition-all group"
                  aria-label="Enhance prompt with AI"
                  title="✨ Enhance your prompt with AI magic"
                >
                  {isEnhancing ? (
                    <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full" />
                  ) : (
                    <div className="relative wand-animate">
                      <MagicWandIcon
                        size={24}
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
                  title={`Generate image (${tier === 'free' ? 'LongCat FREE' : 'FLUX 1.1 Pro'
                    })`}
                >
                  {isGeneratingImage ? (
                    <div className="animate-spin h-5 w-5 border-2 border-primary-800 border-t-transparent rounded-full" />
                  ) : (
                    <ImageGenerateIcon size={20} />
                  )}
                </button>

                {/* Icon Studio Button - Premium Feature */}
                {(tier === 'jive' || tier === 'jigga') && (
                  <button
                    onClick={() => setShowIconStudio(true)}
                    className="action-btn h-12 w-12 bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
                    aria-label="Icon Studio"
                    title="Icon Studio - Generate SA-themed icons"
                  >
                    <MagicWandIcon size={20} />
                  </button>
                )}

                {/* Send Button */}
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading || isGeneratingImage}
                  className="action-btn h-12 w-12 bg-primary-800 text-white hover:bg-primary-700 disabled:bg-primary-300"
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  <SendArrowIcon size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Document Store moved to RightSidePanel */}
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

      {/* Right Side Panel (Tools/Docs/Weather) - Self-contained with vertical tabs */}
      <RightSidePanel />

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
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${isSelected
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
                              onChange={() => { }}
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
          // Close manual modal and re-prompt for location permission
          // This clears any 'declined' state and triggers the permission prompt
          setShowManualLocation(false);
          setManualLocationInput('');
          // Clear declined state first, then request
          const savedConsent = localStorage.getItem('gogga_location_consent');
          if (savedConsent === 'declined') {
            localStorage.removeItem('gogga_location_consent');
          }
          requestLocation();
        }}
        onCancel={() => {
          setShowManualLocation(false);
          setManualLocationInput('');
        }}
      />

      {/* Report Issue Modal (testers only) */}
      {isTester && (
        <ReportIssueModal
          isOpen={showReportIssue}
          onClose={() => setShowReportIssue(false)}
          userEmail={userEmail}
          getCapture={getCapture}
        />
      )}

      {/* GoggaSmart Modal (JIVE/JIGGA only) */}
      {isGoggaSmartEnabled && (
        <GoggaSmartModal
          isOpen={showGoggaSmartModal}
          onClose={() => setShowGoggaSmartModal(false)}
          skills={goggaSmartSkills}
          stats={goggaSmartStats}
          onRemoveSkill={removeGoggaSmartSkill}
          onReset={resetGoggaSmart}
          isLoading={goggaSmartLoading}
        />
      )}

      {/* PDF Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        sessionId={chatSessionId}
        {...(currentSessionTitle ? { sessionTitle: currentSessionTitle } : {})}
        tier={tier}
      />

      {/* Icon Studio Modal (JIVE/JIGGA only) */}
      {(tier === 'jive' || tier === 'jigga') && (
        <IconGeneratorModal
          isOpen={showIconStudio}
          onClose={() => setShowIconStudio(false)}
          userId={userEmail || 'anonymous'}
          tier={tier === 'jive' ? 'JIVE' : 'JIGGA'}
        />
      )}

      {/* 7-Day Forecast Modal */}
      {showForecastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <GoggaForecast
              forecast={forecastData}
              isLoading={forecastLoading}
              error={forecastError}
              onClose={() => setShowForecastModal(false)}
              onRefresh={handleRefreshForecast}
              showCloseButton={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
