'use client';

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

interface AdminUserFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { email?: string; name?: string; password?: string; role?: string; emailVerified?: boolean }) => Promise<void>;
  mode: 'create' | 'edit';
  user?: User | null;
  saving: boolean;
}

export default function AdminUserForm({ isOpen, onClose, onSubmit, mode, user, saving }: AdminUserFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'User',
    emailVerified: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit' && user) {
      setFormData({
        email: user.email,
        name: user.name,
        password: '', // Don't pre-fill password
        role: user.role,
        emailVerified: user.emailVerified,
      });
    } else {
      setFormData({
        email: '',
        name: '',
        password: '',
        role: 'User',
        emailVerified: false,
      });
    }
    setErrors({});
    setShowPassword(false);
  }, [mode, user, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (mode === 'create' && !formData.email.trim()) {
      newErrors.email = 'Email là bắt buộc';
    } else if (mode === 'create' && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Tên là bắt buộc';
    }

    if (mode === 'create' && !formData.password) {
      newErrors.password = 'Mật khẩu là bắt buộc';
    } else if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    if (mode === 'create') {
      await onSubmit({
        email: formData.email.trim(),
        name: formData.name.trim(),
        password: formData.password,
        role: formData.role,
      });
    } else {
      const updateData: any = {
        name: formData.name.trim(),
        role: formData.role,
        emailVerified: formData.emailVerified,
      };
      
      // Only include password if it's provided
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      await onSubmit(updateData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Tạo User Mới' : 'Chỉnh Sửa User'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'create' && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-black/20 focus:border-black/50 ${
                  errors.email ? 'border-red-300' : 'border-gray-200'
                }`}
                disabled={saving}
                required
              />
              {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
            </div>
          )}

          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 cursor-not-allowed"
              />
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-black/20 focus:border-black/50 ${
                errors.name ? 'border-red-300' : 'border-gray-200'
              }`}
              disabled={saving}
              required
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu {mode === 'create' && <span className="text-red-500">*</span>}
              {mode === 'edit' && <span className="text-gray-500 text-xs"> (để trống nếu không đổi)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-2.5 pr-12 border rounded-xl focus:ring-2 focus:ring-black/20 focus:border-black/50 ${
                  errors.password ? 'border-red-300' : 'border-gray-200'
                }`}
                disabled={saving}
                required={mode === 'create'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={saving}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              Vai trò
            </label>
            <div className="relative">
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-black/20 focus:border-black/50 appearance-none bg-white cursor-pointer"
                disabled={saving}
                style={{ paddingLeft: '1rem', paddingRight: '2.5rem' }}
              >
                <option value="User">User</option>
                <option value="Admin">Admin</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" style={{ right: '0.75rem' }} />
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailVerified}
                  onChange={(e) => setFormData({ ...formData, emailVerified: e.target.checked })}
                  className="w-4 h-4 text-black/90 border-gray-300 rounded focus:ring-black/20"
                  disabled={saving}
                />
                <span className="text-sm font-medium text-gray-700">Email đã xác thực</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-black/90 text-white rounded-xl hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                mode === 'create' ? 'Tạo User' : 'Cập nhật'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

