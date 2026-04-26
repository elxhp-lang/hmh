'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Loader2, Users, FileText, TrendingUp, UserCog, ExternalLink } from 'lucide-react';
import { FinanceOverview } from '@/components/finance/FinanceOverview';
import { MaterialCenterDialog } from '@/components/dashboard/MaterialCenterDialog';

interface OverviewStats {
  total_videos: number;
  pending_videos: number;
  total_users: number;
}

interface SuperAdminDashboardProps {
  token: string;
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

  const metricCards = [
    {
      title: '总生成',
      value: stats?.total_videos || 0,
      hint: '累计视频',
      valueClass: 'text-slate-900',
      badgeClass: 'bg-sky-100 text-sky-700',
    },
    {
      title: '生成中',
      value: stats?.pending_videos || 0,
      hint: '进行中任务',
      valueClass: 'text-blue-600',
      badgeClass: 'bg-blue-100 text-blue-700',
    },
    {
      title: '用户数',
      value: stats?.total_users || 0,
      hint: '平台账户',
      valueClass: 'text-slate-900',
      badgeClass: 'bg-violet-100 text-violet-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="hmh-shell-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">视频库窗口</CardTitle>
              <p className="text-sm text-muted-foreground">
                聚合查看已生成视频、版本链路与 REMIX 结果，作为首页主入口
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <p className="text-sm font-medium text-blue-900">进入视频库</p>
                <p className="mt-1 text-xs text-blue-700">按团队维度管理生成视频，支持继续筛选与追踪</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MaterialCenterDialog tabType="team" buttonText="打开视频库窗口" />
                  <Button variant="outline" asChild>
                    <a href="/material/history?type=team">全屏查看</a>
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-900">快速操作</p>
                <p className="mt-1 text-xs text-emerald-700">创建新视频或跳转素材中心，保持内容生产连续性</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href="/video">创建视频</a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/product-library">素材中心</a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
          {metricCards.map((metric) => (
            <Card key={metric.title} className="hmh-shell-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-xs text-muted-foreground">{metric.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${metric.badgeClass}`}>
                    指标
                  </span>
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-20 mt-2" />
                ) : (
                  <p className={`text-2xl font-semibold mt-2 ${metric.valueClass}`}>{metric.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{metric.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 快捷操作 */}
      <Card className="hmh-shell-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">快捷操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="/video"
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC]/80 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all group"
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
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC]/80 hover:bg-purple-50 border border-transparent hover:border-purple-200 transition-all group"
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
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC]/80 hover:bg-cyan-50 border border-transparent hover:border-cyan-200 transition-all group"
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
            className="flex items-center gap-3 p-4 rounded-xl bg-[#F8FAFC]/80 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all group"
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

      <FinanceOverview />

      {/* 平台公告和外部链接 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hmh-shell-card">
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

        <Card className="hmh-shell-card">
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
