import { NextRequest, NextResponse } from 'next/server';
import { transformDocumentToReceipt } from '@/lib/data-transform';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * Get list of receipts/documents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '4');
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;

    // Build query params
    const queryParams = new URLSearchParams();
    if (status) queryParams.append('status', status);
    if (type) queryParams.append('type', type);
    queryParams.append('page', page.toString());
    queryParams.append('pageSize', pageSize.toString());

    const query = queryParams.toString();
    
    // Get auth token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    const jwtToken = cookies['jwt_token'];
    
    // Call backend directly
    const headers: Record<string, string> = {};
    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }
    headers['Cookie'] = cookieHeader; // Also forward cookies as fallback
    
    const backendResponse = await fetch(`${BACKEND_URL}/api/documents${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!backendResponse.ok) {
      console.warn('Backend request failed:', backendResponse.status, backendResponse.statusText);
      return NextResponse.json({
        success: true,
        receipts: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: pageSize,
          totalPages: 0,
        },
      });
    }

    const response = await backendResponse.json();

    // If no data, return empty list instead of error
    if (!response.data) {
      console.warn('No documents data returned:', response.message);
      return NextResponse.json({
        success: true,
        receipts: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: pageSize,
          totalPages: 0,
        },
      });
    }

    // Transform documents to receipts
    const receipts = (response.data.items || []).map((doc: any) => transformDocumentToReceipt(doc));

    return NextResponse.json({
      success: true,
      receipts,
      pagination: {
        total: response.data.totalCount || 0,
        page: response.data.page || page,
        pageSize: response.data.pageSize || pageSize,
        totalPages: response.data.totalPages || 0,
      },
    });
  } catch (error: any) {
    console.error('List receipts error:', error);
    // Return empty list instead of error to prevent frontend crash
    return NextResponse.json({
      success: true,
      receipts: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 4,
        totalPages: 0,
      },
    });
  }
}

