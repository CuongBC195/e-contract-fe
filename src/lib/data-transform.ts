/**
 * Data transformation utilities
 * Convert between frontend and backend data formats
 */

import type { 
  SignatureDataDto, 
  DocumentResponseDto, 
  ReceiptInfoDto,
  ContractMetadataDto,
  SignerResponseDto
} from './api-client';
import type { SignatureData, Signer, ReceiptData } from './kv';

/**
 * Transform backend SignatureDataDto to frontend SignatureData
 * NOTE: Format is now unified - no transformation needed, just mapping
 */
export function transformSignatureDataFromBackend(dto: SignatureDataDto): SignatureData {
  // Format is now unified - backend uses data: string, frontend uses data: string
  return {
    type: dto.type.toLowerCase() === 'draw' ? 'draw' : 'type',
    data: dto.data, // Already in correct format (JSON string for draw, plain text for type)
    fontFamily: dto.fontFamily,
    color: dto.color,
  };
}

/**
 * Transform frontend SignatureData to backend SignatureDataDto
 * NOTE: Format is now unified - no transformation needed, just mapping
 */
export function transformSignatureDataToBackend(data: SignatureData): SignatureDataDto {
  // Format is now unified - frontend uses data: string, backend uses data: string
  return {
    type: data.type === 'draw' ? 'draw' : 'type',
    data: data.data, // Already in correct format
    fontFamily: data.fontFamily,
    color: data.color,
  };
}

/**
 * Transform backend DocumentResponseDto to frontend Receipt format
 */
export function transformDocumentToReceipt(doc: DocumentResponseDto): any {
  // Handle enum as integer or string
  // DocumentType: 0 = Receipt, 1 = Contract
  const documentType = typeof doc.type === 'number' 
    ? (doc.type === 1 ? 'contract' : 'receipt')
    : (doc.type?.toLowerCase() === 'contract' ? 'contract' : 'receipt');
  
  // DocumentStatus: 0 = Pending, 1 = PartiallySigned, 2 = Signed
  const status = typeof doc.status === 'number'
    ? (doc.status === 0 ? 'pending' : doc.status === 1 ? 'partially_signed' : 'signed')
    : (doc.status?.toLowerCase() === 'signed' ? 'signed' : 
       doc.status?.toLowerCase() === 'partiallysigned' ? 'partially_signed' : 'pending');

  const baseReceipt: any = {
    id: doc.id,
    type: documentType as 'receipt' | 'contract',
    title: doc.title,
    content: doc.content,
    status,
    createdAt: new Date(doc.createdAt).getTime(),
    signedAt: doc.signedAt ? new Date(doc.signedAt).getTime() : undefined,
    viewedAt: doc.viewedAt ? new Date(doc.viewedAt).getTime() : undefined,
    receiptInfo: doc.receiptInfo,
    userId: doc.creator?.id,
    signatures: doc.signatures,
    // 🔒 SECURITY: Map hash verification
    hashVerification: doc.hashVerification ? {
      isValid: doc.hashVerification.isValid,
      message: doc.hashVerification.message,
      mismatchedSignatures: doc.hashVerification.mismatchedSignatures || [],
    } : undefined,
  };


  // For contracts, add document structure
  if (documentType === 'contract') {
    // Handle signingMode enum (can be string or integer)
    const signingModeValue = typeof doc.signingMode === 'number'
      ? (doc.signingMode === 1 ? 'RequiredLogin' : 'Public')
      : (doc.signingMode === 'RequiredLogin' ? 'RequiredLogin' : 'Public');
    
    // Create a map of signatures by signerId for quick lookup
    const signaturesById = new Map(
      (doc.signatures || []).map(sig => [sig.signerId, sig])
    );
    
    // Create a map of signatures by role for fallback matching
    const signaturesByRole = new Map(
      (doc.signatures || []).map(sig => [sig.signerRole?.toLowerCase(), sig])
    );
    
    // Build signers list:
    // 1. If backend has signers (doc.signers), use them as base and merge with signatures
    // 2. If not, fall back to creating default signers from signatures
    const defaultRoles = ['Bên A', 'Bên B'];
    const signers: any[] = [];
    
    if (doc.signers && doc.signers.length > 0) {
      // ✅ NEW: Backend provides signers with name - use them as base
      for (let i = 0; i < doc.signers.length; i++) {
        const signer = doc.signers[i];
        
        // Find matching signature by signer ID first, then by role
        let signature = signaturesById.get(signer.id);
        if (!signature) {
          signature = signaturesByRole.get(signer.role?.toLowerCase());
        }
        
        if (signature) {
          // Signer has signed - merge signature data
          const sigData = signature.signatureData;
          signers.push({
            id: signer.id,
            role: signer.role,
            name: signature.signerName || signer.name || '', // Prefer signature name, fallback to signer name
            email: signature.signerEmail || signer.email || '',
            signed: true,
            signedAt: new Date(signature.signedAt).getTime(),
            signatureData: sigData && sigData.data ? {
              type: typeof sigData.type === 'string'
                ? (sigData.type.toLowerCase() === 'draw' ? 'draw' : 'type')
                : 'type',
              data: sigData.data,
              fontFamily: sigData.fontFamily,
              color: sigData.color,
            } : undefined,
          });
        } else {
          // Signer hasn't signed yet - use signer info with name
          signers.push({
            id: signer.id,
            role: signer.role,
            name: signer.name || '', // ✅ KEY FIX: Name is preserved from backend
            email: signer.email || '',
            signed: false,
          });
        }
      }
    } else {
      // FALLBACK: No signers from backend - create from signatures (legacy behavior)
      // This maintains backward compatibility with old documents
      const usedSignatures = new Set<string>();
      
      for (let i = 0; i < 2; i++) {
        const role = defaultRoles[i];
        let signature: typeof doc.signatures[0] | undefined = undefined;
        
        // Try to find signature by role
        for (const sig of (doc.signatures || [])) {
          if (!usedSignatures.has(sig.id)) {
            const sigRole = (sig.signerRole || '').toLowerCase();
            if (sigRole === role.toLowerCase() || 
                (sigRole === 'signer' && i === (doc.signatures || []).indexOf(sig))) {
              signature = sig;
              usedSignatures.add(sig.id);
              break;
            }
          }
        }
        
        // Fallback: use any unused signature
        if (!signature && (doc.signatures || []).length > 0) {
          const unusedSig = (doc.signatures || []).find(s => !usedSignatures.has(s.id));
          if (unusedSig) {
            signature = unusedSig;
            usedSignatures.add(signature.id);
          }
        }
        
        if (signature) {
          const sigData = signature.signatureData;
          signers.push({
            id: signature.signerId,
            role: signature.signerRole || role,
            name: signature.signerName || '',
            email: signature.signerEmail || '',
            signed: true,
            signedAt: new Date(signature.signedAt).getTime(),
            signatureData: sigData && sigData.data ? {
              type: typeof sigData.type === 'string'
                ? (sigData.type.toLowerCase() === 'draw' ? 'draw' : 'type')
                : 'type',
              data: sigData.data,
              fontFamily: sigData.fontFamily,
              color: sigData.color,
            } : undefined,
          });
        } else {
          // No signature - create empty signer
          signers.push({
            id: `signer-${i}`,
            role: role,
            name: '',
            email: '',
            signed: false,
          });
        }
      }
    }
    
    const result = {
      ...baseReceipt,
      document: {
        type: 'contract',
        title: doc.title || '',
        content: doc.content || '',
        signers,
        signingMode: signingModeValue,
        metadata: doc.metadata ? {
          contractNumber: doc.metadata.contractNumber,
          createdDate: doc.metadata.contractDate 
            ? new Date(doc.metadata.contractDate).toLocaleDateString('vi-VN')
            : new Date().toLocaleDateString('vi-VN'),
          location: doc.metadata.location || '',
        } : {},
      },
    };
    
    return result; // CRITICAL: Must return here for contracts!
  }

  // For receipts - transform receiptInfo to ReceiptData format
  if (doc.receiptInfo) {
    return {
      ...baseReceipt,
      receiptInfo: doc.receiptInfo, // Keep receiptInfo for compatibility
      data: transformReceiptInfoToReceiptData(doc.receiptInfo), // Add data field for ReceiptEditorKV
      info: undefined, // Not using legacy format
    };
  }

  // For receipts without receiptInfo
  return baseReceipt;
}

/**
 * Transform backend ReceiptInfoDto to frontend ReceiptData format
 */
export function transformReceiptInfoToReceiptData(receiptInfo: ReceiptInfoDto): ReceiptData {
  return {
    title: 'GIẤY BIÊN NHẬN TIỀN',
    fields: [
      { 
        id: 'hoTenNguoiNhan', 
        label: 'Họ và tên người nhận', 
        value: receiptInfo.receiverName || '', 
        type: 'text' 
      },
      { 
        id: 'donViNguoiNhan', 
        label: 'Đơn vị người nhận', 
        value: receiptInfo.receiverAddress || '', 
        type: 'text' 
      },
      { 
        id: 'hoTenNguoiGui', 
        label: 'Họ và tên người gửi', 
        value: receiptInfo.senderName || '', 
        type: 'text' 
      },
      { 
        id: 'donViNguoiGui', 
        label: 'Đơn vị người gửi', 
        value: receiptInfo.senderAddress || '', 
        type: 'text' 
      },
      { 
        id: 'lyDoNop', 
        label: 'Lý do nộp', 
        value: receiptInfo.reason || '', 
        type: 'text' 
      },
      { 
        id: 'soTien', 
        label: 'Số tiền', 
        value: receiptInfo.amount?.toString() || '0', 
        type: 'money' 
      },
    ],
    ngayThang: receiptInfo.date ? new Date(receiptInfo.date).toLocaleDateString('vi-VN') : '',
    diaDiem: receiptInfo.location || '',
  };
}

/**
 * Transform frontend ReceiptData to backend ReceiptInfoDto
 */
export function transformReceiptDataToReceiptInfo(data: ReceiptData): ReceiptInfoDto {
  const soTienField = data.fields.find(f => f.type === 'money');
  const amount = soTienField ? parseFloat(soTienField.value.replace(/\D/g, '')) || 0 : 0;

  return {
    senderName: data.fields.find(f => f.id === 'hoTenNguoiGui')?.value || '',
    senderAddress: data.fields.find(f => f.id === 'donViNguoiGui')?.value || '',
    receiverName: data.fields.find(f => f.id === 'hoTenNguoiNhan')?.value || '',
    receiverAddress: data.fields.find(f => f.id === 'donViNguoiNhan')?.value || '',
    amount: amount,
    reason: data.fields.find(f => f.id === 'lyDoNop')?.value || '',
    location: data.diaDiem || '',
    date: data.ngayThang ? new Date(data.ngayThang).toISOString() : undefined,
  };
}

/**
 * Transform frontend ContractMetadata to backend ContractMetadataDto
 */
/**
 * Helper function to safely parse date string to ISO string
 * Handles multiple formats:
 * - ISO format: "2024-12-25T00:00:00Z"
 * - Vietnamese format: "ngày 25 tháng 12 năm 2024"
 * - DD/MM/YYYY format: "25/12/2024"
 * - Standard Date parsing
 */
export function parseDateToISO(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  
  try {
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
    console.error('Error parsing date:', dateStr, error);
    return undefined;
  }
}

export function transformMetadataToBackend(metadata: {
  contractNumber?: string;
  createdDate: string;
  effectiveDate?: string;
  expiryDate?: string;
  location: string;
}): ContractMetadataDto {
  return {
    contractNumber: metadata.contractNumber,
    location: metadata.location,
    contractDate: parseDateToISO(metadata.createdDate),
  };
}

/**
 * Transform backend ContractMetadataDto to frontend metadata
 */
export function transformMetadataFromBackend(metadata: ContractMetadataDto): {
  contractNumber?: string;
  createdDate: string;
  effectiveDate?: string;
  expiryDate?: string;
  location: string;
} {
  return {
    contractNumber: metadata.contractNumber,
    location: metadata.location || '',
    createdDate: metadata.contractDate ? new Date(metadata.contractDate).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
  };
}

