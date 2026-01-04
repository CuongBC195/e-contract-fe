import { NextRequest, NextResponse } from 'next/server';
import { getDocument, getClientIpFromHeaders, getUserAgentFromHeaders } from '@/lib/api-client';
import { transformDocumentToReceipt } from '@/lib/data-transform';

/**
 * Get single receipt/document by ID
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Receipt ID is required' },
        { status: 400 }
      );
    }

    // Get client IP and User-Agent from incoming request headers
    const clientIp = getClientIpFromHeaders(request.headers);
    const clientUserAgent = getUserAgentFromHeaders(request.headers);

    // Get document from backend with forwarded client headers
    const response = await getDocument(id, { clientIp, clientUserAgent });

    if (!response.data) {
      return NextResponse.json(
        { success: false, error: response.message || 'Receipt not found' },
        { status: 404 }
      );
    }

    // Transform to frontend format
    const receipt = transformDocumentToReceipt(response.data);

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error: any) {
    console.error('Error getting receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get receipt' 
      },
      { status: 500 }
    );
  }
}

