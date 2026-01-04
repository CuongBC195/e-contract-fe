import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get('page') || '1';
    const pageSize = searchParams.get('pageSize') || '20';

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call backend API
    const response = await fetch(
      `${BACKEND_URL}/api/admin/audit/signed-documents?page=${page}&pageSize=${pageSize}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let data;
    try {
      const responseText = await response.text();
      if (responseText) {
        data = JSON.parse(responseText);
      } else {
        data = { message: 'Empty response' };
      }
    } catch (parseError) {
      console.error('[Audit] Failed to parse backend response:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid response format from backend' },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      const errorMessage = data?.error || data?.message || data?.errors?.[0] || 'Failed to get audit trails';
      console.error('[Audit] Backend error:', response.status, errorMessage, data);
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Audit] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get audit trails' },
      { status: 500 }
    );
  }
}

