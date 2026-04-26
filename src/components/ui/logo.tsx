'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export function Logo({ className, size = 'md', showText = true, variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: { container: 'h-6', text: 'text-lg' },
    md: { container: 'h-8', text: 'text-xl' },
    lg: { container: 'h-12', text: 'text-2xl' },
  };

  const textColors = {
    light: 'text-foreground',      // 深色文字（浅色背景使用）
    dark: 'text-white',            // 白色文字（深色背景使用）
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Logo 图片 */}
      <div className={cn('relative', sizes[size].container)}>
        <Image
          src="/images/logo-small.png"
          alt="海盟会"
          className="h-full w-auto object-contain"
          width={sizes[size].container === 'h-6' ? 24 : sizes[size].container === 'h-8' ? 32 : 48}
          height={sizes[size].container === 'h-6' ? 24 : sizes[size].container === 'h-8' ? 32 : 48}
        />
      </div>
      {showText && (
        <span className={cn('font-semibold tracking-tight', sizes[size].text, textColors[variant])}>
          海盟会
        </span>
      )}
    </div>
  );
}

// 紧凑版 Logo（仅图标）
export function LogoIcon({ className, size = 'md' }: Omit<LogoProps, 'showText' | 'variant'>) {
  return <Logo className={className} size={size} showText={false} />;
}
