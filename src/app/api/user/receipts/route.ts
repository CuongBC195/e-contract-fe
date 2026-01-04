import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDocuments } from '@/lib/api-client';
import { transformDocumentToReceipt } from '@/lib/data-transform';

/**
 * Get user's receipts/documents
 * Proxy to backend /api/documents
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '4');

    // Get documents from backend (for current user)
    // Use apiRequest directly with token
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    const backendResponse = await fetch(`${BACKEND_URL}/api/documents?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!backendResponse.ok) {
      console.warn('Backend request failed:', backendResponse.status, backendResponse.statusText);
      // Return empty list instead of error to prevent frontend crash
      return NextResponse.json({
        success: true,
        receipts: [],
        pagination: {
          total: 0,
          page: page,
          pageSize: pageSize,
          totalPages: 0,
        },
      });
    }

    const backendData = await backendResponse.json().catch(() => ({ success: false }));
    
    // Check if response has ApiResponse wrapper
    const response = backendData.statusCode === 200 && backendData.data
      ? { data: backendData.data, message: backendData.message }
      : { data: backendData, message: '' };

    if (!response.data || !response.data.items) {
      console.warn('No documents data returned:', response.message);
      // Return empty list instead of error
      return NextResponse.json({
        success: true,
        receipts: [],
        pagination: {
          total: 0,
          page: page,
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
    console.error('List user receipts error:', error);
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

