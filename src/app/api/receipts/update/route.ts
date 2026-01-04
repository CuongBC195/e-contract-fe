import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateDocument } from '@/lib/api-client';
import type { UpdateDocumentRequestDto } from '@/lib/api-client';
import { parseDateToISO } from '@/lib/data-transform';

/**
 * Update existing receipt/document
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, document } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document data is required' },
        { status: 400 }
      );
    }

    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Transform to backend DTO
    // Backend expects integer enum: 0 = Receipt, 1 = Contract
    // SigningMode: 0 = Public, 1 = RequiredLogin
    // ASP.NET Core should handle camelCase automatically
    const updateRequest: any = {
      title: document.title,
      content: document.content,
      receiptInfo: document.receiptInfo,
      signingMode: document.signingMode === 'RequiredLogin' ? 1 : 0,
      metadata: document.metadata ? {
        contractNumber: document.metadata.contractNumber,
        location: document.metadata.location,
        contractDate: document.metadata.createdDate ? parseDateToISO(document.metadata.createdDate) : undefined,
      } : undefined,
    };

    // Update document via backend API
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
    
    const backendResponse = await fetch(`${BACKEND_URL}/api/documents/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(updateRequest),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ 
        message: backendResponse.statusText 
      }));
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.message || 'Failed to update document' 
        },
        { status: backendResponse.status }
      );
    }

    const backendData = await backendResponse.json().catch(() => ({ success: false }));
    
    // Check if response has ApiResponse wrapper
    const response = backendData.statusCode === 200 && backendData.data
      ? { data: backendData.data, message: backendData.message }
      : { data: backendData, message: '' };

    if (!response.data) {
      return NextResponse.json(
        { success: false, error: response.message || 'Failed to update document' },
        { status: 500 }
      );
    }

    // Transform response (same as create)
    // Handle enum as integer or string
    const documentType = typeof response.data.type === 'number' 
      ? (response.data.type === 1 ? 'contract' : 'receipt')
      : (response.data.type?.toLowerCase() === 'contract' ? 'contract' : 'receipt');
    
    const status = typeof response.data.status === 'number'
      ? (response.data.status === 0 ? 'pending' : response.data.status === 1 ? 'partially_signed' : 'signed')
      : (response.data.status?.toLowerCase() === 'signed' ? 'signed' : 
         response.data.status?.toLowerCase() === 'partiallysigned' ? 'partially_signed' : 'pending');

    const receipt = {
      id: response.data.id,
      type: documentType as 'receipt' | 'contract',
      title: response.data.title,
      content: response.data.content,
      status,
      createdAt: new Date(response.data.createdAt).getTime(),
      receiptInfo: response.data.receiptInfo,
      document: documentType === 'contract' ? {
        type: 'contract',
        title: response.data.title || '',
        content: response.data.content || '',
        signers: response.data.signatures?.map((sig: any) => ({
          id: sig.signerId,
          role: sig.signerRole,
          name: sig.signerName || '',
          email: sig.signerEmail || '',
          signed: true,
          signatureData: sig.signatureData ? {
            type: typeof sig.signatureData.type === 'string'
              ? (sig.signatureData.type.toLowerCase() === 'draw' ? 'draw' : 'type')
              : 'type',
            data: sig.signatureData.data,
            fontFamily: sig.signatureData.fontFamily,
            color: sig.signatureData.color,
          } : undefined,
        })) || [],
        metadata: response.data.metadata ? {
          contractNumber: response.data.metadata.contractNumber,
          createdDate: response.data.metadata.contractDate 
            ? new Date(response.data.metadata.contractDate).toLocaleDateString('vi-VN')
            : new Date().toLocaleDateString('vi-VN'),
          location: response.data.metadata.location || '',
        } : {},
      } : undefined,
    };

    return NextResponse.json({
      success: true,
      receipt,
    });
  } catch (error: any) {
    console.error('Error updating receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update receipt' 
      },
      { status: 500 }
    );
  }
}

