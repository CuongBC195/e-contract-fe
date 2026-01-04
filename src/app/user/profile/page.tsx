'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, Save, ArrowLeft, Eye, EyeOff, Loader2, Trash2, AlertTriangle, Key } from 'lucide-react';
import { ToastContainer, useToast } from '@/components/Toast';
import { getMe, updateProfile, changePassword, requestDeleteAccountOtp, deleteAccount } from '@/lib/api-client';
import LoadingLogo from '@/components/LoadingLogo';

export default function ProfilePage() {
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    try {
      const res = await fetch('/api/user/check');
      const data = await res.json();
      
      if (!data.authenticated) {
        router.push('/user/login');
        return;
      }
      
      // Load user profile
      const profileData = await getMe();
      
      if (profileData.data) {
        setProfile({
          name: profileData.data.name || '',
          email: profileData.data.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showToast('Có lỗi xảy ra khi tải thông tin', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const result = await updateProfile({ name: profile.name });
      
      // Check if request was successful
      if (result.statusCode === 200 || result.statusCode === 201) {
        showToast(result.message || 'Cập nhật thông tin thành công', 'success');
        
        // Update profile state with new data if available
        if (result.data) {
          setProfile({
            ...profile,
            name: result.data.name,
          });
        }
      } else {
        // Show error message from API
        const errorMessage = result.message || result.errors?.[0] || 'Cập nhật thất bại';
        showToast(errorMessage, 'error');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMessage = error.message || 'Có lỗi xảy ra khi cập nhật thông tin. Vui lòng thử lại.';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Mật khẩu mới và xác nhận không khớp', 'error');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const result = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      
      // Check if request was successful
      if (result.statusCode === 200 || result.statusCode === 201) {
        showToast(result.message || 'Đổi mật khẩu thành công', 'success');
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        // Show error message from API
        const errorMessage = result.message || result.errors?.[0] || 'Đổi mật khẩu thất bại';
        showToast(errorMessage, 'error');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      const errorMessage = error.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.';
      showToast(errorMessage, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleRequestDeleteOtp = async () => {
    setRequestingOtp(true);
    
    try {
      const result = await requestDeleteAccountOtp();
      
      // Check if request was successful
      if (result.statusCode === 200 || result.statusCode === 201) {
        showToast(result.message || 'Đã gửi mã OTP đến email của bạn. Vui lòng kiểm tra email.', 'success');
        setDeleteOtpSent(true);
        setShowDeleteConfirm(true);
      } else {
        // Show error message from API
        const errorMessage = result.message || result.errors?.[0] || 'Gửi mã OTP thất bại';
        showToast(errorMessage, 'error');
      }
    } catch (error: any) {
      console.error('Error requesting delete OTP:', error);
      const errorMessage = error.message || 'Có lỗi xảy ra khi gửi mã OTP. Vui lòng thử lại.';
      showToast(errorMessage, 'error');
    } finally {
      setRequestingOtp(false);
    }
  };

  const handleDeleteAccount = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!showDeleteConfirm) {
      // First step: request OTP
      await handleRequestDeleteOtp();
      return;
    }

    if (!deleteOtpSent) {
      // Should not happen, but just in case
      await handleRequestDeleteOtp();
      return;
    }

    if (!deleteOtpCode.trim()) {
      showToast('Vui lòng nhập mã OTP', 'error');
      return;
    }

    setDeletingAccount(true);
    
    try {
      const result = await deleteAccount(deleteOtpCode);
      
      // Check if request was successful
      if (result.statusCode === 200 || result.statusCode === 201 || result.statusCode === 204) {
        showToast(result.message || 'Đã xóa tài khoản thành công', 'success');
        // Redirect to home after a short delay
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        // Show error message from API
        const errorMessage = result.message || result.errors?.[0] || 'Xóa tài khoản thất bại';
        showToast(errorMessage, 'error');
        setDeleteOtpCode('');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      const errorMessage = error.message || 'Có lỗi xảy ra khi xóa tài khoản. Vui lòng thử lại.';
      showToast(errorMessage, 'error');
      setDeleteOtpCode('');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-glass">
        <LoadingLogo size="md" text="Đang tải..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-glass py-8 px-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Quay lại</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Cài đặt tài khoản</h1>
          <p className="text-gray-500 mt-2">Quản lý thông tin cá nhân và mật khẩu</p>
        </div>

        {/* Profile Section */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5" />
            Thông tin cá nhân
          </h2>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full pl-12 pr-4 py-3 glass-input rounded-xl bg-gray-50 cursor-not-allowed"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Email không thể thay đổi</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Họ và tên
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
                  placeholder="Nhập họ và tên"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Lưu thay đổi</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Đổi mật khẩu
          </h2>
          
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full pl-12 pr-12 py-3 glass-input rounded-xl"
                  placeholder="Nhập mật khẩu hiện tại"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full pl-12 pr-12 py-3 glass-input rounded-xl"
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full pl-12 pr-12 py-3 glass-input rounded-xl"
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang đổi mật khẩu...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Đổi mật khẩu</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Delete Account Section */}
        <div className="glass-card rounded-2xl p-6 border-2 border-red-100">
          <h2 className="text-xl font-semibold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Vùng nguy hiểm
          </h2>
          
          <p className="text-sm text-gray-600 mb-4">
            Xóa tài khoản sẽ vô hiệu hóa tài khoản của bạn. Bạn sẽ không thể đăng nhập lại sau khi xóa. Hành động này không thể hoàn tác.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={handleDeleteAccount}
              disabled={requestingOtp || deletingAccount}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestingOtp ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang gửi mã OTP...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  <span>Xóa tài khoản</span>
                </>
              )}
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              {deleteOtpSent && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>Mã OTP đã được gửi đến email của bạn.</strong>
                  </p>
                  <p className="text-xs text-blue-600">
                    Vui lòng kiểm tra email và nhập mã OTP để xác nhận xóa tài khoản.
                  </p>
                </div>
              )}

              {deleteOtpSent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mã OTP xác nhận
                  </label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={deleteOtpCode}
                      onChange={(e) => setDeleteOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full pl-12 pr-4 py-3 glass-input rounded-xl"
                      placeholder="Nhập mã OTP 6 chữ số"
                      maxLength={6}
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestDeleteOtp}
                    disabled={requestingOtp}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {requestingOtp ? 'Đang gửi...' : 'Gửi lại mã OTP'}
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={deletingAccount || (deleteOtpSent && !deleteOtpCode.trim())}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingAccount ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      <span>{deleteOtpSent ? 'Xác nhận xóa tài khoản' : 'Gửi mã OTP'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteOtpSent(false);
                    setDeleteOtpCode('');
                  }}
                  disabled={deletingAccount}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

