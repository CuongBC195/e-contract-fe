import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/api-client';

/**
 * User registration endpoint
 * Proxy to backend /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Register user via backend API
    let response;
    try {
      response = await register(email, password, name);
    } catch (error: any) {
      // Handle specific errors from backend
      const errorMessage = error.message || 'Registration failed';
      
      // Check for email already exists (handle both English and potential Vietnamese messages)
      if (errorMessage.toLowerCase().includes('already exists') || 
          errorMessage.toLowerCase().includes('email') ||
          errorMessage.toLowerCase().includes('đã tồn tại')) {
        return NextResponse.json(
          { success: false, error: 'Email đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.' },
          { status: 400 }
        );
      }
      
      // Check for rate limiting
      if (errorMessage.includes('429') || errorMessage.includes('RATE_LIMITED')) {
        return NextResponse.json(
          { success: false, error: 'Too many registration attempts. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 }
        );
      }
      
      // Generic error
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

    // DO NOT set cookie - user must verify OTP first
    return NextResponse.json({
      success: true,
      message: response.message || 'Registration successful. Please check your email for OTP code.',
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle rate limiting
    if (error.message?.includes('429') || error.message?.includes('RATE_LIMITED')) {
      return NextResponse.json(
        { success: false, error: 'Too many registration attempts. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // Handle email already exists (handle both English and potential Vietnamese messages)
    if (error.message?.toLowerCase().includes('already exists') || 
        error.message?.toLowerCase().includes('email') ||
        error.message?.toLowerCase().includes('đã tồn tại')) {
      return NextResponse.json(
        { success: false, error: 'Email đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

