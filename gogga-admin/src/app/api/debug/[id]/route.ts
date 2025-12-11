import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/debug/[id]
 * Get a specific debug submission
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const submission = await prisma.debugSubmission.findUnique({
            where: { id },
            include: {
                user: { select: { email: true } },
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
 * Update a debug submission (status, notes)
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const data = await request.json();

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
                updateData.resolvedBy = 'admin'; // Could be enhanced with actual admin email
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
 * Delete a debug submission
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        await prisma.debugSubmission.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete debug submission:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
