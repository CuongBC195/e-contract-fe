'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Trash2,
  Mail,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  Calendar,
  Loader2,
  Search,
  AlertCircle,
  Plus,
  Edit2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatVietnameseDate } from '@/lib/utils';
import { ToastContainer, useToast } from '@/components/Toast';
import AdminUserForm from '@/components/AdminUserForm';

// User interface matching backend UserResponseDto
interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
  documentCount?: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentPage) {
      loadUsers(currentPage);
    }
  }, [currentPage, isAuthenticated]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      
      if (data.success && data.authenticated && data.role === 'admin') {
        setIsAuthenticated(true);
        loadUsers(1);
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

  const loadUsers = async (page: number = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users?page=${page}`);
      const data = await res.json();
      if (data.success) {
        // Transform backend data to frontend format
        const transformedUsers: User[] = (data.users || []).map((u: any) => ({
          id: u.id || u.Id || '',
          email: u.email || u.Email || '',
          name: u.name || u.Name || '',
          role: u.role || u.Role || 'User',
          emailVerified: u.emailVerified !== undefined ? u.emailVerified : (u.EmailVerified !== undefined ? u.EmailVerified : false),
          createdAt: u.createdAt || u.CreatedAt || new Date().toISOString(),
          lastLoginAt: u.lastLoginAt || u.LastLoginAt,
          documentCount: u.documentCount || u.DocumentCount || 0,
        }));
        setUsers(transformedUsers);
        setTotalPages(data.totalPages || Math.ceil((data.totalCount || 0) / 4));
        setTotalCount(data.totalCount || 0);
      } else {
        showToast(data.error || 'Lỗi khi tải danh sách user', 'error');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('Lỗi khi tải danh sách user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response' }));
      
      if (!res.ok || !data.success) {
        const errorMessage = data.error || data.message || 'Xóa thất bại';
        showToast(errorMessage, 'error');
        return;
      }

      showToast('Đã xóa user thành công', 'success');
      loadUsers(currentPage);
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Lỗi khi xóa user', 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleCreate = async (formData: { email: string; name: string; password: string; role: string }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response' }));
      
      if (!res.ok || !data.success) {
        const errorMessage = data.error || data.message || 'Tạo user thất bại';
        showToast(errorMessage, 'error');
        return;
      }

      showToast('Đã tạo user thành công', 'success');
      setCreateModalOpen(false);
      loadUsers(currentPage);
    } catch (error) {
      console.error('Create error:', error);
      showToast('Lỗi khi tạo user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (userId: string, formData: { name?: string; password?: string; role?: string; emailVerified?: boolean }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json().catch(() => ({ success: false, error: 'Failed to parse response' }));
      
      if (!res.ok || !data.success) {
        const errorMessage = data.error || data.message || 'Cập nhật user thất bại';
        showToast(errorMessage, 'error');
        return;
      }

      showToast('Đã cập nhật user thành công', 'success');
      setEditModalOpen(false);
      setEditingUser(null);
      loadUsers(currentPage);
    } catch (error) {
      console.error('Update error:', error);
      showToast('Lỗi khi cập nhật user', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEditModalOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.id.toLowerCase().includes(search)
    );
  });

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

  return (
    <div className="min-h-screen bg-gradient-glass">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <header className="glass border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Quản lý User</h1>
                <p className="text-sm text-gray-500">Danh sách tất cả người dùng</p>
              </div>
            </div>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-black/90 text-white rounded-xl hover:bg-black transition-colors"
            >
              <Plus className="w-5 h-5" />
              Tạo User
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm user theo tên, email hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Tổng user</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Đã xác thực</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {users.filter(u => u.emailVerified).length}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-gray-700" />
              </div>
              <p className="text-sm text-gray-500 font-medium">Chưa xác thực</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {users.filter(u => !u.emailVerified).length}
            </p>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Đang tải dữ liệu...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <UserIcon className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {searchTerm ? 'Không tìm thấy user' : 'Chưa có user nào'}
            </h3>
          </div>
        ) : (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-200/50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vai trò</th>
                    <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">ID: {user.id}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {user.emailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã xác thực
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Chưa xác thực
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {formatVietnameseDate(new Date(user.createdAt))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2.5 hover:bg-blue-50 text-gray-500 hover:text-blue-600 rounded-xl transition-all"
                            title="Chỉnh sửa user"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="p-2.5 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-xl transition-all"
                            title="Xóa user"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Hiển thị {(currentPage - 1) * 4 + 1} - {Math.min(currentPage * 4, totalCount)} trong tổng số {totalCount} user
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Trước
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-4 py-2 rounded-xl transition-colors ${
                          currentPage === page
                            ? 'bg-black text-white'
                            : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-gray-400">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Sau
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        <AdminUserForm
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreate}
          mode="create"
          saving={saving}
        />

        {/* Edit User Modal */}
        <AdminUserForm
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingUser(null);
          }}
          onSubmit={(data) => editingUser && handleEdit(editingUser.id, data)}
          mode="edit"
          user={editingUser}
          saving={saving}
        />

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Xóa user?</h3>
                  <p className="text-sm text-gray-500">Tất cả văn bản của user này sẽ vẫn được giữ lại</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    'Xóa'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

