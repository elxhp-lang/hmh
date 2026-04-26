'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <html lang="zh-CN">
      <body className="bg-background">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-9xl font-bold text-primary/20">404</h1>
            <h2 className="text-2xl font-semibold mt-4 mb-2">页面未找到</h2>
            <p className="text-muted-foreground mb-8">
              抱歉，您访问的页面不存在或已被移除
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回上一页
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                <Home className="w-4 h-4 mr-2" />
                返回首页
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
