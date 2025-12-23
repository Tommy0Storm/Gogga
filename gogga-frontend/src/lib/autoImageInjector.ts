/**
 * Auto-Image Injection Service
 * 
 * Automatically inserts contextual images into long-form responses
 * from CePO (JIVE) and Qwen thinking mode (JIGGA).
 * 
 * Features:
 * - Detects informal/educational content (excludes legal)
 * - Inserts at natural paragraph breaks (every 2-3 paragraphs)
 * - Generates contextual prompts from surrounding text
 * - Uses Pollinations FLUX for instant image URLs
 */

// Topics that should NOT have auto-images
const EXCLUDED_TOPICS = [
  'legal', 'lawsuit', 'court', 'attorney', 'advocate', 'litigation',
  'contract', 'clause', 'liability', 'indemnity', 'damages',
  'popia', 'gdpr', 'compliance', 'regulation', 'statutory',
  'constitutional', 'tribunal', 'judgment', 'ruling',
  'medical diagnosis', 'prescription', 'treatment plan',
  'suicide', 'self-harm', 'abuse', 'violence', 'death',
];

// Topics that SHOULD have auto-images
const INCLUDED_TOPICS = [
  'school', 'project', 'assignment', 'homework', 'learn', 'education',
  'explain', 'tutorial', 'guide', 'how to', 'step by step',
  'history', 'science', 'nature', 'technology', 'art', 'culture',
  'travel', 'food', 'recipe', 'cooking', 'sport', 'game',
  'animal', 'plant', 'geography', 'space', 'ocean', 'mountain',
  'story', 'adventure', 'explore', 'discover', 'creative',
  'analysis', 'research', 'study', 'report', 'presentation',
];

// Pollinations URL builder with HD quality
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const HD_SUFFIX = ', masterpiece, best quality, hyperdetailed, highly detailed, sharp focus, HD, 4K';

/**
 * Check if content should have auto-images injected
 */
export function shouldInjectImages(content: string, userMessage: string): boolean {
  const combined = `${userMessage} ${content}`.toLowerCase();
  
  // Check for excluded topics first
  if (EXCLUDED_TOPICS.some(topic => combined.includes(topic))) {
    return false;
  }
  
  // Check for included topics
  if (INCLUDED_TOPICS.some(topic => combined.includes(topic))) {
    return true;
  }
  
  // Long content (>500 words) that's not excluded gets images
  const wordCount = content.split(/\s+/).length;
  return wordCount > 500;
}

/**
 * Extract a short image prompt from a paragraph
 * Takes the key concepts and creates a visual prompt
 */
function extractImagePrompt(paragraph: string, context: string): string {
  // Remove markdown formatting
  const cleaned = paragraph
    .replace(/[#*_`~\[\]()]/g, '')
    .replace(/\n/g, ' ')
    .trim();
  
  // Take first 80 chars as base
  let prompt = cleaned.slice(0, 80);
  
  // Add context hint if available
  if (context.includes('south africa') || context.includes('african')) {
    prompt = `South African ${prompt}`;
  }
  
  // Make it visual
  prompt = `Illustration of ${prompt}, educational infographic style${HD_SUFFIX}`;
  
  return prompt;
}

/**
 * Generate Pollinations image URL
 */
function generateImageUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_BASE}/${encoded}?enhance=true&nologo=true&width=768&height=512`;
}

/**
 * Split content into paragraphs
 */
function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n\n+/)
    .filter(p => p.trim().length > 50); // Only substantial paragraphs
}

/**
 * Inject auto-images into content
 * 
 * @param content The AI response content
 * @param userMessage The original user message (for context)
 * @param responseCount Current response count in session (for 2nd/3rd logic)
 * @returns Modified content with image markers
 */
export function injectAutoImages(
  content: string,
  userMessage: string,
  responseCount: number
): string {
  // Only inject every 2nd or 3rd response
  if (responseCount % 2 !== 0 && responseCount % 3 !== 0) {
    return content;
  }
  
  // Check if this content should have images
  if (!shouldInjectImages(content, userMessage)) {
    return content;
  }
  
  const paragraphs = splitIntoParagraphs(content);
  
  // Need at least 4 paragraphs to inject images
  if (paragraphs.length < 4) {
    return content;
  }
  
  const result: string[] = [];
  const context = `${userMessage} ${content}`.toLowerCase();
  
  // Inject 1-2 images at natural break points
  const injectPoints = paragraphs.length >= 6 
    ? [2, 5] // Two images for long content
    : [2];   // One image for medium content
  
  paragraphs.forEach((para, idx) => {
    result.push(para);
    
    if (injectPoints.includes(idx)) {
      // Generate contextual image
      const nextPara = paragraphs[idx + 1] || para;
      const imagePrompt = extractImagePrompt(nextPara, context);
      const imageUrl = generateImageUrl(imagePrompt);
      
      // Insert as tool-style marker for ChatClient to render as thumbnail
      const imageData = {
        urls: [imageUrl],
        providers: ['pollinations'],
        prompt: imagePrompt.slice(0, 100)
      };
      
      result.push(''); // Blank line before
      result.push(`__TOOL_IMAGES__:${JSON.stringify(imageData)}`);
      result.push(''); // Blank line after
    }
  });
  
  return result.join('\n\n');
}

/**
 * Process response for auto-image injection
 * Called after streaming completes
 */
export function processResponseForImages(
  content: string,
  userMessage: string,
  tier: string,
  layer: string,
  responseCount: number
): string {
  // Only for JIVE (CePO) and JIGGA thinking modes
  const eligibleLayers = ['jive_reasoning', 'jigga_think', 'jive_direct'];
  
  if (!eligibleLayers.includes(layer.toLowerCase())) {
    return content;
  }
  
  return injectAutoImages(content, userMessage, responseCount);
}
