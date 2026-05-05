'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[GlobalError] 未捕获的渲染错误:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold mb-2">页面发生错误</h1>
        <p className="text-sm text-muted-foreground mb-6">
          应用遇到了意外问题。请尝试刷新页面，如果问题持续存在请联系管理员。
        </p>
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          重试
        </Button>
      </div>
    </div>
  );
}
