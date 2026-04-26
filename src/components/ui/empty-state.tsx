'use client';

import { cn } from '@/lib/utils';
import { LucideIcon, Inbox, FileVideo, MessageSquare, Package, Search, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  default: Inbox,
  video: FileVideo,
  message: MessageSquare,
  product: Package,
  search: Search,
  error: AlertCircle,
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Icon = icon || Inbox;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
        <div className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
      </div>
      <h3 className="mt-4 text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// 预设的空状态组件
export function EmptyVideoState({ onCreateVideo }: { onCreateVideo?: () => void }) {
  return (
    <EmptyState
      icon={FileVideo}
      title="暂无视频"
      description="还没有生成任何视频，开始创作您的第一个视频吧"
      action={onCreateVideo ? { label: '创建视频', onClick: onCreateVideo } : undefined}
    />
  );
}

export function EmptyMessageState() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="开始对话"
      description="发送消息开始与智能助手对话"
    />
  );
}

export function EmptyProductState({ onAddProduct }: { onAddProduct?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="暂无商品"
      description="还没有添加商品，添加商品让创意小海自动识别"
      action={onAddProduct ? { label: '添加商品', onClick: onAddProduct } : undefined}
    />
  );
}

export function EmptySearchState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="未找到结果"
      description={`没有找到与 "${query}" 相关的内容`}
    />
  );
}

export function ErrorState({
  title = '加载失败',
  description = '发生了错误，请稍后重试',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={onRetry ? { label: '重试', onClick: onRetry } : undefined}
    />
  );
}
