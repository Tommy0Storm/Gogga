/**
 * useRightPanel hook
 * 
 * Manages the state of the unified right side panel
 * 
 * Tabs:
 * - documents: RAG and session documents
 * - tools: ToolShed for forcing AI tools
 * - smart: GoggaSmart learning stats
 * - media: ImageStudio and VideoStudio access
 */

import { create } from 'zustand';

type TabId = 'tools' | 'documents' | 'weather' | 'search' | 'smart' | 'media';

interface RightPanelState {
  isOpen: boolean;
  activeTab: TabId;
  openPanel: (tab?: TabId) => void;
  closePanel: () => void;
  togglePanel: (tab?: TabId) => void;
  setActiveTab: (tab: TabId) => void;
}

export const useRightPanel = create<RightPanelState>((set, get) => ({
  isOpen: false,
  activeTab: 'documents',
  
  openPanel: (tab) => set({ 
    isOpen: true, 
    activeTab: tab || get().activeTab 
  }),
  
  closePanel: () => set({ isOpen: false }),
  
  togglePanel: (tab) => {
    const { isOpen, activeTab } = get();
    if (isOpen && (!tab || tab === activeTab)) {
      set({ isOpen: false });
    } else {
      set({ isOpen: true, activeTab: tab || activeTab });
    }
  },
  
  // setActiveTab also opens the panel (for vertical tab clicks)
  setActiveTab: (tab) => set({ activeTab: tab, isOpen: true }),
}));

export default useRightPanel;
