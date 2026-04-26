/**
 * 财务数据缓存服务
 * 每小时自动更新一次，避免频繁调用火山引擎 API
 */

import { createBillingClient, VolcengineBillingClient } from '@/lib/volcengine-client';

interface FinanceCacheData {
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
}

interface CacheEntry {
  data: FinanceCacheData;
  timestamp: number;
  cached: boolean;
}

// 缓存时间：1小时（毫秒）
const CACHE_TTL = 60 * 60 * 1000;

// 内存缓存
let cache: CacheEntry | null = null;

// 刷新锁，防止并发刷新
let isRefreshing = false;

// 定时器引用
let refreshInterval: NodeJS.Timeout | null = null;

/**
 * 刷新财务数据
 */
async function refreshFinanceData(billingClient: VolcengineBillingClient): Promise<FinanceCacheData> {
  const now = new Date();
  const billPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = now.toISOString().split('T')[0];

  // 并行查询所有数据
  const [balanceData, monthlyBillResult, dailyBillResult, totalBillResults] = await Promise.all([
    // 1. 查询余额
    billingClient.queryBalanceAcct().catch(err => {
      console.error('Failed to query balance:', err);
      return null;
    }),
    
    // 2. 查询本月消费
    billingClient.listBillOverviewByCategory({
      BillPeriod: billPeriod,
      Limit: 100,
    }).catch(err => {
      console.error('Failed to query monthly cost:', err);
      return null;
    }),
    
    // 3. 查询今日消费 - 注意：listBillDetail 在某些情况下需要 GroupTerm
    // 如果今日没有消费，跳过即可
    billingClient.listBillDetail({
      BillPeriod: billPeriod,
      BillDay: today,
      PageSize: 100,
    }).catch(err => {
      console.error('Failed to query daily cost:', err);
      return null;
    }),
    
    // 4. 查询过去12个月消费（并行查询）
    (async () => {
      const months: string[] = [];
      for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push(month);
      }
      
      const results = await Promise.all(
        months.map(month =>
          billingClient.listBillOverviewByCategory({
            BillPeriod: month,
            Limit: 100,
          }).catch(() => null)
        )
      );
      return results;
    })(),
  ]);

  // 解析余额
  const balance = {
    available: parseFloat(balanceData?.AvailableBalance || '0'),
    cash: parseFloat(balanceData?.CashBalance || '0'),
    credit: parseFloat(balanceData?.CreditLimit || '0'),
    frozen: parseFloat(balanceData?.FreezeAmount || '0'),
    arrears: parseFloat(balanceData?.ArrearsBalance || '0'),
  };

  // 解析本月消费
  let monthlyCost = 0;
  if (monthlyBillResult?.List) {
    for (const category of monthlyBillResult.List) {
      if (category.List) {
        for (const item of category.List) {
          if (item.BillCategoryParent !== '合计') {
            monthlyCost += parseFloat(item.PayableAmount || '0');
          }
        }
      }
    }
  }

  // 解析今日消费
  let dailyCost = 0;
  if (dailyBillResult?.Items) {
    dailyCost = dailyBillResult.Items.reduce(
      (sum, item) => sum + (item.RealTotalPrice || 0),
      0
    ) / 100;
  }

  // 解析总消费
  let totalCost = 0;
  for (const result of totalBillResults || []) {
    if (result?.List) {
      for (const category of result.List) {
        if (category.List) {
          for (const item of category.List) {
            if (item.BillCategoryParent !== '合计') {
              totalCost += parseFloat(item.PayableAmount || '0');
            }
          }
        }
      }
    }
  }

  return {
    balance,
    consumption: {
      daily: dailyCost,
      monthly: monthlyCost,
      total: totalCost,
      currency: 'CNY',
    },
    bill_period: billPeriod,
    updated_at: new Date().toISOString(),
  };
}

/**
 * 启动定时刷新（每小时一次）
 */
export async function startFinanceCacheRefresh(): Promise<void> {
  if (refreshInterval) {
    return; // 已经在运行
  }

  console.log('[FinanceCache] Starting hourly refresh...');

  // 立即刷新一次（等待完成）
  await refreshCache();

  // 每小时刷新一次
  refreshInterval = setInterval(() => {
    console.log('[FinanceCache] Hourly refresh triggered');
    refreshCache();
  }, CACHE_TTL);
}

/**
 * 停止定时刷新
 */
export function stopFinanceCacheRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('[FinanceCache] Stopped hourly refresh');
  }
}

/**
 * 刷新缓存
 */
async function refreshCache(): Promise<void> {
  // 如果正在刷新，直接返回
  if (isRefreshing) {
    console.log('[FinanceCache] Already refreshing, skip');
    return;
  }

  const billingClient = createBillingClient();
  if (!billingClient) {
    console.warn('[FinanceCache] Billing client not configured, skip refresh');
    return;
  }

  isRefreshing = true;
  try {
    const data = await refreshFinanceData(billingClient);
    cache = {
      data,
      timestamp: Date.now(),
      cached: true,
    };
    console.log('[FinanceCache] Cache refreshed successfully:', {
      monthly: data.consumption.monthly,
      total: data.consumption.total,
    });
  } catch (error) {
    console.error('[FinanceCache] Failed to refresh cache:', error);
  } finally {
    isRefreshing = false;
  }
}

/**
 * 获取缓存的财务数据
 * 如果缓存过期或不存在，会触发刷新
 */
export async function getFinanceCache(): Promise<CacheEntry | null> {
  const billingClient = createBillingClient();
  
  // 如果没有配置火山引擎，返回 null（使用演示数据）
  if (!billingClient) {
    return null;
  }

  // 如果有缓存且未过期，直接返回
  if (cache && Date.now() - cache.timestamp <= CACHE_TTL) {
    return cache;
  }

  // 缓存过期或不存在，触发刷新
  if (!isRefreshing) {
    // 不等待刷新完成，直接返回旧缓存（如果有）或等待刷新
    if (cache) {
      // 有旧缓存，后台刷新，立即返回旧数据
      refreshCache();
      return cache;
    } else {
      // 没有缓存，等待刷新完成
      await refreshCache();
      return cache;
    }
  }

  // 正在刷新，返回现有缓存
  return cache;
}

/**
 * 强制刷新缓存
 */
export async function forceRefreshFinanceCache(): Promise<FinanceCacheData | null> {
  const billingClient = createBillingClient();
  if (!billingClient) {
    return null;
  }

  try {
    const data = await refreshFinanceData(billingClient);
    cache = {
      data,
      timestamp: Date.now(),
      cached: true,
    };
    return data;
  } catch (error) {
    console.error('[FinanceCache] Force refresh failed:', error);
    return null;
  }
}
