import { NextRequest, NextResponse } from 'next/server';
import { getMe } from '@/lib/api-client';

/**
 * Check user authentication status
 * Proxy to backend /api/auth/me
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies
    const token = request.cookies.get('jwt_token')?.value;
    
    if (!token) {
      return NextResponse.json({
        authenticated: false,
        role: null,
      });
    }

    // Get user info from backend
    try {
      const response = await getMe();

      if (!response.data) {
        return NextResponse.json({
          authenticated: false,
          role: null,
        });
      }

      // Return user info with authentication status
      return NextResponse.json({
        authenticated: true,
        role: response.data.role?.toLowerCase() || 'user',
        user: response.data,
      });
    } catch (error: any) {
      // Token invalid or expired
      return NextResponse.json({
        authenticated: false,
        role: null,
      });
    }
  } catch (error: any) {
    console.error('Auth check error:', error);
    return NextResponse.json({
      authenticated: false,
      role: null,
    });
  }
}

