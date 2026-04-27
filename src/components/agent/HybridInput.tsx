'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Send, 
  Upload, 
  Link2, 
  X, 
  Image as ImageIcon,
  Video,
  Loader2,
  AlertCircle,
  Globe
} from 'lucide-react';

// ========== 类型定义 ==========

export type AttachmentType = 'video' | 'image';

export interface HybridInputAttachment {
  id: string;
  type: AttachmentType;
  file?: File;
  url?: string;
  name: string;
  progress?: number;
  status?: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface HybridInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onFileUpload?: (files: FileList) => Promise<void>;
  onUploadComplete?: (attachment: HybridInputAttachment) => void;
  onLinkSubmit?: (url: string) => void;
  // 联网搜索：改为开关模式
  webSearchEnabled?: boolean;  // 当前是否开启联网
  onWebSearchToggle?: () => void;  // 切换联网模式
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

// ========== 链接输入对话框 ==========

interface LinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

function LinkDialog({ open, onClose, onSubmit }: LinkDialogProps) {
  const [url, setUrl] = useState('');
  
  const handleSubmit = () => {
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl('');
      onClose();
    }
  };
  
  if (!open) return null;
  
  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-background border rounded-lg shadow-lg p-3 z-50">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">粘贴视频链接</span>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="抖音/B站/快手等视频链接..."
          className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <Button size="sm" onClick={handleSubmit} disabled={!url.trim()}>
          添加
        </Button>
      </div>
      <button 
        onClick={onClose}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ========== 上传预览项 ==========

interface UploadPreviewProps {
  attachment: HybridInputAttachment;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
}

function UploadPreview({ attachment, onRemove, onRetry }: UploadPreviewProps) {
  return (
    <div className={cn(
      'relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
      attachment.status === 'error' ? 'bg-destructive/10' : 'bg-muted'
    )}>
      {/* 图标 */}
      <div className="text-muted-foreground">
        {attachment.type === 'video' ? (
          <Video className="w-4 h-4" />
        ) : (
          <ImageIcon className="w-4 h-4" />
        )}
      </div>
      
      {/* 文件名/状态 */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-xs">{attachment.name}</p>
        
        {/* 上传进度 */}
        {attachment.status === 'uploading' && attachment.progress !== undefined && (
          <div className="mt-1">
            <Progress value={attachment.progress} className="h-1" />
          </div>
        )}
        
        {/* 错误信息 */}
        {attachment.status === 'error' && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {attachment.error || '上传失败'}
          </p>
        )}
      </div>
      
      {/* 操作按钮 */}
      <div className="flex items-center gap-1">
        {attachment.status === 'uploading' && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {attachment.status === 'error' && onRetry && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 px-1"
            onClick={() => onRetry(attachment.id)}
          >
            重试
          </Button>
        )}
        <button 
          onClick={() => onRemove(attachment.id)}
          className="p-1 hover:bg-muted-foreground/20 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ========== 主组件 ==========

export function HybridInput({
  value,
  onChange,
  onSend,
  onFileUpload,
  onUploadComplete,
  onLinkSubmit,
  webSearchEnabled = false,
  onWebSearchToggle,
  disabled = false,
  placeholder = '输入消息或拖拽文件...',
  maxLength = 2000
}: HybridInputProps) {
  const [attachments, setAttachments] = useState<HybridInputAttachment[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);
  
  // 处理输入
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    adjustHeight();
  };
  
  // 处理发送
  const handleSend = () => {
    if (value.trim() || attachments.length > 0) {
      onSend();
      setAttachments([]);
    }
  };
  
  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onFileUpload) {
      await processFiles(files);
    }
    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && onFileUpload) {
      await processFiles(files);
    }
  };
  
  // 处理文件 - 简化为只显示本地预览，调用 onFileUpload
  const processFiles = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // 创建本地预览
    const newAttachments: HybridInputAttachment[] = fileArray.map(file => {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      return {
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type,
        file,
        name: file.name,
        progress: 0,
        status: 'uploading' as const
      };
    });
    
    setAttachments(prev => [...prev, ...newAttachments]);
    
    // 触发上传回调
    if (onFileUpload) {
      try {
        await onFileUpload(files);
        // 上传成功后，显示预览
        setAttachments(prev => prev.map(a => {
          const matched = newAttachments.find(n => n.id === a.id);
          if (matched && matched.file) {
            return { ...a, status: 'success' as const, url: URL.createObjectURL(matched.file), progress: 100 };
          }
          return a;
        }));
      } catch {
        setAttachments(prev => prev.map(a =>
          newAttachments.find(n => n.id === a.id)
            ? { ...a, status: 'error' as const, error: '上传失败' }
            : a
        ));
      }
    }
  };
  
  // 处理链接提交
  const handleLinkSubmit = (url: string) => {
    if (onLinkSubmit) {
      onLinkSubmit(url);
    }
    setShowLinkDialog(false);
  };
  
  // 移除附件
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  
  return (
    <div className="relative">
      {/* 上传预览区 */}
      {attachments.length > 0 && (
        <div className="mb-2 space-y-2">
          {attachments.map(attachment => (
            <UploadPreview
              key={attachment.id}
              attachment={attachment}
              onRemove={handleRemoveAttachment}
              onRetry={() => {
                // 重试逻辑
                setAttachments(prev => prev.map(a =>
                  a.id === attachment.id
                    ? { ...a, status: 'uploading', progress: 0 }
                    : a
                ));
              }}
            />
          ))}
        </div>
      )}
      
      {/* 拖拽高亮 */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <p className="text-sm text-primary font-medium">松开以上传文件</p>
        </div>
      )}
      
      {/* 输入框区域 */}
      <div 
        className={cn(
          'relative flex items-end gap-2 bg-muted/50 rounded-2xl border px-4 py-2',
          isDragOver && 'border-primary',
          disabled && 'opacity-50'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 左侧按钮组 */}
        <div className="flex items-center gap-1 pb-1">
          {/* 文件上传 */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload className="w-4 h-4" />
          </Button>
          
          {/* 链接输入 */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => setShowLinkDialog(!showLinkDialog)}
              disabled={disabled}
            >
              <Link2 className="w-4 h-4" />
            </Button>
            
            <LinkDialog
              open={showLinkDialog}
              onClose={() => setShowLinkDialog(false)}
              onSubmit={handleLinkSubmit}
            />
          </div>

          {/* 联网搜索开关 */}
        {onWebSearchToggle && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 rounded-full transition-all",
              webSearchEnabled 
                ? "bg-blue-100 hover:bg-blue-200" 
                : "hover:bg-muted"
            )}
            onClick={onWebSearchToggle}
            disabled={disabled}
            title={webSearchEnabled ? "联网已开启" : "联网已关闭"}
          >
            <Globe className={cn(
              "w-4 h-4",
              webSearchEnabled ? "text-blue-500" : "text-muted-foreground"
            )} />
          </Button>
        )}
        </div>
        
        {/* 文本输入 */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent resize-none text-sm leading-relaxed focus:outline-none py-1.5 min-h-[24px]"
          rows={1}
        />
        
        {/* 右侧发送按钮 */}
        <Button
          size="sm"
          className="h-8 w-8 p-0 rounded-full"
          onClick={handleSend}
          disabled={disabled || (!value.trim() && attachments.length === 0)}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
      
      {/* 字数统计 */}
      {maxLength > 0 && (
        <div className="flex items-center justify-between mt-1 px-1">
          <span className="text-[10px] text-muted-foreground/60">
            Enter 发送，Shift+Enter 换行，支持拖拽图片/视频
          </span>
          <span className={cn(
            'text-[10px]',
            value.length > maxLength * 0.9 ? 'text-amber-500' : 'text-muted-foreground/50'
          )}>
            {value.length}/{maxLength}
          </span>
        </div>
      )}
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
