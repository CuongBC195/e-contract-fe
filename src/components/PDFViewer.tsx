'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Plus, X, PenTool, Save, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import SignatureModal, { SignatureResult } from './SignatureModal';
import { PdfSignatureBlockDto, updatePdfSignatureBlocks, applyPdfSignature } from '@/lib/api-client';
import { useToast } from './Toast';

// Dynamic import react-pdf to avoid SSR issues with DOMMatrix
// Must use Next.js dynamic with ssr: false to prevent server-side execution
const Document = dynamic(() => import('react-pdf').then((mod) => mod.Document), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
});

const Page = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false });

// Set up pdfjs worker - only on client side
if (typeof window !== 'undefined') {
  import('react-pdf').then((mod) => {
    mod.pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  });
}

interface PDFViewerProps {
  pdfUrl: string;
  documentId: string;
  initialSignatureBlocks?: PdfSignatureBlockDto[];
  signerRoles?: string[];
  onSave?: () => void;
  onCancel?: () => void;
  mode?: 'edit' | 'sign'; // 'edit' for placing blocks, 'sign' for signing
}

export default function PDFViewer({
  pdfUrl,
  documentId,
  initialSignatureBlocks = [],
  signerRoles = ['Bên A', 'Bên B'],
  onSave,
  onCancel,
  mode: initialMode = 'edit',
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pages, setPages] = useState<any[]>([]);
  const [signatureBlocks, setSignatureBlocks] = useState<PdfSignatureBlockDto[]>(initialSignatureBlocks);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentBlockId, setCurrentBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [mode, setMode] = useState<'edit' | 'sign'>(initialMode);
  const { showToast } = useToast();
  const signatureModalRef = useRef<any>(null);

  // Sync initialSignatureBlocks when they change
  useEffect(() => {
    if (initialSignatureBlocks && initialSignatureBlocks.length > 0) {
      console.log('Initial blocks loaded:', initialSignatureBlocks.map(b => ({ id: b.id, role: b.signerRole, isSigned: b.isSigned })));
      setSignatureBlocks(initialSignatureBlocks);
    }
  }, [initialSignatureBlocks]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPages(Array.from({ length: numPages }, (_, i) => i + 1));
  };

  const addSignatureBlock = (role: string) => {
    if (!containerRef || pageDimensions.length === 0) return;

    const currentPageDim = pageDimensions[pageNumber - 1];
    if (!currentPageDim) return;

    // Default size: 20% width, 10% height, centered
    const defaultWidthPercent = 20;
    const defaultHeightPercent = 10;
    const defaultXPercent = 40; // Center horizontally
    const defaultYPercent = 40; // Center vertically

    const newBlock: PdfSignatureBlockDto = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      pageNumber: pageNumber - 1, // 0-based
      xPercent: defaultXPercent,
      yPercent: defaultYPercent,
      widthPercent: defaultWidthPercent,
      heightPercent: defaultHeightPercent,
      signerRole: role,
      isSigned: false,
    };

    setSignatureBlocks([...signatureBlocks, newBlock]);
    setSelectedBlock(newBlock.id);
  };

  const removeSignatureBlock = (blockId: string) => {
    setSignatureBlocks(signatureBlocks.filter(b => b.id !== blockId));
    if (selectedBlock === blockId) {
      setSelectedBlock(null);
    }
  };

  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (mode === 'sign') return; // Disable drag in sign mode
    
    const block = signatureBlocks.find(b => b.id === blockId);
    if (!block) return;

    const currentPageDim = pageDimensions[block.pageNumber];
    if (!currentPageDim) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggedBlockId(blockId);
    setDragOffset({ x: offsetX, y: offsetY });
    e.preventDefault(); // Prevent text selection while dragging
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedBlockId || !dragOffset || !containerRef || pageDimensions.length === 0) return;

    const block = signatureBlocks.find(b => b.id === draggedBlockId);
    if (!block) return;

    const currentPageDim = pageDimensions[block.pageNumber];
    if (!currentPageDim) return;

    const containerRect = containerRef.getBoundingClientRect();
    const x = e.clientX - containerRect.left - dragOffset.x;
    const y = e.clientY - containerRect.top - dragOffset.y;

    // Calculate percentage from pixel position
    const xPercent = (x / currentPageDim.width) * 100;
    const yPercent = (y / currentPageDim.height) * 100;

    setSignatureBlocks(
      signatureBlocks.map(b =>
        b.id === draggedBlockId
          ? { ...b, xPercent: Math.max(0, Math.min(100, xPercent)), yPercent: Math.max(0, Math.min(100, yPercent)) }
          : b
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedBlockId(null);
    setDragOffset(null);
  };

  const handleSignatureApply = async (signature: SignatureResult) => {
    if (!currentBlockId) return;

    const block = signatureBlocks.find(b => b.id === currentBlockId);
    if (!block) {
      console.error('Block not found in local state. BlockId:', currentBlockId, 'Available blocks:', signatureBlocks.map(b => b.id));
      showToast('Không tìm thấy vị trí ký. Vui lòng lưu vị trí ký trước.', 'error');
      return;
    }

    if (block.isSigned) {
      showToast('Vị trí ký này đã được ký rồi', 'error');
      return;
    }

    try {
      setSaving(true);
      console.log('Applying signature to block:', currentBlockId, 'Document:', documentId);
      console.log('Available blocks in local state:', signatureBlocks.map(b => ({ id: b.id, role: b.signerRole, isSigned: b.isSigned })));
      const result = await applyPdfSignature(documentId, {
        signatureBlockId: currentBlockId,
        signatureImageBase64: signature.previewDataUrl,
      });

      if (result.statusCode === 200) {
        // Reload signature blocks from server to ensure we have the latest state
        if (result.data?.pdfSignatureBlocks) {
          setSignatureBlocks(result.data.pdfSignatureBlocks);
        } else {
          // Fallback: Update local state to mark block as signed
          setSignatureBlocks(
            signatureBlocks.map(b =>
              b.id === currentBlockId
                ? { ...b, isSigned: true, signatureId: result.data?.signatureId }
                : b
            )
          );
        }
        showToast('Ký PDF thành công', 'success');
        setIsSignatureModalOpen(false);
        setCurrentBlockId(null);
        
        // Check if all blocks are signed
        const updatedBlocks = result.data?.pdfSignatureBlocks || signatureBlocks;
        const allSigned = updatedBlocks.every(b => b.isSigned);
        if (allSigned && onSave) {
          setTimeout(() => {
            onSave();
          }, 1500);
        }
      } else {
        const errorMsg = result.message || result.errors?.[0] || 'Ký PDF thất bại';
        console.error('Apply signature failed:', errorMsg, result);
        showToast(errorMsg, 'error');
      }
    } catch (error: any) {
      console.error('Apply signature error:', error);
      const errorMsg = error.message || 'Có lỗi xảy ra khi ký PDF';
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBlocks = async () => {
    try {
      setSaving(true);
      console.log('Saving blocks:', signatureBlocks.map(b => ({ id: b.id, role: b.signerRole })));
      const result = await updatePdfSignatureBlocks(documentId, signatureBlocks);
      if (result.statusCode === 200 && result.data) {
        // Update signature blocks from server response to ensure IDs match
        if (result.data.pdfSignatureBlocks && result.data.pdfSignatureBlocks.length > 0) {
          console.log('Blocks saved, received from server:', result.data.pdfSignatureBlocks.map(b => ({ id: b.id, role: b.signerRole })));
          setSignatureBlocks(result.data.pdfSignatureBlocks);
        }
        showToast('Lưu vị trí ký thành công. Bạn có thể bắt đầu ký ngay bây giờ.', 'success');
        // Switch to sign mode after saving blocks
        setMode('sign');
      } else {
        showToast(result.message || 'Lưu vị trí ký thất bại', 'error');
      }
    } catch (error: any) {
      console.error('Save blocks error:', error);
      showToast(error.message || 'Có lỗi xảy ra khi lưu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePageLoad = (page: any, pageNum: number) => {
    // Store page dimensions for coordinate calculation
    if (page && page.width && page.height) {
      const newDims = [...pageDimensions];
      newDims[pageNum - 1] = { width: page.width, height: page.height };
      setPageDimensions(newDims);
    }
  };

  const unsignedBlocks = signatureBlocks.filter(b => !b.isSigned);
  const signedBlocks = signatureBlocks.filter(b => b.isSigned);

  return (
    <div className="min-h-screen bg-gradient-glass">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCancel}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {mode === 'edit' ? 'Đặt vị trí chữ ký' : 'Ký PDF'}
                </h1>
                <p className="text-sm text-gray-500">
                  {mode === 'edit' 
                    ? 'Kéo thả các khung chữ ký vào vị trí mong muốn trên PDF' 
                    : `Còn ${unsignedBlocks.length} vị trí chưa ký`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'edit' && (
                <button
                  onClick={() => setMode('sign')}
                  disabled={signatureBlocks.length === 0}
                  className="flex items-center gap-2 px-4 py-2 glass-button-outline rounded-xl disabled:opacity-50"
                >
                  <PenTool className="w-4 h-4" />
                  Chuyển sang ký
                </button>
              )}
              {mode === 'sign' && (
                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-2 px-4 py-2 glass-button-outline rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Chỉnh sửa vị trí
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="glass-card rounded-2xl p-6">
          {/* Controls */}
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                disabled={pageNumber <= 1}
                className="px-4 py-2 glass-button-outline rounded-xl disabled:opacity-50"
              >
                Trước
              </button>
              <span className="text-gray-700 font-medium">
                Trang {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
                disabled={pageNumber >= numPages}
                className="px-4 py-2 glass-button-outline rounded-xl disabled:opacity-50"
              >
                Sau
              </button>
            </div>

            {mode === 'edit' && (
              <div className="flex items-center gap-2">
                {signerRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => addSignatureBlock(role)}
                    className="flex items-center gap-2 px-4 py-2 glass-button-outline rounded-xl hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm {role}
                  </button>
                ))}
                <button
                  onClick={handleSaveBlocks}
                  disabled={saving || signatureBlocks.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Lưu vị trí
                </button>
              </div>
            )}

            {mode === 'sign' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Đã ký: {signedBlocks.length}</span>
                  <span className="text-gray-300">|</span>
                  <span>Chưa ký: {unsignedBlocks.length}</span>
                </div>
              </div>
            )}
          </div>

          {/* PDF Viewer */}
          <div
            ref={setContainerRef}
            className="relative border-2 border-gray-200 rounded-xl overflow-auto bg-gray-100"
            style={{ minHeight: '600px', maxHeight: '80vh' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              }
            >
              <div className="relative">
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={(page) => handlePageLoad(page, pageNumber)}
                  className="mx-auto"
                />
                
                {/* Signature Blocks Overlay */}
                {signatureBlocks
                  .filter(block => block.pageNumber === pageNumber - 1)
                  .map((block) => {
                  const pageDim = pageDimensions[pageNumber - 1];
                  if (!pageDim) return null;

                  const left = (block.xPercent / 100) * pageDim.width;
                  const top = (block.yPercent / 100) * pageDim.height;
                  const width = (block.widthPercent / 100) * pageDim.width;
                  const height = (block.heightPercent / 100) * pageDim.height;

                  return (
                    <div
                      key={block.id}
                      className={`absolute border-2 rounded ${mode === 'edit' ? 'cursor-move' : 'cursor-pointer'} ${
                        selectedBlock === block.id
                          ? 'border-blue-500 bg-blue-50/50'
                          : block.isSigned
                          ? 'border-green-500 bg-green-50/50'
                          : 'border-gray-400 bg-white/80'
                      }`}
                      style={{
                        left: `${left}px`,
                        top: `${top}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                        minWidth: '100px',
                        minHeight: '50px',
                      }}
                      onMouseDown={(e) => {
                        if (mode === 'edit') {
                          handleMouseDown(e, block.id);
                        }
                      }}
                      onClick={() => {
                        setSelectedBlock(block.id);
                        if (mode === 'sign' && !block.isSigned) {
                          setCurrentBlockId(block.id);
                          setIsSignatureModalOpen(true);
                        }
                      }}
                    >
                      <div className={`p-2 text-xs font-medium rounded-t flex items-center justify-between ${
                        block.isSigned ? 'bg-green-100 text-green-800' : 'bg-white/90 text-gray-700'
                      }`}>
                        <span>{block.signerRole}</span>
                        {mode === 'edit' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSignatureBlock(block.id);
                            }}
                            className="hover:bg-red-100 rounded p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {mode === 'sign' && (
                          <div className="flex items-center gap-1">
                            {block.isSigned ? (
                              <CheckCircle2 className="w-3 h-3 text-green-600" />
                            ) : (
                              <PenTool className="w-3 h-3 text-blue-600" />
                            )}
                          </div>
                        )}
                      </div>
                      {block.isSigned && (
                        <div className="p-2 text-xs text-green-600 italic">
                          Đã ký
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Document>
          </div>

          {/* Help Text */}
          <div className="mt-4 text-sm text-gray-500">
            {mode === 'edit' ? (
              <p>💡 Kéo thả các khung chữ ký vào vị trí mong muốn, sau đó nhấn "Lưu vị trí" để tiếp tục ký</p>
            ) : (
              <p>💡 Nhấn vào các khung chữ ký chưa ký (màu xám) để mở hộp thoại ký</p>
            )}
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        ref={signatureModalRef}
        isOpen={isSignatureModalOpen}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setCurrentBlockId(null);
        }}
        onApply={handleSignatureApply}
      />
    </div>
  );
}
