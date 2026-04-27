'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  User, 
  Image as ImageIcon, 
  Video, 
  Link2,
  Loader2,
  CheckCircle2
} from 'lucide-react';

// ========== 类型定义 ==========

export type BubbleType = 'user' | 'assistant' | 'system';

export interface BubbleAttachment {
  type: 'video' | 'image' | 'link';
  url: string;
  name?: string;
}

export interface MessageBubbleProps {
  id: string;
  type: BubbleType;
  content: string;
  timestamp: Date;
  attachments?: BubbleAttachment[];
  isStreaming?: boolean;
  showAvatar?: boolean;
}

// ========== 气泡组件 ==========

export function MessageBubble({
  id,
  type,
  content,
  timestamp,
  attachments = [],
  isStreaming = false,
  showAvatar = true
}: MessageBubbleProps) {
  const isUser = type === 'user';
  const isSystem = type === 'system';
  
  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 获取附件图标
  const getAttachmentIcon = (attachmentType: string) => {
    switch (attachmentType) {
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'link':
        return <Link2 className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      'flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300',
      isUser && 'flex-row-reverse',
      isSystem && 'justify-center'
    )}>
      {/* 头像 */}
      {showAvatar && !isSystem && (
        <div className={cn(
          'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
        )}>
          {isUser ? (
            <User className="w-5 h-5" />
          ) : (
            <Bot className="w-5 h-5" />
          )}
        </div>
      )}
      
      {/* 气泡内容 */}
      <div className={cn(
        'max-w-[75%] flex flex-col',
        isUser && 'items-end',
        isSystem && 'items-center'
      )}>
        {/* 消息内容 */}
        <div className={cn(
          'relative rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser && 'bg-primary text-primary-foreground rounded-br-md',
          !isUser && !isSystem && 'bg-muted rounded-bl-md',
          isSystem && 'bg-muted/50 text-muted-foreground text-xs px-3 py-1.5 rounded-full',
          isStreaming && 'pr-10'
        )}>
          {/* 打字机光标 */}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
          )}
          
          {/* 消息文本 */}
          <div className="whitespace-pre-wrap break-words">
            {content}
          </div>
          
          {/* 流式加载指示器 */}
          {isStreaming && (
            <span className="absolute right-3 bottom-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            </span>
          )}
        </div>
        
        {/* 附件展示 */}
        {attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className={cn(
              'flex flex-wrap gap-2',
              isUser && 'flex-row-reverse'
            )}>
              {attachments.map((attachment, index) => (
                <div 
                  key={index}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
                    isUser 
                      ? 'bg-primary-foreground/20 text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {getAttachmentIcon(attachment.type)}
                  <span className="max-w-[120px] truncate">
                    {attachment.name || '附件'}
                  </span>
                </div>
              ))}
            </div>
            {attachments.some((attachment) => attachment.type === 'image') && (
              <div className={cn('grid gap-2', isUser ? 'justify-items-end' : 'justify-items-start')}>
                {attachments
                  .filter((attachment) => attachment.type === 'image')
                  .map((attachment, index) => (
                    <a
                      key={`img_${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={attachment.url}
                        alt={attachment.name || `图片 ${index + 1}`}
                        className="max-w-[220px] max-h-[220px] rounded-lg border object-cover"
                      />
                    </a>
                  ))}
              </div>
            )}
          </div>
        )}
        
        {/* 时间戳 */}
        <span className={cn(
          'text-[10px] text-muted-foreground/60 mt-1 px-1',
          isUser && 'text-right'
        )}>
          {isStreaming ? '正在输入...' : formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}

// ========== 消息分组组件 ==========

interface MessageGroupProps {
  messages: MessageBubbleProps[];
  showTimestamps?: boolean;
}

export function MessageGroup({ messages, showTimestamps = true }: MessageGroupProps) {
  // 按时间分组（5分钟内连续消息为一组）
  const groups: { messages: MessageBubbleProps[]; timestamp: Date }[] = [];
  
  messages.forEach((msg) => {
    const lastGroup = groups[groups.length - 1];
    const timeDiff = lastGroup 
      ? (msg.timestamp.getTime() - lastGroup.timestamp.getTime()) / 1000 / 60 
      : Infinity;
    
    if (lastGroup && lastGroup.messages[0].type === msg.type && timeDiff < 5) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ messages: [msg], timestamp: msg.timestamp });
    }
  });

  return (
    <div className="flex flex-col">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="relative">
          {/* 时间分隔线（如果需要） */}
          {showTimestamps && groupIndex > 0 && (
            <div className="flex items-center gap-3 my-4 px-4">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-[10px] text-muted-foreground/50">
                {group.timestamp.toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
          )}
          
          {/* 消息气泡 */}
          {group.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              {...msg}
              showAvatar={
                group.messages.indexOf(msg) === group.messages.length - 1 ||
                msg.type !== group.messages[0].type
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ========== 打字机效果 Hook ==========

export function useTypewriter(text: string, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    
    let index = 0;
    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return displayedText;
}
