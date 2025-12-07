/**
 * GOGGA Tool Handler
 * 
 * Executes tools called by the AI and returns results.
 * Tools are defined in the backend but executed on the frontend
 * because they operate on client-side data (IndexedDB).
 */

import { createMemory, deleteGoggaMemory, getAllMemories, type MemoryCategory } from './db';

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
  chart_type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
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
        error: 'Missing required fields: title and content'
      };
    }
    
    // Validate category
    const validCategories: MemoryCategory[] = ['personal', 'project', 'reference', 'custom'];
    const safeCategory: MemoryCategory = validCategories.includes(category) ? category : 'personal';
    
    // Clamp priority
    const safePriority = Math.max(1, Math.min(10, priority || 5));
    
    // Check if this is a name-related memory and delete existing ones
    const titleLower = title.toLowerCase();
    const isNameMemory = titleLower.includes('my name is') || 
                         titleLower.includes('name is') ||
                         titleLower.includes('user name');
    
    if (isNameMemory) {
      // Delete existing name memories to prevent duplicates
      const allMemories = await getAllMemories();
      for (const mem of allMemories) {
        if (mem.source === 'gogga' && mem.id && 
            (mem.title.toLowerCase().includes('my name is') ||
             mem.title.toLowerCase().includes('name is') ||
             mem.title.toLowerCase().includes('user name'))) {
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
    
    console.log('[ToolHandler] Memory saved:', { id: memoryId, title, category: safeCategory, isNameMemory });
    
    return {
      tool_call_id: '',
      success: true,
      result: `Memory saved successfully with ID ${memoryId}. Title: "${title}"`
    };
  } catch (error) {
    console.error('[ToolHandler] Failed to save memory:', error);
    return {
      tool_call_id: '',
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Failed to save memory'
    };
  }
}

/**
 * Delete a GOGGA-created memory
 * Can only delete memories with source='gogga'
 */
async function executeDeleteMemory(args: DeleteMemoryArgs): Promise<ToolResult> {
  try {
    const { memory_title, reason } = args;
    
    if (!memory_title) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: memory_title'
      };
    }
    
    // Find memories matching the title (partial match)
    const allMemories = await getAllMemories();
    const matchingMemory = allMemories.find(
      m => m.title.toLowerCase().includes(memory_title.toLowerCase()) && m.source === 'gogga'
    );
    
    if (!matchingMemory) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: `No GOGGA-created memory found matching "${memory_title}". User-created memories cannot be deleted by the AI.`
      };
    }
    
    // Delete the memory
    const deleted = await deleteGoggaMemory(matchingMemory.id!);
    
    if (deleted) {
      console.log('[ToolHandler] Memory deleted:', { id: matchingMemory.id, title: matchingMemory.title, reason });
      return {
        tool_call_id: '',
        success: true,
        result: `Memory "${matchingMemory.title}" deleted. Reason: ${reason}`
      };
    } else {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Memory could not be deleted (may be user-created)'
      };
    }
  } catch (error) {
    console.error('[ToolHandler] Failed to delete memory:', error);
    return {
      tool_call_id: '',
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Failed to delete memory'
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
async function executeGenerateImage(args: GenerateImageArgs): Promise<ToolResult> {
  try {
    const { prompt, style } = args;
    
    if (!prompt) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: 'Missing required field: prompt'
      };
    }
    
    console.log('[ToolHandler] Calling backend for dual image generation...');
    
    // Call backend API for dual generation (Pollinations + AI Horde)
    const response = await fetch('/api/v1/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: 'generate_image',
        arguments: { prompt, style }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.result) {
      throw new Error(data.error || 'Backend returned failure');
    }
    
    const backendResult = data.result;
    const imageUrls: string[] = backendResult.image_urls || [backendResult.image_url];
    const providers: string[] = backendResult.providers || ['pollinations'];
    
    console.log(`[ToolHandler] Received ${imageUrls.length} image(s) from: ${providers.join(', ')}`);
    
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
        'photorealistic': 'photorealistic, highly detailed, 8k resolution',
        'artistic': 'artistic, painterly, expressive brushstrokes',
        'cartoon': 'cartoon style, colorful, animated',
        'sketch': 'pencil sketch, hand-drawn, black and white',
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
        error: 'Missing required fields: chart_type, title, and data'
      };
    }
    
    const validTypes = ['line', 'bar', 'pie', 'area', 'scatter'];
    if (!validTypes.includes(chart_type)) {
      return {
        tool_call_id: '',
        success: false,
        result: '',
        error: `Invalid chart type. Must be one of: ${validTypes.join(', ')}`
      };
    }
    
    // Default colors (monochrome palette matching Gogga UI)
    const defaultColors = [
      '#1a1a1a', '#3a3a3a', '#5a5a5a', '#7a7a7a', 
      '#2563eb', '#dc2626', '#16a34a', '#ca8a04'
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
    
    console.log('[ToolHandler] Created chart config:', chart_type, 'with', data.length, 'data points');
    
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
      error: error instanceof Error ? error.message : 'Failed to create chart'
    };
  }
}

/**
 * Execute a tool call and return the result
 */
export async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
  console.log('[ToolHandler] Executing tool:', toolCall.name, toolCall.arguments);
  
  let result: ToolResult;
  
  switch (toolCall.name) {
    case 'save_memory':
      result = await executeSaveMemory(toolCall.arguments as unknown as SaveMemoryArgs);
      break;
      
    case 'delete_memory':
      result = await executeDeleteMemory(toolCall.arguments as unknown as DeleteMemoryArgs);
      break;
      
    case 'generate_image':
      result = await executeGenerateImage(toolCall.arguments as unknown as GenerateImageArgs);
      break;
      
    case 'create_chart':
      result = executeCreateChart(toolCall.arguments as unknown as CreateChartArgs);
      break;
      
    default:
      result = {
        tool_call_id: toolCall.id,
        success: false,
        result: '',
        error: `Unknown tool: ${toolCall.name}`
      };
  }
  
  // Set the tool_call_id
  result.tool_call_id = toolCall.id;
  
  return result;
}

/**
 * Execute multiple tool calls in sequence
 */
export async function executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
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
 */
export function formatToolResultsMessage(results: ToolResult[]): string {
  const messages: string[] = [];
  
  for (const result of results) {
    if (!result.success) {
      messages.push(`❌ ${result.error}`);
      continue;
    }
    
    // Try to parse JSON result for special handling
    try {
      const parsed = JSON.parse(result.result);
      
      // Handle multi-image result (dual generation)
      if (parsed.type === 'images' && Array.isArray(parsed.image_urls)) {
        const imageMarkdown = parsed.image_urls
          .map((url: string, i: number) => `![Generated Image ${i + 1}](${url})`)
          .join('\n\n');
        const providerInfo = parsed.providers?.length > 1 
          ? `*Generated by: ${parsed.providers.join(' + ')}*`
          : '';
        messages.push(`${imageMarkdown}\n${providerInfo}`);
        continue;
      }
      
      // Handle single image result
      if (parsed.type === 'image' && parsed.image_url) {
        messages.push(`![Generated Image](${parsed.image_url})`);
        continue;
      }
      
      // Handle chart result
      if (parsed.type === 'chart') {
        messages.push(`📊 **${parsed.title}** (${parsed.chart_type} chart created)`);
        continue;
      }
      
      // Default: show the result as-is
      messages.push(`✅ ${result.result}`);
    } catch {
      // Not JSON, show as plain text
      messages.push(`✅ ${result.result}`);
    }
  }
  
  return messages.join('\n\n');
}
