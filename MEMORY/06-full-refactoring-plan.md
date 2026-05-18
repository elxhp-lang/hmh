# 全栈重构方案 — UI 改造 + MCP 协议 + 性能优化

> 基于 2026-05-14 全栈质检（共 93 项发现）
> 范围: 运行速度 + 交互体验 + 工具架构 + UI 一致性

---

## 一、现状诊断

### 工具架构
```
当前: LLM → 自定义 JSON → route.ts → 硬编码 switch → 类方法（同进程函数调用）
问题: 工具错误崩溃整个路由 / 无法独立测试 / 无法跨进程部署 / 换 LLM 需重写适配层
```

### UI 状态
```
15 个路由: 0 个 loading.tsx, 0 个路由级 error.tsx
2 个巨型页面: video(1694行) / agent/create(2114行)
交互问题: alert() 报错 / 原生无样式 input / 硬编码颜色 / emoji 替代图标
```

---

## 二、MCP 协议改造

### 目标架构

```
chat/route.ts → 只做 LLM 通信 + MCP Client（JSON-RPC）
                    │
     ┌──────────────┼──────────────┬──────────────┐
     ▼              ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ video-  │  │ content-│  │ memory- │  │ material│
│ gen     │  │ search  │  │ evolution│ │ studio  │
│ Server  │  │ Server  │  │ Server  │  │ Server  │
├─────────┤  ├─────────┤  ├─────────┤  ├─────────┤
│ submit  │  │ search  │  │ saveMem │  │ saveMat │
│ query   │  │ webSrch │  │ getMem  │  │ delMat  │
│ batch   │  │ analyze │  │ record  │  │ genScrpt│
│ getTmpl │  │ getLib  │  │ getPref │  │ copywrt │
└─────────┘  └─────────┘  └─────────┘  └─────────┘

finance MCP Server（17 工具，已有独立类，迁入最快）
```

### MCP Server 分组（5 个）

| Server | 包含工具（从 agent-tools-service.ts 拆出） |
|---|---|
| **video-gen** | submit_video_task, query_task_status, batch_generate, get_templates, get_template, create_template |
| **content-search** | search_product, get_learning_library, search_learning_library, sync_to_library, analyze_video, analyze_image, webSearch |
| **memory-evolution** | saveUserMemory, getUserMemories, searchUserMemories, recordLearning, getLearningRecords, get_user_preference, save_user_preference |
| **material-studio** | save_material, delete_material, update_material, get_materials, generate_script, modify_script, generate_copywriting, generate_first_frame |
| **finance** | 现有 FinanceToolExecutor 的 17 个工具 |

### 渐进策略

| Phase | 内容 | 开发中断 |
|---|---|---|
| 1 | 建 `src/mcp/` 框架（McpServer 基类 + McpClient），route.ts 加开关 `USE_MCP=false` | 零中断 |
| 2 | finance Server 先行验证（最独立，17 工具无耦合） | 断开 finance 部分 |
| 3 | 逐 Server 迁移，每次验证功能不变 | 逐模块 |
| 4 | video-gen Server 可选独立 GPU 部署（SSE transport） | 零中断 |

### 不改的东西
- 工具业务逻辑不重写（只加协议适配层）
- SSE 传输给前端保持不变
- Tool 输入输出参数不变
- LLM 调用流程不变

---

## 三、UI 改造方案

### 层面 1：补基础设施

| 当前问题 | 改法 | 涉及 |
|---|---|---|
| 0 个 loading.tsx | 每路由新建，骨架屏匹配最终布局 | 15 个路由 |
| 0 个路由级 error.tsx | 每路由新建，错误不退回根级 | 15 个路由 |
| `alert()` 报错 | 全局换 `sonner` toast | video, learning-library |
| `not-found.tsx` 重复 `<html>/<body>` | 修复 | app/not-found.tsx |
| 硬编码色 `bg-[#1E40AF]` `bg-[#0F172A]` | 替换为 `bg-primary` `bg-sidebar` CSS 变量 | 全局 |

### 层面 2：统一交互模式

| 当前问题 | 改法 | 涉及 |
|---|---|---|
| 原生 `<input type="range">` | 换 shadcn `Slider` | billing, video |
| `<details>/<summary>` | 换 shadcn `Collapsible` | billing |
| emoji 平台徽标 (⚡📺📕🐦) | 换 `lucide-react` 图标 | learning-library |
| 价格硬编码前端 | 抽 `/api/pricing` 接口 | billing |
| 部分页面原始 `fetch()` | 统一 `useApi` hook | settings/models, learning-library |

### 层面 3：页面重构

| 页面 | 当前 | 改后 |
|---|---|---|
| `video/page.tsx` (1694行) | 1 文件含 5 个 Tab + 历史 + 任务卡片 | 5 个独立 Tab 组件 + VideoHistory + TaskCard，React.memo |
| `agent/create/page.tsx` (2114行) | 1 文件含聊天 + 侧栏 + 调试面板 | ChatArea + RightSidebar + DebugPanel + SSEProvider，React.memo |
| `dashboard/` (63行) | 纯客户端 | **首个 RSC 页面**——服务端直查 DB 渲染 HTML |
| `billing/` | 价格硬编码 + 原生 slider | 统一 Slider + 价格从 API 拉 |

### 层面 4：视觉统一

```
当前 → 改后:

侧边栏:    bg-[#0F172A]           →  bg-sidebar (CSS变量)
Active:    bg-[#1E40AF]           →  bg-primary (CSS变量)
欢迎页:    amber/orange 渐变       →  blue 主题渐变
学习库:    emoji 图标             →  lucide-react 全替换
定价:      原生 range             →  shadcn Slider
Hero:      仅 Dashboard 有        →  每个主要页面统一 header
```

---

## 四、性能优化方案（摘要，详见 05-performance-optimization-plan.md）

### Tier 1（本周）
1. chat/route.ts 会话历史加 LIMIT 200 + 内容裁剪
2. generic-llm-client.ts 加 AbortSignal.timeout
3. supabase-client.ts Pool 加 statement_timeout
4. agent/create 历史+素材改 Promise.all 并行
5. 移除所有 next/image 的 unoptimized

### Tier 2（本周-下周）
6. 15 路由加 loading.tsx 骨架屏
7. API 错误隐藏详情
8. real-assets 加分页
9. billing 列裁剪
10. video 页拆 Tab
11. agent/create 页拆组件
12. 7 个无 LIMIT 查询补齐

### Tier 3（下月）
13. React Query 引入
14. 高频数据加内存缓存
15. 长列表虚拟滚动
16. Dashboard → RSC 先行
17. 轮询 → SSE 替换
18. AuthContext 拆分
19. LLM/Seedance 加重试
20. agent-tools-service → 按领域拆

---

## 五、统一路线图

```
Phase 1 — 安全 + 交互补丁 (1周)
├── middleware 统一 JWT
├── 全局 sonner toast 替换 alert()
├── 15 个 loading.tsx + error.tsx
├── 颜色硬编码替换为 CSS 变量
├── 7 个无 LIMIT 查询补齐
├── 密钥集中管理（移除硬编码后备）
└── 生产环境错误信息隐藏

Phase 2 — 工具 MCP 化 + 页面拆分 (2周)
├── 建 src/mcp/ 框架（McpServer + McpClient）
├── finance MCP Server 先行验证
├── 其余 4 个 Server 逐步迁移
├── video/page.tsx 拆 5 个 Tab 组件
├── agent/create/page.tsx 拆 3 区域
├── 统一交互组件（Slider/Collapsible/图标）
├── 价格数据接口化
└── unbundled next/image → 启用优化

Phase 3 — RSC 渐进 + 全栈化 (2周)
├── dashboard → 首个 RSC 页面
├── learning-library / product-library → 混合（RSC + 客户端搜索）
├── React Query 引入
├── AuthContext 拆分（useUser/useToken）
├── 轮询 → SSE 替换
├── 类型从 schema.ts 统一导出（消除重复定义）
└── 内存缓存层引入

Phase 4 — 长期优化
├── video-gen MCP Server 可选独立 GPU 部署
├── material/history 虚拟滚动
├── migration 文件补全（3 张缺失的表）
├── patterns-cache 补充 P011-P017 (7 条新规则)
└── agent-tools-service.ts 按领域拆分完成
```

---

## 六、新增全局规则（待 /handoff 固化为 patterns-cache）

| ID | 规则 | 触发 |
|----|------|------|
| P011 | `next/image` 使用 `unoptimized` 属性 | warn |
| P012 | `fetch()` 无 `AbortSignal.timeout` | warn |
| P013 | Next.js 路由缺少 `loading.tsx` | warn |
| P014 | `.select('*')` 对 > 10 列表（升级 P002） | error |
| P015 | `.select(...)` 无 `.limit()` | warn |
| P016 | 多个 `await fetch()` 串行（可并行） | warn |
| P017 | `new Pool()` 无 `statement_timeout` | error |
