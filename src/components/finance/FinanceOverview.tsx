'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface FinanceData {
  balance: {
    available: number;
    cash: number;
    credit: number;
    frozen: number;
    arrears: number;
  };
  consumption: {
    daily: number;
    monthly: number;
    total: number;
    currency: string;
  };
  bill_period: string;
  updated_at: string;
  demo?: boolean;
}

interface FinanceResponse {
  cached: boolean;
  cached_at?: string;
  next_refresh?: string;
  data: FinanceData;
}

// 演示数据
const DEMO_DATA: FinanceData = {
  balance: {
    available: 1000,
    cash: 1000,
    credit: 0,
    frozen: 0,
    arrears: 0,
  },
  consumption: {
    daily: 0,
    monthly: 0,
    total: 0,
    currency: 'CNY',
  },
  bill_period: new Date().toISOString().slice(0, 7),
  updated_at: new Date().toISOString(),
  demo: true,
};

export function FinanceOverview() {
  const { user, token } = useAuth();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState<string | null>(null);

  useEffect(() => {
    const fetchFinanceData = async () => {
      try {
        setLoading(true);
        
        // 如果未登录，显示演示数据
        if (!user || !token) {
          setData(DEMO_DATA);
          setError(null);
          return;
        }
        
        const response = await fetch('/api/finance/realtime', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          // 如果是权限问题，显示演示数据
          if (response.status === 401 || response.status === 403) {
            setData(DEMO_DATA);
            setError(null);
            return;
          }
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch finance data');
        }

        const result: FinanceResponse = await response.json();
        setData(result.data);
        setCached(result.cached);
        setCachedAt(result.cached_at || null);
        setNextRefresh(result.next_refresh || null);
        setError(null);
      } catch (err) {
        // 出错时显示演示数据
        console.error('Finance data fetch error:', err);
        setData(DEMO_DATA);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFinanceData();

    // 每小时刷新一次（与后端缓存同步）
    const interval = setInterval(fetchFinanceData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, token]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="h-4 w-4 text-red-500" />
            财务概览
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.demo && (
              <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                演示数据
              </span>
            )}
            {cached && !data.demo && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                缓存数据
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 主要余额 */}
        <div>
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(data.balance.available)}
          </div>
          <p className="text-xs text-muted-foreground">可用余额</p>
        </div>

        {/* 消费统计 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="h-3 w-3 text-red-500" />
              <span className="text-muted-foreground">今日</span>
            </div>
            <div className="text-base font-semibold">
              {formatCurrency(data.consumption.daily)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <TrendingDown className="h-3 w-3 text-amber-500" />
              <span className="text-muted-foreground">本月</span>
            </div>
            <div className="text-base font-semibold">
              {formatCurrency(data.consumption.monthly)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <Wallet className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">累计</span>
            </div>
            <div className="text-base font-semibold">
              {formatCurrency(data.consumption.total)}
            </div>
          </div>
        </div>

        {/* 详细余额 */}
        <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>现金余额</span>
            <span>{formatCurrency(data.balance.cash)}</span>
          </div>
          {data.balance.credit > 0 && (
            <div className="flex justify-between">
              <span>信用额度</span>
              <span>{formatCurrency(data.balance.credit)}</span>
            </div>
          )}
          {data.balance.frozen > 0 && (
            <div className="flex justify-between">
              <span>冻结金额</span>
              <span className="text-amber-600">
                {formatCurrency(data.balance.frozen)}
              </span>
            </div>
          )}
          {data.balance.arrears > 0 && (
            <div className="flex justify-between">
              <span>欠费金额</span>
              <span className="text-red-600">
                {formatCurrency(data.balance.arrears)}
              </span>
            </div>
          )}
        </div>

        {/* 更新时间 */}
        <div className="text-xs text-muted-foreground pt-2 border-t space-y-1">
          <div className="flex items-center justify-between">
            <span>更新于: {new Date(data.updated_at).toLocaleString('zh-CN')}</span>
            {cached && !data.demo && (
              <span className="text-green-600 dark:text-green-400">已缓存</span>
            )}
          </div>
          {nextRefresh && !data.demo && (
            <div className="text-muted-foreground/70">
              下次更新: {new Date(nextRefresh).toLocaleTimeString('zh-CN')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
