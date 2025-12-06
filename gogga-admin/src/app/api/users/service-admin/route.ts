import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - List all service admins
export async function GET() {
  try {
    const serviceAdmins = await prisma.user.findMany({
      where: { isServiceAdmin: true },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isServiceAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      serviceAdmins,
      count: serviceAdmins.length,
    });
  } catch (error) {
    console.error('Failed to fetch service admins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch service admins' },
      { status: 500 }
    );
  }
}

// POST - Grant or revoke service admin access
export async function POST(request: NextRequest) {
  try {
    const { email, grant } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${email}` },
        { status: 404 }
      );
    }

    // Update service admin status
    const updated = await prisma.user.update({
      where: { email },
      data: { isServiceAdmin: grant === true },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isServiceAdmin: true,
      },
    });

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminEmail: 'system', // TODO: Get from auth session
        action: grant ? 'service_admin_granted' : 'service_admin_revoked',
        targetUser: email,
        meta: JSON.stringify({ userId: user.id }),
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: grant
        ? `Service admin access granted to ${email}`
        : `Service admin access revoked from ${email}`,
    });
  } catch (error) {
    console.error('Failed to update service admin:', error);
    return NextResponse.json(
      { error: 'Failed to update service admin status' },
      { status: 500 }
    );
  }
}
