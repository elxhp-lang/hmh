import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getFinanceCache, startFinanceCacheRefresh } from '@/lib/finance-cache';

// 缓存初始化 Promise
let cacheInitPromise: Promise<void> | null = null;

/**
 * GET /api/finance/realtime
 * 获取实时财务信息（仅超级管理员可访问）
 * 数据每小时更新一次
 */
export async function GET(request: NextRequest) {
  try {
    // 启动缓存刷新（只执行一次）
    if (!cacheInitPromise) {
      cacheInitPromise = startFinanceCacheRefresh();
    }
    // 等待初始化完成
    await cacheInitPromise;

    // 权限检查
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 获取缓存数据
    const cacheEntry = await getFinanceCache();
    
    if (!cacheEntry) {
      // 演示模式：返回模拟数据
      return NextResponse.json({
        cached: false,
        data: {
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
        },
      });
    }

    // 返回缓存数据
    return NextResponse.json({
      cached: cacheEntry.cached,
      cached_at: new Date(cacheEntry.timestamp).toISOString(),
      next_refresh: new Date(cacheEntry.timestamp + 60 * 60 * 1000).toISOString(),
      data: cacheEntry.data,
    });
  } catch (error) {
    console.error('Finance realtime API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
