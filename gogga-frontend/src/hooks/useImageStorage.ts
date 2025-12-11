/**
 * useImageStorage Hook
 * Stores generated images in Dexie with thumbnails
 * Supports soft-delete with placeholder display
 */

'use client';

import { useState, useCallback } from 'react';
import {
  type GeneratedImage,
  saveGeneratedImage,
  getSessionImages,
  softDeleteImage,
  getImage,
} from '@/lib/db';

interface UseImageStorageReturn {
  saveImage: (
    sessionId: string,
    prompt: string,
    enhancedPrompt: string,
    imageData: string,
    tier: string,
    model: string
  ) => Promise<number>;
  deleteImage: (imageId: number) => Promise<void>;
  getImageById: (imageId: number) => Promise<GeneratedImage | undefined>;
  getImagesForSession: (sessionId: string) => Promise<GeneratedImage[]>;
}

/**
 * Create a 2x thumbnail from base64 image data
 * Maintains quality while reducing storage for display
 */
async function createThumbnail(
  imageData: string,
  mimeType: string,
  maxWidth: number = 512  // 2x typical thumbnail display size
): Promise<{ thumbnail: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw scaled image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Get as base64 (JPEG for smaller size)
      const thumbnail = canvas.toDataURL('image/jpeg', 0.85);
      
      resolve({
        thumbnail: thumbnail.split(',')[1], // Remove data: prefix
        width: img.width,
        height: img.height,
      });
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    
    // Load image from base64
    const prefix = imageData.startsWith('data:') ? '' : `data:${mimeType};base64,`;
    img.src = `${prefix}${imageData}`;
  });
}

/**
 * Detect MIME type from base64 data
 */
function detectMimeType(base64: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg'; // Default
}

export function useImageStorage(): UseImageStorageReturn {
  const saveImage = useCallback(async (
    sessionId: string,
    prompt: string,
    enhancedPrompt: string,
    imageData: string,
    tier: string,
    model: string
  ): Promise<number> => {
    // Clean image data (remove data: prefix if present)
    let cleanData = imageData;
    if (imageData.startsWith('data:')) {
      cleanData = imageData.split(',')[1];
    }
    
    const mimeType = detectMimeType(cleanData);
    
    // Create thumbnail
    const { thumbnail, width, height } = await createThumbnail(cleanData, mimeType);
    
    // Save to Dexie
    const imageId = await saveGeneratedImage(sessionId, {
      prompt,
      enhancedPrompt,
      thumbnailData: thumbnail,
      fullImageData: cleanData,
      mimeType,
      width,
      height,
      tier,
      model,
    });
    
    return imageId;
  }, []);

  const deleteImage = useCallback(async (imageId: number) => {
    await softDeleteImage(imageId);
  }, []);

  const getImageById = useCallback(async (imageId: number) => {
    return getImage(imageId);
  }, []);

  const getImagesForSession = useCallback(async (sessionId: string) => {
    return getSessionImages(sessionId);
  }, []);

  return {
    saveImage,
    deleteImage,
    getImageById,
    getImagesForSession,
  };
}

export default useImageStorage;
