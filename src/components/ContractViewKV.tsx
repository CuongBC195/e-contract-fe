'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileDown,
  PenLine,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureModal, { SignatureResult } from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import type { Receipt, Signer, SignatureData, SignaturePoint } from '@/lib/kv';

interface ContractViewKVProps {
  receiptId: string;
}

// Helper: Render signature SVG from data string
function renderSignatureSVGFromData(data: string, color?: string) {
  try {
    const points: SignaturePoint[][] = JSON.parse(data);
    if (!points || points.length === 0) return null;

    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const stroke of points) {
      for (const point of stroke) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const scale = Math.min(200 / width, 80 / height, 1) * 0.8;
    const offsetX = (250 - width * scale) / 2 - minX * scale;
    const offsetY = (80 - height * scale) / 2 - minY * scale;

    return points.map((stroke, i) => {
      const pathData = stroke.map((point, j) => {
        const x = point.x * scale + offsetX;
        const y = point.y * scale + offsetY;
        return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      }).join(' ');

      return (
        <path
          key={i}
          d={pathData}
          stroke={color || '#000'}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    });
  } catch (error) {
    console.error('Failed to render signature from data:', error);
    return null;
  }
}

export default function ContractViewKV({ receiptId }: ContractViewKVProps) {
  const contractRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();

  // Contract data
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentSignerId, setCurrentSignerId] = useState<string | null>(null);
  const [localSignatures, setLocalSignatures] = useState<Record<string, string>>({});
  const [signatureDataMap, setSignatureDataMap] = useState<Record<string, SignatureData>>({});
  // SECURITY: Store signer info (email/name) for each signer
  const [signerInfoMap, setSignerInfoMap] = useState<Record<string, { email?: string; name?: string }>>({});
  const [showSignerInfoModal, setShowSignerInfoModal] = useState(false);
  const [pendingSignerId, setPendingSignerId] = useState<string | null>(null);

  // Action states
  const [signing, setSigning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Fetch contract
  useEffect(() => {
    const fetchContract = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/receipts/get?id=${receiptId}`);
        if (!res.ok) {
          throw new Error('Failed to load contract');
        }
        const data = await res.json().catch(() => ({ success: false }));

        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/c0dd4eed-6dc5-42ed-b9e7-2bb1a8b4e15b', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ContractViewKV.tsx:107',message:'Received receipt data',data:{success:data.success,hasReceipt:!!data.receipt,receiptId:data.receipt?.id,receiptStatus:data.receipt?.status,hasDocument:!!data.receipt?.document,signatureCount:data.receipt?.document?.signers?.length||0,signatureIds:data.receipt?.document?.signers?.map((s:any)=>s.id)||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        if (data.success && data.receipt) {
          const r = data.receipt as Receipt;
          
          if (!r.document) {
            setError('Đây không phải hợp đồng mới. Vui lòng dùng trang xem biên lai cũ.');
            return;
          }

          // SECURITY: Check signing mode - if RequiredLogin, user must be authenticated
          if (r.document.signingMode === 'RequiredLogin') {
            // Check if user is authenticated
            const authCheckRes = await fetch('/api/user/check');
            const authCheckData = await authCheckRes.json().catch(() => ({ authenticated: false }));
            
            if (!authCheckData.authenticated) {
              // Redirect to login page with return URL
              showToast('Vui lòng đăng nhập để ký tài liệu này', 'error');
              router.push(`/user/login?returnUrl=${encodeURIComponent(window.location.href)}`);
              return;
            }
          }

          setReceipt(r);
          
          // Check if already fully signed
          if (r.status === 'signed') {
            setCompleted(true);
          }

          // Track view (customer opened the link)
          try {
            await fetch('/api/receipts/track-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: receiptId }),
            });
          } catch (error) {
            console.error('Error tracking view:', error);
            // Don't fail if tracking fails
          }
        } else {
          setError(data.error || 'Không tìm thấy hợp đồng');
        }
      } catch (err) {
        console.error('Error fetching contract:', err);
        setError('Có lỗi xảy ra khi tải hợp đồng');
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [receiptId]);

  // Handle signature
  const handleOpenSignature = (signerId: string) => {
    // SECURITY: Check if email/name is required before opening signature modal
    const signerInfo = signerInfoMap[signerId];
    if (!signerInfo || (!signerInfo.email && !signerInfo.name)) {
      // Show form to enter email/name first
      setPendingSignerId(signerId);
      setShowSignerInfoModal(true);
      return;
    }
    setCurrentSignerId(signerId);
    setIsSignatureModalOpen(true);
  };

  // Handle signer info submission
  const handleSignerInfoSubmit = () => {
    if (!pendingSignerId) return;
    
    const signerInfo = signerInfoMap[pendingSignerId];
    if (!signerInfo || (!signerInfo.email && !signerInfo.name)) {
      showToast('Vui lòng nhập Email hoặc Họ tên trước khi ký', 'error');
      return;
    }
    
    setShowSignerInfoModal(false);
    setCurrentSignerId(pendingSignerId);
    setPendingSignerId(null);
    setIsSignatureModalOpen(true);
  };

  const handleSignatureComplete = (result: SignatureResult) => {
    if (!currentSignerId) return;

    // VALIDATION: Check if signature is actually drawn/typed
    if (result.type === 'draw') {
      if (!result.signaturePoints || result.signaturePoints.length === 0) {
        showToast('Vui lòng vẽ chữ ký trước khi lưu!', 'error');
        return;
      }
      // Check if all strokes are empty
      const hasValidStrokes = result.signaturePoints.some(stroke => stroke.length > 0);
      if (!hasValidStrokes) {
        showToast('Chữ ký không hợp lệ. Vui lòng vẽ lại!', 'error');
        return;
      }
    } else if (result.type === 'type') {
      if (!result.typedText || result.typedText.trim() === '') {
        showToast('Vui lòng nhập tên trước khi lưu!', 'error');
        return;
      }
    }

    // Store local preview
    setLocalSignatures(prev => ({
      ...prev,
      [currentSignerId]: result.previewDataUrl,
    }));

    // Store signature data for server submission (use data string directly)
    const signatureData: SignatureData = {
      type: result.type,
      data: result.data, // JSON string for draw, plain text for type
      fontFamily: result.fontFamily,
      color: result.color,
    };

    setSignatureDataMap(prev => ({
      ...prev,
      [currentSignerId]: signatureData,
    }));

    setIsSignatureModalOpen(false);
    setCurrentSignerId(null);
    showToast('Đã thêm chữ ký', 'success');
  };

  // Submit all signatures
  const handleSubmitSignatures = async () => {
    if (!receipt?.document) return;

    // Check if all required signers have signed
    const unsignedSigners = receipt.document.signers.filter(
      s => !s.signed && !localSignatures[s.id]
    );

    if (unsignedSigners.length > 0) {
      showToast(`Còn ${unsignedSigners.length} bên chưa ký`, 'error');
      return;
    }

    setSigning(true);

    try {
      // Find the first unsigned signer who has signature data
      const signerToSign = receipt.document.signers.find(s => !s.signed && signatureDataMap[s.id]);
      
      if (!signerToSign) {
        showToast('Không tìm thấy chữ ký để gửi', 'error');
        return;
      }

      // Get the actual signature data
      const signatureData = signatureDataMap[signerToSign.id];

      // SECURITY: Validate email/name is provided
      const signerInfo = signerInfoMap[signerToSign.id];
      if (!signerInfo || (!signerInfo.email && !signerInfo.name)) {
        showToast('Vui lòng nhập Email hoặc Họ tên trước khi ký tài liệu!', 'error');
        setSigning(false);
        return;
      }

      // FINAL VALIDATION: Double-check signature data before sending
      if (!signatureData) {
        showToast('Không tìm thấy dữ liệu chữ ký!', 'error');
        setSigning(false);
        return;
      }

      // Validate signature data
      if (!signatureData.data || signatureData.data.trim() === '') {
        showToast('Chữ ký không hợp lệ. Vui lòng ký lại!', 'error');
        // Remove invalid signature
        setSignatureDataMap(prev => {
          const newMap = { ...prev };
          delete newMap[signerToSign.id];
          return newMap;
        });
        setLocalSignatures(prev => {
          const newSigs = { ...prev };
          delete newSigs[signerToSign.id];
          return newSigs;
        });
        setSigning(false);
        return;
      }

      // Additional validation for draw type - check if JSON is valid
      if (signatureData.type === 'draw') {
        try {
          const points = JSON.parse(signatureData.data);
          if (!points || !Array.isArray(points) || points.length === 0) {
            throw new Error('Invalid signature points');
          }
        } catch (error) {
          showToast('Chữ ký không hợp lệ. Vui lòng ký lại!', 'error');
          setSigning(false);
          return;
        }
      }

      const response = await fetch('/api/receipts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: receiptId,
          signerId: signerToSign.id,
          signatureDataNguoiGui: signatureData,
          signerInfo: {
            role: signerToSign.role || 'Bên A', // CRITICAL: Ensure role is always provided, default to "Bên A"
            name: signerInfo.name || signerToSign.name || '',
            email: signerInfo.email || signerToSign.email || '',
          },
        }),
      });

      // Handle response - even if PDF generation fails, signing may have succeeded
      const result = await response.json().catch(() => ({ success: false }));
      
      // Check if signing was successful (even if PDF generation failed)
      if (!response.ok && !result.success) {
        const errorMessage = result.error || result.message || 'Failed to sign document';
        throw new Error(errorMessage);
      }

      if (result.success) {
        showToast('Ký thành công!', 'success');
        setCompleted(true);
        
        // Reload contract
        const refreshRes = await fetch(`/api/receipts/get?id=${receiptId}`);
        if (!refreshRes.ok) {
          throw new Error('Failed to reload contract');
        }
        const refreshData = await refreshRes.json().catch(() => ({ success: false }));
        if (refreshData.success) {
          setReceipt(refreshData.receipt);
          // SECURITY: Check hash verification
          if (refreshData.receipt?.hashVerification && !refreshData.receipt.hashVerification.isValid) {
            showToast(refreshData.receipt.hashVerification.message || 'Tài liệu đã bị thay đổi sau khi ký', 'error');
          }
        }
      } else {
        // SECURITY: Handle specific error codes
        if (result.code === 'ALREADY_SIGNED') {
          // Already signed is not an error - just reload to show updated state
          showToast('Tài liệu đã được ký bởi người ký này', 'success');
          setCompleted(true);
          // Reload to show updated state
          window.location.reload();
        } else if (result.code === 'PDF_GENERATION_FAILED') {
          showToast('Không thể tạo PDF. Vui lòng thử lại sau.', 'error');
        } else if (result.code === 'EMPTY_SIGNATURE') {
          showToast('Vui lòng vẽ hoặc gõ chữ ký trước khi gửi!', 'error');
        } else if (result.code === 'RATE_LIMITED') {
          const retryAfter = result.retryAfter || 60;
          showToast(`⏱️ Vui lòng đợi ${retryAfter} giây trước khi thử lại.`, 'error');
          // Auto re-enable after rate limit expires
          setTimeout(() => {
            setSigning(false);
          }, retryAfter * 1000);
          return; // Don't setSigning(false) immediately
        } else {
          showToast(result.error || 'Ký thất bại', 'error');
        }
      }
    } catch (error) {
      console.error('Error signing:', error);
      showToast('Có lỗi xảy ra khi ký', 'error');
    } finally {
      // Only reset if not rate limited (handled above)
      setSigning(false);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!contractRef.current || !receipt?.document) return;

    setExporting(true);

    try {
      // Ensure container is fully visible and scroll to top
      contractRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for scroll
      
      // Use html2canvas to capture full content including scrollable parts
      const canvas = await html2canvas(contractRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: contractRef.current.scrollWidth,
        height: contractRef.current.scrollHeight,
      });
      const fullImageData = canvas.toDataURL('image/png', 1.0);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const img = new Image();
      img.src = fullImageData;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // A4 width: 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // A4 height: 297mm
      
      // Container is 210mm in CSS, we want to fit it in A4 with small margins
      // Use minimal margins: 3mm left (shift left), 7mm right (prevent overflow)
      const leftMargin = 3; // 3mm left margin (shift left)
      const rightMargin = 7; // 7mm right margin (prevent overflow)
      const usableWidth = pageWidth - leftMargin - rightMargin; // 200mm
      
      // Calculate scale: container 210mm -> fit in 200mm
      const scale = usableWidth / 210;
      const imgWidth = usableWidth; // 200mm in PDF
      
      // Calculate full image height in PDF units (mm)
      // Image aspect ratio: img.height / img.width
      // Container width is 210mm, so height = 210 * (img.height / img.width)
      const containerHeightMm = 210 * (img.height / img.width);
      const imgHeight = containerHeightMm * scale; // Scaled height in mm for PDF
      
      // Minimal vertical margins
      const topMargin = 5;
      const bottomMargin = 5;
      const usableHeight = pageHeight - topMargin - bottomMargin; // 287mm
      
      // Split into multiple pages if needed
      if (imgHeight > usableHeight) {
        // Calculate pixels per mm in source image
        const pixelsPerMm = img.width / 210;
        
        let sourceY = 0; // Current position in source image (in pixels)
        let pageNumber = 0;
        
        while (sourceY < img.height) {
          if (pageNumber > 0) {
            pdf.addPage();
          }
          
          // Calculate how much height to show on this page (in mm)
          const remainingHeightMm = (img.height - sourceY) / pixelsPerMm / scale;
          const pageHeightToShowMm = Math.min(usableHeight, remainingHeightMm);
          
          // Convert page height to pixels in source image
          const sourceHeight = pageHeightToShowMm * scale * pixelsPerMm;
          
          // Ensure we don't exceed image bounds
          const actualSourceHeight = Math.min(sourceHeight, img.height - sourceY);
          
          // Create a temporary canvas to crop this page's portion
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = img.width;
          pageCanvas.height = actualSourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            // Draw the cropped portion
            pageCtx.drawImage(
              img,
              0, sourceY, img.width, actualSourceHeight, // Source: crop from sourceY
              0, 0, img.width, actualSourceHeight // Destination: full canvas
            );
            
            const pageDataUrl = pageCanvas.toDataURL('image/png', 1.0);
            
            // Add cropped image to PDF
            pdf.addImage(
              pageDataUrl,
              'PNG',
              leftMargin,
              topMargin,
              imgWidth,
              pageHeightToShowMm
            );
          }
          
          // Move to next page position
          sourceY += actualSourceHeight;
          pageNumber++;
          
          // Safety check to avoid infinite loop
          if (actualSourceHeight <= 0) break;
        }
      } else {
        // Single page - fit with margins
        pdf.addImage(fullImageData, 'PNG', leftMargin, topMargin, imgWidth, imgHeight, undefined, 'FAST');
      }

      pdf.save(`Hop_Dong_${receiptId}.pdf`);

      showToast('Đã tải xuống PDF', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showToast('Không thể xuất PDF', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
          <span className="text-gray-500">Đang tải hợp đồng...</span>
        </div>
      </div>
    );
  }

  // Error
  if (error || !receipt?.document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Không tìm thấy hợp đồng</h2>
          <p className="text-gray-500">{error || 'Hợp đồng không tồn tại'}</p>
        </div>
      </div>
    );
  }

  const contract = receipt.document;

  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* CSS for contract content to fit A4 */}
      <style jsx global>{`
        [data-contract-content] * {
          max-width: 100% !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          box-sizing: border-box !important;
        }
        [data-contract-content] table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }
        [data-contract-content] img {
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>

      <div className="max-w-4xl mx-auto" style={{ paddingLeft: '8px' }}>
        {/* SECURITY: Hash Verification Warning */}
        {receipt?.hashVerification && !receipt.hashVerification.isValid && (
          <div className="glass-card rounded-2xl p-6 mb-6 border-2 border-red-400 bg-red-50">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span>Cảnh báo: Tài liệu đã bị thay đổi</span>
                </h3>
                <p className="text-red-700 mb-2">
                  {receipt.hashVerification.message || 'Tài liệu này đã bị thay đổi sau khi ký. Tính toàn vẹn của tài liệu không được đảm bảo.'}
                </p>
                {receipt.hashVerification.mismatchedSignatures && receipt.hashVerification.mismatchedSignatures.length > 0 && (
                  <p className="text-sm text-red-600">
                    Chữ ký bị ảnh hưởng: {receipt.hashVerification.mismatchedSignatures.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {completed && (
          <div className="glass-card rounded-2xl p-6 mb-6 text-center border-2 border-green-400">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-green-900 mb-2">
              Hợp đồng đã hoàn tất!
            </h3>
            <p className="text-green-700">
              Tất cả các bên đã ký xác nhận. Bạn có thể tải xuống file PDF.
            </p>
          </div>
        )}

        {/* Contract Content */}
        <div 
          ref={contractRef} 
          className="glass-card rounded-2xl p-8 mb-6" 
          style={{ 
            fontFamily: 'var(--font-tinos), serif',
            width: '210mm', // A4 width
            maxWidth: '100%',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
            <p className="mt-4 text-gray-400">---------------oOo---------------</p>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">{contract.title}</h1>
          {contract.metadata.contractNumber && (
            <p className="text-center text-sm italic mb-6">Số: {contract.metadata.contractNumber}</p>
          )}

          {/* Date & Location */}
          <p className="mb-8 text-right">
            {contract.metadata.createdDate}, tại {contract.metadata.location}
          </p>

          {/* Content */}
          <div
            data-contract-content
            className="mb-8 leading-relaxed"
            style={{
              width: '100%',
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: contract.content }}
          />

          {/* Signatures */}
          <div className="mt-12">
            <p className="text-right mb-8">
              {contract.metadata.location}, {contract.metadata.createdDate}
            </p>

            <div className={`grid gap-8 ${contract.signers.length > 2 ? 'grid-cols-2' : `grid-cols-${contract.signers.length}`}`}>
              {contract.signers.map((signer) => {
                const hasLocalSignature = localSignatures[signer.id];
                const hasBackendSignature = signer.signed && signer.signatureData;
                const signatureData = signer.signatureData;

                return (
                  <div key={signer.id} className="text-center">
                    <p className="font-bold mb-2">{signer.role}</p>
                    <p className="text-sm italic text-gray-500 mb-4">(Ký và ghi rõ họ tên)</p>

                    <div className="min-h-[100px] flex items-center justify-center mb-4">
                      {hasLocalSignature ? (
                        /* Local preview (from modal) */
                        <img
                          src={localSignatures[signer.id]}
                          alt={`Chữ ký ${signer.role}`}
                          className="h-20 w-auto object-contain"
                        />
                      ) : hasBackendSignature && signatureData ? (
                        /* Backend signature - render from data string */
                        <>
                          {signatureData.type === 'type' ? (
                            <span 
                              className="text-2xl italic" 
                              style={{ 
                                fontFamily: signatureData.fontFamily || 'cursive',
                                color: signatureData.color || '#000'
                              }}
                            >
                              {signatureData.data}
                            </span>
                          ) : signatureData.type === 'draw' ? (
                            <svg 
                              viewBox="0 0 250 80" 
                              className="w-full h-full"
                              style={{ maxWidth: '200px', maxHeight: '80px' }}
                            >
                              {renderSignatureSVGFromData(signatureData.data, signatureData.color)}
                            </svg>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đã ký</span>
                            </div>
                          )}
                        </>
                      ) : !completed && !signer.signed ? (
                        <button
                          onClick={() => handleOpenSignature(signer.id)}
                          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-blue-400 rounded-xl text-blue-600 hover:border-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <PenLine className="w-4 h-4" />
                          Ký xác nhận
                        </button>
                      ) : (
                        <span className="text-gray-400 italic">
                          {signer.signed ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đã ký</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Chưa ký</span>
                          )}
                        </span>
                      )}
                    </div>

                    <p className="border-t border-dotted border-gray-400 pt-2 inline-block px-8">
                      {signer.name || '...........................'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex flex-col gap-3">
            {!completed && (
              <button
                onClick={handleSubmitSignatures}
                disabled={signing || Object.keys(localSignatures).length === 0}
                className="w-full px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {signing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Hoàn tất & Gửi
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleExportPDF}
              disabled={exporting || !completed}
              className="w-full px-6 py-3 border-2 border-black text-black rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xuất...
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  Tải xuống PDF
                </>
              )}
            </button>
          </div>

          {!completed && (
            <p className="text-xs text-gray-500 text-center mt-3">
              {Object.keys(localSignatures).length > 0
                ? 'Nhấn "Hoàn tất & Gửi" để lưu chữ ký'
                : 'Vui lòng ký xác nhận trước'}
            </p>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setCurrentSignerId(null);
        }}
        onApply={handleSignatureComplete}
      />

      {/* SECURITY: Signer Info Modal (Email/Name) */}
      {showSignerInfoModal && pendingSignerId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Thông tin người ký
            </h2>
            <div className="text-sm text-red-600 mb-6 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Bắt buộc: Vui lòng nhập Email hoặc Họ tên để ký tài liệu</span>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(ít nhất một trong hai)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={signerInfoMap[pendingSignerId]?.email || ''}
                  onChange={(e) => {
                    setSignerInfoMap(prev => ({
                      ...prev,
                      [pendingSignerId]: {
                        ...prev[pendingSignerId],
                        email: e.target.value,
                      },
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Họ tên <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(ít nhất một trong hai)</span>
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={signerInfoMap[pendingSignerId]?.name || ''}
                  onChange={(e) => {
                    setSignerInfoMap(prev => ({
                      ...prev,
                      [pendingSignerId]: {
                        ...prev[pendingSignerId],
                        name: e.target.value,
                      },
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSignerInfoModal(false);
                  setPendingSignerId(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSignerInfoSubmit}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

