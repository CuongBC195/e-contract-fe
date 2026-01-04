import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * GET: List users (with pagination and search)
 * POST: Create new user
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '4';
    const search = searchParams.get('search') || '';

    const queryParams = new URLSearchParams({
      page,
      pageSize,
      ...(search && { search }),
    });

    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/users?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ 
        message: backendResponse.statusText 
      }));
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.message || 'Failed to fetch users' 
        },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json().catch(() => ({ success: false }));
    
    // Backend returns ApiResponse<PaginatedResponseDto<UserResponseDto>>
    // Extract data from ApiResponse wrapper
    const paginatedData = backendData.data || backendData;
    
    return NextResponse.json({
      success: true,
      users: paginatedData.items || [],
      totalCount: paginatedData.totalCount || 0,
      page: paginatedData.page || 1,
      pageSize: paginatedData.pageSize || 4,
      totalPages: paginatedData.totalPages || 0,
    });
  } catch (error: any) {
    console.error('[Admin Users GET] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, name, password, role } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { success: false, error: 'Email, tên và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: email.trim(),
        name: name.trim(),
        password: password,
        role: role || 'User',
      }),
      credentials: 'include',
    });

    const backendData = await backendResponse.json().catch(() => ({ success: false }));

    if (!backendResponse.ok) {
      const errorMessage = backendData.message || backendData.error || 'Failed to create user';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: backendResponse.status }
      );
    }

    // Extract data from ApiResponse wrapper
    const userData = backendData.data || backendData;

    return NextResponse.json({
      success: true,
      user: userData,
      message: backendData.message || 'User created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Users POST] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

