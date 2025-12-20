# Gogga Premium UI Design System

## Philosophy: "Ubuntu Luxe"
AI that feels like home, looks like the future. Warm, sophisticated, distinctly South African.

## Why Gogga Beats ChatGPT & Gemini
| Aspect | ChatGPT/Gemini | Gogga |
|--------|----------------|-------|
| Warmth | Cold/Clinical | Warm & Inviting |
| Personality | None | BuddySystem adaptive |
| Motion | Basic | Organic, breathing |
| Colors | Gray/Blue | Earth + Gold accents |
| Spatial | Flat | Glass morphism + depth |

## Color System: "Savanna Palette"
- **Base**: Warm neutrals (bone, sand, clay, earth, bark)
- **Accents**: Gold (Protea), Teal (Ocean), Coral (Karoo sunset)
- **Dark Mode**: Warm charcoal, NOT pure black

## Typography
- **Display/Body**: Quicksand (friendly, rounded)
- **Mono**: JetBrains Mono
- **Scale**: Fluid clamp() for all sizes

## Animation Principles
- **Easing**: Spring (0.34, 1.56, 0.64, 1) for bouncy, Smooth for elegant
- **Durations**: 150ms buttons, 250ms panels, 400ms pages
- **Patterns**: Breathing pulse (AI thinking), staggered cascade, magnetic hover

## Key Components
1. **Message Bubbles**: Glass morphism with gradient shine, hover actions
2. **Input Composer**: Hero element with glow on focus
3. **AI Thinking**: Breathing dots with stagger animation
4. **Cards**: Lift on hover (translateY + shadow)

## Micro-Interactions
- Button press: scale(0.96) with spring
- Input focus: Gold glow ring
- Toggle: Spring slide
- Modal: Scale + fade in

## Glass Morphism Recipe
```css
backdrop-filter: blur(20px) saturate(180%);
border: 1px solid rgba(255, 255, 255, 0.3);
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
```

## Implementation Phases
1. Foundation (colors, type, animation utils)
2. Core Components (messages, composer, sidebar)
3. Polish (micro-interactions, loading states)
4. Delight (transitions, sound, performance)

## Implementation Status: ✅ COMPLETED (Dec 2025)

**File**: `gogga-frontend/src/app/globals.css`

### What Was Implemented
- ✅ Savanna color palette (primary-50 through primary-950)
- ✅ Gold accent system (#d4a012 Protea Gold)
- ✅ Premium easing functions (spring, smooth, snap, breathe)
- ✅ Animation keyframes (fadeIn, slideUp, scaleIn, breathe, shimmer, glowPulse, bounceThinking)
- ✅ Glass morphism utilities (.glass-surface, .glass-card)
- ✅ Premium buttons (.btn-accent with gold gradient)
- ✅ Message bubbles (glass AI, gold user)
- ✅ Input composer with gold focus glow
- ✅ Thinking indicator (.thinking-dots)
- ✅ Micro-interactions (hover-lift, press-feedback, focus-glow, magnetic-hover)
- ✅ Premium tier badges with gold gradient
- ✅ Dark mode ("Starlit Savanna" warm charcoal)

## Full Spec
See `/memories/premium_ui_design.md` for complete wireframes, CSS variables, and component code.
