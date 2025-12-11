/**
 * GOGGA - Usage Summary API
 * 
 * GET: Retrieve usage summary for a user (current month or specified period)
 * 
 * Query params:
 *   - userId: Required
 *   - year: Optional (defaults to current year)
 *   - month: Optional (defaults to current month)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const yearParam = searchParams.get('year')
        const monthParam = searchParams.get('month')

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            )
        }

        const now = new Date()
        const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
        const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1

        // Get user's subscription for tier info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { subscription: true },
        })

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            )
        }

        // Get monthly summary
        const summary = await prisma.usageSummary.findUnique({
            where: {
                userId_year_month: { userId, year, month },
            },
        })

        // Get tier limits
        const tier = user.subscription?.tier || 'FREE'
        const imageLimits: Record<string, number> = {
            FREE: 50,
            JIVE: 200,
            JIGGA: 1000,
        }
        const imageLimit = imageLimits[tier] || 50

        return NextResponse.json({
            userId,
            year,
            month,
            tier,
            summary: summary ? {
                totalTokens: summary.totalTokens,
                promptTokens: summary.promptTokens,
                completionTokens: summary.completionTokens,
                totalCostCents: summary.totalCostCents,
                chatRequests: summary.chatRequests,
                enhanceRequests: summary.enhanceRequests,
                imageRequests: summary.imageRequests,
                imagesUsed: summary.imagesUsed,
            } : {
                totalTokens: 0,
                promptTokens: 0,
                completionTokens: 0,
                totalCostCents: 0,
                chatRequests: 0,
                enhanceRequests: 0,
                imageRequests: 0,
                imagesUsed: 0,
            },
            limits: {
                images: {
                    used: summary?.imagesUsed || 0,
                    limit: imageLimit,
                    remaining: imageLimit - (summary?.imagesUsed || 0),
                },
            },
        })
    } catch (error) {
        console.error('[usage/summary] Error:', error)
        return NextResponse.json(
            { error: 'Failed to get usage summary' },
            { status: 500 }
        )
    }
}
