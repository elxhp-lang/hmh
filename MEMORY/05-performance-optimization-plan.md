# 性能优化方案 — 运行速度 + 交互体验

> 基于 2026-05-14 全栈质检（@architect + @security-reviewer + @boundary-checker + @backend 并行审计）
> 状态: 方案已确认，待执行

---

## 当前性能画像

| 指标 | 现状 | 目标 |
|---|---|---|
| 首次内容绘制 (FCP) | ~5-8 秒 | <1.5 秒 |
| 布局偏移 (CLS) | 200-600ms | ~0 |
| 客户端 JS 体积 | ~4-6 MB | <1 MB |
| 服务端渲染率 | 0% (全 CSR) | 80%+ |
| API 响应（会话历史） | 400KB-1MB | <30KB |
| LLM 调用超时 | 无硬超时 | 60s |
| 缓存命中率 | ~2% | 60%+ |

---

## Tier 1: 立竿见影（本周，每个改动 < 1 小时）

### 1. chat/route.ts 会话历史加 LIMIT + 内容裁剪

**文件**: `src/app/api/xiaohai/agent/chat/route.ts:585,1422`

**问题**: GET 处理返回会话的**全部**消息，`select('*')` 无 LIMIT。200 条消息的会话 = 400KB~1MB JSON。

**修复**:
- GET 返回加 `.limit(200)`，对 content 字段只返前 500 字符
- LLM 上下文的完整消息在服务端本地构建，不返回给前端
- 效果: API 响应 1MB → ~30KB (97%↓)

### 2. generic-llm-client.ts 加超时

**文件**: `src/lib/generic-llm-client.ts:24,81`

**问题**: `fetch(apiUrl, { ... })` 无 `AbortSignal`。LLM 服务挂起时，请求无限期等待，占用 Node.js 线程。

**修复**: 添加 `signal: AbortSignal.timeout(120000)` (2 分钟) 给流式请求，60 秒给同步请求
- 效果: 消除最常见的静默挂起故障

### 3. supabase-client.ts Pool 加 statement_timeout

**文件**: `src/storage/database/supabase-client.ts`

**问题**: PG Pool 无 `statement_timeout`。一条慢查询（如无 LIMIT 的 SELECT * 扫 5 万行）会永久占用连接，直到堵死全部 20 个 pool 连接。

**修复**: 在 `pool.on('connect')` 中设置 `SET statement_timeout = '30000'` (30 秒)
- 效果: 慢查询 30 秒后自动中止，释放连接给其他请求

### 4. agent/create 历史+素材改为 Promise.all

**文件**: `src/app/agent/create/page.tsx:1004-1041`

**问题**: 历史记录和素材资料两个独立的 fetch 是**串行**执行。第 2 个请求白等第 1 个完成。

**修复**: 改为 `const [historyRes, materialsRes] = await Promise.all([fetch('/api/material/history?...'), fetch('/api/learning-library?...')])`
- 效果: 页面数据加载时间减半

### 5. 移除所有 next/image 的 unoptimized 属性

**文件**: `video/page.tsx`, `agent/RightSidebar.tsx` 等 9 个文件

**问题**: 所有 `NextImage` 都带了 `unoptimized` 属性，完全禁用了 Next.js 的图片优化（自动 WebP 转换、尺寸裁剪、懒加载）。一张 320×160 的预览图可能高达 2MB。

**修复**: 删除 `unoptimized` 属性，添加 `sizes` 属性
- 效果: 图片带宽降 80% (2MB → 30KB)

---

## Tier 2: 体验质变（本周-下周）

### 6. 15 个路由全部加 loading.tsx

**文件**: 每个路由目录下新建 `loading.tsx`

**问题**: 当前项目**零个** loading.tsx。页面跳转时用户看到白屏/旋转图标，然后内容突然出现（CLS 200-600ms）。

**修复**: 为每个路由创建 `loading.tsx`，渲染骨架屏（与最终布局匹配的灰色占位块）
- 效果: CLS → 0，用户感知加载速度快 2-3 倍

### 7. API 错误响应隐藏详情

**文件**: 所有 route.ts 的 catch 块

**问题**: 多数路由直接返回 `error.message`，包含 DB 列名、文件路径、SQL 错误等敏感内部信息。

**修复**: 生产环境统一返回 `{ error: "操作失败", code: "INTERNAL_ERROR" }`，详细错误仅写服务端日志
- 效果: 安全提升 + 用户体验不打折扣

### 8. real-assets/route.ts 加分页

**文件**: `src/app/api/real-assets/route.ts:33`

**问题**: 当前返回全部素材，无 LIMIT、无分页。用户素材过百条时响应体积失控。

**修复**: 添加 `?page=1&pageSize=20` 参数，客户端分页加载
- 效果: 列表响应固定 < 50KB

### 9. billing/route.ts 列裁剪

**文件**: `src/app/api/billing/route.ts:51`

**问题**: 已有分页（range），但仍查全部 11 列，包括 TEXT 类型的 `description`（列表页不展示）。

**修复**: 改为 `.select('id,user_id,video_id,amount,task_type,created_at', { count: 'exact' })`
- 效果: 账单查询数据量降 50%

### 10. video/page.tsx 拆 Tab 为独立 memo 组件

**文件**: `src/app/video/page.tsx`

**问题**: 1694 行单一组件，50+ 个 useState。在文本 Tab 输入一个字，会触发全部 5 个 Tab 和视频历史重新渲染。

**修复**: 提取 `TextToVideoTab`、`ImageToVideoTab` 等为独立组件，包 `React.memo`
- 效果: Tab 切换不再触发无关组件的渲染

### 11. agent/create/page.tsx 拆分子组件

**文件**: `src/app/agent/create/page.tsx`

**问题**: 2114 行单体组件，30+ useState。ChatArea / SessionSelector / MessageList / DebugPanel 全部耦合在一起。

**修复**: 提取为独立组件，用 `React.memo` 包裹。状态按组件内聚
- 效果: 可维护性 + 性能双重提升

### 12. 7 个无 LIMIT 查询补齐

**文件**: `finance-tool-executor.ts`, `xiaohai-memory-service.ts`, `script-template-service.ts` 等

**问题**: 7 处查询完全没有 LIMIT。随着用户数据增长，这些查询会逐渐变慢并最终超时。

**修复**: 每处加 `.limit(100)`
- 效果: 防止数据增长导致的性能退化

---

## Tier 3: 架构升级（下个月）

### 13. 引入 React Query

**库**: `@tanstack/react-query`

**作用**:
- 自动去重: 多个组件请求同一数据只发一次网络请求
- 自动缓存: 已获取的数据在 5 分钟内不重复请求
- 后台刷新: 用户切换 Tab 回来后自动拉最新数据
- 消除冗余 fetch: agent/create 中两处重复获取会话列表的 bug 自然消失

### 14. 高频数据加内存缓存

**对象**: 模型列表、标签定义、能力档案

**现状**: 每次请求都查 DB。模型列表和标签定义极少变化（管理员操作，< 1 次/天），但被高频读取（每次打开页面、每次 agent 会话初始化）。

**方案**: 简单的内存 Map + TTL (60s)，写入时主动废除缓存
- 效果: 缓存命中率从 2% → 60%+

### 15. 长列表虚拟滚动

**库**: `@tanstack/react-virtual`

**适用**: `material/history/` (1602 行，500+ 素材)、`learning-library/` (921 行)

**问题**: 当前渲染所有 DOM 节点。500 条素材 = 10,000+ DOM 节点，在移动设备上卡顿明显。

**方案**: 只渲染可视区域内的 10-20 个节点，其余动态创建/销毁
- 效果: DOM 节点从 10,000+ → ~50，滚动 60fps

### 16. Dashboard 转 RSC（服务器组件）

**文件**: 从 `src/app/dashboard/page.tsx` 开始

**现状**: 全部 18 个页面都是 `'use client'`（客户端组件）。这意味着浏览器需要下载全部 JS、水合 React、再发 API 请求才能渲染任何内容。

**RSC 替代方案**:
- 服务器端渲染数据（数据库直连，无 API 往返）
- 仅交互部分（按钮、表单）留在客户端
- 首屏 HTML 直接返回，无需 JS 即可看到内容
- 效果: TTFB 从 5s → <0.5s

### 17. 轮询换 SSE

**适用**: agent/create 的 workerTasks 轮询（每 8 秒）、video/page 的视频生成轮询（每 5 秒）

**问题**: 4 个独立定时器同时跑，即使空闲也持续发请求。浏览器 15 秒不活跃后还会节流定时器。

**SSE (Server-Sent Events) 方案**:
- 服务端保持一个 HTTP 连接，有状态变化时主动推送
- 无任务时不发数据，零开销
- 不需要 WebSocket 的复杂性
- 效果: 网络请求减少 90%，状态更新即时

### 18. AuthContext 拆分选择器

**文件**: `src/contexts/AuthContext.tsx`

**问题**: AuthProvider 包裹整个应用。token 刷新时，所有子组件（包括不关心 auth 的纯展示组件）全部重新渲染。

**修复**: 拆分为 `useUser()`、`useToken()`，需要什么订阅什么。不需要 auth 的组件不订阅。
- 效果: token 刷新不再触发全页面重新渲染

### 19. LLM/Seedance 调用加指数退避重试

**文件**: `seedance-client.ts`, `generic-llm-client.ts`

**问题**: 外部 API 的瞬时网络错误（429 限流、502 网关错误、503 服务不可用）直接导致任务失败。视频生成任务花钱又耗时，一次网络抖动全白费。

**方案**: 3 次重试，间隔 1秒/2秒/4秒（指数退避）。仅对 5xx 和 429 重试，4xx 不重试
- 效果: 瞬时故障恢复率 > 95%

### 20. agent-tools-service.ts 按领域拆分

**文件**: `src/lib/agent-tools-service.ts` (2857 行)

**问题**: 所有 agent 工具（视频、图片、学习、素材、记忆、产品）都在这一个文件里。任何领域的功能添加都要改这个文件。测试无法隔离。

**方案**: 拆分为 `VideoToolsService`、`ImageToolsService`、`MaterialToolsService`、`LearningToolsService`、`ProductToolsService`、`MemoryToolsService`。每个 < 500 行，通过接口通信。
- 效果: 可维护性 + 可测试性 + 并发开发

---

## 预期效果一览

| 阶段 | 改动数 | FCP | CLS | JS 体积 | API 带宽 |
|---|---|---|---|---|---|
| 当前 | - | 5-8s | 200-600ms | 4-6MB | 基准 |
| Tier 1 | 5 | 2-3s | ~100ms | 3-4MB | -60% |
| Tier 2 | 7 | 1-2s | ~0ms | 2-3MB | -75% |
| Tier 3 | 8 | <1s | 0ms | <1MB | -85% |
