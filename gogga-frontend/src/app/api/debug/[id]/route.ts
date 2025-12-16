import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/[id]
 * Get a specific debug submission (admin only)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isServiceAdmin: true },
        });

        if (!user?.isServiceAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const submission = await prisma.debugSubmission.findUnique({
            where: { id },
            include: {
                User: { select: { email: true } },
            },
        });

        if (!submission) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(submission);
    } catch (error) {
        console.error('Failed to get debug submission:', error);
        return NextResponse.json({ error: 'Failed to get submission' }, { status: 500 });
    }
}

/**
 * PATCH /api/debug/[id]
 * Update a debug submission (status, notes) - admin only
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isServiceAdmin: true, email: true },
        });

        if (!user?.isServiceAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const data = await req.json();

        const updateData: {
            status?: string;
            adminNotes?: string;
            resolvedAt?: Date | null;
            resolvedBy?: string | null;
        } = {};

        if (data.status) {
            updateData.status = data.status;
            if (data.status === 'resolved') {
                updateData.resolvedAt = new Date();
                updateData.resolvedBy = user.email;
            } else {
                updateData.resolvedAt = null;
                updateData.resolvedBy = null;
            }
        }

        if (data.adminNotes !== undefined) {
            updateData.adminNotes = data.adminNotes;
        }

        const updated = await prisma.debugSubmission.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Failed to update debug submission:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

/**
 * DELETE /api/debug/[id]
 * Delete a debug submission (admin only)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isServiceAdmin: true },
        });

        if (!user?.isServiceAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.debugSubmission.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete debug submission:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
