/**
 * GOGGA - Subscribe API Route
 * 
 * POST /api/payments/subscribe
 * 
 * Proxies subscription requests to the FastAPI backend.
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
    const { tier, payment_type = 'tokenization' } = body

    if (!tier || !['JIVE', 'JIGGA'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier. Must be JIVE or JIGGA' },
        { status: 400 }
      )
    }

    // Validate payment type
    const validPaymentTypes = ['once_off', 'subscription', 'tokenization']
    const selectedPaymentType = validPaymentTypes.includes(payment_type) ? payment_type : 'tokenization'

    // Call backend to generate PayFast form
    const response = await fetch(`${BACKEND_URL}/api/v1/payments/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tier: tier.toLowerCase(),
        user_email: session.user.email,
        payment_type: selectedPaymentType,
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
      payment_type: data.payment_type,
    })

  } catch (error) {
    console.error('Subscribe API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
