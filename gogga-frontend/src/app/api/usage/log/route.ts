/**
 * GOGGA - Usage Logging API
 * 
 * Logs detailed token usage for every AI request.
 * Called by the backend after each chat/enhance/image request.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

// Cost per 1M tokens in cents (ZAR)
const MODEL_COSTS: Record<string, number> = {
    'llama-3.3-70b': 35,        // $0.35/1M → ~R6.50/1M
    'llama-3.1-8b': 10,         // $0.10/1M → ~R1.85/1M
    'qwen-3-32b': 20,           // $0.20/1M → ~R3.70/1M
    'qwen3-32b': 20,            // Alias
    'meta-llama/llama-3.3-70b-instruct': 35,
    'meta-llama/llama-3.1-8b-instruct': 10,
    'qwen/qwen3-32b': 20,
}

function calculateCost(model: string, tokens: number): number {
    const normalizedModel = model.toLowerCase()
    const costPer1M = MODEL_COSTS[normalizedModel] || 50 // Default 50 cents/1M
    return Math.ceil((tokens / 1_000_000) * costPer1M)
}

export async function POST(request: NextRequest) {
    try {
        const data = await request.json()

        const {
            userId,
            promptTokens = 0,
            completionTokens = 0,
            totalTokens = promptTokens + completionTokens,
            model,
            provider,
            endpoint,
            tier,
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

        // Calculate cost
        const costCents = calculateCost(model, totalTokens)

        // Create usage record
        const usage = await prisma.usage.create({
            data: {
                id: randomUUID(),
                userId,
                promptTokens,
                completionTokens,
                totalTokens,
                costCents,
                model,
                provider,
                endpoint,
                tier,
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
