'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Loader2, Users, CheckCircle, Plus, History, ChevronRight } from 'lucide-react';
import { MaterialCenterDialog } from '@/components/dashboard/MaterialCenterDialog';
import { RecentVideosCard } from '@/components/dashboard/RecentVideosCard';

interface MemberStat {
  user_id: string;
  username: string;
  email: string;
  created_at: string;
  video_count: number;
  processing_count: number;
}

interface TeamStats {
  teamVideos: number;
  processingCount: number;
  teamMembers: number;
  successRate: string;
  members: MemberStat[];
}

interface MaterialLeaderDashboardProps {
  token: string;
}

export function MaterialLeaderDashboard({ token }: MaterialLeaderDashboardProps) {
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/stats/team', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('加载团队数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [token]);

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
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 团队生成总量 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">团队生成总量</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teamVideos || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">已生成视频总数</p>
          </CardContent>
        </Card>

        {/* 生成中 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">生成中</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.processingCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">正在处理的任务</p>
          </CardContent>
        </Card>

        {/* 团队人数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">团队人数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teamMembers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">素材团队成员</p>
          </CardContent>
        </Card>

        {/* 成功率 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">成功率</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.successRate || '0%'}</div>
            <p className="text-xs text-muted-foreground mt-1">视频生成成功率</p>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
          <CardDescription>常用功能入口</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href="/video">
                <Plus className="h-4 w-4 mr-2" />
                创建视频
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/material/history?type=team">
                <History className="h-4 w-4 mr-2" />
                查看历史
              </a>
            </Button>
            <MaterialCenterDialog tabType="team" />
          </div>
        </CardContent>
      </Card>
      <RecentVideosCard token={token} type="team" />

      {/* 团队成员详情 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>团队成员</span>
            <span className="text-sm font-normal text-muted-foreground">
              共 {stats?.teamMembers || 0} 人
            </span>
          </CardTitle>
          <CardDescription>素材团队工作人员列表</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.members && stats.members.length > 0 ? (
            <div className="space-y-3">
              {stats.members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {member.username?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.username}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium">{member.video_count}</p>
                      <p className="text-xs text-muted-foreground">生成总量</p>
                    </div>
                    {member.processing_count > 0 && (
                      <div className="text-center">
                        <p className="font-medium text-blue-600">{member.processing_count}</p>
                        <p className="text-xs text-muted-foreground">生成中</p>
                      </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>暂无团队成员</p>
              <p className="text-xs mt-1">请联系管理员添加素材团队工作人员</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
