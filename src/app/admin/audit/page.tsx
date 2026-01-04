'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Search,
  Calendar,
  User,
  Globe,
  Monitor,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
} from 'lucide-react';
import { ToastContainer, useToast } from '@/components/Toast';

interface SignatureAudit {
  signerId: string;
  signerName: string;
  signerRole: string;
  signerEmail: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
}

interface TimelineEvent {
  eventType: string; // View, Sign, etc.
  eventAt: string;
  signerRole?: string;
  signerName: string;
  signerEmail: string;
  ipAddress: string;
  userAgent: string;
}

interface DocumentAuditTrail {
  documentId: string;
  documentTitle: string;
  documentType: string;
  status: string;
  createdAt: string;
  signedAt?: string;
  creatorId: string;
  signatures: SignatureAudit[];
  timelineEvents?: TimelineEvent[]; // Timeline events (view + sign)
}

export default function AdminAuditPage() {
  const router = useRouter();
  const [auditTrails, setAuditTrails] = useState<DocumentAuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentAuditTrail | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAuditTrails(currentPage);
    }
  }, [currentPage, isAuthenticated]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      
      if (data.success && data.authenticated && data.role === 'admin') {
        setIsAuthenticated(true);
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditTrails = async (page: number = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/audit/signed-documents?page=${page}&pageSize=${pageSize}`);
      
      let data;
      try {
        const responseText = await res.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        showToast('Lỗi khi xử lý phản hồi từ server', 'error');
        return;
      }
      
      if (!res.ok) {
        const errorMessage = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
        console.error('API Error:', errorMessage, data);
        showToast(errorMessage || 'Không thể tải audit trail', 'error');
        return;
      }
      
      // Check response format
      // Backend returns ApiResponse<List<DocumentAuditTrailDto>>
      // Check both success field and statusCode
      const isSuccess = data.success === true || (data.statusCode >= 200 && data.statusCode < 300);
      
      if (isSuccess) {
        // The data is in data.data field (from ApiResponse<T>)
        const trails = data.data || [];
        setAuditTrails(trails);
        
        // If empty, that's okay - just means no signed documents yet
        if (trails.length === 0) {
          console.log('No signed documents found - this is normal if no documents have been fully signed yet');
        }
        
        // Calculate total pages (backend should return this, but we'll estimate)
        const estimatedTotal = trails.length === pageSize ? page * 2 : page;
        setTotalPages(Math.max(1, estimatedTotal));
      } else {
        // Handle error response
        const errorMessage = data.message || data.error || data.errors?.[0] || 'Không thể tải audit trail';
        console.error('API returned error:', {
          statusCode: data.statusCode,
          message: data.message,
          error: data.error,
          errors: data.errors,
          fullResponse: data
        });
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error loading audit trails:', error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi khi tải audit trail';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentAudit = async (documentId: string) => {
    try {
      const res = await fetch(`/api/admin/audit/document/${documentId}`);
      
      let data;
      try {
        const responseText = await res.text();
        if (!responseText) {
          throw new Error('Empty response from server');
        }
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        showToast('Lỗi khi xử lý phản hồi từ server', 'error');
        return;
      }
      
      if (!res.ok) {
        const errorMessage = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
        console.error('API Error:', errorMessage, data);
        showToast(errorMessage || 'Không thể tải chi tiết audit trail', 'error');
        return;
      }
      
      // Check response format
      // Backend returns ApiResponse<DocumentAuditTrailDto>
      const isSuccess = data.success === true || (data.statusCode >= 200 && data.statusCode < 300);
      
      if (isSuccess) {
        // The data is in data.data field (from ApiResponse<T>)
        const auditData = data.data;
        if (auditData) {
          setSelectedDocument(auditData);
        } else {
          console.error('No data in response:', data);
          showToast('Không có dữ liệu trong phản hồi', 'error');
        }
      } else {
        // Handle error response
        const errorMessage = data.message || data.error || data.errors?.[0] || 'Không thể tải chi tiết audit trail';
        console.error('API returned error:', {
          statusCode: data.statusCode,
          message: data.message,
          error: data.error,
          errors: data.errors,
          fullResponse: data
        });
        showToast(errorMessage, 'error');
      }
    } catch (error) {
      console.error('Error loading document audit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Lỗi khi tải chi tiết audit trail';
      showToast(errorMessage, 'error');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const filteredTrails = auditTrails.filter(trail =>
    trail.documentTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trail.documentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !isAuthenticated) {
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

  return (
    <div className="min-h-screen bg-gradient-glass">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
                <p className="text-sm text-gray-500">Lịch sử ký và bằng chứng pháp lý</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên tài liệu hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
        </div>

        {/* Audit Trails List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : filteredTrails.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm 
                ? 'Không tìm thấy audit trail nào với từ khóa này' 
                : 'Chưa có tài liệu nào được ký đầy đủ. Audit trail sẽ xuất hiện khi có tài liệu được ký.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTrails.map((trail) => (
              <div
                key={trail.documentId}
                className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">{trail.documentTitle}</h3>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        {trail.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-gray-500">Document ID</p>
                        <p className="font-mono text-gray-900">{trail.documentId}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Loại</p>
                        <p className="text-gray-900">{trail.documentType}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Ngày ký</p>
                        <p className="text-gray-900">{trail.signedAt ? formatDate(trail.signedAt) : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Số chữ ký</p>
                        <p className="text-gray-900">{trail.signatures.length}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadDocumentAudit(trail.documentId)}
                    className="ml-4 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Chi tiết Audit Trail</h2>
              <button
                onClick={() => setSelectedDocument(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{selectedDocument.documentTitle}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Document ID</p>
                    <p className="font-mono text-gray-900">{selectedDocument.documentId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ngày tạo</p>
                    <p className="text-gray-900">{formatDate(selectedDocument.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Ngày ký</p>
                    <p className="text-gray-900">{selectedDocument.signedAt ? formatDate(selectedDocument.signedAt) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Creator ID</p>
                    <p className="font-mono text-gray-900">{selectedDocument.creatorId}</p>
                  </div>
                </div>
              </div>

              {/* Timeline View */}
              {selectedDocument.timelineEvents && selectedDocument.timelineEvents.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Dòng thời gian</h4>
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                    
                    <div className="space-y-4">
                      {/* Document Created */}
                      <div className="relative pl-12">
                        <div className="absolute left-0 top-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-blue-900">Khởi tạo tài liệu</p>
                              <p className="text-sm text-blue-600">{formatDate(selectedDocument.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Timeline Events */}
                      {selectedDocument.timelineEvents.map((event, idx) => (
                        <div key={idx} className="relative pl-12">
                          <div className={`absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center ${
                            event.eventType === 'Sign' ? 'bg-green-500' : 'bg-gray-400'
                          }`}>
                            {event.eventType === 'Sign' ? (
                              <User className="w-4 h-4 text-white" />
                            ) : (
                              <Eye className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <div className={`border rounded-xl p-4 ${
                            event.eventType === 'Sign' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className={`font-semibold ${
                                  event.eventType === 'Sign' ? 'text-green-900' : 'text-gray-900'
                                }`}>
                                  {event.eventType === 'Sign' 
                                    ? `${event.signerRole || 'Người ký'} ký xác nhận`
                                    : 'Xem tài liệu (Lần ' + (selectedDocument.timelineEvents?.filter(e => e.eventType === 'View' && new Date(e.eventAt) <= new Date(event.eventAt)).length || 0) + ')'
                                  }
                                </p>
                                {event.eventType === 'Sign' && event.signerName && (
                                  <p className="text-sm text-gray-600 mt-1">{event.signerName}</p>
                                )}
                                <p className={`text-sm mt-1 ${
                                  event.eventType === 'Sign' ? 'text-green-600' : 'text-gray-600'
                                }`}>
                                  {formatDate(event.eventAt)}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mt-3">
                              {event.signerEmail && event.signerEmail !== 'N/A' && (
                                <div className="flex items-center gap-2">
                                  <User className="w-3 h-3 text-gray-400" />
                                  <span className="text-gray-500">Email:</span>
                                  <span className="text-gray-700">{event.signerEmail}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">IP:</span>
                                <span className="font-mono text-gray-700">{event.ipAddress}</span>
                              </div>
                              <div className="flex items-center gap-2 md:col-span-2">
                                <Monitor className="w-3 h-3 text-gray-400" />
                                <span className="text-gray-500">User-Agent:</span>
                                <span className="text-gray-700 text-xs truncate">{event.userAgent}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">Chữ ký ({selectedDocument.signatures.length})</h4>
                <div className="space-y-4">
                  {selectedDocument.signatures.map((sig, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{sig.signerName}</p>
                          <p className="text-sm text-gray-500">{sig.signerRole}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-gray-500">Ký lúc</p>
                          <p className="text-gray-900">{formatDate(sig.signedAt)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">Email:</span>
                          <span className="text-gray-900">{sig.signerEmail}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">IP:</span>
                          <span className="font-mono text-gray-900">{sig.ipAddress}</span>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <Monitor className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-500">User-Agent:</span>
                          <span className="text-gray-900 text-xs">{sig.userAgent}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

