/**
 * 财务助手工具执行器 V2
 * 
 * 执行财务工具的核心逻辑
 * 支持：火山引擎 API、记忆存储、定时任务、预算管理
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createBillingClient } from './volcengine-client';
import { SearchClient } from 'coze-coding-dev-sdk';
import {
  VIDEO_GENERATION_BENCHMARK,
} from './finance-types';

interface BillingRow {
  created_at: string;
  amount: number | string;
}

interface OverviewItem {
  productName: string;
  realAmount: number;
}

interface DbErrorLike {
  message?: string;
}

interface IdRow {
  id?: string;
}

interface BudgetTaskRow {
  params?: string;
}

interface WebSearchRow {
  title?: string;
  snippet?: string;
  site_name?: string;
}

function isBillingRow(value: unknown): value is BillingRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.created_at === 'string' && (typeof row.amount === 'number' || typeof row.amount === 'string');
}

// ========== 火山引擎客户端创建 ==========

function getBillingClient() {
  const client = createBillingClient();
  if (!client) {
    throw new Error('火山引擎财务 API 凭证未配置');
  }
  return client;
}

// ========== 辅助函数 ==========

function formatAmount(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }
  if (val && typeof val === 'object' && typeof (val as { toString?: () => string }).toString === 'function') {
    const str = (val as { toString: () => string }).toString();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }
  return 0;
}

// ========== 工具执行器类 ==========

export class FinanceToolExecutor {
  private userId: string;
  private webSearchEnabled: boolean;
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;
  private _searchClient: SearchClient | null = null;

  constructor(userId: string, webSearchEnabled: boolean = false) {
    this.userId = userId;
    this.webSearchEnabled = webSearchEnabled;
  }

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  private get searchClient() {
    if (!this._searchClient) {
      this._searchClient = new SearchClient();
    }
    return this._searchClient;
  }

  /**
   * 执行工具
   */
  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    console.log(`🔧 [Finance Executor] 执行工具: ${toolName}`, params);

    try {
      switch (toolName) {
        // 财务查询工具
        case 'get_balance':
          return await this.getBalance();
        case 'get_bill_overview':
          return await this.getBillOverview(params);
        case 'get_bill_details':
          return await this.getBillDetails(params);
        case 'get_coupons':
          return await this.getCoupons();
        case 'get_resource_packages':
          return await this.getResourcePackages();
        case 'analyze_cost_trend':
          return await this.analyzeCostTrend(params);
        case 'estimate_video_cost':
          return await this.estimateVideoCost(params);
        case 'generate_finance_report':
          return await this.generateFinanceReport(params);

        // 记忆存储工具
        case 'save_finance_memory':
          return await this.saveFinanceMemory(params);
        case 'get_finance_memory':
          return await this.getFinanceMemory(params);
        case 'search_finance_memory':
          return await this.searchFinanceMemory(params);

        // 定时任务工具
        case 'create_scheduled_task':
          return await this.createScheduledTask(params);
        case 'get_scheduled_tasks':
          return await this.getScheduledTasks();
        case 'delete_scheduled_task':
          return await this.deleteScheduledTask(params);

        // 预算管理工具
        case 'set_budget_alert':
          return await this.setBudgetAlert(params);
        case 'get_budget_status':
          return await this.getBudgetStatus();

        // 联网搜索工具
        case 'web_search':
          return await this.executeWebSearch(params);

        default:
          return { success: false, error: `未知工具：${toolName}` };
      }
    } catch (error) {
      console.error(`❌ [Finance Executor] 执行失败: ${toolName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败'
      };
    }
  }

  // ========== 财务查询工具实现 ==========

  private async getBalance() {
    const client = getBillingClient();
    const result = await client.queryBalanceAcct();
    
    return {
      success: true,
      data: {
        balance: formatAmount(result.AvailableBalance) || formatAmount(result.TotalBalance),
        availableAmount: formatAmount(result.AvailableBalance),
        currency: result.Currency || 'CNY',
        details: {
          cashBalance: formatAmount(result.CashBalance),
          creditLimit: formatAmount(result.CreditLimit),
        },
      },
      message: '账户余额查询成功'
    };
  }

  private async getBillOverview(params: Record<string, unknown>) {
    const client = getBillingClient();
    const period = (params.period as string) || new Date().toISOString().slice(0, 7);
    
    const result = await client.listBillOverviewByProd({
      BillPeriod: period,
      PageSize: 50,
    });
    
    const items = result.Items || [];
    const totalAmount = items.reduce((sum, item) => sum + formatAmount(item.TotalRealPrice), 0);
    
    return {
      success: true,
      data: {
        overview: items.map((item) => ({
          product: item.Product || '',
          productName: item.ProductZh || item.Product || '',
          totalAmount: formatAmount(item.TotalListPrice),
          deductAmount: formatAmount(item.TotalDeductedByVoucher) + formatAmount(item.TotalDeductedByCash),
          realAmount: formatAmount(item.TotalRealPrice),
        })),
        totalAmount: formatAmount(totalAmount),
        period,
      },
      message: `账单概览查询成功，共 ${items.length} 个产品`
    };
  }

  private async getBillDetails(params: Record<string, unknown>) {
    const client = getBillingClient();
    const period = (params.period as string) || new Date().toISOString().slice(0, 7);
    const pageNum = (params.page_num as number) || 1;
    const pageSize = (params.page_size as number) || 50;
    
    const result = await client.listBillDetail({
      BillPeriod: period,
      PageNum: pageNum,
      PageSize: pageSize,
    });
    
    return {
      success: true,
      data: {
        items: (result.Items || []).map((item) => ({
          billId: item.BillId || '',
          product: item.Product || '',
          productName: item.ProductZh || item.Product || '',
          billType: item.BillingItem || '',
          billTypeName: item.BillingItemZh || item.BillingItem || '',
          amount: formatAmount(item.ListPrice) * (Number(item.Value) || 1),
          deductAmount: formatAmount(item.DeductedByVoucher) + formatAmount(item.DeductedByCash),
          realAmount: formatAmount(item.RealTotalPrice),
          billTime: item.BillDay || item.BillPeriod || '',
        })),
        totalCount: result.TotalCount || 0,
        period,
        pageNum,
        pageSize,
      },
      message: `账单明细查询成功，共 ${result.Items?.length || 0} 条记录`
    };
  }

  private async getCoupons() {
    const client = getBillingClient();
    
    const result = await client.listCoupons({
      Status: 'UNUSED',
      PageSize: 50,
    });
    
    return {
      success: true,
      data: {
        coupons: (result.Coupons || []).map((coupon) => ({
          couponId: coupon.CouponId || '',
          couponName: coupon.CouponName || '',
          couponType: coupon.CouponTypeZh || coupon.CouponType || '',
          faceValue: formatAmount(coupon.FaceValue),
          balance: formatAmount(coupon.Balance),
          startTime: coupon.EffectiveStartTime || '',
          expireTime: coupon.EffectiveEndTime || '',
          status: coupon.StatusZh || coupon.Status || '',
          applicableProducts: coupon.ApplicableProducts,
        })),
        totalCount: result.TotalCount || 0,
      },
      message: `代金券查询成功，共 ${result.Coupons?.length || 0} 张可用`
    };
  }

  private async getResourcePackages() {
    const client = getBillingClient();
    
    const result = await client.listResourcePackages({
      Status: '有效',
      PageSize: 50,
    });
    
    return {
      success: true,
      data: {
        packages: (result.Packages || []).map((pkg) => ({
          packageId: pkg.PackageId || '',
          packageName: pkg.PackageName || '',
          product: pkg.Product || '',
          productName: pkg.ProductZh || pkg.Product || '',
          totalCapacity: Number(pkg.TotalCapacity) || 0,
          usedCapacity: Number(pkg.UsedCapacity) || 0,
          remainingCapacity: Number(pkg.RemainingCapacity) || 0,
          unit: pkg.Unit || '',
          startTime: pkg.EffectiveStartTime || '',
          expireTime: pkg.EffectiveEndTime || '',
          status: pkg.StatusZh || pkg.Status || '',
        })),
        totalCount: result.TotalCount || 0,
      },
      message: `资源包查询成功，共 ${result.Packages?.length || 0} 个`
    };
  }

  private async analyzeCostTrend(params: Record<string, unknown>) {
    const startDate = params.start_date as string;
    const endDate = params.end_date as string;
    const granularity = (params.granularity as string) || 'daily';
    
    // 查询账单明细
    const { data: bills } = await this.supabase
      .from('billing')
      .select('created_at, amount, task_type')
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true });
    
    // 按日期分组
    const dailyData: Record<string, number> = {};
    (bills || []).filter(isBillingRow).forEach((bill) => {
      const date = (bill.created_at as string).split('T')[0];
      dailyData[date] = (dailyData[date] || 0) + formatAmount(bill.amount);
    });
    
    // 计算趋势
    const dates = Object.keys(dailyData).sort();
    const values = dates.map(d => dailyData[d]);
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (values.length >= 2) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (secondAvg > firstAvg * 1.1) trend = 'up';
      else if (secondAvg < firstAvg * 0.9) trend = 'down';
    }
    
    const maxDate = dates.length > 0 ? dates.reduce((a, b) => dailyData[a] > dailyData[b] ? a : b) : null;
    const maxAmount = maxDate ? dailyData[maxDate] : 0;
    
    return {
      success: true,
      data: {
        dailyData,
        totalAmount: values.reduce((a, b) => a + b, 0),
        averageDaily: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
        maxDate,
        maxAmount: formatAmount(maxAmount),
        trend,
        period: { start: startDate, end: endDate },
        granularity,
      },
      message: `费用趋势分析完成，${trend === 'up' ? '呈上升趋势' : trend === 'down' ? '呈下降趋势' : '基本稳定'}`
    };
  }

  private async estimateVideoCost(params: Record<string, unknown>) {
    const duration = (params.duration as number) || 5;
    const hasVideoInput = params.has_video_input as boolean || false;
    const quantity = (params.quantity as number) || 1;
    
    const ratio = duration / 15;
    const benchmark = VIDEO_GENERATION_BENCHMARK;
    const unitCost = hasVideoInput 
      ? benchmark.VIDEO_15S_COST.WITH_VIDEO_INPUT 
      : benchmark.VIDEO_15S_COST.WITHOUT_VIDEO_INPUT;
    const totalCost = Math.round(unitCost * ratio * quantity * 100) / 100;
    
    return {
      success: true,
      data: {
        duration,
        hasVideoInput,
        quantity,
        unitCost: Math.round(unitCost * ratio * 100) / 100,
        totalCost,
        costPerSecond: hasVideoInput ? 0.58 : 0.95,
        currency: 'CNY',
        description: hasVideoInput ? '图生视频模式' : '文生视频模式',
      },
      message: `估算生成 ${quantity} 个 ${duration} 秒视频需要 ${totalCost} 元`
    };
  }

  private async generateFinanceReport(params: Record<string, unknown>) {
    const period = (params.period as string) || new Date().toISOString().slice(0, 7);
    
    // 并行获取数据
    const [balanceResult, overviewResult] = await Promise.all([
      this.getBalance(),
      this.getBillOverview({ period }),
    ]);
    
    const balance = balanceResult.data;
    const overview = overviewResult.data;
    const totalCost = overview.totalAmount || 0;
    const currentDay = new Date().getDate();
    const averageDailyCost = currentDay > 0 ? totalCost / currentDay : 0;
    const daysInMonth = new Date(period + '-01').getMonth() === new Date().getMonth() 
      ? new Date().getDate() 
      : 30;
    const projectedMonthlyCost = averageDailyCost * daysInMonth;
    
    // 按产品分组
    const breakdown: Record<string, number> = {};
    ((overview.overview || []) as OverviewItem[]).forEach((item) => {
      breakdown[item.productName] = item.realAmount;
    });
    
    // 生成建议
    const recommendations: string[] = [];
    if ((balance?.availableAmount || 0) < projectedMonthlyCost) {
      recommendations.push(`账户余额可能不足以支撑本月预估消费，建议关注`);
    }
    if (totalCost > 0 && Object.keys(breakdown).length > 0) {
      const topProduct = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
      if (topProduct) {
        recommendations.push(`本月费用主要来自 ${topProduct[0]}，占比 ${((topProduct[1] / totalCost) * 100).toFixed(1)}%`);
      }
    }
    if (recommendations.length === 0) {
      recommendations.push('消费状况良好，暂无特殊建议');
    }
    
    return {
      success: true,
      data: {
        period,
        summary: {
          totalCost: Math.round(totalCost * 100) / 100,
          averageDailyCost: Math.round(averageDailyCost * 100) / 100,
          projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100,
          balance: balance?.balance || 0,
          availableAmount: balance?.availableAmount || 0,
        },
        breakdown,
        recommendations,
      },
      message: `财务报告生成成功`
    };
  }

  // ========== 记忆存储工具实现 ==========

  private async saveFinanceMemory(params: Record<string, unknown>) {
    const key = params.key as string;
    const value = params.value as string;
    const category = (params.category as string) || 'custom';
    
    const { error } = await this.supabase
      .from('finance_memories')
      .upsert({
        user_id: this.userId,
        memory_key: key,
        memory_value: value,
        category,
        updated_at: new Date().toISOString(),
      });
    
    if (error) throw new Error(`保存记忆失败: ${error.message}`);
    
    return {
      success: true,
      message: `记忆 "${key}" 保存成功`
    };
  }

  private async getFinanceMemory(params: Record<string, unknown>) {
    const key = params.key as string | undefined;
    const category = params.category as string | undefined;
    
    let query = this.supabase
      .from('finance_memories')
      .select('*')
      .eq('user_id', this.userId);
    
    if (key) {
      query = query.eq('memory_key', key);
    }
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query.order('updated_at', { ascending: false });
    
    if (error) throw new Error(`读取记忆失败: ${error.message}`);
    
    return {
      success: true,
      data: {
        memories: data?.map(m => ({
          key: m.memory_key,
          value: m.memory_value,
          category: m.category,
          updatedAt: m.updated_at,
        })) || [],
      },
      message: `读取到 ${data?.length || 0} 条记忆`
    };
  }

  private async searchFinanceMemory(params: Record<string, unknown>) {
    const keyword = params.keyword as string;
    
    const { data, error } = await this.supabase
      .from('finance_memories')
      .select('*')
      .eq('user_id', this.userId)
      .or(`memory_key.ilike.%${keyword}%,memory_value.ilike.%${keyword}%`)
      .order('updated_at', { ascending: false });
    
    if (error) throw new Error(`搜索记忆失败: ${error.message}`);
    
    return {
      success: true,
      data: {
        memories: data?.map(m => ({
          key: m.memory_key,
          value: m.memory_value,
          category: m.category,
          updatedAt: m.updated_at,
        })) || [],
      },
      message: `找到 ${data?.length || 0} 条相关记忆`
    };
  }

  // ========== 定时任务工具实现 ==========

  private async createScheduledTask(params: Record<string, unknown>) {
    const taskName = params.task_name as string;
    const taskType = params.task_type as string;
    const cronExpression = params.cron_expression as string;
    const taskParams = params.params as string | undefined;
    
    // 解析 cron 表达式计算下次执行时间（简化版）
    const nextRun = this.calculateNextRun(cronExpression);
    
    const { data, error } = await this.supabase
      .from('finance_scheduled_tasks')
      .insert({
        user_id: this.userId,
        task_name: taskName,
        task_type: taskType,
        cron_expression: cronExpression,
        params: taskParams,
        next_run_at: nextRun,
        status: 'active',
      })
      .select()
      .single();
    
    if (error) throw new Error(`创建任务失败: ${(error as DbErrorLike).message || '未知错误'}`);
    if (!data) throw new Error('创建任务失败：未返回数据');
    
    return {
      success: true,
      data: {
        taskId: (data as IdRow).id as string,
        taskName,
        taskType,
        cronExpression,
        nextRunAt: nextRun,
      },
      message: `定时任务 "${taskName}" 创建成功，下次执行: ${nextRun}`
    };
  }

  private async getScheduledTasks() {
    const { data, error } = await this.supabase
      .from('finance_scheduled_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .eq('status', 'active')
      .order('next_run_at', { ascending: true });
    
    if (error) throw new Error(`查询任务失败: ${error.message}`);
    
    return {
      success: true,
      data: {
        tasks: data?.map(t => ({
          taskId: t.id,
          taskName: t.task_name,
          taskType: t.task_type,
          cronExpression: t.cron_expression,
          nextRunAt: t.next_run_at,
          status: t.status,
        })) || [],
      },
      message: `查询到 ${data?.length || 0} 个定时任务`
    };
  }

  private async deleteScheduledTask(params: Record<string, unknown>) {
    const taskId = params.task_id as string;
    
    const { error } = await this.supabase
      .from('finance_scheduled_tasks')
      .update({ status: 'deleted' })
      .eq('id', taskId)
      .eq('user_id', this.userId);
    
    if (error) throw new Error(`删除任务失败: ${error.message}`);
    
    return {
      success: true,
      message: '定时任务已删除'
    };
  }

  private calculateNextRun(cronExpression: string): string {
    // 简化版 cron 解析
    const now = new Date();
    const parts = cronExpression.split(' ');
    
    // 支持简单格式: 分 时 日 月 周
    // 例如: "0 9 * * *" = 每天9点
    // "0 9 * * 1" = 每周一9点
    
    if (parts.length >= 5) {
      const [minute, hour] = parts;
      
      // 计算下次执行时间
      const next = new Date(now);
      
      if (hour !== '*') {
        next.setHours(parseInt(hour), parseInt(minute) || 0, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
      } else {
        next.setTime(next.getTime() + 60 * 60 * 1000); // 默认1小时后
      }
      
      return next.toISOString();
    }
    
    // 默认1小时后
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  // ========== 预算管理工具实现 ==========

  private async setBudgetAlert(params: Record<string, unknown>) {
    const budgetAmount = params.budget_amount as number;
    const periodType = params.period_type as string;
    const alertThreshold = (params.alert_threshold as number) || 0.8;
    
    const { data, error } = await this.supabase
      .from('finance_scheduled_tasks')
      .upsert({
        user_id: this.userId,
        task_name: `${periodType} 预算提醒`,
        task_type: 'budget_alert',
        cron_expression: periodType === 'monthly' ? '0 9 1 * *' : periodType === 'weekly' ? '0 9 * * 1' : '0 9 * * *',
        params: JSON.stringify({ budget_amount: budgetAmount, alert_threshold: alertThreshold }),
        status: 'active',
      })
      .select()
      .single();
    
    if (error) throw new Error(`设置预算失败: ${error.message}`);
    
    return {
      success: true,
      data: {
        budgetAmount,
        periodType,
        alertThreshold,
        taskId: data?.id,
      },
      message: `预算提醒设置成功: ${budgetAmount}元/${periodType}`
    };
  }

  private async getBudgetStatus() {
    // 查询当前消费
    const { data: bills } = await this.supabase
      .from('billing')
      .select('amount, created_at')
      .gte('created_at', new Date(new Date().setDate(1)).toISOString());
    
    const totalSpend = bills?.reduce((sum, b) => sum + formatAmount(b.amount), 0) || 0;
    
    // 查询预算设置
    const { data: budgets } = await this.supabase
      .from('finance_scheduled_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .eq('task_type', 'budget_alert')
      .eq('status', 'active');
    
    const b = ((budgets || []) as BudgetTaskRow[])?.[0];
    let budgetAmount = 0;
    let alertThreshold = 0.8;
    
    if (b?.params) {
      try {
        const params = JSON.parse(b.params as string);
        budgetAmount = params.budget_amount || 0;
        alertThreshold = params.alert_threshold || 0.8;
      } catch {}
    }
    
    return {
      success: true,
      data: {
        totalSpend: Math.round(totalSpend * 100) / 100,
        budgetAmount,
        remaining: Math.round((budgetAmount - totalSpend) * 100) / 100,
        percentage: budgetAmount > 0 ? Math.round((totalSpend / budgetAmount) * 100) : 0,
        alertThreshold,
        isOverBudget: totalSpend > budgetAmount && budgetAmount > 0,
        isNearBudget: budgetAmount > 0 && (totalSpend / budgetAmount) >= alertThreshold,
      },
      message: budgetAmount > 0 
        ? `本月已消费 ${totalSpend.toFixed(2)}元，预算 ${budgetAmount}元`
        : '暂无预算设置'
    };
  }

  // ========== 联网搜索工具实现 ==========

  private async executeWebSearch(params: Record<string, unknown>) {
    // 如果联网未开启，返回提示
    if (!this.webSearchEnabled) {
      return {
        success: false,
        error: '联网搜索功能未开启，请在界面右上角开启联网模式'
      };
    }

    const query = (params.query as string) || '';
    const count = (params.count as number) || 5;

    if (!query) {
      return {
        success: false,
        error: '搜索关键词不能为空'
      };
    }

    try {
      const result = await this.searchClient.webSearch(query, count);

      if (result.web_items && result.web_items.length > 0) {
        const resultText = result.web_items
          .map((r: WebSearchRow, i: number) => `${i + 1}. 【${r.title}】\n   ${r.snippet}\n   来源: ${r.site_name || '未知网站'}`)
          .join('\n\n');

        return {
          success: true,
          data: {
            summary: result.summary || '',
            results: result.web_items,
            formatted: `--- 联网搜索结果（${result.web_items.length}条）---\n${result.summary ? result.summary + '\n\n' : ''}${resultText}`
          },
          message: `搜索到 ${result.web_items.length} 条相关结果`
        };
      } else {
        return {
          success: false,
          error: '未找到相关结果'
        };
      }
    } catch (error) {
      console.error('[Finance] 联网搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '联网搜索失败'
      };
    }
  }
}
