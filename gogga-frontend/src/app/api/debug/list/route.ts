import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/list
 * List all debug submissions (admin only)
 * Query params: status (pending|in_progress|resolved|all)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is service admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isServiceAdmin: true },
        });

        if (!user?.isServiceAdmin) {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'pending';

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
