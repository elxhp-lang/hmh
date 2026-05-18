# 性能优化任务表 — 含安全前置条件

> 基于 2026-05-14 全栈质检 + 安全评估（3 Agent 并行审查）
> 总计: 25 项任务 | 预计 5.5 天

---

## 🔴 Step 0: 安全前置（必须先做，0.5天）

| # | 任务 | 文件 | 操作 | 时间 |
|---|------|------|------|------|
| 0.1 | 限制 remotePatterns 白名单 | `next.config.ts:15-22` | 改 `hostname: '*'` → 具体域名：`*.volces.com`, `*.tostoreapi.com`, `*.bytedance.com` | 15min |
| 0.2 | 创建统一 `safeError()` | NEW `src/lib/server/safe-error.ts` | `export function safeError(error, publicMsg?)` — 生产环境返回通用错误+correlationId，开发环境返回详情 | 30min |
| 0.3 | 标记 blob URL 组件保留 `unoptimized` | `video/page.tsx` 等 | 确认 firstFramePreview、lastFramePreview、referenceImages[].preview 等 6 处 blob URL 保留 `unoptimized` | 15min |

---

## 🟢 Tier 1: 立竿见影（安全的本周出手项，1天）

| # | 任务 | 文件 | 操作 | 时间 |
|---|------|------|------|------|
| 1.1 | 会话历史 LIMIT | `api/xiaohai/agent/chat/route.ts:585,1422` | GET 加 `.limit(200)`，content 裁剪 500 字符；LLM 上下文服务端直接用完整 version | 15min |
| 1.2a | LLM fetch 超时 | `lib/generic-llm-client.ts:24,81` | 加 `signal: AbortSignal.timeout(120000)` (流式) / 60000 (同步) | 15min |
| 1.2b | LLM api_url 校验 | `api/models/route.ts:28-30` | POST/PUT 加 URL 校验：拒绝私有IP/localhost/非http协议 | 15min |
| 1.3 | 并行数据请求 | `agent/create/page.tsx:1004-1041` | `fetch(/history)` + `fetch(/learning-library)` → `Promise.all` | 10min |
| 1.4 | PG 查询超时 | `database/supabase-client.ts` | 不用全局 `statement_timeout`，改为在 `queryBuilder.executeSelect()` 中加 `SET LOCAL statement_timeout = '60000'` | 20min |
| 1.5 | 启用图片优化 | 9 个文件 | 删除非 blob URL 组件的 `unoptimized` + 加 `sizes`。blob URL 组件保留 `unoptimized` (0.3 已标记) | 1h |

---

## 🟡 Tier 2: 体验质变（1.5天）

| # | 任务 | 文件 | 操作 | 时间 |
|---|------|------|------|------|
| 2.1 | 统一错误处理 | 所有 `route.ts` 的 catch 块 | 用 `safeError()` 替换 `error.message`。先改 `api-kit.ts` 的 `fail()` 函数为底层入口 | 2h |
| 2.2a | loading.tsx × 15 | `每个路由/loading.tsx` | 新建，骨架屏匹配最终布局（灰色占位块） | 2h |
| 2.2b | error.tsx × 15 | `每个路由/error.tsx` | 新建，路由级错误边界 | 1h |
| 2.3 | 素材分页 | `api/real-assets/route.ts:33` | 加 `?page=1&pageSize=20`，用已有 `toPositiveInt()` 校验 max=100 | 30min |
| 2.4 | 账单列裁剪 | `api/billing/route.ts:51` | `select('*')` → `select('id,user_id,video_id,amount,task_type,created_at')` | 15min |
| 2.5 | 补齐 LIMIT × 7 | `finance-tool-executor.ts:481,514,579,697` `xiaohai-memory-service.ts:156` `script-template-service.ts:114,146` | 每处加 `.limit(100)`，搜索类加 `.limit(50)` | 30min |
| 2.6 | video 页拆 Tab | `video/page.tsx` (1694行) | 提取 5 个独立 Tab 组件 + VideoHistory + TaskCard，`React.memo`。`useEffect` cleanup 杀定时器 | 2h |
| 2.7 | agent 页拆组件 | `agent/create/page.tsx` (2114行) | 提取 ChatArea + SessionSelector + MessageList，`React.memo`。DebugPanel 加 `NODE_ENV !== 'production'` 门禁 | 3h |

---

## 🟠 Tier 3: 架构升级（2天）

| # | 任务 | 文件 | 操作 | 时间 |
|---|------|------|------|------|
| **3.1** | **JWT → httpOnly cookie** | `AuthContext.tsx` + `middleware.ts` + `login/route.ts` + `refresh/route.ts` + `api.ts` | **全栈改动**：① login/refresh 返回 `Set-Cookie` ② middleware 读 cookie 注 header ③ AuthContext 从 localStorage 改为读 `/api/auth/me` 接口 ④跨标签同步从 storage event → cookie change ⑤ `useAuth` 接口不变（透明迁移） | 4h |
| 3.2 | React Query | NEW `providers/query-provider.tsx` + 逐页迁移 | 安装 `@tanstack/react-query`。token 进 queryKey。`logout()` 时 `queryClient.clear()` | 2h |
| 3.3 | 内存缓存 | NEW `lib/cache.ts` | Map + TTL 60s。model-list/tag-defs 全局；ability-profiles per-user。LRU max 500 驱逐 | 1h |
| 3.4 | useUser/useToken | `contexts/AuthContext.tsx` | 从 `useAuth()` 拆出两个独立 hook，共享 `useReducer` 原子状态 | 1h |
| 3.5 | 轮询→SSE | `video/page.tsx:632` `agent/create/page.tsx:1047,1058` | 客户端轮询改 SSE。服务端 `video-generation-poller.ts` 不动。用已有 `streamRequest()` 模式。单连接复用 | 3h |
| 3.6 | API 重试退避 | `generic-llm-client.ts` `seedance-client.ts` | 3 次重试，仅 5xx+429。Seedance `createTask()` 加幂等键。jitter ±25%。失败 3 次后 circuit breaker 30s | 2h |
| 3.7 | 拆分 agent-tools | `lib/tools/` (6 个新文件) | `agent-tools-service.ts` → `video-tools.ts` / `content-tools.ts` / `memory-tools.ts` / `material-tools.ts` + `index.ts` 注册表 | 4h |
| 3.8 | 虚拟滚动 | `material/history/page.tsx` `learning-library/page.tsx` | 安装 `@tanstack/react-virtual`。只渲染可视区节点，其余动态创建/销毁 | 2h |
| 3.9 | Dashboard RSC | `dashboard/page.tsx` | (依赖 3.1) 去掉 `'use client'`，服务端用 `cookies()` 取 token 查 DB。子组件改为展示组件 | 2h |

---

## 依赖关系图

```
Step 0 (安全前置)
├── 0.1 remotePatterns ────────────────────────┐
├── 0.2 safeError() ───────────────────────────┤
└── 0.3 blob URL 标记 ─────────────────────────┤
                                                ▼
Tier 1 ─────────────────────────────────────────┤
├── 1.1 LIMIT ─────────────────────────────────┤
├── 1.2 LLM timeout + url校验 ─────────────────┤
├── 1.3 Promise.all ───────────────────────────┤
├── 1.4 PG timeout ────────────────────────────┤
└── 1.5 图片优化 (需要 0.1 + 0.3) ──────────────┤
                                                ▼
Tier 2 ─────────────────────────────────────────┤
├── 2.1 统一错误 (需要 0.2) ────────────────────┤
├── 2.2 loading.tsx + error.tsx ────────────────┤
├── 2.3 分页 ──────────────────────────────────┤
├── 2.4 列裁剪 ────────────────────────────────┤
├── 2.5 LIMIT 补齐 ────────────────────────────┤
├── 2.6 video 拆 Tab ──────────────────────────┤
└── 2.7 agent 拆组件 ──────────────────────────┤
                                                ▼
Tier 3 ─────────────────────────────────────────┤
├── 3.1 JWT→cookie (阻断性，3.9 依赖此) ────────┤
├── 3.2 React Query ───────────────────────────┤
├── 3.3 内存缓存 ──────────────────────────────┤
├── 3.4 useUser/useToken ──────────────────────┤
├── 3.5 SSE (仅客户端，不依赖 3.1) ────────────┤
├── 3.6 重试退避 ──────────────────────────────┤
├── 3.7 agent-tools 拆分 ──────────────────────┤
├── 3.8 虚拟滚动 ──────────────────────────────┤
└── 3.9 Dashboard RSC (依赖 3.1) ──────────────┘
```

---

## 可并行执行的组

| 并行组 | 任务 | Agent |
|---|---|---|
| **组 A** | 1.1, 1.2a, 1.2b, 1.3, 1.4 | 任意（简单改动） |
| **组 B** | 2.2a, 2.2b (15×2 个文件) | @frontend |
| **组 C** | 2.6, 2.7 (大型重构) | @frontend |
| **组 D** | 3.2, 3.3, 3.4 (基础设施) | @frontend |
| **组 E** | 3.5, 3.6 (传输层) | @backend |
| **组 F** | 3.7, 3.8 (大型重构) | @backend + @frontend 互斥 |
| **阻断** | 3.1 JWT→cookie + 3.9 Dashboard RSC | @backend（必须先 3.1 再 3.9） |

---

## 风险最高的 3 项

| # | 风险 | 缓解 |
|---|------|------|
| **3.1** JWT → cookie | 影响全部登录/认证流程，如果出错所有用户无法登录 | 先在 dev 分支验证，login 保留 localStorage 兼容旧客户端 7 天 |
| **1.5** 图片优化 | SSRF 风险（#5 审计结论：HIGH） | 已前置 0.1 限制 domains。保留 blob URL 的 `unoptimized` |
| **2.1** 统一错误 | 涉及 60+ API 路由，可能漏改或改错 | 先改 `api-kit.ts` 的 `fail()` 为统一入口，逐路由改的是 catch 块用它 |
