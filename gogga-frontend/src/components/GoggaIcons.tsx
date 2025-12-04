/**
 * GOGGA Custom Icons
 * Monochrome SVG icons for the GOGGA interface
 * Uses black Material Icons style to match the theme
 */

'use client';

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/**
 * File Storage Icon - Filing cabinet / folder with documents
 * For the right panel document store
 */
export const FileStoreIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Cabinet body */}
    <rect x="3" y="3" width="18" height="18" rx="2" />
    {/* Drawer dividers */}
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    {/* Drawer handles */}
    <line x1="10" y1="6" x2="14" y2="6" />
    <line x1="10" y1="12" x2="14" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

/**
 * Settings Gear Icon - Admin panel settings
 * Precise gear with cog teeth
 */
export const SettingsGearIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Center circle */}
    <circle cx="12" cy="12" r="3" />
    {/* Gear path */}
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * Send Arrow Icon - Message send button
 * Clean arrow pointing right
 */
export const SendArrowIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Paper plane send */}
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

/**
 * Image Generate Icon - Picture with sparkle
 * For AI image generation button
 */
export const ImageGenerateIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Image frame */}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    {/* Mountain landscape */}
    <polyline points="3 15 8 10 13 15" />
    <polyline points="14 14 16 12 21 17" />
    {/* Sun */}
    <circle cx="16" cy="8" r="2" />
    {/* Sparkle */}
    <path d="M20 2L20.5 3.5L22 4L20.5 4.5L20 6L19.5 4.5L18 4L19.5 3.5L20 2" strokeWidth={1.5} />
  </svg>
);

/**
 * Magic Wand Icon - Prompt enhancement
 * Wand with sparkle trail
 */
export const MagicWandIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Wand body */}
    <path d="M15 4L20 9L9 20L4 15L15 4Z" />
    <line x1="14.5" y1="5.5" x2="18.5" y2="9.5" />
    {/* Sparkles */}
    <path d="M6 2L6.5 3.5L8 4L6.5 4.5L6 6L5.5 4.5L4 4L5.5 3.5L6 2" strokeWidth={1.5} />
    <path d="M3 10L3.3 11L4 11.3L3.3 11.6L3 12.6L2.7 11.6L2 11.3L2.7 11L3 10" strokeWidth={1.5} />
    <path d="M11 1L11.3 2L12 2.3L11.3 2.6L11 3.6L10.7 2.6L10 2.3L10.7 2L11 1" strokeWidth={1.5} />
  </svg>
);

/**
 * Document RAG Icon - Document with vector lines
 * For RAG-enabled document display
 */
export const DocumentRAGIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Document */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Vector/embedding lines */}
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
    {/* Connection nodes */}
    <circle cx="8" cy="13" r="1" fill="currentColor" />
    <circle cx="16" cy="13" r="1" fill="currentColor" />
  </svg>
);

/**
 * Brain Thinking Icon - Brain with pulse
 * For JIGGA thinking mode
 */
export const BrainThinkingIcon: React.FC<IconProps> = ({ 
  size = 24, 
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Brain outline */}
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    {/* Center line */}
    <path d="M12 5v13" />
    {/* Thinking pulses */}
    <circle cx="12" cy="9" r="1" fill="currentColor" className="animate-pulse" />
    <circle cx="12" cy="13" r="1" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
  </svg>
);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ULTRA PREMIUM MENU ICONS - Tier Selection & Navigation
 * Sophisticated monochrome icons with fine detail work
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * FREE Tier Icon - Lightning bolt with circuit paths
 * Represents speed and accessibility
 */
export const FreeTierIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Main lightning bolt */}
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    {/* Circuit traces */}
    <path d="M2 8h2" strokeWidth={1} />
    <path d="M2 12h1" strokeWidth={1} />
    <path d="M21 10h1" strokeWidth={1} />
    <path d="M20 14h2" strokeWidth={1} />
    {/* Spark dots */}
    <circle cx="18" cy="6" r="0.5" fill="currentColor" />
    <circle cx="6" cy="18" r="0.5" fill="currentColor" />
  </svg>
);

/**
 * JIVE Tier Icon - Brain with neural network connections
 * Represents intelligent routing and CePO thinking
 */
export const JiveTierIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Stylized brain hemisphere */}
    <path d="M12 4c-2 0-3.5 1-4.5 2.5C6 8 5 10 5 12c0 3 2 5.5 4.5 6.5" />
    <path d="M12 4c2 0 3.5 1 4.5 2.5C18 8 19 10 19 12c0 3-2 5.5-4.5 6.5" />
    {/* Brain folds */}
    <path d="M8 8c1 0 2 1 3 1s2-1 3-1" strokeWidth={1} />
    <path d="M7 12c1.5 0 2.5 1 4 1s2.5-1 4-1" strokeWidth={1} />
    {/* Neural network nodes */}
    <circle cx="12" cy="4" r="1.5" strokeWidth={1.5} />
    <circle cx="6" cy="10" r="1" strokeWidth={1} />
    <circle cx="18" cy="10" r="1" strokeWidth={1} />
    <circle cx="12" cy="19" r="1.5" strokeWidth={1.5} />
    {/* Connection lines */}
    <path d="M12 5.5v3" strokeWidth={0.75} strokeDasharray="1 1" />
    <path d="M7 10l3 2" strokeWidth={0.75} strokeDasharray="1 1" />
    <path d="M17 10l-3 2" strokeWidth={0.75} strokeDasharray="1 1" />
  </svg>
);

/**
 * JIGGA Tier Icon - Diamond with embedded vectors
 * Represents premium RAG, semantic search, and quality
 */
export const JiggaTierIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Diamond shape */}
    <path d="M12 2L2 9l10 13 10-13-10-7z" />
    {/* Crown top facets */}
    <path d="M2 9h20" />
    <path d="M7 2l-5 7" strokeWidth={1} />
    <path d="M17 2l5 7" strokeWidth={1} />
    <path d="M12 2v7" strokeWidth={1} />
    {/* Inner sparkle/vector symbol */}
    <path d="M12 11l2 4-2-1-2 1 2-4z" fill="currentColor" strokeWidth={0} />
    {/* Radiance lines */}
    <path d="M12 17v2" strokeWidth={1} />
    <path d="M9 15l-1.5 1.5" strokeWidth={0.75} />
    <path d="M15 15l1.5 1.5" strokeWidth={0.75} />
  </svg>
);

/**
 * New Chat Icon - Elegant plus with speech bubble
 * For starting new conversations
 */
export const NewChatIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Speech bubble */}
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    {/* Plus sign */}
    <path d="M12 8v6" strokeWidth={2} />
    <path d="M9 11h6" strokeWidth={2} />
  </svg>
);

/**
 * History Icon - Clock with document pages
 * For chat history navigation
 */
export const HistoryIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Clock face */}
    <circle cx="12" cy="12" r="9" />
    {/* Clock hands */}
    <path d="M12 7v5l3 3" />
    {/* Stack effect - subtle pages behind */}
    <path d="M4 8V6a2 2 0 0 1 2-2h2" strokeWidth={1} />
    <path d="M4 16v2a2 2 0 0 0 2 2h2" strokeWidth={1} />
    <path d="M20 8V6a2 2 0 0 0-2-2h-2" strokeWidth={1} />
    <path d="M20 16v2a2 2 0 0 1-2 2h-2" strokeWidth={1} />
  </svg>
);

/**
 * Token Counter Icon - Hash with meter
 * For displaying token usage
 */
export const TokenCounterIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Hash symbol */}
    <path d="M4 9h16" />
    <path d="M4 15h16" />
    <path d="M10 3l-2 18" />
    <path d="M16 3l-2 18" />
    {/* Meter bar at bottom */}
    <rect x="3" y="20" width="18" height="2" rx="1" strokeWidth={1} fill="currentColor" opacity="0.3" />
    <rect x="3" y="20" width="12" height="2" rx="1" strokeWidth={0} fill="currentColor" />
  </svg>
);

/**
 * Microphone Icon - Elegant audio capture
 * For voice input recording
 */
export const MicrophoneIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Microphone body */}
    <rect x="9" y="2" width="6" height="11" rx="3" />
    {/* Sound waves */}
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    {/* Stand */}
    <path d="M12 18v4" />
    <path d="M8 22h8" />
    {/* Subtle grill lines */}
    <path d="M10 5h4" strokeWidth={0.75} />
    <path d="M10 7h4" strokeWidth={0.75} />
    <path d="M10 9h4" strokeWidth={0.75} />
  </svg>
);

/**
 * Upload Icon - Document with upward arrow
 * For file upload functionality
 */
export const UploadIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Document base */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    {/* Upload arrow */}
    <path d="M12 18v-6" strokeWidth={2} />
    <path d="M9 15l3-3 3 3" strokeWidth={2} />
  </svg>
);

/**
 * Dashboard Icon - Grid with chart element
 * For analytics and metrics view
 */
export const DashboardIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Grid squares */}
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    {/* Chart in bottom right */}
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <path d="M16 19v-3" strokeWidth={2} />
    <path d="M19 19v-5" strokeWidth={2} />
  </svg>
);

/**
 * Memory Icon - Brain chip / memory module
 * For long-term memory management
 */
export const MemoryIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Chip body */}
    <rect x="5" y="5" width="14" height="14" rx="2" />
    {/* Inner circuit */}
    <rect x="8" y="8" width="8" height="8" rx="1" strokeWidth={1} />
    {/* Connection pins */}
    <path d="M9 5V3" strokeWidth={1.5} />
    <path d="M12 5V3" strokeWidth={1.5} />
    <path d="M15 5V3" strokeWidth={1.5} />
    <path d="M9 21v-2" strokeWidth={1.5} />
    <path d="M12 21v-2" strokeWidth={1.5} />
    <path d="M15 21v-2" strokeWidth={1.5} />
    <path d="M5 9H3" strokeWidth={1.5} />
    <path d="M5 12H3" strokeWidth={1.5} />
    <path d="M5 15H3" strokeWidth={1.5} />
    <path d="M21 9h-2" strokeWidth={1.5} />
    <path d="M21 12h-2" strokeWidth={1.5} />
    <path d="M21 15h-2" strokeWidth={1.5} />
    {/* Center glow */}
    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3" />
  </svg>
);

/**
 * Search Icon - Magnifying glass with sparkle
 * For semantic search
 */
export const SemanticSearchIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Magnifying glass */}
    <circle cx="10" cy="10" r="7" />
    <path d="M21 21l-4.35-4.35" strokeWidth={2} />
    {/* AI sparkle inside lens */}
    <path d="M10 7l0.5 1.5L12 9l-1.5 0.5L10 11l-0.5-1.5L8 9l1.5-0.5L10 7" strokeWidth={1} />
    {/* Vector dots */}
    <circle cx="7" cy="12" r="0.5" fill="currentColor" />
    <circle cx="13" cy="8" r="0.5" fill="currentColor" />
  </svg>
);

/**
 * CePO Icon - Brain with planning arrows
 * For Cerebras Planning Optimization indicator
 */
export const CepoIcon: React.FC<IconProps> = ({
  size = 24,
  className = '',
  strokeWidth = 1.5,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Brain outline */}
    <path d="M12 4a4 4 0 0 0-4 4c0 1.5.5 3 1.5 4" />
    <path d="M12 4a4 4 0 0 1 4 4c0 1.5-.5 3-1.5 4" />
    <path d="M8 12c-2 1-3 3-3 5a4 4 0 0 0 7 2.5" />
    <path d="M16 12c2 1 3 3 3 5a4 4 0 0 1-7 2.5" />
    {/* Planning arrows - cyclical thinking */}
    <path d="M9 10l3-3 3 3" strokeWidth={1.5} />
    <path d="M12 7v4" strokeWidth={1} />
    {/* Iteration symbol */}
    <circle cx="12" cy="14" r="2" strokeWidth={1} />
    <path d="M14 14l1.5 1.5" strokeWidth={1} />
  </svg>
);

// Export all icons
export const GoggaIcons = {
  // Original icons
  FileStore: FileStoreIcon,
  SettingsGear: SettingsGearIcon,
  SendArrow: SendArrowIcon,
  ImageGenerate: ImageGenerateIcon,
  MagicWand: MagicWandIcon,
  DocumentRAG: DocumentRAGIcon,
  BrainThinking: BrainThinkingIcon,
  // Ultra premium menu icons
  FreeTier: FreeTierIcon,
  JiveTier: JiveTierIcon,
  JiggaTier: JiggaTierIcon,
  NewChat: NewChatIcon,
  History: HistoryIcon,
  TokenCounter: TokenCounterIcon,
  Microphone: MicrophoneIcon,
  Upload: UploadIcon,
  Dashboard: DashboardIcon,
  Memory: MemoryIcon,
  SemanticSearch: SemanticSearchIcon,
  Cepo: CepoIcon,
};

export default GoggaIcons;
