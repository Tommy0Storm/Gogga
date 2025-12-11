import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/debug/submit
 * Submit a debug report with console/network logs
 * Only available to tester users (isTester=true)
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is a tester
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isTester: true },
        });

        if (!user?.isTester) {
            return NextResponse.json(
                { error: 'Only testers can submit debug reports' },
                { status: 403 }
            );
        }

        const data = await req.json();

        // Validate required fields
        if (!data.reason?.trim()) {
            return NextResponse.json(
                { error: 'Reason is required' },
                { status: 400 }
            );
        }

        const submission = await prisma.debugSubmission.create({
            data: {
                userId: session.user.id,
                reason: data.reason.trim(),
                consoleLogs: data.consoleLogs || '[]',
                networkLogs: data.networkLogs || null,
                errorStack: data.errorStack || null,
                userAgent: data.userAgent || 'Unknown',
                url: data.url || 'Unknown',
                screenSize: data.screenSize || null,
            },
        });

        return NextResponse.json({ success: true, id: submission.id });
    } catch (error) {
        console.error('Debug submission failed:', error);
        return NextResponse.json(
            { error: 'Failed to submit debug report' },
            { status: 500 }
        );
    }
}
