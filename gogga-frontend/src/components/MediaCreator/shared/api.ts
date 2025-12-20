/**
 * Media API Client
 * 
 * Handles all API calls to the media endpoints.
 * Supports idempotency keys for duplicate cost prevention.
 */

import type {
  ImageCreateRequest,
  ImageEditRequest,
  ImageUpscaleRequest,
  ImageResponse,
  VideoGenerateRequest,
  VideoResponse,
  MediaQuota,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiOptions {
  userTier?: string;
  userId?: string;
}

/**
 * Generate a UUID v4 idempotency key.
 * Use this for all generation requests to prevent duplicate costs on retry.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function mediaFetch<T>(
  endpoint: string,
  options: RequestInit & ApiOptions = {}
): Promise<T> {
  const { userTier, userId, ...fetchOptions } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  
  if (userTier) headers['X-User-Tier'] = userTier;
  if (userId) headers['X-User-ID'] = userId;
  
  const response = await fetch(`${API_BASE}/api/v1/media${endpoint}`, {
    ...fetchOptions,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Image API
// ============================================================================

export async function generateImage(
  request: ImageCreateRequest,
  options?: ApiOptions
): Promise<ImageResponse> {
  // Auto-generate idempotency key if not provided
  const requestWithKey = {
    ...request,
    idempotency_key: request.idempotency_key || generateIdempotencyKey(),
  };
  
  return mediaFetch<ImageResponse>('/images/generate', {
    method: 'POST',
    body: JSON.stringify(requestWithKey),
    ...options,
  });
}

export async function editImage(
  request: ImageEditRequest,
  options?: ApiOptions
): Promise<ImageResponse> {
  // Auto-generate idempotency key if not provided
  const requestWithKey = {
    ...request,
    idempotency_key: request.idempotency_key || generateIdempotencyKey(),
  };
  
  return mediaFetch<ImageResponse>('/images/edit', {
    method: 'POST',
    body: JSON.stringify(requestWithKey),
    ...options,
  });
}

export async function upscaleImage(
  request: ImageUpscaleRequest,
  options?: ApiOptions
): Promise<ImageResponse> {
  // Auto-generate idempotency key if not provided
  const requestWithKey = {
    ...request,
    idempotency_key: request.idempotency_key || generateIdempotencyKey(),
  };
  
  return mediaFetch<ImageResponse>('/images/upscale', {
    method: 'POST',
    body: JSON.stringify(requestWithKey),
    ...options,
  });
}

// ============================================================================
// Video API
// ============================================================================

export async function generateVideo(
  request: VideoGenerateRequest,
  options?: ApiOptions
): Promise<VideoResponse> {
  // Auto-generate idempotency key if not provided
  const requestWithKey = {
    ...request,
    idempotency_key: request.idempotency_key || generateIdempotencyKey(),
  };
  
  return mediaFetch<VideoResponse>('/videos/generate', {
    method: 'POST',
    body: JSON.stringify(requestWithKey),
    ...options,
  });
}

export async function getVideoStatus(
  jobId: string,
  options?: ApiOptions
): Promise<VideoResponse> {
  return mediaFetch<VideoResponse>(`/videos/${jobId}/status`, {
    method: 'GET',
    ...options,
  });
}

export async function getVideoResult(
  jobId: string,
  wait = false,
  timeout = 300,
  options?: ApiOptions
): Promise<VideoResponse> {
  const params = new URLSearchParams();
  if (wait) params.set('wait', 'true');
  params.set('timeout', String(timeout));
  
  return mediaFetch<VideoResponse>(`/videos/${jobId}/result?${params}`, {
    method: 'GET',
    ...options,
  });
}

// ============================================================================
// Quota API
// ============================================================================

export async function getMediaQuota(options?: ApiOptions): Promise<MediaQuota> {
  return mediaFetch<MediaQuota>('/quota', {
    method: 'GET',
    ...options,
  });
}

export async function checkMediaHealth(): Promise<{ status: string }> {
  return mediaFetch<{ status: string }>('/health', {
    method: 'GET',
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const parts = result.split(',');
      const base64 = parts.length > 1 ? (parts[1] ?? result) : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBase64Image(base64: string, filename: string, mimeType = 'image/png') {
  const blob = base64ToBlob(base64, mimeType);
  downloadBlob(blob, filename);
}
