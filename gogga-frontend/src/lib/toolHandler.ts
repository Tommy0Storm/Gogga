/**
 * GOGGA Tool Handler
 *
 * Executes tools called by the AI and returns results.
 * Tools are defined in the backend but executed on the frontend
 * because they operate on client-side data (IndexedDB).
 */

import {
  createMemory,
  deleteGoggaMemory,
  getAllMemories,
  trackToolUsage,
  type MemoryCategory,
} from './db';
import { toolExecutionEmitter } from './toolExecutionEmitter';

// =============================================================================
// Types
// =============================================================================

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  success: boolean;
  result: string;
  error?: string;
}

export interface SaveMemoryArgs {
  title: string;
  content: string;
  category: MemoryCategory;
  priority: number;
}

export interface DeleteMemoryArgs {
  memory_title: string;
  reason: string;
}

export interface GenerateImageArgs {
  prompt: string;
  style?: 'photorealistic' | 'artistic' | 'cartoon' | 'sketch' | '3d-render';
  tier?: string; // User tier for provider routing (free/jive/jigga)
}

export interface CreateChartArgs {
  chart_type:
    | 'line'
    | 'bar'
    | 'pie'
    | 'area'
    | 'scatter'
    | 'radar'
    | 'radialBar'
    | 'composed'
    | 'funnel'
    | 'treemap';
  title: string;
  subtitle?: string;
  data: Array<{
    name?: string;
    value?: number;
    value2?: number;
    x?: number;
    y?: number;
    [key: string]: unknown;
  }>;
  x_label?: string;
  y_label?: string;
  colors?: string[];
  series?: Array<{ name: string; dataKey: string; color?: string }>;
}

export interface GeneratedImageResult {
  type: 'image';
  image_url: string;
  prompt: string;
  style?: string;
}

export interface ChartResult {
  type: 'chart';
  chart_type: string;
  title: string;
  subtitle?: string;
  data: Array<Record<string, unknown>>;
  x_label?: string;
  y_label?: string;
  colors?: string[];
  series?: Array<{ name: string; dataKey: string; color?: string }>;
}

export interface MathResult {
  type: 'math';
  success: boolean;
  display_type:
    | 'stat_cards'
    | 'data_table'
    | 'chart'
    | 'alert_cards'
    | 'formula';
  data: Record<string, unknown>;
  error?: string;
}

export interface GenerateVideoArgs {
  prompt: string;
  style?: 'cinematic' | 'realistic' | 'animated' | 'abstract';
  generate_audio?: boolean;
  tier?: string;
}

export interface GeneratedVideoResult {
  type: 'video';
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  prompt: string;
  style?: string;
  message?: string;
}

export interface GenerateDocumentArgs {
  content: string;
  document_type?: string;
  language?: string;
  formality?: 'formal' | 'semi-formal' | 'casual';
  include_sa_context?: boolean;
  additional_requirements?: string;
  tier?: string;
}

export interface GeneratedDocumentResult {
  type: 'document';
  title: string;
  content: string;
  document_type: string;
  language: string;
  word_count: number;
  sections?: string[];
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Save a memory to IndexedDB
 * Called by AI when user asks to remember something
 * For name updates, deletes existing name memories first
 */
async function executeSaveMemory(args: SaveMemoryArgs): Promise<ToolResult> {
  try {
    const { title, content, category, priority } = args;

    // Validate inputs
    if (!title || !content) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required fields: title and content',
      };
    }

    // Validate category
    const validCategories: MemoryCategory[] = [
      'personal',
      'project',
      'reference',
      'custom',
    ];
    const safeCategory: MemoryCategory = validCategories.includes(category)
      ? category
      : 'personal';

    // Clamp priority
    const safePriority = Math.max(1, Math.min(10, priority || 5));

    // Check if this is a name-related memory and delete existing ones
    const titleLower = title.toLowerCase();
    const isNameMemory =
      titleLower.includes('my name is') ||
      titleLower.includes('name is') ||
      titleLower.includes('user name');

    if (isNameMemory) {
      // Delete existing name memories to prevent duplicates
      const allMemories = await getAllMemories();
      for (const mem of allMemories) {
        if (
          mem.source === 'gogga' &&
          mem.id &&
          (mem.title.toLowerCase().includes('my name is') ||
            mem.title.toLowerCase().includes('name is') ||
            mem.title.toLowerCase().includes('user name'))
        ) {
          await deleteGoggaMemory(mem.id);
          console.log('[ToolHandler] Deleted old name memory:', mem.title);
        }
      }
    }

    // Create the memory with source='gogga' (AI-created)
    const memoryId = await createMemory({
      title: title.slice(0, 100), // Max 100 chars for title
      content: content.slice(0, 10000), // Max 10000 chars for content
      category: safeCategory,
      priority: safePriority,
      source: 'gogga', // Source: AI-created memory
      isActive: true,
      tokenCount: Math.ceil(content.length / 4),
    });

    console.log('[ToolHandler] Memory saved:', {
      id: memoryId,
      title,
      category: safeCategory,
      isNameMemory,
    });

    return {
      tool_call_id: '',
      success: true,
      result: `Memory saved successfully with ID ${memoryId}. Title: "${title}"`,
    };
  } catch (error) {
    console.error('[ToolHandler] Failed to save memory:', error);
    return {
      tool_call_id: '',
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Failed to save memory',
    };
  }
}

/**
 * Delete a GOGGA-created memory
 * Can only delete memories with source='gogga'
 */
async function executeDeleteMemory(
  args: DeleteMemoryArgs
): Promise<ToolResult> {
  try {
    const { memory_title, reason } = args;

    if (!memory_title) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: memory_title',
      };
    }

    // Find memories matching the title (partial match)
    const allMemories = await getAllMemories();
    const matchingMemory = allMemories.find(
      (m) =>
        m.title.toLowerCase().includes(memory_title.toLowerCase()) &&
        m.source === 'gogga'
    );

    if (!matchingMemory) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: `No GOGGA-created memory found matching "${memory_title}". User-created memories cannot be deleted by the AI.`,
      };
    }

    // Delete the memory
    const deleted = await deleteGoggaMemory(matchingMemory.id!);

    if (deleted) {
      console.log('[ToolHandler] Memory deleted:', {
        id: matchingMemory.id,
        title: matchingMemory.title,
        reason,
      });
      return {
        tool_call_id: '',
        success: true,
        result: `Memory "${matchingMemory.title}" deleted. Reason: ${reason}`,
      };
    } else {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Memory could not be deleted (may be user-created)',
      };
    }
  } catch (error) {
    console.error('[ToolHandler] Failed to delete memory:', error);
    return {
      tool_call_id: '',
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Failed to delete memory',
    };
  }
}

// =============================================================================
// Main Executor
// =============================================================================

// Extended result type for multi-image generation
export interface GeneratedImagesResult {
  type: 'images';
  image_urls: string[];
  prompt: string;
  style?: string;
  providers: string[];
}

/**
 * Generate images using backend tier-based routing
 * FREE: Pollinations + AI Horde, JIVE/JIGGA: Vertex AI Imagen 3.0
 */
async function executeGenerateImage(
  args: GenerateImageArgs
): Promise<ToolResult> {
  try {
    const { prompt, style, tier } = args;

    if (!prompt) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: prompt',
      };
    }

    console.log('[ToolHandler] Generating image with tier:', tier || 'free');
    console.log('[ToolHandler] Calling backend for dual image generation...');

    // Call backend API for dual generation (tier-based routing)
    // FREE: Pollinations + AI Horde, JIVE/JIGGA: Vertex AI Imagen 3.0
    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'generate_image',
        arguments: { prompt, style, tier: tier || 'free' },
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.result) {
      throw new Error(data.error || 'Backend returned failure');
    }

    const backendResult = data.result;
    const imageUrls: string[] = backendResult.image_urls || [
      backendResult.image_url,
    ];
    const providers: string[] = backendResult.providers || ['pollinations'];

    console.log(
      `[ToolHandler] Received ${
        imageUrls.length
      } image(s) from: ${providers.join(', ')}`
    );

    // Return structured result for the UI to render
    // Use 'images' type for multiple, 'image' for single (backward compat)
    if (imageUrls.length > 1) {
      const imagesResult: GeneratedImagesResult = {
        type: 'images',
        image_urls: imageUrls,
        prompt: prompt,
        style: style,
        providers: providers,
      };
      return {
        tool_call_id: '',
        success: true,
        result: JSON.stringify(imagesResult),
      };
    } else {
      // Single image - use original format for backward compatibility
      const imageResult: GeneratedImageResult = {
        type: 'image',
        image_url: imageUrls[0] ?? '',
        prompt: prompt,
        style: style,
      };
      return {
        tool_call_id: '',
        success: true,
        result: JSON.stringify(imageResult),
      };
    }
  } catch (error) {
    console.error('[ToolHandler] Failed to generate image:', error);

    // Fallback to Pollinations URL if backend fails
    console.log('[ToolHandler] Falling back to direct Pollinations URL...');
    const { prompt, style } = args;
    let fullPrompt = prompt;
    if (style) {
      const styleHints: Record<string, string> = {
        photorealistic: 'photorealistic, highly detailed, 8k resolution',
        artistic: 'artistic, painterly, expressive brushstrokes',
        cartoon: 'cartoon style, colorful, animated',
        sketch: 'pencil sketch, hand-drawn, black and white',
        '3d-render': '3D render, CGI, volumetric lighting',
      };
      if (styleHints[style]) {
        fullPrompt = `${prompt}, ${styleHints[style]}`;
      }
    }
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

    const imageResult: GeneratedImageResult = {
      type: 'image',
      image_url: fallbackUrl,
      prompt: prompt,
      style: style,
    };

    return {
      tool_call_id: '',
      success: true,
      result: JSON.stringify(imageResult),
    };
  }
}

/**
 * Generate video using backend Veo 3.1 API
 * JIVE/JIGGA only - returns job_id for polling
 */
async function executeGenerateVideo(
  args: GenerateVideoArgs
): Promise<ToolResult> {
  try {
    const { prompt, style, generate_audio = true, tier } = args;

    if (!prompt) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: prompt',
      };
    }

    // FREE tier cannot generate videos
    if (!tier || tier.toLowerCase() === 'free') {
      const errorResult: GeneratedVideoResult = {
        type: 'video',
        job_id: '',
        status: 'failed',
        prompt,
        message:
          'Video generation is only available for JIVE and JIGGA tiers. Please upgrade to create videos.',
      };
      return {
        tool_call_id: '',
        success: false,
        result: JSON.stringify(errorResult),
        error: 'Video generation requires JIVE or JIGGA tier',
      };
    }

    console.log('[ToolHandler] Starting video generation with tier:', tier);

    // Call backend via tools/execute endpoint (consistent with image generation)
    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'generate_video',
        arguments: {
          prompt,
          generate_audio,
          tier: tier,
          style: style,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error ||
          errorData.detail ||
          `Backend returned ${response.status}`
      );
    }

    const data = await response.json();

    // Handle tools/execute response format: {success, result, error}
    if (!data.success) {
      throw new Error(data.error || 'Video generation failed');
    }

    const backendResult = data.result;

    // Return job info for frontend to poll
    const videoResult: GeneratedVideoResult = {
      type: 'video',
      job_id: backendResult.job_id,
      status: backendResult.status || 'pending',
      prompt,
      style,
      message:
        backendResult.message ||
        'Video generation started. This takes 30-60 seconds. The video will appear when ready.',
    };

    console.log(
      '[ToolHandler] Video generation started, job_id:',
      backendResult.job_id
    );

    return {
      tool_call_id: '',
      success: true,
      result: JSON.stringify(videoResult),
    };
  } catch (error) {
    console.error('[ToolHandler] Failed to generate video:', error);

    const errorResult: GeneratedVideoResult = {
      type: 'video',
      job_id: '',
      status: 'failed',
      prompt: args.prompt,
      message:
        error instanceof Error
          ? error.message
          : 'Failed to start video generation',
    };

    return {
      tool_call_id: '',
      success: false,
      result: JSON.stringify(errorResult),
      error:
        error instanceof Error ? error.message : 'Failed to generate video',
    };
  }
}

/**
 * Generate a document via backend API
 * Documents are generated on the backend using AI
 */
async function executeGenerateDocument(
  args: GenerateDocumentArgs
): Promise<ToolResult> {
  const {
    content,
    document_type,
    language,
    formality,
    include_sa_context,
    additional_requirements,
    tier,
  } = args;

  try {
    console.log('[ToolHandler] Generating document with tier:', tier || 'free');

    // Emit start event
    toolExecutionEmitter.emit({
      type: 'start',
      toolName: 'generate_document',
      message: `Generating ${document_type || 'document'}...`,
      level: 'info',
      icon: '📄',
      data: { document_type, language },
    });

    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'generate_document',
        arguments: {
          content,
          document_type: document_type || 'general',
          language: language || 'en',
          formality: formality || 'formal',
          include_sa_context: include_sa_context !== false,
          additional_requirements,
        },
        tier: tier || 'free',
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Document generation failed');
    }

    const docResult = data.result;

    // Format as a document result for frontend rendering
    const documentResult: GeneratedDocumentResult = {
      type: 'document',
      title: docResult.title || 'Generated Document',
      content: docResult.content || docResult.document || '',
      document_type: docResult.document_type || document_type || 'general',
      language: docResult.language || language || 'en',
      word_count: docResult.word_count || 0,
      sections: docResult.sections,
    };

    console.log('[ToolHandler] Document generated:', {
      title: documentResult.title,
      wordCount: documentResult.word_count,
    });

    // Emit completion
    toolExecutionEmitter.emit({
      type: 'complete',
      toolName: 'generate_document',
      message: `Document generated: ${documentResult.title}`,
      level: 'success',
      icon: '✅',
      data: documentResult,
    });

    return {
      tool_call_id: '',
      success: true,
      result: JSON.stringify(documentResult),
    };
  } catch (error) {
    console.error('[ToolHandler] Failed to generate document:', error);

    toolExecutionEmitter.emit({
      type: 'error',
      toolName: 'generate_document',
      message:
        error instanceof Error ? error.message : 'Document generation failed',
      level: 'error',
      icon: '❌',
      data: null,
    });

    return {
      tool_call_id: '',
      success: false,
      result: '',
      error:
        error instanceof Error ? error.message : 'Failed to generate document',
    };
  }
}

/**
 * Create a chart configuration for frontend rendering
 */
function executeCreateChart(args: CreateChartArgs): ToolResult {
  try {
    const {
      chart_type,
      title,
      subtitle,
      data,
      x_label,
      y_label,
      colors,
      series,
    } = args;

    if (!chart_type || !title || !data) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required fields: chart_type, title, and data',
      };
    }

    const validTypes = [
      'line',
      'bar',
      'pie',
      'area',
      'scatter',
      'radar',
      'radialBar',
      'composed',
      'funnel',
      'treemap',
    ];
    if (!validTypes.includes(chart_type)) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: `Invalid chart type. Must be one of: ${validTypes.join(', ')}`,
      };
    }

    // Default colors (monochrome palette matching Gogga UI)
    const defaultColors = [
      '#1a1a1a',
      '#3a3a3a',
      '#5a5a5a',
      '#7a7a7a',
      '#2563eb',
      '#dc2626',
      '#16a34a',
      '#ca8a04',
    ];

    // For multi-series, we need colors for series not data points
    const numSeries = series?.length || 1;
    const chartColors =
      colors || defaultColors.slice(0, Math.max(numSeries, data.length));

    const chartResult: ChartResult = {
      type: 'chart',
      chart_type,
      title,
      ...(subtitle && { subtitle }),
      data,
      x_label,
      y_label,
      colors: chartColors,
      ...(series && { series }),
    };

    console.log(
      '[ToolHandler] Created chart config:',
      chart_type,
      'with',
      data.length,
      'data points'
    );

    return {
      tool_call_id: '',
      success: true,
      result: JSON.stringify(chartResult),
    };
  } catch (error) {
    console.error('[ToolHandler] Failed to create chart:', error);
    return {
      tool_call_id: '',
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Failed to create chart',
    };
  }
}

/**
 * Execute a math tool via backend API
 * Math tools are computed on the backend (statistics, financial, tax, etc.)
 */
async function executeMathTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Collect execution logs to embed in result
  const executionLogs: Array<{
    timestamp: string;
    level: 'info' | 'debug' | 'success' | 'error' | 'warn';
    message: string;
    icon?: string;
  }> = [];

  const addLog = (
    level: 'info' | 'debug' | 'success' | 'error' | 'warn',
    message: string,
    icon?: string
  ) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      icon,
    };
    executionLogs.push(logEntry);
    // Also emit to global listeners for any live subscribers
    toolExecutionEmitter.emit({
      type:
        level === 'error' ? 'error' : level === 'success' ? 'complete' : 'log',
      toolName,
      message,
      level,
      icon,
      data: null,
    });
  };

  try {
    console.log('[ToolHandler] Calling backend for math tool:', toolName);

    // Emit explicit start event for UI tracking
    toolExecutionEmitter.emit({
      type: 'start',
      toolName,
      message: `Starting ${toolName}...`,
      level: 'info',
      icon: '🔧',
      data: args,
    });

    // Log start
    addLog('info', `🔧 Starting ${toolName}...`, '🔧');
    addLog('info', `Calling backend API for ${toolName}`, '📡');

    // Log arguments summary
    const argsSummary = Object.entries(args)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: [${v.length} items]`;
        if (typeof v === 'number') return `${k}: ${v.toLocaleString('en-ZA')}`;
        return `${k}: ${v}`;
      })
      .join(', ');
    addLog('debug', `Args: ${argsSummary}`, '•');

    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        arguments: args,
      }),
    });

    if (!response.ok) {
      addLog('error', `Backend returned HTTP ${response.status}`, '❌');
      throw new Error(`Backend returned ${response.status}`);
    }

    addLog('info', 'Response received, parsing...', '📥');
    const data = await response.json();

    if (!data.success) {
      addLog('error', data.error || 'Calculation failed', '❌');
      throw new Error(data.error || 'Math calculation failed');
    }

    // Extract result data, handling nested structure
    const resultData = data.result?.data || data.result || {};

    // If backend returned calculation_steps, add them to execution logs
    const calculationSteps = resultData.calculation_steps as
      | Array<{
          step: number;
          description: string;
          formula: string;
          value: string | null;
        }>
      | undefined;

    if (calculationSteps && Array.isArray(calculationSteps)) {
      addLog('info', '━━━ Calculation Steps ━━━', '📐');
      for (const step of calculationSteps) {
        const valueStr = step.value ? ` → ${step.value}` : '';
        addLog('debug', `Step ${step.step}: ${step.description}`, '•');
        addLog('info', `   ${step.formula}${valueStr}`, '📝');
      }
      addLog('info', '━━━━━━━━━━━━━━━━━━━━━━━', '✓');
    }

    // Build the math result with embedded execution logs
    const mathResult: MathResult & { executionLogs?: typeof executionLogs } = {
      type: 'math',
      success: true, // Required for MathResultDisplay to render correctly
      display_type: data.result?.display_type || 'stat_cards',
      data: resultData,
      error: data.result?.error,
      executionLogs, // Embed logs in result for display
    };

    // Log success with result summary
    const dataKeys = Object.keys(mathResult.data).filter(
      (k) => k !== 'calculation_steps'
    );
    addLog('info', `Display type: ${mathResult.display_type}`, '🎨');
    addLog(
      'debug',
      `Result contains ${dataKeys.length} fields: ${dataKeys
        .slice(0, 5)
        .join(', ')}${dataKeys.length > 5 ? '...' : ''}`,
      '•'
    );
    addLog('success', `${toolName} completed successfully`, '✅');

    // Emit explicit complete event for UI tracking
    toolExecutionEmitter.emit({
      type: 'complete',
      toolName,
      message: `${toolName} completed successfully`,
      level: 'success',
      icon: '✅',
      data: mathResult,
    });

    console.log('[ToolHandler] Math result:', mathResult.display_type);

    return {
      tool_call_id: '',
      success: true,
      result: JSON.stringify(mathResult),
    };
  } catch (error) {
    console.error('[ToolHandler] Math tool failed:', error);
    addLog(
      'error',
      error instanceof Error ? error.message : 'Unknown error',
      '❌'
    );

    // Emit explicit error event for UI tracking
    toolExecutionEmitter.emit({
      type: 'error',
      toolName,
      message: error instanceof Error ? error.message : 'Unknown error',
      level: 'error',
      icon: '❌',
      data: error,
    });

    // Return error with logs
    const errorResult = {
      type: 'math',
      display_type: 'alert_cards',
      data: {},
      error: error instanceof Error ? error.message : 'Math calculation failed',
      executionLogs,
    };

    return {
      tool_call_id: '',
      success: false,
      result: JSON.stringify(errorResult),
      error: error instanceof Error ? error.message : 'Math calculation failed',
    };
  }
}

/**
 * Execute a tool call and return the result
 * @param toolCall - The tool call to execute
 * @param tier - Optional user tier for provider routing (image generation)
 */
export async function executeToolCall(
  toolCall: ToolCall,
  tier?: string
): Promise<ToolResult> {
  const startTime = performance.now();
  console.log(
    '[ToolHandler] Executing tool:',
    toolCall.name,
    toolCall.arguments,
    'tier:',
    tier || 'free'
  );

  let result: ToolResult;

  switch (toolCall.name) {
    case 'save_memory':
      result = await executeSaveMemory(
        toolCall.arguments as unknown as SaveMemoryArgs
      );
      break;

    case 'delete_memory':
      result = await executeDeleteMemory(
        toolCall.arguments as unknown as DeleteMemoryArgs
      );
      break;

    case 'generate_image':
      // Inject tier into args for provider routing
      result = await executeGenerateImage({
        ...(toolCall.arguments as unknown as GenerateImageArgs),
        tier: tier,
      });
      break;

    case 'generate_video':
      // Video generation - JIVE/JIGGA only
      result = await executeGenerateVideo({
        ...(toolCall.arguments as unknown as GenerateVideoArgs),
        tier: tier,
      });
      break;

    case 'generate_document':
      // Document generation - executed on backend
      result = await executeGenerateDocument({
        ...(toolCall.arguments as unknown as GenerateDocumentArgs),
        tier: tier,
      });
      break;

    case 'create_chart':
      result = executeCreateChart(
        toolCall.arguments as unknown as CreateChartArgs
      );
      break;

    // Math tools - executed on backend
    case 'math_statistics':
    case 'math_financial':
    case 'math_sa_tax':
    case 'math_probability':
    case 'math_conversion':
    case 'math_fraud_analysis':
    case 'python_execute':
      result = await executeMathTool(toolCall.name, toolCall.arguments);
      break;

    // Server-side tools that should NOT reach frontend
    // If these leak through, return friendly error (they should be handled backend-side)
    case 'web_search':
    case 'legal_search':
    case 'shopping_search':
    case 'places_search':
    case 'sequential_think':
      console.warn(
        `[ToolHandler] Server-side tool '${toolCall.name}' reached frontend - should be handled backend-side`
      );
      result = {
        tool_call_id: toolCall.id,
        success: false,
        result: '',
        error: `Tool '${toolCall.name}' should be executed server-side. Please try again.`,
      };
      break;

    default:
      result = {
        tool_call_id: toolCall.id,
        success: false,
        result: '',
        error: `Unknown tool: ${toolCall.name}`,
      };
  }

  // Set the tool_call_id
  result.tool_call_id = toolCall.id;

  // Track tool usage for analytics
  const executionTimeMs = Math.round(performance.now() - startTime);
  try {
    await trackToolUsage({
      toolName: toolCall.name,
      tier: tier || 'free',
      success: result.success,
      executionTimeMs,
    });
  } catch (error) {
    console.warn('[ToolHandler] Failed to track tool usage:', error);
  }

  return result;
}

/**
 * Execute multiple tool calls in sequence
 * @param toolCalls - Array of tool calls to execute
 * @param tier - Optional user tier for provider routing (image generation)
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  tier?: string
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, tier);
    results.push(result);
  }

  return results;
}

/**
 * Format tool results for display to user
 * Handles special formatting for images, charts, and memories
 * Returns special markers for images that ChatClient will render as thumbnails
 */
export function formatToolResultsMessage(results: ToolResult[]): string {
  const messages: string[] = [];
  console.log(
    '[ToolHandler] formatToolResultsMessage called with',
    results.length,
    'results'
  );

  for (const result of results) {
    console.log('[ToolHandler] Processing result:', {
      success: result.success,
      resultPreview: result.result?.substring(0, 100),
    });

    if (!result.success) {
      messages.push(`❌ ${result.error}`);
      continue;
    }

    // Try to parse JSON result for special handling
    try {
      const parsed = JSON.parse(result.result);
      console.log(
        '[ToolHandler] Parsed result type:',
        parsed.type,
        'display_type:',
        parsed.display_type
      );

      // Handle multi-image result (dual generation)
      // Return special format: __TOOL_IMAGES__:json for ChatClient to parse
      if (parsed.type === 'images' && Array.isArray(parsed.image_urls)) {
        const imageData = {
          urls: parsed.image_urls,
          providers: parsed.providers || [],
          prompt: parsed.prompt || '',
        };
        messages.push(`__TOOL_IMAGES__:${JSON.stringify(imageData)}`);
        continue;
      }

      // Handle single image result
      if (parsed.type === 'image' && parsed.image_url) {
        const imageData = {
          urls: [parsed.image_url],
          providers: [parsed.provider || 'unknown'],
          prompt: parsed.prompt || '',
        };
        messages.push(`__TOOL_IMAGES__:${JSON.stringify(imageData)}`);
        continue;
      }

      // Handle chart result - use special marker for frontend rendering
      if (parsed.type === 'chart') {
        console.log(
          '[ToolHandler] 📊 Chart detected, adding __TOOL_CHART__ marker'
        );
        messages.push(`__TOOL_CHART__:${JSON.stringify(parsed)}`);
        continue;
      }

      // Handle video result - use special marker for frontend rendering
      if (parsed.type === 'video') {
        console.log(
          '[ToolHandler] 🎬 Video detected, adding __TOOL_VIDEO__ marker'
        );
        messages.push(`__TOOL_VIDEO__:${JSON.stringify(parsed)}`);
        continue;
      }

      // Handle math result - use special marker for frontend rendering
      if (parsed.type === 'math') {
        console.log(
          '[ToolHandler] 🧮 Math detected, adding __TOOL_MATH__ marker'
        );
        messages.push(`__TOOL_MATH__:${JSON.stringify(parsed)}`);
        continue;
      }

      // Handle document result - display content directly as markdown
      if (parsed.type === 'document') {
        console.log('[ToolHandler] 📄 Document detected, displaying content');
        // For documents, we display the content directly with a header
        const docTitle = parsed.title || 'Generated Document';
        const docContent = parsed.content || '';
        const wordCount = parsed.word_count || 0;

        // Format as markdown with title header and content
        const documentDisplay = `## 📄 ${docTitle}\n\n${docContent}\n\n---\n*${wordCount} words • ${
          parsed.document_type || 'document'
        } • ${parsed.language || 'en'}*`;
        messages.push(documentDisplay);
        continue;
      }

      // Default: show the result as-is
      console.log('[ToolHandler] Default handling, type was:', parsed.type);
      messages.push(`✅ ${result.result}`);
    } catch (e) {
      // Not JSON, show as plain text
      console.log('[ToolHandler] Failed to parse JSON:', e);
      messages.push(`✅ ${result.result}`);
    }
  }

  console.log(
    '[ToolHandler] Final messages count:',
    messages.length,
    'First 200 chars:',
    messages.join('\n\n').substring(0, 200)
  );
  return messages.join('\n\n');
}
