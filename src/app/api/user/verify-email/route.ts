import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/api-client';

/**
 * Verify email with OTP code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otpCode } = body;

    if (!email || !otpCode) {
      return NextResponse.json(
        { success: false, error: 'Email và mã OTP là bắt buộc' },
        { status: 400 }
      );
    }

    const response = await verifyEmail({
      email: email.trim(),
      otpCode: otpCode.trim(),
    });

    if (response.statusCode === 200 || response.statusCode === 201) {
      // Set JWT token cookie if token is returned
      if (response.data && typeof response.data === 'object' && 'token' in response.data) {
        const token = (response.data as any).token;
        const nextResponse = NextResponse.json({
          success: true,
          message: response.message || 'Xác thực email thành công',
          user: (response.data as any).user,
        });
        
        nextResponse.cookies.set('jwt_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 1 day
        });
        
        return nextResponse;
      }

      return NextResponse.json({
        success: true,
        message: response.message || 'Xác thực email thành công',
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: response.message || 'Xác thực email thất bại' 
        },
        { status: response.statusCode || 500 }
      );
    }
  } catch (error: any) {
    console.error('[Verify Email] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Xác thực email thất bại' 
      },
      { status: 500 }
    );
  }
}

