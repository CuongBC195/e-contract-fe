import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset } from '@/lib/api-client';

/**
 * Forgot password endpoint
 * Proxy to backend /api/auth/forgot-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const response = await requestPasswordReset({ email: email.trim() });

    if (response.statusCode === 200 || response.statusCode === 201) {
      return NextResponse.json({
        success: true,
        message: response.message || 'Password reset email sent successfully',
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: response.message || 'Failed to send password reset email' 
        },
        { status: response.statusCode || 500 }
      );
    }
  } catch (error: any) {
    console.error('[Forgot Password] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send password reset email' 
      },
      { status: 500 }
    );
  }
}

