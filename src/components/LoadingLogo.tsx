'use client';

import { FileText } from 'lucide-react';

interface LoadingLogoProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export default function LoadingLogo({ size = 'md', text }: LoadingLogoProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={`${sizeClasses[size]} bg-black/90 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-lg`}>
        {/* Animated background gradient - slides from left to right */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-slide-right" />
        
        {/* Logo icon */}
        <FileText className={`${iconSizes[size]} text-white relative z-10`} />
      </div>
      {text && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span>{text}</span>
        </div>
      )}
    </div>
  );
}

