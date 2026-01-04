import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/api-client';

/**
 * Admin login endpoint
 * Proxy to backend /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, email } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Call backend API - admin login only needs password
    const response = await login(email || '', password);

    if (response.statusCode === 200 || response.statusCode === 201) {
      // Set JWT token as cookie
      if (response.data && response.data.token) {
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
        user: response.data?.user,
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: response.message || 'Login failed',
          code: response.code,
          warning: response.warning,
        },
        { status: response.statusCode || 401 }
      );
    }
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle rate limiting
    if (error.message?.includes('429') || error.message?.includes('RATE_LIMITED')) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

