'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';
import { ToastContainer, useToast } from '@/components/Toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { showToast, toasts, removeToast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email) {
      setError('Vui lòng nhập email');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json().catch(() => ({ success: false, error: 'Failed to parse response' }));

      if (!response.ok || !data.success) {
        setError(data.error || 'Đã xảy ra lỗi. Vui lòng thử lại sau.');
        return;
      }

      setSuccess(true);
      showToast('Email đặt lại mật khẩu đã được gửi!', 'success');
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Đã xảy ra lỗi. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-glass flex items-center justify-center p-4">
      <div className="glass-card rounded-3xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black/90 rounded-2xl mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Quên mật khẩu</h1>
          <p className="text-gray-500 mt-2">Nhập email để nhận link đặt lại mật khẩu</p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Email đã được gửi!</h2>
              <p className="text-gray-600 mb-4">
                Chúng tôi đã gửi link đặt lại mật khẩu đến email <strong>{email}</strong>
              </p>
              <p className="text-sm text-gray-500">
                Vui lòng kiểm tra hộp thư và làm theo hướng dẫn trong email.
              </p>
            </div>
            <button
              onClick={() => router.push('/user/login')}
              className="w-full glass-button py-3.5 rounded-xl font-medium"
            >
              Quay lại đăng nhập
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl"
                  autoFocus
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 p-4 rounded-xl border border-red-100">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full glass-button py-3.5 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                'Gửi email đặt lại mật khẩu'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push('/user/login')}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

