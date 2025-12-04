# Icon Mapping Service

## Overview

Universal icon mapping service for normalizing alternative icon names to their canonical Google Material Icons equivalents.

## Files

- `gogga-frontend/src/lib/iconMapping.ts` - Core mapping service
- `gogga-frontend/src/components/Icon.tsx` - React icon components

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

## Usage Examples

```typescript
import { normalizeIcon, IconMappingService } from '@/lib/iconMapping';
import { Icon, StatusIcon, TierIcon } from '@/components/Icon';

// Direct normalization
normalizeIcon('fireplace'); // → 'local_fire_department'
normalizeIcon('done'); // → 'check_circle'

// Service object
IconMappingService.normalize('whatshot'); // → 'local_fire_department'
IconMappingService.getAlternatives('check_circle'); // → ['done', 'verified', 'task_alt', 'done_all']

// React components
<Icon name="fireplace" size={24} />  // Renders local_fire_department
<StatusIcon status="success" />       // Green check_circle
<TierIcon tier="JIGGA" />            // Purple star
```

## Domain Categories

1. **cooking** - Fire, blender, kitchen tools, restaurant
2. **technology** - Errors, success, loops, storage, security
3. **health** - Heart, pills, fitness, hospital
4. **business** - Money, trends, payments, documents
5. **learning** - School, assignments, help, video
6. **travel** - Flight, hotel, car, location
7. **social** - Mail, phone, video, share
8. **media** - Image, video, music, edit
9. **weather** - Sun, cloud, thermostat
10. **sports** - Fitness center
11. **home** - Chair, bed, bath, cleaning
12. **shopping** - Cart, bag, payment, shipping
13. **environment** - Recycle, water, nature
14. **general** - Add, info, expand, navigation
