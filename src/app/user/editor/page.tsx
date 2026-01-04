'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, FileText } from 'lucide-react';
import DocumentEditorKV, { DocumentEditorData } from '@/components/DocumentEditorKV';
import ReceiptEditorKV from '@/components/ReceiptEditorKV';
import { getTemplateById, type ContractTemplate } from '@/data/templates';
import { useToast, ToastContainer } from '@/components/Toast';
import type { Receipt } from '@/lib/kv';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toasts, showToast, removeToast } = useToast();

  const [template, setTemplate] = useState<ContractTemplate | undefined>();
  const [initialData, setInitialData] = useState<any>();
  const [receiptData, setReceiptData] = useState<Receipt | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [documentType, setDocumentType] = useState<'contract' | 'receipt' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  // Reload editor data when URL params change (edit, template, type, mode)
  useEffect(() => {
    if (isAuthenticated) {
      loadEditorData();
    }
  }, [searchParams, isAuthenticated]);

  // Scroll to top when URL changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [searchParams]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/user/check');
      const data = await res.json();
      
      if (data.authenticated && data.role === 'user') {
        setIsAuthenticated(true);
        loadEditorData();
      } else {
        router.push('/user/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/user/login');
    } finally {
      setLoading(false);
    }
  };

  const loadEditorData = async () => {
    const templateId = searchParams.get('template');
    const editId = searchParams.get('edit');
    const modeParam = searchParams.get('mode');
    
    if (editId) {
      // Edit mode - load from backend API
      try {
        const res = await fetch(`/api/receipts/get?id=${editId}`);
        if (!res.ok) {
          throw new Error('Failed to load document');
        }
        const data = await res.json().catch(() => ({ success: false }));
        
        if (data.success && data.receipt) {
          const receipt = data.receipt as Receipt;
          
          // Determine if it's a contract or receipt
          if (receipt.document) {
            // It's a contract
            setDocumentType('contract');
            setInitialData({
              type: receipt.document.type,
              templateId: receipt.document.templateId,
              title: receipt.document.title,
              content: receipt.document.content,
              signers: receipt.document.signers || [],
              signingMode: receipt.document.signingMode || 'Public',
              metadata: receipt.document.metadata || {},
            });
            setMode('edit');
          } else {
            // It's a receipt
            setDocumentType('receipt');
            setReceiptData(receipt);
            setMode('edit');
          }
        } else {
          showToast(data.error || 'Không thể tải tài liệu', 'error');
        }
      } catch (error) {
        console.error('Error loading document:', error);
        showToast('Lỗi khi tải tài liệu', 'error');
      }
    } else if (templateId) {
      // Create mode - load template (always contract)
      const t = getTemplateById(templateId);
      setTemplate(t);
      setDocumentType('contract');
      setMode('create');
    }
  };

  const handleSaveContract = async (data: DocumentEditorData) => {
    try {
      const isEdit = mode === 'edit' && searchParams.get('edit');
      
      if (isEdit) {
        // Update existing contract
        const response = await fetch('/api/receipts/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            id: searchParams.get('edit'),
            document: data 
          }),
        });

        const result = await response.json();

        if (result.success) {
          showToast('Cập nhật thành công!', 'success');
          setTimeout(() => router.push('/user/dashboard'), 1000);
        } else {
          if (result.code === 'FULLY_SIGNED') {
            showToast('Văn bản đã được ký đầy đủ. Không thể chỉnh sửa.', 'error');
          } else {
            showToast(result.error || 'Có lỗi xảy ra', 'error');
          }
        }
      } else {
        // Create new contract
        const response = await fetch('/api/receipts/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: data }),
        });

        const result = await response.json();

        if (result.success) {
          showToast('Tạo hợp đồng thành công!', 'success');
          setTimeout(() => router.push('/user/dashboard'), 1000);
        } else {
          showToast(result.error || 'Có lỗi xảy ra', 'error');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Không thể lưu. Vui lòng thử lại.', 'error');
    }
  };

  const handleSaveReceipt = async () => {
    // ReceiptEditorKV handles its own save logic
    // This will be called after successful save
    router.push('/user/dashboard');
  };

  const handleSavePDF = async (data: DocumentEditorData) => {
    try {
      const editId = searchParams.get('edit');
      if (!editId) {
        showToast('Không tìm thấy ID tài liệu', 'error');
        return;
      }

      const response = await fetch('/api/receipts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editId,
          document: {
            type: 'pdf',
            signers: data.signers,
            metadata: data.metadata,
          }
        }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('Cập nhật thành công!', 'success');
        setTimeout(() => router.push('/user/dashboard'), 1000);
      } else {
        if (result.code === 'FULLY_SIGNED') {
          showToast('Văn bản đã được ký đầy đủ. Không thể chỉnh sửa.', 'error');
        } else {
          showToast(result.error || 'Có lỗi xảy ra', 'error');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      showToast('Không thể lưu. Vui lòng thử lại.', 'error');
    }
  };

  const handleCancel = () => {
    router.push('/user/create');
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-black/90 rounded-2xl flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-500">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }


  // Render receipt editor for receipts
  if (documentType === 'receipt') {
    return (
      <>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <ReceiptEditorKV
          receipt={receiptData}
          onSave={handleSaveReceipt}
          onCancel={handleCancel}
        />
      </>
    );
  }

  // Render contract editor for contracts
  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <DocumentEditorKV
        template={template}
        initialData={initialData}
        onSave={handleSaveContract}
        onCancel={handleCancel}
        mode={mode}
      />
    </>
  );
}

export default function UserEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
          <div className="flex flex-col items-center gap-4">
            <FileText className="w-12 h-12 text-gray-400 animate-pulse" />
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
