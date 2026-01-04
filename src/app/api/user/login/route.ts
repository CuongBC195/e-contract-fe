import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/api-client';

/**
 * User login endpoint
 * Proxy to backend /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Login via backend API
    let response;
    try {
      response = await login(email, password);
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed';
      
      // Check for rate limiting
      if (errorMessage.includes('429') || errorMessage.includes('RATE_LIMITED')) {
        return NextResponse.json(
          { success: false, error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 }
        );
      }
      
      // Check for email not verified
      if (errorMessage.includes('not verified') || errorMessage.includes('EMAIL_NOT_VERIFIED')) {
        return NextResponse.json(
          { success: false, error: 'Please verify your email before logging in.', code: 'EMAIL_NOT_VERIFIED' },
          { status: 400 }
        );
      }
      
      // Generic error
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 401 }
      );
    }

    if (!response.data) {
      return NextResponse.json(
        { success: false, error: response.message || 'Login failed' },
        { status: response.statusCode || 500 }
      );
    }

    // Set JWT token as cookie
    if (response.data.token) {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      };

      const responseObj = NextResponse.json({
        success: true,
        message: 'Login successful',
        user: response.data.user,
      });

      responseObj.cookies.set('jwt_token', response.data.token, cookieOptions);

      return responseObj;
    }

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: response.data.user,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

