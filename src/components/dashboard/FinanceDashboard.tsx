'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingDown, Calendar, ClipboardList, Download, FileText, Receipt, ExternalLink, RefreshCw } from 'lucide-react';

interface FinanceData {
  balance: string;
  dailyCost: string;
  monthlyCost: string;
  totalTasks: number;
  lastUpdated: string | null;
}

interface FinanceDashboardProps {
  token: string;
}

export function FinanceDashboard({ token }: FinanceDashboardProps) {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await fetch('/api/finance/realtime', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('加载财务数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  const handleExport = () => {
    // 跳转到账单页面并触发导出
    window.location.href = '/billing?export=true';
  };

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
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 账户余额 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">账户余额</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.balance || '¥0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">可用余额</p>
          </CardContent>
        </Card>

        {/* 今日消费 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日消费</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{data?.dailyCost || '¥0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">今日累计</p>
          </CardContent>
        </Card>

        {/* 本月消费 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本月消费</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.monthlyCost || '¥0.00'}</div>
            <p className="text-xs text-muted-foreground mt-1">本月累计</p>
          </CardContent>
        </Card>

        {/* 总任务数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总任务数</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalTasks || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">视频生成任务</p>
          </CardContent>
        </Card>
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>快捷操作</CardTitle>
              <CardDescription>常用财务功能入口</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出账单
            </Button>
            <Button variant="outline" asChild>
              <a href="https://console.volcengine.com/finance/invoice" target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                开发票
                <ExternalLink className="h-3 w-3 ml-2" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/billing">
                <Receipt className="h-4 w-4 mr-2" />
                账单明细
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据更新时间 */}
      {data?.lastUpdated && (
        <p className="text-xs text-muted-foreground text-center">
          数据更新时间: {new Date(data.lastUpdated).toLocaleString('zh-CN')}
        </p>
      )}
    </div>
  );
}
