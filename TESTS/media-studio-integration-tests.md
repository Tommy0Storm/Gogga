# Media Studio Integration Tests

## Overview
Test plan for the MediaStudio (ImageStudio + VideoStudio) integration into the RightSidePanel.

**Date:** December 2025
**Feature:** Media Tab in RightSidePanel
**Components:** 
- `gogga-frontend/src/components/RightSidePanel.tsx` - MediaTabContent
- `gogga-frontend/src/hooks/useRightPanel.ts` - Added 'media' tab type
- `gogga-frontend/src/components/MediaCreator/` - ImageStudio, VideoStudio

---

## Test Categories

### 1. Media Tab Visibility & Access

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-001 | Media tab visible in vertical tab strip | 1. Load chat interface | Film icon tab visible on right edge with "Media" label | ALL |
| MSI-002 | Media tab opens panel on click | 1. Click Media tab | Panel slides in, shows "Media Studio" header | ALL |
| MSI-003 | Media tab toggles panel off | 1. Open Media tab, 2. Click Media tab again | Panel closes | ALL |
| MSI-004 | Media tab switches from other tabs | 1. Open Docs tab, 2. Click Media tab | Panel switches to Media content | ALL |

### 2. Media Home View (Launcher)

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-010 | Home view shows both studio cards | 1. Open Media tab | ImageStudio and VideoStudio cards visible | ALL |
| MSI-011 | ImageStudio card shows correct info | 1. Open Media tab | Shows "Image Studio", "Create, edit & upscale", Create/Edit/Upscale tags | ALL |
| MSI-012 | VideoStudio card shows correct info | 1. Open Media tab | Shows "Video Studio", "Generate videos with Veo 3.1", Text2Vid/Img2Vid/Audio tags | ALL |
| MSI-013 | FREE tier shows Premium badge on Video | 1. Open Media tab as FREE user | Gold "Premium" badge appears on VideoStudio card | FREE |
| MSI-014 | JIVE/JIGGA no Premium badge on Video | 1. Open Media tab as JIVE/JIGGA user | No Premium badge on VideoStudio card | JIVE/JIGGA |
| MSI-015 | Quota indicators show correctly | 1. Open Media tab | Image quota bar shows used/limit, Video quota shows used/limit or upgrade message | ALL |
| MSI-016 | Feature highlights grid visible | 1. Open Media tab | Shows HD Quality, Fast Gen, Edit & Refine, R Pricing with emojis | ALL |
| MSI-017 | Tier info displayed at bottom | 1. Open Media tab | Shows "FREE tier • Limited access" or "JIVE tier • Full access" etc. | ALL |

### 3. ImageStudio Navigation

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-020 | Click ImageStudio card opens studio | 1. Open Media tab, 2. Click ImageStudio card | View switches to ImageStudio component with tabs | ALL |
| MSI-021 | Back button returns to home | 1. Enter ImageStudio, 2. Click "Back to Media" | Returns to Media home view | ALL |
| MSI-022 | ImageStudio shows Create/Edit/Upscale tabs | 1. Enter ImageStudio | Three tabs visible: Create, Edit, Upscale | ALL |
| MSI-023 | Edit/Upscale tabs show JIVE+ badge for FREE | 1. Enter ImageStudio as FREE user | Edit and Upscale tabs show "JIVE+" badge | FREE |
| MSI-024 | All tabs accessible for paid users | 1. Enter ImageStudio as JIVE/JIGGA | All tabs clickable without upgrade prompts | JIVE/JIGGA |

### 4. VideoStudio Navigation

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-030 | Click VideoStudio card opens studio | 1. Open Media tab, 2. Click VideoStudio card | View switches to VideoStudio component | ALL |
| MSI-031 | Back button returns to home | 1. Enter VideoStudio, 2. Click "Back to Media" | Returns to Media home view | ALL |
| MSI-032 | FREE tier sees upgrade prompt | 1. Enter VideoStudio as FREE user | Shows "Video Generation is a Premium Feature" message with upgrade info | FREE |
| MSI-033 | FREE tier sees sample gallery | 1. Enter VideoStudio as FREE user | Sample gallery with SA-themed examples visible | FREE |
| MSI-034 | Paid tier sees video form | 1. Enter VideoStudio as JIVE/JIGGA | Video generation form visible with all parameters | JIVE/JIGGA |

### 5. Quota Display Accuracy

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-040 | FREE tier image quota shows 0/1 | 1. Open Media tab as new FREE user | Image quota shows "0/1" | FREE |
| MSI-041 | JIVE tier image quota shows 0/50 | 1. Open Media tab as new JIVE user | Image quota shows "0/50" | JIVE |
| MSI-042 | JIGGA tier image quota shows 0/200 | 1. Open Media tab as new JIGGA user | Image quota shows "0/200" | JIGGA |
| MSI-043 | FREE tier video shows upgrade message | 1. Open Media tab as FREE user | Video card shows "Upgrade to create videos" | FREE |
| MSI-044 | JIVE tier video quota shows 0/5 | 1. Open Media tab as new JIVE user | Video quota shows "0/5" minutes | JIVE |
| MSI-045 | JIGGA tier video quota shows 0/20 | 1. Open Media tab as new JIGGA user | Video quota shows "0/20" minutes | JIGGA |

### 6. Panel State Persistence

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-050 | Panel remembers open/closed state | 1. Open Media tab, 2. Navigate elsewhere, 3. Return | Panel state persists based on global state | ALL |
| MSI-051 | Tab selection persists | 1. Select Media tab, 2. Close panel, 3. Reopen | Opens on Media tab | ALL |
| MSI-052 | View resets on panel close | 1. Enter ImageStudio, 2. Close panel, 3. Reopen | Returns to Media home (not stuck in ImageStudio) | ALL |

### 7. Responsive Design

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-060 | Panel works on mobile viewport | 1. Resize to 375px width, 2. Open Media tab | Panel takes appropriate width, content readable | ALL |
| MSI-061 | Vertical tabs visible on mobile | 1. Resize to 375px width | Vertical tab strip still visible and clickable | ALL |
| MSI-062 | Cards stack properly | 1. Resize to narrow width | Studio cards stack vertically, text doesn't overflow | ALL |

### 8. Accessibility

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-070 | Media tab has proper aria label | 1. Inspect Media tab button | Has title="Media" attribute | ALL |
| MSI-071 | Studio cards are keyboard accessible | 1. Tab to Media panel, 2. Navigate with keyboard | Can navigate and select cards with Enter | ALL |
| MSI-072 | Back button is focusable | 1. Enter ImageStudio, 2. Tab focus | Back button receives focus, Enter triggers navigation | ALL |

---

## Integration with Existing Features

### 9. Coexistence with Other Tabs

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-080 | Documents tab still works | 1. Open Docs tab, 2. Upload document | Document upload works, then switch to Media | ALL |
| MSI-081 | Tools tab still works | 1. Open Tools tab, 2. Force a tool, 3. Switch to Media | Tool remains forced, badge shows in chat | JIVE/JIGGA |
| MSI-082 | Smart tab still works | 1. Open Smart tab, 2. Check skills, 3. Switch to Media | GoggaSmart data persists | JIVE/JIGGA |

### 10. Chat Integration

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-090 | Can generate image from chat then open Media | 1. Use Image button in chat, 2. Open Media tab | Both work independently | ALL |
| MSI-091 | Icon Studio button still works | 1. Click Icon Studio button in chat | IconGeneratorModal opens (separate from Media tab) | JIVE/JIGGA |

---

## Error Handling

### 11. Graceful Degradation

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-100 | ImageStudio handles API errors | 1. Enter ImageStudio, 2. Submit with invalid data | Shows error message, doesn't crash | ALL |
| MSI-101 | VideoStudio handles API errors | 1. Enter VideoStudio, 2. Submit with invalid data | Shows error message, doesn't crash | JIVE/JIGGA |
| MSI-102 | Panel handles missing tier gracefully | 1. Load with undefined tier | Defaults to FREE tier behavior | ALL |

---

## Performance

### 12. Load Times

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-110 | Media tab opens quickly | 1. Click Media tab | Panel appears within 100ms (CSS transition) | ALL |
| MSI-111 | ImageStudio lazy loads properly | 1. Enter ImageStudio | Component loads without blocking UI | ALL |
| MSI-112 | VideoStudio lazy loads properly | 1. Enter VideoStudio | Component loads without blocking UI | ALL |

---

## Visual Regression

### 13. Design Consistency

| Test ID | Description | Steps | Expected Result | Tier |
|---------|-------------|-------|-----------------|------|
| MSI-120 | Media tab matches other tabs styling | 1. Compare Media tab to Docs/Tools/Smart | Same size, spacing, font, colors | ALL |
| MSI-121 | Studio cards follow monochrome theme | 1. Open Media tab | Cards use gray/neutral colors except accent gradients | ALL |
| MSI-122 | Premium badge uses gold gradient | 1. Open as FREE user | Badge shows amber-to-orange gradient | FREE |

---

## Test Summary

| Category | Test Count | Priority |
|----------|------------|----------|
| Tab Visibility & Access | 4 | P0 |
| Media Home View | 8 | P0 |
| ImageStudio Navigation | 5 | P0 |
| VideoStudio Navigation | 5 | P0 |
| Quota Display | 6 | P1 |
| Panel State | 3 | P1 |
| Responsive Design | 3 | P1 |
| Accessibility | 3 | P1 |
| Integration | 5 | P1 |
| Error Handling | 3 | P2 |
| Performance | 3 | P2 |
| Visual Regression | 3 | P2 |

**Total Tests: 51**

---

## Automated Test Coverage

File: `gogga-frontend/src/components/__tests__/MediaTabContent.test.tsx`

```typescript
/**
 * MediaTabContent Unit Tests
 */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the MediaCreator components
jest.mock('@/components/MediaCreator/ImageStudio', () => ({
  ImageStudio: ({ tier }: { tier: string }) => (
    <div data-testid="image-studio">ImageStudio for {tier}</div>
  ),
}));

jest.mock('@/components/MediaCreator/VideoStudio', () => ({
  VideoStudio: ({ tier, quota }: { tier: string; quota: { used: number; limit: number } }) => (
    <div data-testid="video-studio">VideoStudio for {tier}, quota: {quota.used}/{quota.limit}</div>
  ),
}));

// Test suite would be in the actual test file
describe('MediaTabContent', () => {
  it('should render home view by default');
  it('should show ImageStudio card');
  it('should show VideoStudio card');
  it('should navigate to ImageStudio on card click');
  it('should navigate to VideoStudio on card click');
  it('should show back button in studio views');
  it('should return to home on back click');
  it('should show Premium badge for FREE tier on video');
  it('should show upgrade message for FREE tier video quota');
  it('should show correct quota limits per tier');
});
```

---

## Notes

1. The MediaTabContent uses internal state for view navigation (`home` | `image` | `video`)
2. Quota data is currently mocked - future integration should fetch from `/api/v1/media/quota` endpoint
3. The ImageStudio and VideoStudio components are the full implementations from `MediaCreator/`
4. Panel width is 320px (w-80), same as other tabs

## Related Documentation

- `.serena/memories/image_video_generation.md` - Full feature documentation
- `gogga-frontend/src/components/MediaCreator/` - Source components
- `TESTS/image-generation-tests.md` - Existing image generation tests
