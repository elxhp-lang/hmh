'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

// 不需要登录就能访问的路径
const publicPaths = ['/login', '/register', '/'];

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // 客户端挂载后设置 mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (loading || !mounted) return;

    // 检查当前路径是否是公开路径
    const isPublicPath = publicPaths.some(path => {
      if (path === '/') {
        return pathname === '/';
      }
      return pathname?.startsWith(path);
    });

    // 如果未登录且访问的是受保护路径，跳转到登录页
    if (!user && !isPublicPath) {
      const returnUrl = encodeURIComponent(pathname || '/dashboard');
      router.push(`/login?redirect=${returnUrl}`);
    }

    // 如果已登录且访问登录页，跳转到仪表盘
    if (user && pathname === '/login') {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router, mounted]);

  // 服务端渲染时显示 children（让页面正常渲染）
  // 客户端加载后如果未登录会重定向
  if (!mounted) {
    return <>{children}</>;
  }

  // 加载中显示 loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
