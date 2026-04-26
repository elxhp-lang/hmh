'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Film } from 'lucide-react';

interface RecentVideoItem {
  id: string;
  video_name?: string;
  prompt: string;
  status: string;
  created_at: string;
}

interface RecentVideosCardProps {
  token: string;
  type: 'personal' | 'team';
}

export function RecentVideosCard({ token, type }: RecentVideosCardProps) {
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<RecentVideoItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/material/history?type=${type}&limit=6&page=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (response.ok && result.success) {
          setVideos((result.videos || []) as RecentVideoItem[]);
        }
      } catch (error) {
        console.error('加载最近生成失败:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, type]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">最近生成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无视频记录</p>
        ) : (
          videos.map((video) => (
            <div key={video.id} className="flex items-center justify-between rounded border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{video.video_name || video.prompt || '未命名视频'}</p>
                <p className="text-xs text-muted-foreground">{new Date(video.created_at).toLocaleString('zh-CN')}</p>
              </div>
              <Badge variant={video.status === 'completed' ? 'default' : video.status === 'failed' ? 'destructive' : 'secondary'}>
                {video.status}
              </Badge>
            </div>
          ))
        )}
        <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" asChild>
          <a href={`/material/history?type=${type}`}>
            <Film className="h-4 w-4 mr-2" />
            查看全部
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
