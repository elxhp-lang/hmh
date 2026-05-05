'use client';

import React from 'react';
import NextImage from 'next/image';
import { Badge } from '@/components/ui/badge';

// ========== Script Card ==========

interface ScriptCardProps {
  data: Record<string, unknown>;
}

export function ScriptCard({ data }: ScriptCardProps) {
  const title = typeof data.title === 'string' ? data.title : '';
  const duration = typeof data.duration === 'string' ? data.duration : '';
  const style = typeof data.style === 'string' ? data.style : '';
  const columns = Array.isArray(data.columns) ? data.columns as string[] : [];
  const rows = Array.isArray(data.rows) ? data.rows as string[][] : [];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{title || '脚本'}</span>
          {style && <Badge variant="secondary" className="text-[10px] h-4">{style}</Badge>}
          {duration && <Badge variant="outline" className="text-[10px] h-4">{duration}</Badge>}
        </div>
        <span className="text-[10px] text-muted-foreground">AI 生成</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((h, i) => (
                <th key={i} className="px-2.5 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t odd:bg-background even:bg-muted/10">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2.5 py-1.5 align-top whitespace-pre-wrap leading-relaxed">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========== First Frame Card ==========

interface FirstFrameCardProps {
  data: Record<string, unknown>;
}

export function FirstFrameCard({ data }: FirstFrameCardProps) {
  const imageUrl = typeof data.image_url === 'string' ? data.image_url : '';
  const imageId = typeof data.image_id === 'string' ? data.image_id : '';

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-sm">
      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
          <NextImage
            src={imageUrl}
            alt={`首帧图${imageId ? ` ${imageId}` : ''}`}
            width={400}
            height={300}
            className="w-full h-auto object-cover"
            unoptimized
          />
        </a>
      ) : (
        <div className="aspect-video bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          首帧图生成中...
        </div>
      )}
      <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between">
        <span className="text-xs font-medium">首帧预览</span>
        {imageId && <span className="text-[10px] text-muted-foreground">{imageId}</span>}
      </div>
    </div>
  );
}

// ========== Video Result Card ==========

interface VideoResultCardProps {
  data: Record<string, unknown>;
}

export function VideoResultCard({ data }: VideoResultCardProps) {
  const videoUrl = typeof data.public_video_url === 'string' ? data.public_video_url : (typeof data.video_url === 'string' ? data.video_url : '');
  const videoName = typeof data.video_name === 'string' ? data.video_name : '';
  const poster = typeof data.cover_url === 'string' ? data.cover_url : undefined;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-md">
      {videoUrl ? (
        <div className="bg-black">
          <video src={videoUrl} controls poster={poster} className="w-full max-h-[300px]" preload="metadata" />
        </div>
      ) : (
        <div className="aspect-video bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          视频加载中...
        </div>
      )}
      <div className="px-3 py-2 border-t bg-muted/20 flex items-center justify-between">
        <span className="text-xs font-medium">{videoName || '视频结果'}</span>
        <Badge variant="secondary" className="text-[10px] h-4">已完成</Badge>
      </div>
    </div>
  );
}

// ========== Task Progress Card ==========

interface TaskProgressCardProps {
  data: Record<string, unknown>;
}

export function TaskProgressCard({ data }: TaskProgressCardProps) {
  const status = typeof data.status === 'string' ? data.status : 'running';
  const taskType = typeof data.task_type === 'string' ? data.task_type : (typeof data.tool === 'string' ? data.tool : '');
  const isTerminal = ['succeeded', 'completed', 'failed', 'cancelled'].includes(status);

  const statusLabels: Record<string, string> = {
    queued: '排队中', running: '生成中', processing: '处理中',
    succeeded: '已完成', completed: '已完成', failed: '失败', cancelled: '已取消',
  };
  const statusColors: Record<string, string> = {
    queued: 'bg-yellow-500', running: 'bg-blue-500', processing: 'bg-blue-500',
    succeeded: 'bg-green-500', completed: 'bg-green-500', failed: 'bg-destructive', cancelled: 'bg-muted-foreground',
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-md">
      <div className="px-3 py-2.5 flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-muted-foreground'} ${!isTerminal ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium flex-1">
          {taskType === 'video_generate' ? '视频' : taskType === 'image_generate' ? '图片' : '任务'}
          {statusLabels[status] || status}
        </span>
      </div>
      {!isTerminal && (
        <div className="px-3 pb-2">
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Card Renderer (Dispatches by cardType) ==========

interface CardRendererProps {
  cardType: string;
  data: Record<string, unknown>;
}

export function CardRenderer({ cardType, data }: CardRendererProps) {
  switch (cardType) {
    case 'script':
    case 'script_options':
      return <ScriptCard data={data} />;
    case 'first_frame':
    case 'image_generated':
      return <FirstFrameCard data={data} />;
    case 'video_result':
      return <VideoResultCard data={data} />;
    case 'task_done':
    case 'task_progress':
    case 'task_submitted':
      return <TaskProgressCard data={data} />;
    default:
      return null;
  }
}
