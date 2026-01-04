import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Delete receipt/document
 * Proxy to backend DELETE /api/documents/{id}
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get document ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Delete document from backend
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    
    const backendResponse = await fetch(`${BACKEND_URL}/api/documents/${id}`, {
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
        message: 'Document deleted successfully',
      });
    }

    // Handle other status codes
    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ 
        message: backendResponse.statusText,
        error: backendResponse.statusText
      }));
      
      // Extract error message from ApiResponse format
      // Backend returns: { message: "...", errors: [...] }
      const errorMessage = errorData.message || 
                          (errorData.errors && errorData.errors.length > 0 ? errorData.errors[0] : null) ||
                          errorData.error || 
                          'Failed to delete document';
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage
        },
        { status: backendResponse.status }
      );
    }

    // Parse response if it has content
    const backendData = await backendResponse.json().catch(() => ({ success: true }));
    
    return NextResponse.json({
      success: true,
      message: backendData.message || 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete receipt error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

