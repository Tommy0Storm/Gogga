/**
 * GOGGA Tool Handler
 * 
 * Executes tools called by the AI and returns results.
 * Tools are defined in the backend but executed on the frontend
 * because they operate on client-side data (IndexedDB).
 */

import { createMemory, deleteGoggaMemory, getAllMemories, type MemoryCategory } from './db';
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
  data: Array<{ name?: string; value?: number; x?: number; y?: number }>;
  x_label?: string;
  y_label?: string;
  colors?: string[];
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
  data: Array<Record<string, unknown>>;
  x_label?: string;
  y_label?: string;
  colors?: string[];
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
    const memoryId = await createMemory(
      title.slice(0, 100), // Max 100 chars for title
      content.slice(0, 10000), // Max 10000 chars for content
      safeCategory,
      safePriority,
      'gogga' // Source: AI-created memory
    );

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
 * Generate images using backend dual generation (Pollinations + AI Horde)
 * Calls the backend API to get multiple images in parallel
 */
async function executeGenerateImage(
  args: GenerateImageArgs
): Promise<ToolResult> {
  try {
    const { prompt, style } = args;

    if (!prompt) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: prompt',
      };
    }

    console.log('[ToolHandler] Calling backend for dual image generation...');

    // Call backend API for dual generation (Pollinations + AI Horde)
    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'generate_image',
        arguments: { prompt, style },
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
        image_url: imageUrls[0],
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
 * Create a chart configuration for frontend rendering
 */
function executeCreateChart(args: CreateChartArgs): ToolResult {
  try {
    const { chart_type, title, data, x_label, y_label, colors } = args;

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

    const chartResult: ChartResult = {
      type: 'chart',
      chart_type,
      title,
      data,
      x_label,
      y_label,
      colors: colors || defaultColors.slice(0, data.length),
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

    // Build the math result with embedded execution logs
    const mathResult: MathResult & { executionLogs?: typeof executionLogs } = {
      type: 'math',
      success: true, // Required for MathResultDisplay to render correctly
      display_type: data.result?.display_type || 'stat_cards',
      data: data.result?.data || data.result || {},
      error: data.result?.error,
      executionLogs, // Embed logs in result for display
    };

    // Log success with result summary
    const dataKeys = Object.keys(mathResult.data);
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
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  console.log(
    '[ToolHandler] Executing tool:',
    toolCall.name,
    toolCall.arguments
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
      result = await executeGenerateImage(
        toolCall.arguments as unknown as GenerateImageArgs
      );
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
      result = await executeMathTool(toolCall.name, toolCall.arguments);
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

  return result;
}

/**
 * Execute multiple tool calls in sequence
 */
export async function executeToolCalls(
  toolCalls: ToolCall[]
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall);
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

      // Handle math result - use special marker for frontend rendering
      if (parsed.type === 'math') {
        console.log(
          '[ToolHandler] 🧮 Math detected, adding __TOOL_MATH__ marker'
        );
        messages.push(`__TOOL_MATH__:${JSON.stringify(parsed)}`);
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
