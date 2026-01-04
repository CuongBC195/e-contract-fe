import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Send invitation email to customer for signing document
 * This route proxies the request to the backend API with authentication
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      customerEmail,
      customerName,
      receiptId,
      documentId,
      signingUrl,
      documentData,
    } = body;

    // Use documentId if provided, otherwise use receiptId
    const docId = documentId || receiptId;
    
    if (!docId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Customer email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Use customerName if provided, otherwise extract from email
    const name = customerName || customerEmail.split('@')[0];

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    // Call backend API directly
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    try {
      const response = await fetch(`${backendUrl}/api/email/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: docId,
          customerEmail: customerEmail.trim(),
          customerName: name,
          signingUrl: signingUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/?id=${docId}`,
        }),
      });

      let responseData;
      try {
        const responseText = await response.text();
        if (responseText) {
          responseData = JSON.parse(responseText);
        } else {
          responseData = { message: 'Empty response' };
        }
      } catch (parseError) {
        console.error('[Send Invitation] Failed to parse response:', parseError);
        responseData = { message: 'Invalid response format' };
      }

      if (!response.ok) {
        const errorMessage = responseData?.message || responseData?.error || responseData?.errors?.[0] || 'Failed to send invitation email';
        console.error('[Send Invitation] Backend error:', response.status, errorMessage, responseData);
        return NextResponse.json(
          { 
            success: false, 
            error: errorMessage 
          },
          { status: response.status }
        );
      }

      // Check if response is successful (statusCode 200 or 201)
      if (responseData && (responseData.statusCode === 200 || responseData.statusCode === 201 || response.ok)) {
        return NextResponse.json({
          success: true,
          message: responseData.message || 'Email invitation sent successfully',
        });
      }

      // If response exists but statusCode is not 200/201
      return NextResponse.json(
        { 
          success: false, 
          error: responseData?.message || 'Failed to send invitation email' 
        },
        { status: responseData?.statusCode || response.status || 500 }
      );
    } catch (fetchError: any) {
      console.error('[Send Invitation] Network error:', fetchError);
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Network error. Please check your connection.';
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Send Invitation] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send invitation email' 
      },
      { status: 500 }
    );
  }
}

