# Icon Mapping Service

## Overview

Universal icon mapping service for normalizing alternative icon names to their canonical Google Material Icons equivalents.

## Files

- `gogga-frontend/src/lib/iconMapping.ts` - Core mapping service
- `gogga-frontend/src/components/Icon.tsx` - React icon components
- `gogga-frontend/src/components/GoggaIcons.tsx` - Custom GOGGA SVG icons

## Features

### Core Mapping
- 150+ alternative-to-canonical mappings
- 12 domain categories (cooking, technology, health, business, learning, travel, social, media, weather, sports, home, shopping, environment, general)
- TypeScript support with full type definitions

### Functions Available

| Function | Purpose |
|----------|---------|
| `normalizeIcon(name)` | Normalize single icon name |
| `normalizeIcons(names)` | Normalize array of icon names |
| `normalizeIconsInText(text)` | Normalize icon refs in text |
| `getCanonicalIcon(name)` | Get canonical for alternative |
| `getAlternatives(canonical)` | Get all alternatives for a canonical |
| `isAlternativeIcon(name)` | Check if icon will be normalized |
| `isCanonicalIcon(name)` | Check if icon is already canonical |
| `getIconsForDomain(domain)` | Get icons for a specific domain |
| `getDomainsForIcon(name)` | Find which domains an icon belongs to |
| `suggestIcons(domain, limit)` | Suggest icons for a domain |
| `getIconClass(name)` | Get CSS class for Material Icons |
| `getSymbolClass(name, variant)` | Get CSS class for Material Symbols |

### React Components

| Component | Purpose |
|-----------|---------|
| `Icon` | Basic Material Icon with auto-normalization |
| `SymbolIcon` | Material Symbols with variable font support |
| `TierIcon` | GOGGA tier indicators (FREE/JIVE/JIGGA) |
| `StatusIcon` | Status indicators (success/error/warning/info/loading) |
| `ActionIcon` | Common action buttons (add/edit/delete/save/etc) |
| `DomainIconSet` | Icon picker for specific domains |

---

## Custom GOGGA Icons (`/components/GoggaIcons.tsx`)

### Original Icons
| Icon | Component | Purpose |
|------|-----------|---------|
| FileStoreIcon | `<FileStoreIcon />` | Filing cabinet for document store sidebar |
| SettingsGearIcon | `<SettingsGearIcon />` | Admin panel settings |
| SendArrowIcon | `<SendArrowIcon />` | Paper plane for message send button |
| ImageGenerateIcon | `<ImageGenerateIcon />` | Picture + sparkle for AI image generation |
| MagicWandIcon | `<MagicWandIcon />` | Wand with sparkles for prompt enhancement (animated) |
| DocumentRAGIcon | `<DocumentRAGIcon />` | Document with vector nodes for RAG docs |
| BrainThinkingIcon | `<BrainThinkingIcon />` | Brain with pulse for JIGGA thinking |

### Ultra Premium Menu Icons
| Icon | Component | Purpose |
|------|-----------|---------|
| FreeTierIcon | `<FreeTierIcon />` | Lightning bolt with circuit paths - FREE tier |
| JiveTierIcon | `<JiveTierIcon />` | Brain with neural network - JIVE tier |
| JiggaTierIcon | `<JiggaTierIcon />` | Diamond with vectors - JIGGA tier |
| NewChatIcon | `<NewChatIcon />` | Speech bubble with plus - new conversation |
| HistoryIcon | `<HistoryIcon />` | Clock with document stack - chat history |
| TokenCounterIcon | `<TokenCounterIcon />` | Hash with meter bar - token usage |
| MicrophoneIcon | `<MicrophoneIcon />` | Elegant mic with grill - audio input |
| UploadIcon | `<UploadIcon />` | Document with arrow - file upload |
| DashboardIcon | `<DashboardIcon />` | Grid with chart element - analytics |
| MemoryIcon | `<MemoryIcon />` | Brain chip with pins - long-term memory |
| SemanticSearchIcon | `<SemanticSearchIcon />` | Magnifying glass with sparkle - AI search |
| CepoIcon | `<CepoIcon />` | Brain with planning arrows - CePO indicator |

## CSS Animations

### Magic Wand Animation (`globals.css`)
```css
.wand-animate {
  animation: wand-sparkle 2s ease-in-out infinite, wand-glow 1.5s ease-in-out infinite;
}
.wand-animate:hover {
  animation-duration: 0.8s, 0.6s; /* Faster on hover */
}
```

## Usage
```tsx
import { MagicWandIcon, JiggaTierIcon, GoggaIcons } from '@/components/GoggaIcons';

// Direct import
<MagicWandIcon size={20} className="wand-animate" />

// Namespace import
<GoggaIcons.JiggaTier size={24} strokeWidth={1.5} />
```

## Tool Category Icons (`/lib/toolshedStore.ts`)

Unicode symbols for category filter tabs - NO DUPLICATES:
| Category | Icon | Description |
|----------|------|-------------|
| All | ⊕ | Circle with plus - all tools |
| Math & Finance | Σ | Sigma - calculations, stats |
| Charts | ◱ | Square with quadrant - visualization |
| Images | ◈ | Diamond - AI image generation |
| Memory | ⬡ | Hexagon - store/recall info |

## Tool Icon Map (`/lib/iconMapping.ts`)

Lucide icons for individual tools - unique per tool type:
| Tool Type | Lucide Icon | Example Tools |
|-----------|-------------|---------------|
| Math | Calculator | calculator, math, solve, goggasolve, wolfram_alpha |
| Code | Code | execute_code, python, javascript, run_code |
| Search | Search | search, web_search, google_search, find |
| Web | Globe | browse, fetch_url, web, http |
| Document | FileText | document, read_file, write_file, file |
| Image | Image | generate_image, analyze_image, vision |
| Chat | MessageSquare | chat, message, conversation |
| Database | Database | database, query, sql |
| AI | Brain | ai, llm, thinking |
| Weather | CloudSun | weather, forecast |
| Location | MapPin | location, geocode, places |
| Time | Calendar/Clock | calendar, schedule, time, timer |
| Email | Mail | email, send_email |
| Notification | Bell | notification, notify |
| Settings | Settings | settings, config |
| Default | Wrench | unknown tools (fallback) |

**Note**: The `getToolIcon()` function performs fuzzy matching:
1. Direct match on normalized tool name
2. Partial match if key is contained in tool name
3. Falls back to Wrench for unknown tools

## Design Principles
- All icons: Monochrome (black, currentColor)
- Material Icons style with custom detail work
- Configurable: `size`, `className`, `strokeWidth` props
- Tier icons have finer detail (strokeWidth: 1.5 default)
