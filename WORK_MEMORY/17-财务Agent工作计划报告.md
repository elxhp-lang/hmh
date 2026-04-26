# 财务智能体 - 工作计划报告

> 创建时间：2026-04-14
> 状态：待执行

---

## 一、事务确认结果

### 1.1 环境变量 ✅ 已确认

| 变量 | 状态 | 用途 |
|------|------|------|
| `VOLCENGINE_ACCESS_KEY_ID` | ✅ 已配置 | 火山引擎财务 API 认证 |
| `VOLCENGINE_SECRET_ACCESS_KEY` | ✅ 已配置 | 火山引擎财务 API 认证 |
| `VOLCENGINE_REGION` | ✅ cn-beijing | 区域配置 |
| `ARK_API_KEY` | ✅ 已配置 | Seedance 2.0 视频生成 |

**结论**：财务 API 调用的凭证已完整配置，可以直接使用。

---

### 1.2 Seedance 2.0 官方定价 ✅ 已确认

| 计费模式 | 单价 | 说明 |
|----------|------|------|
| **含视频输入** | 28元/百万tokens | 视频编辑场景（扩展、改写、风格迁移） |
| **不含视频输入** | 46元/百万tokens | 纯视频生成场景 |

**实测数据**：
- 生成 15 秒视频约需 30.888 万 tokens
- 纯生成成本：30.888 × 46 ≈ **14.2 元/条**
- 编辑模式成本：30.888 × 28 ≈ **8.6 元/条**
- 折合：**约 1 元/秒**

**价格分层逻辑**：
| 场景 | 模式 | 单价 | 15秒成本 |
|------|------|------|----------|
| 文生视频 | 纯生成 | 46元/百万tokens | ~14元 |
| 图生视频 | 混合 | 28元/百万tokens | ~9元 |
| 视频延长 | 混合 | 28元/百万tokens | ~9元 |

---

### 1.3 预算告警 ⚠️ 待确认

| 功能 | 说明 |
|------|------|
| 火山引擎预算告警 | 支持配置预算阈值和告警邮箱 |
| 实现方式 | AI 定期检查消费，超阈值发送通知 |
| 告警渠道 | 可选：飞书 / 邮件 / 系统通知 |

**待确认问题**：
- 是否需要预算告警功能？
- 告警通知发送到哪个渠道？

---

## 二、现有技术能力

### 2.1 已实现的 API 封装

| API | 方法 | 状态 |
|-----|------|------|
| 账单明细查询 | `listBillDetail` | ✅ 已封装 |
| 账单总览 | `listBillOverviewByProd` | ✅ 已封装 |
| 账户余额查询 | `queryBalanceAcct` | ✅ 已封装 |
| 代金券查询 | `listCoupons` | ✅ 已封装 |
| 资源包查询 | `listResourcePackages` | ✅ 已封装 |
| 预算管理 CRUD | `createBudget/updateBudget/deleteBudget` | ✅ 已封装 |
| 费用分析 | `listCostAnalysis` | ✅ 已封装 |

**文件位置**：`src/lib/volcengine-client.ts`

### 2.2 已有基础框架

| 组件 | 状态 |
|------|------|
| `src/app/api/agent/finance/route.ts` | ✅ 框架已存在 |
| 火山引擎 SDK | ✅ `@volcengine/openapi` 已安装 |

---

## 三、工作计划

### 阶段一：数据定义文档（基础）

| 任务 | 内容 | 产出文件 |
|------|------|----------|
| 3.1.1 | 定义费用类型枚举 | `src/lib/finance-types.ts` |
| 3.1.2 | 编写价格表常量 | `PRICING_TABLE` |
| 3.1.3 | 编写计算公式 | `COST_FORMULAS` |

**数据定义示例**：
```typescript
// 费用类型
export const BILLING_TYPES = {
  VIDEO_GENERATION: 'video.generation',      // 文生视频
  IMAGE_TO_VIDEO: 'video.image_to_video',   // 图生视频
  VIDEO_EXTEND: 'video.extend',             // 视频延长
  STORAGE: 'storage.tos',                   // TOS存储
} as const;

// 价格表（元/百万tokens，2026-03官方定价）
export const PRICING_TABLE = {
  [BILLING_TYPES.VIDEO_GENERATION]: {
    withVideoInput: 28,    // 含视频输入
    withoutVideoInput: 46, // 纯生成
    unit: '元/百万tokens',
  },
  [BILLING_TYPES.IMAGE_TO_VIDEO]: {
    withVideoInput: 28,
    withoutVideoInput: 46,
    unit: '元/百万tokens',
  },
  [BILLING_TYPES.VIDEO_EXTEND]: {
    withVideoInput: 28,
    withoutVideoInput: 46,
    unit: '元/百万tokens',
  },
} as const;

// 计算公式
export const COST_FORMULAS = {
  // 单条视频成本估算
  estimateVideoCost: (tokens: number, hasVideoInput: boolean) => {
    const price = hasVideoInput ? 28 : 46;
    return (tokens / 1_000_000) * price;
  },
  // 月度费用汇总
  monthlyTotal: (dailyCosts: number[]) => dailyCosts.reduce((a, b) => a + b, 0),
  // 资源包抵扣
  resourcePackageDeduction: (usage: number, packageCapacity: number) =>
    Math.min(usage, packageCapacity),
} as const;
```

---

### 阶段二：Agent 工具封装（核心）

| 任务 | 工具名称 | 功能 |
|------|----------|------|
| 3.2.1 | `get_balance` | 查询账户余额和可用额度 |
| 3.2.2 | `get_bill_details` | 查询账单明细（支持时间范围筛选） |
| 3.2.3 | `get_bill_overview` | 查询账单总览（按产品汇总） |
| 3.2.4 | `get_coupons` | 查询可用代金券 |
| 3.2.5 | `get_resource_packages` | 查询资源包状态 |
| 3.2.6 | `analyze_cost_trend` | 费用趋势分析 |
| 3.2.7 | `estimate_video_cost` | 视频生成成本估算 |
| 3.2.8 | `get_budget_status` | 预算状态查询 |

**工具定义示例**：
```typescript
// 工具定义
const financeTools = [
  {
    name: 'get_balance',
    description: '查询火山引擎账户余额和可用额度信息',
    parameters: { type: 'object', properties: {}, required: [] },
    handler: async () => {
      const client = createBillingClient();
      return await client.queryBalanceAcct();
    },
  },
  {
    name: 'estimate_video_cost',
    description: '根据视频参数估算生成成本',
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: '视频时长（秒）' },
        hasReference: { type: 'boolean', description: '是否有视频参考' },
      },
      required: ['duration'],
    },
    handler: async ({ duration, hasReference }) => {
      const tokens = Math.ceil(duration * 20600); // 约30.888万tokens/15秒
      const price = hasReference ? 28 : 46;
      const cost = (tokens / 1_000_000) * price;
      return {
        estimatedTokens: tokens,
        unitPrice: price,
        estimatedCost: cost,
        currency: 'CNY',
      };
    },
  },
];
```

---

### 阶段三：系统提示词（智能）

| 任务 | 内容 |
|------|------|
| 3.3.1 | 编写财务智能体角色定义 |
| 3.3.2 | 注入价格表和计算公式 |
| 3.3.3 | 添加分析能力指令 |
| 3.3.4 | 添加响应格式规范 |

**提示词片段**：
```
# 财务智能体角色

你是一名专业的火山引擎云服务财务顾问，专门帮助用户管理视频生成服务的成本。

## 核心能力
1. 实时查询账户余额和消费情况
2. 分析视频生成成本构成
3. 预测月度支出趋势
4. 提供成本优化建议

## 价格表（2026-03官方定价）
| 服务类型 | 单价 | 说明 |
|----------|------|------|
| 文生视频 | 46元/百万tokens | 纯生成，成本约1元/秒 |
| 图生视频 | 28元/百万tokens | 有视频参考时 |
| 视频延长 | 28元/百万tokens | 有视频参考时 |

## 计算公式
- 单条成本 = (tokens / 1,000,000) × 单价
- 15秒视频约需 30.888 万 tokens
- 月度费用 = Σ 日费用

## 响应规范
- 涉及费用时，必须给出具体数字和单位
- 提供优化建议时，引用具体的成本数据
- 超预算时，明确指出超支金额和建议
```

---

### 阶段四：前端集成（展示）

| 任务 | 组件 | 功能 |
|------|------|------|
| 3.4.1 | `BalanceCard` | 显示账户余额和可用额度 |
| 3.4.2 | `CostCalculator` | 视频成本估算工具 |
| 3.4.3 | `BillTable` | 账单明细表格 |
| 3.4.4 | `CostTrend` | 费用趋势展示 |
| 3.4.5 | `CouponList` | 代金券列表 |

---

### 阶段五：预算告警（可选）

| 任务 | 内容 | 优先级 |
|------|------|--------|
| 3.5.1 | 配置火山引擎预算 | P2 |
| 3.5.2 | 实现飞书告警通知 | P3 |
| 3.5.3 | 系统内消息通知 | P3 |

---

## 四、执行时间估算

| 阶段 | 任务 | 预估时间 |
|------|------|----------|
| 阶段一 | 数据定义文档 | 1小时 |
| 阶段二 | Agent工具封装 | 2小时 |
| 阶段三 | 系统提示词 | 1小时 |
| 阶段四 | 前端集成 | 2小时 |
| 阶段五 | 预算告警（可选） | 2小时 |
| **总计** | | **8小时** |

---

## 五、风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| API 调用频率限制 | 中 | 添加请求间隔和缓存 |
| 价格变动 | 低 | 价格表可配置化 |
| Token 消耗估算偏差 | 中 | 使用官方实测数据 |

---

## 六、交付物清单

| 交付物 | 文件路径 |
|--------|----------|
| 数据类型定义 | `src/lib/finance-types.ts` |
| 工具封装 | `src/lib/finance-tools.ts` |
| Agent API | `src/app/api/agent/finance/route.ts` |
| 系统提示词 | `src/lib/finance-system-prompt.ts` |
| 前端组件 | `src/components/agent/finance/*` |
| 页面集成 | `src/app/agent/finance/page.tsx` |
| 工作文档 | `WORK_MEMORY/XX-财务Agent实现报告.md` |

---

## 七、待确认事项

- [ ] **预算告警功能**：是否需要？告警渠道（飞书/邮件/系统）？
- [ ] **前端展示优先级**：先实现哪些组件？
- [ ] **费用归属**：是否需要按用户/团队分摊？

---

## 八、下一步行动

确认以上内容后，按阶段执行：

```
阶段一（1小时）→ 阶段二（2小时）→ 阶段三（1小时）→ 阶段四（2小时）
```
