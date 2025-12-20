/**
 * GOGGA - Usage Logging API
 * 
 * Logs detailed token usage for every AI request.
 * Called by the backend after each chat/enhance/image request.
 * 
 * Now includes OptiLLM-adjusted tokens and reasoning token tracking.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

// Pricing per 1M tokens in USD (synchronized with backend config.py)
const MODEL_PRICING_USD: Record<string, { input: number; output: number }> = {
    // Cerebras Qwen 32B (JIVE/JIGGA)
    'qwen-3-32b': { input: 0.10, output: 0.10 },
    'qwen3-32b': { input: 0.10, output: 0.10 },
    'qwen/qwen3-32b': { input: 0.10, output: 0.10 },
    // OpenRouter Qwen 235B (complex queries)
    'qwen-3-235b': { input: 0.80, output: 1.10 },
    'qwen3-235b': { input: 0.80, output: 1.10 },
    'qwen/qwen3-235b-a22b': { input: 0.80, output: 1.10 },
    // Legacy models
    'llama-3.3-70b': { input: 0.35, output: 0.35 },
    'llama-3.1-8b': { input: 0.10, output: 0.10 },
    'meta-llama/llama-3.3-70b-instruct': { input: 0.35, output: 0.35 },
    'meta-llama/llama-3.1-8b-instruct': { input: 0.10, output: 0.10 },
}

// Exchange rate ZAR/USD (December 2025)
const ZAR_USD_RATE = 18.50

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
    const normalizedModel = model.toLowerCase()
    const pricing = MODEL_PRICING_USD[normalizedModel] || { input: 0.50, output: 0.50 } // Default 50c/1M
    
    // Calculate cost in USD
    const inputCostUsd = (inputTokens / 1_000_000) * pricing.input
    const outputCostUsd = (outputTokens / 1_000_000) * pricing.output
    const totalCostUsd = inputCostUsd + outputCostUsd
    
    // Convert to ZAR cents (1 ZAR = 100 cents)
    const totalCostZar = totalCostUsd * ZAR_USD_RATE
    return Math.ceil(totalCostZar * 100) // Return in ZAR cents
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json()

        const {
            userId,
            promptTokens = 0,
            completionTokens = 0,
            adjustedCompletionTokens,
            reasoningTokens = 0,
            totalTokens = promptTokens + completionTokens,
            model,
            provider,
            endpoint,
            tier,
            optillmLevel,
            optillmMultiplier,
            conversationId,
            requestId,
            durationMs,
        } = data

        if (!userId || !model || !provider || !endpoint || !tier) {
            return NextResponse.json(
                { error: 'Missing required fields: userId, model, provider, endpoint, tier' },
                { status: 400 }
            )
        }

        // Use adjusted tokens for cost calculation if provided, otherwise use raw
        const tokensForCost = adjustedCompletionTokens ?? completionTokens
        const costCents = calculateCostCents(model, promptTokens, tokensForCost)

        // Create usage record with OptiLLM fields
        const usage = await prisma.usage.create({
            data: {
                id: randomUUID(),
                userId,
                promptTokens,
                completionTokens,
                adjustedCompletionTokens: adjustedCompletionTokens ?? null,
                reasoningTokens: reasoningTokens || null,
                totalTokens,
                costCents,
                model,
                provider,
                endpoint,
                tier,
                optillmLevel: optillmLevel ?? null,
                optillmMultiplier: optillmMultiplier ?? null,
                conversationId,
                requestId,
                durationMs,
            },
        })

        // Update monthly summary (upsert)
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1 // 1-12

        const isImage = endpoint === 'images'
        const isEnhance = endpoint === 'enhance'

        await prisma.usageSummary.upsert({
            where: {
                userId_year_month: { userId, year, month },
            },
            create: {
                id: randomUUID(),
                userId,
                year,
                month,
                totalTokens,
                promptTokens,
                completionTokens,
                totalCostCents: costCents,
                chatRequests: !isImage && !isEnhance ? 1 : 0,
                enhanceRequests: isEnhance ? 1 : 0,
                imageRequests: isImage ? 1 : 0,
                imagesUsed: isImage ? 1 : 0,
            },
            update: {
                totalTokens: { increment: totalTokens },
                promptTokens: { increment: promptTokens },
                completionTokens: { increment: completionTokens },
                totalCostCents: { increment: costCents },
                ...(!isImage && !isEnhance ? { chatRequests: { increment: 1 } } : {}),
                ...(isEnhance ? { enhanceRequests: { increment: 1 } } : {}),
                ...(isImage ? { imageRequests: { increment: 1 } } : {}),
                ...(isImage ? { imagesUsed: { increment: 1 } } : {}),
            },
        })

        return NextResponse.json({
            success: true,
            id: usage.id,
            costCents,
        })
    } catch (error) {
        console.error('[usage/log] Error:', error)
        return NextResponse.json(
            { error: 'Failed to log usage' },
            { status: 500 }
        )
    }
}
