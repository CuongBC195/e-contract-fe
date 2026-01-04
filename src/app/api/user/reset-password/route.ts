import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/api-client';

/**
 * Reset password endpoint
 * Proxy to backend /api/auth/reset-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, newPassword } = body;

    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Email, token, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    const response = await resetPassword({
      email: email.trim(),
      token: token.trim(),
      newPassword: newPassword,
    });

    if (response.statusCode === 200 || response.statusCode === 201) {
      return NextResponse.json({
        success: true,
        message: response.message || 'Password reset successfully',
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: response.message || 'Failed to reset password' 
        },
        { status: response.statusCode || 500 }
      );
    }
  } catch (error: any) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset password' 
      },
      { status: 500 }
    );
  }
}

