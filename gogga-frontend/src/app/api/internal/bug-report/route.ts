import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, userAgent, timestamp, url } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { ok: false, message: 'Bug report message is required' },
        { status: 400 }
      )
    }

    // Store bug report in database
    const bugReport = await prisma.bugReport.create({
      data: {
        message: message.trim(),
        userAgent: userAgent || 'unknown',
        url: url || 'unknown',
        timestamp: new Date(timestamp),
      },
    })

    return NextResponse.json({
      ok: true,
      message: 'Bug report submitted successfully',
      reportId: bugReport.id,
    })
  } catch (error) {
    console.error('Bug report submission error:', error)
    return NextResponse.json(
      { ok: false, message: 'Failed to submit bug report' },
      { status: 500 }
    )
  }
}