/**
 * Media Creator Type Definitions
 * 
 * Shared types for Image and Video generation components.
 */

export type UserTier = 'free' | 'jive' | 'jigga';

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

export type ImageEditMode = 
  | 'EDIT_MODE_INPAINT_INSERTION'
  | 'EDIT_MODE_INPAINT_REMOVAL'
  | 'EDIT_MODE_OUTPAINT'
  | 'EDIT_MODE_BGSWAP';

export type UpscaleFactor = 'x2' | 'x3' | 'x4';

export type VideoResolution = '720p' | '1080p';

export type VideoDuration = 5 | 6 | 7 | 8;

// ============================================================================
// Image Types
// ============================================================================

export interface ImageCreateRequest {
  prompt: string;
  aspect_ratio?: AspectRatio;
  negative_prompt?: string;
  sample_count?: number;
  person_generation?: 'allow_adult' | 'dont_allow';
  safety_setting?: 'block_few' | 'block_some' | 'block_most';
  /** UUID v4 for request deduplication (prevents duplicate costs) */
  idempotency_key?: string;
}

export interface ImageEditRequest {
  prompt: string;
  source_image: string; // Base64
  mask_image?: string; // Base64
  edit_mode?: ImageEditMode;
  mask_dilation?: number;
  sample_count?: number;
  /** UUID v4 for request deduplication (prevents duplicate costs) */
  idempotency_key?: string;
}

export interface ImageUpscaleRequest {
  source_image: string; // Base64
  upscale_factor?: UpscaleFactor;
  /** UUID v4 for request deduplication (prevents duplicate costs) */
  idempotency_key?: string;
}

export interface GeneratedImage {
  data: string; // Base64
  mime_type: string;
}

export interface ImageResponse {
  success: boolean;
  images: GeneratedImage[];
  prompt: string;
  meta: {
    tier: string;
    model: string;
    operation: string;
    cost_usd: number;
    cost_zar: number;
    num_requested: number;
    num_generated: number;
  };
  error?: string;
}

// ============================================================================
// Video Types
// ============================================================================

export interface VideoGenerateRequest {
  prompt: string;
  source_image?: string; // Base64 for img2vid
  source_video?: string; // Base64 for video extension
  storage_uri?: string; // GCS URI
  aspect_ratio?: '16:9' | '9:16';
  duration_seconds?: VideoDuration;
  generate_audio?: boolean;
  negative_prompt?: string;
  person_generation?: 'allow_adult' | 'dont_allow';
  resolution?: VideoResolution;
  sample_count?: number;
  seed?: number;
  use_fast_model?: boolean;
  /** UUID v4 for request deduplication (prevents duplicate costs) */
  idempotency_key?: string;
}

export type VideoJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface VideoResponse {
  success: boolean;
  job_id?: string;
  status: VideoJobStatus;
  video_url?: string; // GCS URL when complete
  video_data?: string; // Base64 if downloaded
  prompt: string;
  duration_seconds: number;
  meta: {
    tier: string;
    model: string;
    generate_audio: boolean;
    estimated_cost_usd?: number;
    estimated_cost_zar?: number;
    cost_usd?: number;
    cost_zar?: number;
    progress_percent?: number;
    elapsed_seconds?: number;
  };
  error?: string;
}

// ============================================================================
// Quota Types
// ============================================================================

export interface MediaQuota {
  tier: UserTier;
  images: {
    create: number;
    edit: number;
    upscale: number;
    used_create: number;
    used_edit: number;
    used_upscale: number;
  };
  video_minutes: number;
  video_minutes_used: number;
  allow_audio: boolean;
}

// ============================================================================
// Pricing Constants (ZAR)
// ============================================================================

export const PRICING = {
  // Image pricing per image (ZAR at R18.50/$1)
  IMAGE_CREATE: 0.74, // $0.04
  IMAGE_EDIT: 0.74,   // $0.04
  UPSCALE_V3: 0.74,   // $0.04
  UPSCALE_V4: 1.11,   // $0.06
  
  // Video pricing per second (ZAR)
  VIDEO_ONLY: 3.70,   // $0.20
  VIDEO_AUDIO: 7.40,  // $0.40
} as const;

// Tier limits
export const TIER_LIMITS = {
  free: {
    images_create: 1,
    images_edit: 0,
    images_upscale: 0,
    video_minutes: 0,
    allow_audio: false,
    watermark: true,
  },
  jive: {
    images_create: 50,
    images_edit: 20,
    images_upscale: 20,
    video_minutes: 5,
    allow_audio: true,
    watermark: false,
  },
  jigga: {
    images_create: 200,
    images_edit: 100,
    images_upscale: 50,
    video_minutes: 20,
    allow_audio: true,
    watermark: false,
  },
} as const;
