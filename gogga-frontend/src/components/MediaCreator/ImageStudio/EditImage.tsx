/**
 * EditImage Component
 * 
 * Image editing interface with mask-based inpainting.
 * Upload → Draw Mask → Select Edit Mode → Apply → Results
 */

'use client';

import { useState, useCallback } from 'react';
import { Upload, Wand2, Sparkles, Download, Loader2, Trash2, Plus, Replace, Image as ImageIcon } from 'lucide-react';
import {
  type UserTier,
  type ImageEditMode,
  type ImageEditRequest,
  type ImageResponse,
  type GeneratedImage,
  editImage,
  fileToBase64,
  downloadBase64Image,
} from '../shared';
import { CostEstimate, TierGate, WatermarkOverlay } from '../shared';
import { MaskEditor } from './MaskEditor';

interface EditImageProps {
  tier: UserTier;
  /** Pre-loaded image from CreateImage */
  initialImage?: GeneratedImage;
  onUpgrade?: () => void;
  onUpscale?: (image: GeneratedImage) => void;
}

const EDIT_MODES: { value: ImageEditMode; label: string; description: string; icon: typeof Plus }[] = [
  {
    value: 'EDIT_MODE_INPAINT_INSERTION',
    label: 'Insert',
    description: 'Add new elements to masked areas',
    icon: Plus,
  },
  {
    value: 'EDIT_MODE_INPAINT_REMOVAL',
    label: 'Remove',
    description: 'Remove objects from masked areas',
    icon: Trash2,
  },
  {
    value: 'EDIT_MODE_BGSWAP',
    label: 'Background',
    description: 'Replace the background',
    icon: Replace,
  },
];

export function EditImage({
  tier,
  initialImage,
  onUpgrade,
  onUpscale,
}: EditImageProps) {
  // Source image
  const [sourceImage, setSourceImage] = useState<string | null>(initialImage?.data || null);
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  
  // Mask
  const [maskImage, setMaskImage] = useState<string>('');
  
  // Form state
  const [prompt, setPrompt] = useState('');
  const [editMode, setEditMode] = useState<ImageEditMode>('EDIT_MODE_INPAINT_INSERTION');
  const [maskDilation, setMaskDilation] = useState(0.03);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Step tracking
  const [step, setStep] = useState<'upload' | 'mask' | 'edit'>('upload');
  
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64 = await fileToBase64(file);
      setSourceImage(base64);
      setSourceImageFile(file);
      setStep('mask');
    } catch (err) {
      setError('Failed to load image');
    }
  }, []);
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    try {
      const base64 = await fileToBase64(file);
      setSourceImage(base64);
      setSourceImageFile(file);
      setStep('mask');
    } catch (err) {
      setError('Failed to load image');
    }
  }, []);
  
  const handleMaskChange = useCallback((mask: string) => {
    setMaskImage(mask);
    if (mask && step === 'mask') {
      setStep('edit');
    }
  }, [step]);
  
  const handleEdit = useCallback(async () => {
    if (!sourceImage || !prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setResult(null);
    
    try {
      const request: ImageEditRequest = {
        prompt,
        source_image: sourceImage,
        mask_image: maskImage || undefined,
        edit_mode: editMode,
        mask_dilation: maskDilation,
        sample_count: 1,
      };
      
      const response = await editImage(request, { userTier: tier });
      setResult(response);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Editing failed');
    } finally {
      setIsGenerating(false);
    }
  }, [sourceImage, maskImage, prompt, editMode, maskDilation, tier]);
  
  const handleDownload = useCallback((image: GeneratedImage, index: number) => {
    const filename = `gogga-edited-${Date.now()}-${index + 1}.png`;
    downloadBase64Image(image.data, filename, image.mime_type);
  }, []);
  
  const resetEditor = useCallback(() => {
    setSourceImage(null);
    setSourceImageFile(null);
    setMaskImage('');
    setPrompt('');
    setResult(null);
    setError(null);
    setStep('upload');
  }, []);
  
  return (
    <TierGate
      tier={tier}
      requiredTier="jive"
      featureName="Image Editing"
      onUpgrade={onUpgrade}
    >
      <div className="space-y-6">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl 
                     p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="edit-image-upload"
            />
            <label htmlFor="edit-image-upload" className="cursor-pointer block">
              <Upload className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
              <p className="text-lg font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Upload an image to edit
              </p>
              <p className="text-sm text-neutral-500">
                Drag and drop or click to select
              </p>
              <p className="text-xs text-neutral-400 mt-2">
                PNG, JPG up to 10MB
              </p>
            </label>
          </div>
        )}
        
        {/* Step 2: Draw Mask */}
        {step === 'mask' && sourceImage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-neutral-900 dark:text-white">
                Draw your mask
              </h3>
              <button
                onClick={resetEditor}
                className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                Upload different image
              </button>
            </div>
            
            <MaskEditor
              sourceImage={sourceImage}
              onMaskChange={handleMaskChange}
              width={480}
              height={400}
            />
            
            {maskImage && (
              <button
                onClick={() => setStep('edit')}
                className="w-full py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 
                         font-medium rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
              >
                Continue to Edit
              </button>
            )}
          </div>
        )}
        
        {/* Step 3: Edit Options */}
        {step === 'edit' && sourceImage && (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img
                src={`data:image/png;base64,${sourceImage}`}
                alt="Source"
                className="w-full max-h-64 object-contain"
              />
              {maskImage && (
                <div className="absolute inset-0 opacity-30">
                  <img
                    src={`data:image/png;base64,${maskImage}`}
                    alt="Mask"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <button
                onClick={() => setStep('mask')}
                className="absolute bottom-2 right-2 px-3 py-1 bg-white/90 text-neutral-900 text-sm 
                         rounded-lg hover:bg-white transition-colors"
              >
                Edit Mask
              </button>
            </div>
            
            {/* Edit mode */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Edit Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EDIT_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setEditMode(mode.value)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        editMode === mode.value
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${
                        editMode === mode.value ? 'text-primary-600' : 'text-neutral-400'
                      }`} />
                      <div className="text-sm font-medium">{mode.label}</div>
                      <div className="text-xs text-neutral-500">{mode.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {editMode === 'EDIT_MODE_INPAINT_REMOVAL'
                  ? 'What should replace the removed area?'
                  : editMode === 'EDIT_MODE_BGSWAP'
                  ? 'Describe the new background'
                  : 'Describe what to add'}
              </label>
              <textarea
                id="edit-image-prompt"
                name="edit-image-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  editMode === 'EDIT_MODE_INPAINT_REMOVAL'
                    ? 'Clean floor, empty space...'
                    : editMode === 'EDIT_MODE_BGSWAP'
                    ? 'A beautiful sunset over the ocean...'
                    : 'A red rose, a cat, a spaceship...'
                }
                className="w-full h-20 px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 
                         dark:border-neutral-700 rounded-lg resize-none focus:ring-2 focus:ring-primary-500"
                disabled={isGenerating}
              />
            </div>
            
            {/* Cost estimate */}
            <CostEstimate operation="edit" count={1} tier={tier} />
            
            {/* Generate button */}
            <button
              onClick={handleEdit}
              disabled={!prompt.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-neutral-900 dark:bg-white 
                       text-white dark:text-neutral-900 font-medium rounded-lg hover:bg-neutral-800 
                       dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Editing...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  Apply Edit
                </>
              )}
            </button>
          </div>
        )}
        
        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        {/* Results */}
        {result?.success && result.images.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Edit Result
            </h3>
            
            {result.images.map((image, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <WatermarkOverlay showWatermark={tier === 'free'} onUpgrade={onUpgrade}>
                  <img
                    src={`data:${image.mime_type};base64,${image.data}`}
                    alt={`Edited image ${index + 1}`}
                    className="w-full h-auto"
                  />
                </WatermarkOverlay>
                
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-linear-to-t from-black/60 to-transparent 
                              opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(image, index)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white/90 
                               text-neutral-900 text-sm rounded hover:bg-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    {onUpscale && (
                      <button
                        onClick={() => onUpscale(image)}
                        className="px-3 py-1.5 bg-white/90 text-neutral-900 text-sm rounded 
                                 hover:bg-white transition-colors"
                      >
                        Upscale
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <div className="flex gap-2">
              <button
                onClick={() => setStep('mask')}
                className="flex-1 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 
                         dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                Edit Again
              </button>
              <button
                onClick={resetEditor}
                className="flex-1 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 
                         dark:text-neutral-300 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                New Image
              </button>
            </div>
          </div>
        )}
      </div>
    </TierGate>
  );
}

export default EditImage;
