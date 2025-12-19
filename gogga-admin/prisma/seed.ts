/**
 * GOGGA Admin - Prisma Seed Script
 * 
 * Seeds default pricing data for Token Administration:
 * - ModelPricing: Default model rates
 * - FeatureCost: Feature-level costs
 * - ExchangeRate: ZAR/USD rate
 * 
 * Run with: npx tsx prisma/seed.ts
 */

import { PrismaClient } from './generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Create the SQLite adapter - Prisma 7 requirement
// Uses the shared frontend database (same as Prisma datasource)
const adapter = new PrismaBetterSqlite3({
  url: 'file:../gogga-frontend/prisma/dev.db',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding GOGGA Admin database...\n');

  // ============================================
  // MODEL PRICING
  // ============================================
  const modelPricing = [
    // FREE tier - Qwen 235B via OpenRouter (free)
    {
      modelId: 'qwen/qwen3-235b-a22b:free',
      displayName: 'Qwen 3 235B (Free)',
      provider: 'openrouter',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0,
      allowedTiers: 'free',
      isActive: true,
    },
    // JIVE/JIGGA tier - Qwen 32B via Cerebras
    {
      modelId: 'qwen-3-32b',
      displayName: 'Qwen 3 32B',
      provider: 'cerebras',
      inputPricePerM: 0.40,
      outputPricePerM: 0.80,
      imagePricePerUnit: 0,
      allowedTiers: 'jive,jigga',
      isActive: true,
    },
    // JIGGA tier - Qwen 235B via Cerebras (paid, for complex/legal)
    {
      modelId: 'qwen-3-235b-a22b-instruct-2507',
      displayName: 'Qwen 3 235B A22B',
      provider: 'cerebras',
      inputPricePerM: 0.60,
      outputPricePerM: 1.20,
      imagePricePerUnit: 0,
      allowedTiers: 'jigga',
      isActive: true,
    },
    // Image generation - FLUX 1.1 Pro
    {
      modelId: 'flux-1.1-pro',
      displayName: 'FLUX 1.1 Pro',
      provider: 'bfl',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.04,
      allowedTiers: 'jive,jigga',
      isActive: true,
    },
    // Image generation - Pollinations (free)
    {
      modelId: 'pollinations-image',
      displayName: 'Pollinations (Free)',
      provider: 'pollinations',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0,
      allowedTiers: 'free',
      isActive: true,
    },
    // Vertex AI Imagen Models
    {
      modelId: 'imagen-3.0-generate-002',
      displayName: 'Imagen 3.0 Generate',
      provider: 'vertex-ai',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.04,  // $0.04 per image
      allowedTiers: 'jive,jigga',
      isActive: true,
    },
    {
      modelId: 'imagen-3.0-capability-001',
      displayName: 'Imagen 3.0 Edit',
      provider: 'vertex-ai',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.04,  // $0.04 per edit
      allowedTiers: 'jive,jigga',
      isActive: true,
    },
    {
      modelId: 'imagen-4.0-upscale-preview',
      displayName: 'Imagen 4.0 Upscale',
      provider: 'vertex-ai',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.06,  // $0.06 per upscale
      allowedTiers: 'jigga',
      isActive: true,
    },
    // Vertex AI Veo Models
    {
      modelId: 'veo-3.1-generate-001',
      displayName: 'Veo 3.1 Video',
      provider: 'vertex-ai',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.20,  // $0.20 per second (video only)
      allowedTiers: 'jigga',
      isActive: true,
    },
    {
      modelId: 'veo-3.1-fast-generate-001',
      displayName: 'Veo 3.1 Fast',
      provider: 'vertex-ai',
      inputPricePerM: 0,
      outputPricePerM: 0,
      imagePricePerUnit: 0.20,  // $0.20 per second (video only)
      allowedTiers: 'jigga',
      isActive: true,
    },
    // Gemini Live API (GoggaTalk Voice Chat)
    {
      modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
      displayName: 'Gemini 2.5 Flash Native Audio',
      provider: 'google-ai',
      inputPricePerM: 3.00,   // $3.00/M audio input tokens
      outputPricePerM: 12.00, // $12.00/M audio output tokens
      imagePricePerUnit: 0,
      allowedTiers: 'jive,jigga',
      isActive: true,
    },
  ];

  console.log('📊 Seeding ModelPricing...');
  for (const model of modelPricing) {
    await prisma.modelPricing.upsert({
      where: { modelId: model.modelId },
      update: model,
      create: model,
    });
    console.log(`  ✅ ${model.displayName} (${model.provider})`);
  }

  // ============================================
  // FEATURE COSTS
  // ============================================
  const featureCosts = [
    {
      featureKey: 'rag_search',
      displayName: 'RAG Semantic Search',
      description: 'Client-side vector search with E5 embeddings',
      costType: 'per_request',
      costAmountUSD: 0,
      tierOverrides: JSON.stringify({ free: 0, jive: 0, jigga: 0 }),
      cepoMultiplier: 1.0,
      isBillable: false,
    },
    {
      featureKey: 'optillm_cot',
      displayName: 'OptiLLM Chain-of-Thought',
      description: 'Reasoning enhancement with reflection',
      costType: 'per_token',
      costAmountUSD: 0,
      tierOverrides: JSON.stringify({ free: 1.1, jive: 1.3, jigga: 1.5 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'image_gen',
      displayName: 'Image Generation',
      description: 'FLUX 1.1 Pro, Pollinations, or Imagen 3.0 image generation',
      costType: 'per_image',
      costAmountUSD: 0.04,
      tierOverrides: JSON.stringify({ free: 0, jive: 0.04, jigga: 0.04 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'image_edit',
      displayName: 'Image Editing',
      description: 'Imagen 3.0 insert, remove, or background replacement',
      costType: 'per_image',
      costAmountUSD: 0.04,
      tierOverrides: JSON.stringify({ free: null, jive: 0.04, jigga: 0.04 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'image_upscale',
      displayName: 'Image Upscale',
      description: 'Imagen 4.0 Ultra upscale to 2K/3K/4K',
      costType: 'per_image',
      costAmountUSD: 0.06,
      tierOverrides: JSON.stringify({ free: null, jive: null, jigga: 0.06 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'video_gen',
      displayName: 'Video Generation',
      description: 'Veo 3.1 text-to-video and image-to-video',
      costType: 'per_second',
      costAmountUSD: 0.20,
      tierOverrides: JSON.stringify({ free: null, jive: null, jigga: 0.20 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'video_gen_audio',
      displayName: 'Video + Audio Generation',
      description: 'Veo 3.1 video with synchronized audio',
      costType: 'per_second',
      costAmountUSD: 0.40,
      tierOverrides: JSON.stringify({ free: null, jive: null, jigga: 0.40 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'chart_gen',
      displayName: 'Chart Generation',
      description: 'Recharts-based data visualization',
      costType: 'per_request',
      costAmountUSD: 0,
      tierOverrides: null,
      cepoMultiplier: 1.0,
      isBillable: false,
    },
    {
      featureKey: 'math_tools',
      displayName: 'Math Tool Delegation',
      description: 'SymPy and NumPy calculations',
      costType: 'per_request',
      costAmountUSD: 0,
      tierOverrides: null,
      cepoMultiplier: 1.0,
      isBillable: false,
    },
    // Web Search via Serper.dev
    {
      featureKey: 'web_search',
      displayName: 'Web Search',
      description: 'Google Search via Serper.dev API',
      costType: 'per_request',
      costAmountUSD: 0.001,  // $1.00 per 1000 queries (Starter tier)
      tierOverrides: JSON.stringify({ free: 0.001, jive: 0.001, jigga: 0.001 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'legal_search',
      displayName: 'Legal Search',
      description: 'SA legal database search via Serper.dev',
      costType: 'per_request',
      costAmountUSD: 0.001,
      tierOverrides: JSON.stringify({ free: null, jive: 0.001, jigga: 0.001 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    {
      featureKey: 'places_search',
      displayName: 'Places Search',
      description: 'Nearby businesses and places via Serper.dev',
      costType: 'per_request',
      costAmountUSD: 0.001,
      tierOverrides: JSON.stringify({ free: 0.001, jive: 0.001, jigga: 0.001 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    // GoggaTalk - Gemini Live API Voice Chat
    {
      featureKey: 'gogga_talk',
      displayName: 'GoggaTalk Voice Chat',
      description: 'Real-time voice chat via Gemini 2.5 Flash Native Audio',
      costType: 'per_second',
      costAmountUSD: 0.015,  // ~$3.00/M input audio + $12.00/M output = ~$0.015/sec estimated
      tierOverrides: JSON.stringify({ free: null, jive: 0.015, jigga: 0.015 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
    // GoggaTalk Screen Share - additional cost when sharing screen
    {
      featureKey: 'screen_share',
      displayName: 'GoggaTalk Screen Share',
      description: 'Desktop sharing via Gemini Live API (1 FPS JPEG frames)',
      costType: 'per_second',
      costAmountUSD: 0.001,  // ~258 tokens/frame × 1fps = 15.5k tokens/min → $0.0465/min → +30% margin
      tierOverrides: JSON.stringify({ free: null, jive: 0.001, jigga: 0.001 }),
      cepoMultiplier: 1.0,
      isBillable: true,
    },
  ];

  console.log('\n🔧 Seeding FeatureCost...');
  for (const feature of featureCosts) {
    await prisma.featureCost.upsert({
      where: { featureKey: feature.featureKey },
      update: feature,
      create: feature,
    });
    console.log(`  ✅ ${feature.displayName}`);
  }

  // ============================================
  // EXCHANGE RATES
  // ============================================
  console.log('\n💱 Seeding ExchangeRate...');
  await prisma.exchangeRate.upsert({
    where: {
      fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: 'ZAR' },
    },
    update: { rate: 19.00 },
    create: {
      fromCurrency: 'USD',
      toCurrency: 'ZAR',
      rate: 19.00,
    },
  });
  console.log('  ✅ USD → ZAR: R19.00');

  console.log('\n🎉 Seeding complete!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
