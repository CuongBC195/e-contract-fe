'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Save,
  X,
  Eye,
  EyeOff,
  Users,
  Calendar,
  MapPin,
  FileText,
  Loader2,
  PenLine,
  AlertCircle,
  CheckCircle2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { formatVietnameseDate } from '@/lib/utils';
import SignatureModal, { SignatureResult, SignaturePoint } from './SignatureModal';
import { ToastContainer, useToast } from './Toast';
import TipTapEditor from './TipTapEditor';
import type { ContractTemplate } from '@/data/templates';
import type { Signer, SignatureData } from '@/lib/kv';

interface DocumentEditorKVProps {
  template?: ContractTemplate;
  onSave: (data: DocumentEditorData) => void;
  onCancel: () => void;
  initialData?: DocumentEditorData;
  mode?: 'create' | 'edit';
}

export interface DocumentEditorData {
  type: 'contract' | 'receipt';
  templateId?: string;
  title: string;
  content: string;
  signers: Signer[];
  signingMode?: 'Public' | 'RequiredLogin'; // Signing mode selection
  metadata: {
    contractNumber?: string;
    createdDate: string;
    effectiveDate?: string;
    expiryDate?: string;
    location: string;
  };
}

// Helper: Render signature SVG from data string (JSON string or array)
function renderSignatureSVG(data: string | SignaturePoint[][], color?: string) {
  // Parse JSON string to array if needed
  let points: SignaturePoint[][];
  
  if (typeof data === 'string') {
    try {
      points = JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse signature data:', error, data);
      return null;
    }
  } else {
    points = data;
  }
  
  if (!points || points.length === 0) {
    console.warn('No signature points to render');
    return null;
  }

  // Filter out empty strokes
  const validStrokes = points.filter(stroke => stroke && stroke.length > 0);
  if (validStrokes.length === 0) {
    console.warn('No valid signature strokes');
    return null;
  }

  // Find bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stroke of validStrokes) {
    for (const point of stroke) {
      if (point && typeof point.x === 'number' && typeof point.y === 'number') {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  // Check if bounding box is valid
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    console.warn('Invalid bounding box for signature');
    return null;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  
  // Handle case where width or height is 0
  if (width <= 0 || height <= 0) {
    console.warn('Zero or negative width/height for signature');
    return null;
  }

  const scale = Math.min(280 / width, 80 / height, 1) * 0.8;
  const offsetX = (300 - width * scale) / 2 - minX * scale;
  const offsetY = (100 - height * scale) / 2 - minY * scale;

  return validStrokes.map((stroke, i) => {
    const pathData = stroke
      .filter(point => point && typeof point.x === 'number' && typeof point.y === 'number')
      .map((point, j) => {
        const x = point.x * scale + offsetX;
        const y = point.y * scale + offsetY;
        return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    if (!pathData || pathData.trim() === '') {
      return null;
    }

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
  }).filter(Boolean); // Remove null entries
}

export default function DocumentEditorKV({
  template,
  onSave,
  onCancel,
  initialData,
  mode = 'create',
}: DocumentEditorKVProps) {
  const { toasts, showToast, removeToast } = useToast();

  // Preview mode - removed, always show live preview
  const showPreview = false;

  // Document data - initialize from initialData or template
  const [title, setTitle] = useState(
    initialData?.title || template?.name || 'HỢP ĐỒNG'
  );
  const [content, setContent] = useState(
    initialData?.content || template?.content || ''
  );
  const [contractNumber, setContractNumber] = useState(
    initialData?.metadata?.contractNumber || ''
  );
  const [createdDate, setCreatedDate] = useState(
    initialData?.metadata?.createdDate || formatVietnameseDate(new Date())
  );
  const [location, setLocation] = useState(
    initialData?.metadata?.location || 'TP. Cần Thơ'
  );

  // Signing mode - initialize from initialData or default to Public
  const [signingMode, setSigningMode] = useState<'Public' | 'RequiredLogin'>(
    initialData?.signingMode || 'Public'
  );

  // Signers - initialize from initialData or template
  const [signers, setSigners] = useState<Signer[]>(
    initialData?.signers ||
      template?.signers.map((s, idx) => ({
        id: `signer-${idx}`,
        role: s.role,
        name: s.defaultName || '',
        position: '',
        organization: '',
        idNumber: '',
        phone: '',
        email: '',
        address: '',
        signed: false,
      })) || [
        {
          id: 'signer-0',
          role: 'Bên A',
          name: '',
          position: '',
          organization: '',
          signed: false,
        },
        {
          id: 'signer-1',
          role: 'Bên B',
          name: '',
          position: '',
          organization: '',
          signed: false,
        },
      ]
  );

  // Update state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || template?.name || 'HỢP ĐỒNG');
      setContent(initialData.content || template?.content || '');
      setContractNumber(initialData.metadata?.contractNumber || '');
      setCreatedDate(initialData.metadata?.createdDate || formatVietnameseDate(new Date()));
      setLocation(initialData.metadata?.location || 'TP. Cần Thơ');
      if (initialData.signers && initialData.signers.length > 0) {
        setSigners(initialData.signers);
      }
    }
  }, [initialData, template]);


  // Signature modal
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [currentSignerIndex, setCurrentSignerIndex] = useState<number | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Handle content change from TipTap
  const handleContentChange = (html: string) => {
    setContent(html);
  };

  const handleSignerChange = (index: number, field: keyof Signer, value: any) => {
    const updated = [...signers];
    updated[index] = { ...updated[index], [field]: value };
    setSigners(updated);
  };

  const handleSignatureComplete = (result: SignatureResult) => {
    if (currentSignerIndex === null) return;

    // Validate signature data
    if (!result.data || result.data.trim() === '') {
      showToast('Chữ ký không hợp lệ', 'error');
      return;
    }

    // Use data string directly from result (already in backend format)
    const signatureData: SignatureData = {
      type: result.type,
      data: result.data, // JSON string for draw, plain text for type
      fontFamily: result.fontFamily,
      color: result.color,
    };

    // Update signer with signature data
    const updated = [...signers];
    updated[currentSignerIndex] = {
      ...updated[currentSignerIndex],
      signed: true,
      signedAt: Date.now(),
      signatureData: signatureData,
    };
    
    setSigners(updated);

    showToast(`✓ Đã ký cho ${signers[currentSignerIndex].role}`, 'success');
    setIsSignatureModalOpen(false);
    setCurrentSignerIndex(null);
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      showToast('Vui lòng nhập tiêu đề', 'error');
      return;
    }
    if (!content.trim() || content === '<p><br></p>') {
      showToast('Vui lòng nhập nội dung văn bản', 'error');
      return;
    }
    if (!location.trim()) {
      showToast('Vui lòng nhập địa điểm', 'error');
      return;
    }

    // Validate all signers have names before saving
    const signersWithoutName = signers.filter((s) => !s.name || !s.name.trim());
    if (signersWithoutName.length > 0) {
      const missingNames = signersWithoutName.map((s) => s.role).join(', ');
      showToast(`Vui lòng nhập họ tên cho: ${missingNames}`, 'error');
      return;
    }

    setIsSaving(true);

    try {
      const data: DocumentEditorData = {
        type: 'contract',
        templateId: template?.id,
        title: title.trim(),
        content: content,
        signers: signers,
        signingMode: signingMode,
        metadata: {
          contractNumber: contractNumber.trim() || undefined,
          createdDate,
          location: location.trim(),
        },
      };

      await onSave(data);
      // Don't show toast here - let the parent page handle it
    } catch (error) {
      console.error('Save error:', error);
      showToast('Lưu thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-glass">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onCancel}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {mode === 'create' ? 'Soạn Văn Bản' : 'Chỉnh Sửa Văn Bản'}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {template?.name || 'Văn bản tùy chỉnh'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span className="text-sm font-medium">Lưu</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Document Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Document Metadata */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Thông tin văn bản
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: HỢP ĐỒNG LAO ĐỘNG"
                    className="w-full px-4 py-2.5 glass-input rounded-xl"
                  />
                </div>

                {/* Contract Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Số hợp đồng
                  </label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ví dụ: 001/HĐLĐ"
                    className="w-full px-4 py-2.5 glass-input rounded-xl"
                  />
                </div>

                {/* Date & Location */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Ngày lập
                    </label>
                    <input
                      type="text"
                      value={createdDate}
                      onChange={(e) => setCreatedDate(e.target.value)}
                      className="w-full px-4 py-2.5 glass-input rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Địa điểm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="TP. Cần Thơ"
                      className="w-full px-4 py-2.5 glass-input rounded-xl"
                    />
                  </div>
                </div>

                {/* Signing Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chế độ ký <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="signingMode"
                        value="Public"
                        checked={signingMode === 'Public'}
                        onChange={(e) => setSigningMode(e.target.value as 'Public' | 'RequiredLogin')}
                        className="w-4 h-4 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">
                        Công khai (Bất kỳ ai có link đều ký được)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="signingMode"
                        value="RequiredLogin"
                        checked={signingMode === 'RequiredLogin'}
                        onChange={(e) => setSigningMode(e.target.value as 'Public' | 'RequiredLogin')}
                        className="w-4 h-4 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">
                        Yêu cầu đăng nhập (Chỉ người đăng nhập mới ký được)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Editor */}
            <div className="glass-card rounded-2xl p-6">
              <div className="mb-4">
                <h3 className="font-bold text-gray-900">Nội dung văn bản</h3>
              </div>

              {/* Live Preview với Header + Content + Footer */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Header - Always visible */}
                <div className="p-6 bg-blue-50/30 border-b border-blue-100">
                  <div className="text-center text-sm leading-relaxed" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                    <p className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="font-bold">Độc lập - Tự do - Hạnh phúc</p>
                    <p className="mt-2 text-gray-400">---------------oOo---------------</p>
                    <h1 className="text-xl font-bold mt-4">{title || 'Tiêu đề văn bản'}</h1>
                    {contractNumber && (
                      <p className="text-xs italic mt-2">Số: {contractNumber}</p>
                    )}
                  </div>
                </div>

                {/* Date & Location */}
                <div className="px-6 pt-4 text-sm text-right" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                  <p>{createdDate}, tại {location}</p>
                </div>

                {/* Rich Text Editor - TipTap */}
                <TipTapEditor
                  content={content || '<p></p>'}
                  onChange={handleContentChange}
                  placeholder="Nhập nội dung văn bản..."
                />

                {/* Footer - Signatures */}
                <div className="px-6 pb-6 pt-4 border-t border-gray-200">
                  <div className="text-right mb-4 text-sm" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                    <p className="italic">{location}, {createdDate}</p>
                  </div>

                  <div className={`grid gap-6 ${signers.length > 2 ? 'grid-cols-2' : `grid-cols-${signers.length}`}`}>
                    {signers.map((signer, index) => (
                      <div key={signer.id} className="text-center" style={{ fontFamily: 'var(--font-tinos), serif' }}>
                        <p className="font-bold text-sm mb-1">{signer.role}</p>
                        <p className="text-xs italic text-gray-500 mb-3">(Ký và ghi rõ họ tên)</p>
                        
                        {/* Signature Preview */}
                        <div className="min-h-[80px] flex items-center justify-center mb-3 bg-white rounded-lg border border-gray-200 p-3">
                          {signer.signed && signer.signatureData ? (
                            <>
                              {signer.signatureData.type === 'type' ? (
                                /* Typed Signature - data contains typedText */
                                <span 
                                  className="text-2xl italic" 
                                  style={{ 
                                    fontFamily: signer.signatureData.fontFamily || 'cursive',
                                    color: signer.signatureData.color || '#000'
                                  }}
                                >
                                  {signer.signatureData.data}
                                </span>
                              ) : signer.signatureData.type === 'draw' && signer.signatureData.data ? (
                                /* Drawn Signature - data contains JSON string */
                                <svg 
                                  viewBox="0 0 300 100" 
                                  className="w-full h-full"
                                  style={{ maxWidth: '200px', maxHeight: '80px' }}
                                >
                                  {renderSignatureSVG(signer.signatureData.data, signer.signatureData.color)}
                                </svg>
                              ) : (
                                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Đã ký</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Chưa ký</span>
                          )}
                        </div>

                        {/* Name */}
                        <div className="border-t border-dotted border-gray-400 pt-2 text-sm">
                          {signer.name || '...........................'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Signers */}
          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Các bên ký ({signers.length})
              </h3>

              <div className="space-y-4">
                {signers.map((signer, index) => (
                  <div
                    key={signer.id}
                    className="p-4 bg-white border border-gray-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-700">
                        {signer.role}
                      </span>
                      {signer.signed ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Đã ký</span>
                          </span>
                          {/* Only allow re-sign if in create mode and not saved yet */}
                          {mode === 'create' && (
                            <button
                              onClick={() => {
                                setCurrentSignerIndex(index);
                                setIsSignatureModalOpen(true);
                              }}
                              className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors flex items-center gap-1"
                              title="Ký lại (chỉ khi chưa lưu)"
                            >
                              <PenLine className="w-3 h-3" />
                              Ký lại
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            // Only allow signing in create mode
                            if (mode === 'edit') {
                              showToast('Không thể ký khi đang chỉnh sửa. Vui lòng lưu và gửi link cho người ký.', 'error');
                              return;
                            }
                            setCurrentSignerIndex(index);
                            setIsSignatureModalOpen(true);
                          }}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <PenLine className="w-3 h-3" />
                          Ký ngay
                        </button>
                      )}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={signer.name}
                        onChange={(e) => handleSignerChange(index, 'name', e.target.value)}
                        placeholder="Họ và tên *"
                        required
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-300 focus:outline-none"
                      />
                      {!signer.name || !signer.name.trim() ? (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Bắt buộc nhập họ tên trước khi lưu</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onApply={handleSignatureComplete}
        onClose={() => {
          setIsSignatureModalOpen(false);
          setCurrentSignerIndex(null);
        }}
      />
    </div>
  );
}

