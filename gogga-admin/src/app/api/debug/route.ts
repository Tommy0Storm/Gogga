import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/debug
 * List debug submissions with optional status filter
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';

    try {
        const submissions = await prisma.debugSubmission.findMany({
            where: status === 'all' ? {} : { status },
            include: {
                user: {
                    select: { email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return NextResponse.json(submissions);
    } catch (error) {
        console.error('Failed to list debug submissions:', error);
        return NextResponse.json(
            { error: 'Failed to list submissions' },
            { status: 500 }
        );
    }
}
