/**
 * GOGGA - Credit Pack API Route
 * 
 * POST /api/payments/credit-pack
 * 
 * Proxies credit pack purchase requests to the FastAPI backend.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { pack_size } = body

    if (!pack_size || ![200, 500, 1000].includes(pack_size)) {
      return NextResponse.json(
        { error: 'Invalid pack size. Must be 200, 500, or 1000' },
        { status: 400 }
      )
    }

    // Call backend to generate PayFast form
    const response = await fetch(`${BACKEND_URL}/api/v1/payments/credit-pack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pack_size: String(pack_size),
        user_email: session.user.email,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: error.detail || 'Backend error' },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Transform backend response to match frontend expectations
    return NextResponse.json({
      action_url: data.payment_url,
      form_data: data.payment_data,
      payment_id: data.payment_id,
    })

  } catch (error) {
    console.error('Credit pack API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
