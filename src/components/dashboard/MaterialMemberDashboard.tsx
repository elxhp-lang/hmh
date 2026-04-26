'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Loader2, CheckCircle, XCircle, Plus, History, Sparkles, TrendingUp } from 'lucide-react';
import { MaterialCenterDialog } from '@/components/dashboard/MaterialCenterDialog';
import { RecentVideosCard } from '@/components/dashboard/RecentVideosCard';

interface PersonalStats {
  myVideos: number;
  myProcessing: number;
  myCompleted: number;
  myFailed: number;
}

interface MaterialMemberDashboardProps {
  token: string;
  userId: string;
}

export function MaterialMemberDashboard({ token, userId }: MaterialMemberDashboardProps) {
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`/api/stats/personal?user_id=${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('加载个人数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [token, userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: '我的生成总量',
      value: stats?.myVideos || 0,
      desc: '已生成视频总数',
      icon: Video,
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: '生成中',
      value: stats?.myProcessing || 0,
      desc: '正在处理',
      icon: Loader2,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      animate: true,
    },
    {
      title: '已完成',
      value: stats?.myCompleted || 0,
      desc: '成功生成',
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: '失败',
      value: stats?.myFailed || 0,
      desc: '生成失败',
      icon: XCircle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card 
            key={index}
            className="hmh-shell-card hover:shadow-md transition-shadow duration-200 overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor} ${stat.animate ? 'animate-spin' : ''}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快捷操作 */}
      <Card className="hmh-shell-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 h-1" />
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle>快捷操作</CardTitle>
          </div>
          <CardDescription>开始创建新的视频内容</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <a href="/video">
                <Plus className="h-4 w-4" />
                创建视频
              </a>
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <a href="/material/history?type=personal">
                <History className="h-4 w-4" />
                查看历史
              </a>
            </Button>
            <Button variant="secondary" asChild className="gap-2">
              <a href="/agent">
                <TrendingUp className="h-4 w-4" />
                创意小海
              </a>
            </Button>
            <MaterialCenterDialog tabType="personal" />
          </div>
        </CardContent>
      </Card>
      <RecentVideosCard token={token} type="personal" />
    </div>
  );
}
