import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    // Get client IP and User-Agent from request headers
    // Try to get real IP from forwarded headers (for reverse proxy)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = forwardedFor 
      ? forwardedFor.split(',')[0].trim() 
      : request.headers.get('x-real-ip') 
      || 'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Add client IP and User-Agent to request body for backend
    const enhancedBody = {
      ...body,
      clientIpAddress: realIp,
      clientUserAgent: userAgent,
    };

    // Forward IP and User-Agent to backend in headers as well (for backup)
    const backendHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      backendHeaders['Authorization'] = `Bearer ${token}`;
    }

    // Forward client IP and User-Agent to backend in headers (backup method)
    backendHeaders['X-Client-IP'] = realIp;
    backendHeaders['X-Client-User-Agent'] = userAgent;

    // Call backend API
    const response = await fetch(`${BACKEND_URL}/api/documents/${id}/sign`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify(enhancedBody),
    });

    let data;
    try {
      const responseText = await response.text();
      if (responseText) {
        data = JSON.parse(responseText);
      } else {
        data = { message: 'Empty response' };
      }
    } catch (parseError) {
      console.error('[Sign Document] Failed to parse backend response:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid response format from backend' },
        { status: 500 }
      );
    }
    
    if (!response.ok) {
      const errorMessage = data?.error || data?.message || data?.errors?.[0] || 'Failed to sign document';
      console.error('[Sign Document] Backend error:', response.status, errorMessage, data);
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Sign Document] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sign document' },
      { status: 500 }
    );
  }
}

