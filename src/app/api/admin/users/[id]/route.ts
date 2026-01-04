import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * GET: Get user by ID
 * PUT: Update user
 * DELETE: Delete user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    const backendData = await backendResponse.json().catch(() => ({ success: false }));

    if (!backendResponse.ok) {
      const errorMessage = backendData.message || backendData.error || 'Failed to fetch user';
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
    });
  } catch (error: any) {
    console.error('[Admin Users GET by ID] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, password, role, emailVerified } = body;

    // Validate password if provided
    if (password && password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (password !== undefined) updateData.password = password;
    if (role !== undefined) updateData.role = role;
    if (emailVerified !== undefined) updateData.emailVerified = emailVerified;

    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
      credentials: 'include',
    });

    const backendData = await backendResponse.json().catch(() => ({ success: false }));

    if (!backendResponse.ok) {
      const errorMessage = backendData.message || backendData.error || 'Failed to update user';
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
      message: backendData.message || 'User updated successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const backendResponse = await fetch(`${BACKEND_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    // Handle 204 No Content response
    if (backendResponse.status === 204) {
      return NextResponse.json({
        success: true,
        message: 'User deleted successfully',
      });
    }

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ 
        message: backendResponse.statusText 
      }));
      
      const errorMessage = errorData.message || errorData.error || 'Failed to delete user';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json().catch(() => ({ success: true }));
    
    return NextResponse.json({
      success: true,
      message: backendData.message || 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

