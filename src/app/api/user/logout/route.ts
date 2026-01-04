import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/api-client';

/**
 * User logout endpoint
 * Proxy to backend /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    // Logout via backend API
    try {
      await logout();
    } catch (error) {
      // Continue even if backend logout fails
      console.error('Backend logout error:', error);
    }

    // Clear cookie
    const responseObj = NextResponse.json({
      success: true,
      message: 'Logout successful',
    });

    responseObj.cookies.delete('jwt_token');

    return responseObj;
  } catch (error: any) {
    console.error('Logout error:', error);
    
    // Still try to clear cookie on error
    const responseObj = NextResponse.json(
      { success: false, error: error.message || 'Logout failed' },
      { status: 500 }
    );
    
    responseObj.cookies.delete('jwt_token');
    
    return responseObj;
  }
}

