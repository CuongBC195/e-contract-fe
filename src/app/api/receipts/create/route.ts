import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createDocument } from '@/lib/api-client';
import type { CreateDocumentRequestDto } from '@/lib/api-client';

/**
 * Create new receipt/document
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { document } = body;

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document data is required' },
        { status: 400 }
      );
    }

    // Transform to backend DTO
    // Backend expects integer enum: 0 = Receipt, 1 = Contract
    // SigningMode: 0 = Public, 1 = RequiredLogin
    // ASP.NET Core should handle camelCase automatically, but we'll use camelCase to be safe
    const createRequest: any = {
      type: document.type === 'contract' ? 1 : 0,
      title: document.title,
      content: document.content,
      signers: document.signers?.map((s: any) => ({
        role: s.role,
        name: s.name || '',
        email: s.email || '',
      })) || [],
      receiptInfo: document.receiptInfo,
      signingMode: document.signingMode === 'RequiredLogin' ? 1 : 0,
      metadata: document.metadata ? {
        contractNumber: document.metadata.contractNumber,
        location: document.metadata.location,
        contractDate: document.metadata.createdDate ? (() => {
          try {
            const dateStr = document.metadata.createdDate;
            
            // If it's already an ISO string, validate and return
            if (dateStr.includes('T') || dateStr.includes('Z')) {
              const date = new Date(dateStr);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            }
            
            // Try parsing Vietnamese format: "ngày X tháng Y năm Z"
            const vietnameseMatch = dateStr.match(/ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d+)/i);
            if (vietnameseMatch) {
              const day = parseInt(vietnameseMatch[1], 10);
              const month = parseInt(vietnameseMatch[2], 10) - 1; // Month is 0-indexed
              const year = parseInt(vietnameseMatch[3], 10);
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            }
            
            // Try parsing DD/MM/YYYY format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const day = parseInt(parts[0], 10);
              const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
              const year = parseInt(parts[2], 10);
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime())) {
                return date.toISOString();
              }
            }
            
            // Try standard Date parsing
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }
            
            return undefined;
          } catch (error) {
            console.error('Error parsing date:', error);
            return undefined;
          }
        })() : undefined,
      } : undefined,
    };

    // Create document via backend API
    const response = await createDocument(createRequest);

    if (!response.data) {
      throw new Error(response.message || 'Failed to create document');
    }

    // If there are signers with signatures already (from frontend state), sign them now
    // This happens when user signs during creation
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (document.signers && document.signers.length > 0 && token) {
      const signedSigners = document.signers.filter((s: any) => s.signed && s.signatureData);
      
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      
      for (const signer of signedSigners) {
        try {
          const signResponse = await fetch(`${BACKEND_URL}/api/documents/${response.data.id}/sign`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
            body: JSON.stringify({
              signerId: signer.id,
              signerRole: signer.role || 'Signer',
              signerName: signer.name || '',
              signerEmail: signer.email || '',
              signatureData: {
                type: signer.signatureData.type,
                data: signer.signatureData.data,
                fontFamily: signer.signatureData.fontFamily,
                color: signer.signatureData.color,
              },
            }),
          });
          
          if (!signResponse.ok) {
            const errorText = await signResponse.text();
            console.error(`Failed to sign document for signer ${signer.id}:`, signResponse.status, errorText);
          } else {
            console.log(`Successfully signed document for signer ${signer.id}`);
          }
        } catch (signError) {
          console.error('Error signing document during creation:', signError);
          // Continue even if signing fails - document is still created
        }
      }
      
      // Re-fetch document to get updated signatures
      if (signedSigners.length > 0) {
        try {
          const updatedResponse = await fetch(`${BACKEND_URL}/api/documents/${response.data.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          
          if (updatedResponse.ok) {
            const updatedData = await updatedResponse.json().catch(() => null);
            // Handle ApiResponse wrapper: { statusCode: 200, data: {...}, message: "..." }
            if (updatedData?.data) {
              response.data = updatedData.data;
            } else if (updatedData?.statusCode === 200 && updatedData?.data) {
              response.data = updatedData.data;
            } else {
              console.warn('Unexpected response format when re-fetching document:', updatedData);
            }
          } else {
            console.error('Failed to re-fetch document after signing:', updatedResponse.status, await updatedResponse.text().catch(() => ''));
          }
        } catch (fetchError) {
          console.error('Error fetching updated document:', fetchError);
          // Continue with original response
        }
      }
    }
    
    const finalDocument = response.data;
    if (!finalDocument) {
      throw new Error('Failed to create document');
    }

    // Transform response
    // Backend returns enum as integer: 0 = Receipt, 1 = Contract
    // Convert to string for frontend
    const documentType = typeof finalDocument.type === 'number' 
      ? (finalDocument.type === 1 ? 'contract' : 'receipt')
      : (finalDocument.type?.toLowerCase() === 'contract' ? 'contract' : 'receipt');
    
    const status = typeof finalDocument.status === 'number'
      ? (finalDocument.status === 0 ? 'pending' : finalDocument.status === 1 ? 'partially_signed' : 'signed')
      : (finalDocument.status?.toLowerCase() === 'signed' ? 'signed' : 
         finalDocument.status?.toLowerCase() === 'partiallysigned' ? 'partially_signed' : 'pending');
    
    const receipt = {
      id: finalDocument.id,
      type: documentType as 'receipt' | 'contract',
      title: finalDocument.title,
      content: finalDocument.content,
      status,
      createdAt: new Date(finalDocument.createdAt).getTime(),
      receiptInfo: finalDocument.receiptInfo,
      document: documentType === 'contract' ? {
        type: 'contract',
        title: finalDocument.title || '',
        content: finalDocument.content || '',
        signers: (() => {
          console.log('Merging signers - finalDocument.signatures:', finalDocument.signatures?.length || 0);
          console.log('Original document.signers:', document.signers?.length || 0);
          
          // Create a map of signatures by signerId
          const signaturesMap = new Map();
          finalDocument.signatures?.forEach((sig: any) => {
            signaturesMap.set(sig.signerId, sig);
            console.log('Signature mapped:', sig.signerId, sig.signerRole, 'has signatureData:', !!sig.signatureData);
          });
          
          // Start with signers from original request, merge with signatures
          const signersList = (document.signers || []).map((signer: any) => {
            const signature = signaturesMap.get(signer.id);
            if (signature) {
              // Has signature - merge data
              return {
                id: signer.id,
                role: signature.signerRole || signer.role,
                name: signature.signerName || signer.name || '',
                email: signature.signerEmail || signer.email || '',
                signed: true,
                signatureData: signature.signatureData ? {
                  type: signature.signatureData.type.toLowerCase() === 'draw' ? 'draw' : 'type',
                  data: signature.signatureData.data,
                  fontFamily: signature.signatureData.fontFamily,
                  color: signature.signatureData.color,
                } : undefined,
              };
            } else {
              // No signature yet - return original signer data
              return {
                id: signer.id,
                role: signer.role,
                name: signer.name || '',
                email: signer.email || '',
                signed: false,
              };
            }
          });
          
          // Add any signatures that don't have corresponding signers in original request
          finalDocument.signatures?.forEach((sig: any) => {
            if (!signersList.find((s: any) => s.id === sig.signerId)) {
              signersList.push({
                id: sig.signerId,
                role: sig.signerRole,
                name: sig.signerName || '',
                email: sig.signerEmail || '',
                signed: true,
                signatureData: sig.signatureData ? {
                  type: sig.signatureData.type.toLowerCase() === 'draw' ? 'draw' : 'type',
                  data: sig.signatureData.data,
                  fontFamily: sig.signatureData.fontFamily,
                  color: sig.signatureData.color,
                } : undefined,
              });
            }
          });
          
          console.log('Final merged signers list:', signersList.length, signersList.map((s: any) => ({
            id: s.id,
            role: s.role,
            signed: s.signed,
            hasSignatureData: !!s.signatureData,
          })));
          return signersList;
        })(),
        metadata: finalDocument.metadata ? {
          contractNumber: finalDocument.metadata.contractNumber,
          createdDate: finalDocument.metadata.contractDate 
            ? new Date(finalDocument.metadata.contractDate).toLocaleDateString('vi-VN')
            : new Date().toLocaleDateString('vi-VN'),
          location: finalDocument.metadata.location || '',
        } : {},
      } : undefined,
    };

    // Generate share URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = document.type === 'contract' 
      ? `${baseUrl}/contract/${finalDocument.id}`
      : `${baseUrl}/receipt/${finalDocument.id}`;

    return NextResponse.json({
      success: true,
      receipt,
      url,
    });
  } catch (error: any) {
    console.error('Error creating receipt:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create receipt' 
      },
      { status: 500 }
    );
  }
}

