'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Loader2, Users, FileText, TrendingUp, UserCog, ExternalLink, ChevronDown, Lock } from 'lucide-react';
import { FinanceOverview } from '@/components/finance/FinanceOverview';
import { MaterialCenterDialog } from '@/components/dashboard/MaterialCenterDialog';
import { RecentVideosCard } from '@/components/dashboard/RecentVideosCard';

interface OverviewStats {
  total_videos: number;
  pending_videos: number;
  total_users: number;
}

interface SuperAdminDashboardProps {
  token: string;
}

// 迷你趋势图组件
function MiniTrendChart({ data, color = 'blue' }: { data: number[]; color?: 'blue' | 'purple' | 'cyan' | 'green' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');
  
  const colorMap = {
    blue: { stroke: '#3B82F6', fill: 'url(#blueGradient)' },
    purple: { stroke: '#8B5CF6', fill: 'url(#purpleGradient)' },
    cyan: { stroke: '#06B6D4', fill: 'url(#cyanGradient)' },
    green: { stroke: '#10B981', fill: 'url(#greenGradient)' },
  };
  
  return (
    <svg viewBox="0 0 100 40" className="w-full h-12" preserveAspectRatio="none">
      <defs>
        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="cyanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* 填充区域 */}
      <polygon
        points={`0,40 ${points} 100,40`}
        fill={colorMap[color].fill}
      />
      {/* 线条 */}
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color].stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SuperAdminDashboard({ token }: SuperAdminDashboardProps) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/stats/overview', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('加载统计数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [token]);

  // 模拟趋势数据
  const trendData = {
    videos: [12, 19, 15, 25, 22, 30, 35],
    pending: [2, 3, 5, 3, 4, 2, 3],
    users: [5, 8, 12, 15, 18, 22, 25],
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片网格 - 2×2布局 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 总生成视频 */}
        <Card className="border-0 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">总生成</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground cursor-pointer" />
          </CardHeader>
          <CardContent className="pt-2 pb-4 px-4">
            {loading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  {stats?.total_videos || 0}
                </div>
                <MiniTrendChart data={trendData.videos} color="blue" />
              </>
            )}
          </CardContent>
        </Card>

        {/* 生成中 */}
        <Card className="border-0 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">生成中</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground cursor-pointer" />
          </CardHeader>
          <CardContent className="pt-2 pb-4 px-4">
            {loading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold text-blue-600 tracking-tight">
                  {stats?.pending_videos || 0}
                </div>
                <MiniTrendChart data={trendData.pending} color="cyan" />
              </>
            )}
          </CardContent>
        </Card>

        {/* 用户总数 */}
        <Card className="border-0 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">用户数</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground cursor-pointer" />
          </CardHeader>
          <CardContent className="pt-2 pb-4 px-4">
            {loading ? (
              <Skeleton className="h-10 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  {stats?.total_users || 0}
                </div>
                <MiniTrendChart data={trendData.users} color="purple" />
              </>
            )}
          </CardContent>
        </Card>

        {/* 财务概览 */}
        <FinanceOverview />
      </div>

      {/* 快捷操作 */}
      <Card className="border-0 rounded-xl bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="/video"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC] hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <Video className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-sm">生成视频</p>
              <p className="text-xs text-muted-foreground">文生视频/图生视频</p>
            </div>
          </a>
          <a
            href="/billing"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC] hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-sm">查看账单</p>
              <p className="text-xs text-muted-foreground">消费明细/发票</p>
            </div>
          </a>
          <a
            href="/product-library"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC] hover:bg-cyan-50 border border-transparent hover:border-cyan-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
              <TrendingUp className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="font-medium text-sm">素材中心</p>
              <p className="text-xs text-muted-foreground">管理商品素材与演员素材</p>
            </div>
          </a>
          <a
            href="/admin/users"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC] hover:bg-green-50 border border-transparent hover:border-green-200 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <UserCog className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-sm">用户管理</p>
              <p className="text-xs text-muted-foreground">角色分配/状态管理</p>
            </div>
          </a>
          <MaterialCenterDialog tabType="team" buttonText="素材中心窗口" />
        </CardContent>
      </Card>

      <RecentVideosCard token={token} type="team" />

      {/* 平台公告和外部链接 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 rounded-xl bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">平台公告</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div>
                  <p className="text-sm font-medium">Seedance 2.0 模型已上线</p>
                  <p className="text-xs text-muted-foreground">支持更高质量的视频生成</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-purple-500" />
                <div>
                  <p className="text-sm font-medium">智能体系统升级</p>
                  <p className="text-xs text-muted-foreground">新增素材创意助手和长期记忆</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-cyan-500" />
                <div>
                  <p className="text-sm font-medium">多级权限管理</p>
                  <p className="text-xs text-muted-foreground">支持按角色展示不同数据面板</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-0 rounded-xl bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">外部链接</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:border-blue-200" asChild>
              <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                火山引擎 ARK 控制台
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start h-11 rounded-lg hover:bg-purple-50 hover:border-purple-200" asChild>
              <a href="https://console.volcengine.com/finance" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                火山引擎财务中心
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
