import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

/**
 * Proxy export PDF request to backend
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Forward request to backend
    const backendUrl = `${BACKEND_URL}/api/documents/${id}/export-pdf`;
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        // Forward any auth headers if present
        ...(request.headers.get('authorization') && {
          authorization: request.headers.get('authorization')!,
        }),
      },
    });

    if (!backendResponse.ok) {
      let errorText = 'Failed to export PDF';
      try {
        errorText = await backendResponse.text();
        // Try to parse as JSON if possible
        try {
          const errorJson = JSON.parse(errorText);
          errorText = errorJson.error || errorJson.message || errorText;
        } catch {
          // Not JSON, use as-is
        }
      } catch (e) {
        console.error('Error reading backend error response:', e);
      }
      return NextResponse.json(
        { success: false, error: errorText },
        { status: backendResponse.status }
      );
    }

    // Get PDF blob from backend
    const pdfBlob = await backendResponse.blob();

    // Return PDF with proper headers
    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': backendResponse.headers.get('Content-Disposition') || 
          `attachment; filename="document_${id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting PDF:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export PDF',
      },
      { status: 500 }
    );
  }
}

