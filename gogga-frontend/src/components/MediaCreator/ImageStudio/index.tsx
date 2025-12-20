/**
 * ImageStudio Component
 * 
 * Main container for image creation, editing, and upscaling.
 * Tab-based navigation between features.
 */

'use client';

import { useState, useCallback } from 'react';
import { Wand2, Edit, ArrowUpCircle, Sparkles } from 'lucide-react';
import type { UserTier, GeneratedImage, MediaQuota } from '../shared';
import { CreateImage } from './CreateImage';
import { EditImage } from './EditImage';
import { UpscaleChoice } from './UpscaleChoice';
export { ImageViewer } from './ImageViewer';

interface ImageStudioProps {
  tier: UserTier;
  quota?: MediaQuota;
  onUpgrade?: () => void;
}

type Tab = 'create' | 'edit' | 'upscale';

const TABS: { id: Tab; label: string; icon: typeof Wand2; description: string }[] = [
  { id: 'create', label: 'Create', icon: Wand2, description: 'Generate from text' },
  { id: 'edit', label: 'Edit', icon: Edit, description: 'Modify with masks' },
  { id: 'upscale', label: 'Upscale', icon: ArrowUpCircle, description: 'Enhance resolution' },
];

export function ImageStudio({ tier, quota, onUpgrade }: ImageStudioProps) {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  
  // Handle image flow between tabs
  const handleEditImage = useCallback((image: GeneratedImage) => {
    setSelectedImage(image);
    setActiveTab('edit');
  }, []);
  
  const handleUpscaleImage = useCallback((image: GeneratedImage) => {
    setSelectedImage(image);
    setActiveTab('upscale');
  }, []);
  
  // Build quota info for each tab
  const createQuota = quota ? {
    used: quota.images.used_create,
    limit: quota.images.create,
  } : undefined;
  
  const editQuota = quota ? {
    used: quota.images.used_edit,
    limit: quota.images.edit,
  } : undefined;
  
  const upscaleQuota = quota ? {
    used: quota.images.used_upscale,
    limit: quota.images.upscale,
  } : undefined;
  
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <Sparkles className="w-5 h-5 text-primary-500" />
        <h2 className="font-bold text-neutral-900 dark:text-white">Image Studio</h2>
        <span className="ml-auto text-xs text-neutral-500 uppercase">{tier}</span>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isLocked = tab.id !== 'create' && tier === 'free';
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-all
                       border-b-2 ${
                         isActive
                           ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white font-medium'
                           : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                       }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {isLocked && (
                <span className="text-[10px] px-1 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 
                               text-yellow-700 dark:text-yellow-400 rounded">
                  JIVE+
                </span>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'create' && (
          <CreateImage
            tier={tier}
            onEdit={handleEditImage}
            onUpscale={handleUpscaleImage}
            onUpgrade={onUpgrade}
            quota={createQuota}
          />
        )}
        
        {activeTab === 'edit' && (
          <EditImage
            tier={tier}
            initialImage={selectedImage || undefined}
            onUpgrade={onUpgrade}
            onUpscale={handleUpscaleImage}
          />
        )}
        
        {activeTab === 'upscale' && (
          <UpscaleChoice
            tier={tier}
            initialImage={selectedImage || undefined}
            onUpgrade={onUpgrade}
          />
        )}
      </div>
    </div>
  );
}

export default ImageStudio;
