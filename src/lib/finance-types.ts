/**
 * 财务智能体 - 数据类型定义
 * 
 * 定义费用类型、价格表、计算公式等核心数据结构
 */

// ========== 费用类型枚举 ==========
export const BILLING_TYPES = {
  // 视频生成相关
  VIDEO_GENERATION: 'video.generation',        // 文生视频
  IMAGE_TO_VIDEO: 'video.image_to_video',      // 图生视频
  VIDEO_EXTEND: 'video.extend',               // 视频延长
  VIDEO_EDIT: 'video.edit',                   // 视频编辑
  FIRST_FRAME: 'video.first_frame',          // 首帧生成
  
  // 存储相关
  STORAGE_TOS: 'storage.tos',                 // TOS 对象存储
  
  // AI 模型调用相关
  LLM_CHAT: 'llm.chat',                      // 主模型对话（doubao-seed-2-0-pro）
  LLM_VISION: 'llm.vision',                  // 视觉分析（doubao-seed-1-6-vision）
  
  // 其他
  BANDWIDTH: 'bandwidth',                     // 带宽费用
  CDN: 'cdn',                                 // CDN 费用
} as const;

export type BillingType = typeof BILLING_TYPES[keyof typeof BILLING_TYPES];

// ========== 费用类型中文名称 ==========
export const BILLING_TYPE_NAMES: Record<BillingType, string> = {
  [BILLING_TYPES.VIDEO_GENERATION]: '文生视频',
  [BILLING_TYPES.IMAGE_TO_VIDEO]: '图生视频',
  [BILLING_TYPES.VIDEO_EXTEND]: '视频延长',
  [BILLING_TYPES.VIDEO_EDIT]: '视频编辑',
  [BILLING_TYPES.FIRST_FRAME]: '首帧生成',
  [BILLING_TYPES.STORAGE_TOS]: '对象存储',
  [BILLING_TYPES.LLM_CHAT]: 'AI 对话',
  [BILLING_TYPES.LLM_VISION]: '视觉分析',
  [BILLING_TYPES.BANDWIDTH]: '带宽',
  [BILLING_TYPES.CDN]: 'CDN',
};

// ========== 价格表（官方定价 2026-03） ==========
// 单位：元/百万tokens 或 元/GB
export const PRICING_TABLE: Record<string, {
  price: number;
  unit: string;
  description: string;
}> = {
  // Seedance 2.0 视频生成
  [BILLING_TYPES.VIDEO_GENERATION]: {
    price: 46,
    unit: '元/百万tokens',
    description: '文生视频（不含视频输入）',
  },
  [BILLING_TYPES.IMAGE_TO_VIDEO]: {
    price: 28,
    unit: '元/百万tokens',
    description: '图生视频（含视频输入）',
  },
  [BILLING_TYPES.VIDEO_EXTEND]: {
    price: 28,
    unit: '元/百万tokens',
    description: '视频延长（含视频输入）',
  },
  [BILLING_TYPES.VIDEO_EDIT]: {
    price: 28,
    unit: '元/百万tokens',
    description: '视频编辑（含视频输入）',
  },
  [BILLING_TYPES.FIRST_FRAME]: {
    price: 28,
    unit: '元/百万tokens',
    description: '首帧生成',
  },
  
  // 存储
  [BILLING_TYPES.STORAGE_TOS]: {
    price: 0.12,
    unit: '元/GB/月',
    description: 'TOS 标准存储',
  },
  
  // LLM 模型
  [BILLING_TYPES.LLM_CHAT]: {
    price: 46,
    unit: '元/百万tokens',
    description: 'doubao-seed-2-0-pro 对话',
  },
  [BILLING_TYPES.LLM_VISION]: {
    price: 28,
    unit: '元/百万tokens',
    description: 'doubao-seed-1-6-vision 视觉分析',
  },
};

// ========== 视频生成实测数据 ==========
export const VIDEO_GENERATION_BENCHMARK = {
  // 15秒视频平均 token 消耗
  DURATION_15S_TOKENS: 308_880, // 约 30.888 万 tokens
  
  // 单条视频成本估算
  VIDEO_15S_COST: {
    WITHOUT_VIDEO_INPUT: 14.21, // 元（纯生成）
    WITH_VIDEO_INPUT: 8.65,     // 元（含视频参考）
  },
  
  // 折算
  COST_PER_SECOND: {
    WITHOUT_VIDEO_INPUT: 0.95,  // 元/秒
    WITH_VIDEO_INPUT: 0.58,     // 元/秒
  },
};

// ========== 计算公式 ==========
export const COST_FORMULAS = {
  /**
   * 估算视频生成成本
   * @param duration 秒
   * @param hasVideoInput 是否有视频参考
   * @returns 估算成本（元）
   */
  estimateVideoCost: (duration: number, hasVideoInput: boolean = false): number => {
    const benchmark = VIDEO_GENERATION_BENCHMARK;
    const ratio = duration / 15;
    const baseCost = hasVideoInput 
      ? benchmark.VIDEO_15S_COST.WITH_VIDEO_INPUT 
      : benchmark.VIDEO_15S_COST.WITHOUT_VIDEO_INPUT;
    return Math.round(baseCost * ratio * 100) / 100;
  },
  
  /**
   * 估算 LLM 调用成本
   * @param inputTokens 输入 tokens
   * @param outputTokens 输出 tokens
   * @param billingType 费用类型
   * @returns 成本（元）
   */
  estimateLLMCost: (
    inputTokens: number, 
    outputTokens: number, 
    billingType: BillingType = BILLING_TYPES.LLM_CHAT
  ): number => {
    const pricing = PRICING_TABLE[billingType];
    if (!pricing) return 0;
    const totalTokens = inputTokens + outputTokens;
    return Math.round((totalTokens / 1_000_000) * pricing.price * 100) / 100;
  },
  
  /**
   * 简化 token 估算（基于字符数）
   * @param text 文本内容
   * @returns 估算 tokens
   */
  estimateTokensFromText: (text: string): number => {
    // 中文约 1 token ≈ 2 字符
    // 英文约 1 token ≈ 4 字符
    // 混合场景取中间值
    return Math.ceil(text.length / 3);
  },
  
  /**
   * 月度费用汇总
   * @param dailyCosts 每日费用数组
   * @returns 月度总费用
   */
  monthlyTotal: (dailyCosts: number[]): number => {
    return Math.round(dailyCosts.reduce((a, b) => a + b, 0) * 100) / 100;
  },
  
  /**
   * 资源包抵扣计算
   * @param usage 使用量
   * @param packageCapacity 资源包额度
   * @returns 抵扣后的剩余使用量
   */
  resourcePackageDeduction: (usage: number, packageCapacity: number): number => {
    return Math.max(0, usage - packageCapacity);
  },
  
  /**
   * 计算实际支出
   * @param total 总费用
   * @param couponAmount 代金券金额
   * @param resourcePackageDeductionAmount 资源包抵扣金额
   * @returns 实际支出
   */
  calculateActualSpend: (
    total: number, 
    couponAmount: number = 0, 
    resourcePackageDeductionAmount: number = 0
  ): number => {
    return Math.max(0, Math.round((total - couponAmount - resourcePackageDeductionAmount) * 100) / 100);
  },
};

// ========== 账户信息类型 ==========
export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;          // 账户余额（元）
  availableAmount: number;  // 可用金额
  creditAmount: number;      // 信用额度
  currency: string;          // 货币类型
}

// ========== 账单明细类型 ==========
export interface BillDetailItem {
  billId: string;
  product: string;          // 产品名称
  productType: string;      // 产品类型
  billType: string;          // 计费类型
  duration: number;          // 使用量
  unit: string;             // 单位
  price: number;             // 单价
  amount: number;            // 金额
  deductAmount: number;      // 抵扣金额
  actualAmount: number;      // 实际金额
  billTime: string;          // 账单时间
}

// ========== 账单总览类型 ==========
export interface BillOverviewItem {
  product: string;
  productName: string;
  totalAmount: number;
  deductAmount: number;
  actualAmount: number;
  billCount: number;
}

// ========== 代金券类型 ==========
export interface CouponInfo {
  couponId: string;
  couponName: string;
  couponType: string;
  amount: number;
  balance: number;          // 剩余金额
  threshold: number;         // 使用门槛
  startTime: string;
  expireTime: string;
  status: 'unused' | 'used' | 'expired';
}

// ========== 资源包类型 ==========
export interface ResourcePackage {
  packageId: string;
  packageName: string;
  product: string;
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  startTime: string;
  expireTime: string;
  status: 'active' | 'expired' | 'depleted';
}

// ========== 预算类型 ==========
export interface Budget {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  alertThreshold: number;   // 告警阈值（百分比）
  alertEmails: string[];    // 告警邮箱
  status: 'active' | 'paused';
  currentSpend: number;      // 当前消费
  createdAt: string;
}

// ========== 费用趋势类型 ==========
export interface CostTrendItem {
  time: string;
  amount: number;
  product: string;
}

// ========== Token 使用日志 ==========
export interface TokenUsageLog {
  id: string;
  userId: string;
  type: 'video_generation' | 'llm_chat' | 'llm_vision';
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  model: string;
  taskId?: string;
  createdAt: string;
}

// ========== 每日费用汇总 ==========
export interface DailyCostSummary {
  id: string;
  date: string;
  totalCost: number;
  videoGenerationCost: number;
  llmCost: number;
  storageCost: number;
  transactionCount: number;
  createdAt: string;
}

// ========== 财务分析报告 ==========
export interface FinanceAnalysisReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalCost: number;
    averageDailyCost: number;
    projectedMonthlyCost: number;
    costChangeRate: number;  // 环比增长率
  };
  breakdown: {
    byType: Record<string, number>;
    byProduct: Record<string, number>;
  };
  trends: {
    daily: CostTrendItem[];
    weekly: CostTrendItem[];
  };
  recommendations: string[];
}
