# 海盟会 HMH — AI视频创作平台

> 全栈代码通读 + 语义标注 | 2026-05-04

## 系统全景

创意小海 Agent 为核心的跨模块视频创作平台。对话式交互，AI 协调学习库/模板库/素材库/真人库完成 脚本→首帧→视频→配文 完整链。

### 技术栈
Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
DB: Supabase PostgreSQL (火山引擎托管，三环境: LOCAL/DEV/PROD)
AI: coze-coding-dev-sdk (LLMClient + ImageGenerationClient + SeedanceClient)
存储: TOS 对象存储

---

## 核心数据流（理解这个就理解了整个系统）

```
用户发消息 → page.tsx handleSend()
  → POST /api/xiaohai/agent/chat (SSE)
  → ensureCreativeSession (创建/恢复会话)
  → 加载双笔记本 (conversation_history + user_preferences)
  → 加载用户画像 (user_profiles, Phase 1新增)
  → 构建系统提示词 (xiaohai-system-prompt-v3 + 偏好 + 画像)
  → LLM 迭代循环 (max 15轮)
    → LLM 输出文本 → SSE stream 给前端
    → LLM 调工具 → AgentToolsService 执行
      → 同步工具: 结果直回 LLM 循环
      → 异步工具: fire-and-forget → Worker任务状态机 → 轮询回填
  → saveConversationMessage (content 清洗后存 DB)
  → updateConversationMessageParts (parts 回写)
  → taskStateService.saveOutput (task_outputs 表)
```

---

## 关键语义规则

### 工具分类（修改前必读）
- **同步 LLM 调用**: generate_script, analyze_video, analyze_image, analyze_multiple_images
  - 均通过 LLMClient.invoke/stream 调用，结果在同一请求周期返回
  - 历史遗留：这4个被错误归入 LONG_RUNNING_TOOLS，其中 generate_script 确认失效
- **异步外部 API**: submit_video_task, batch_generate
  - 提交到 Seedance API → 轮询回填 → VideoGenerationPoller 每30s检查
- **混合模式**: generate_first_frame
  - 异步执行(SYNC_RESULT_TOOLS) → 结果持久化到 task_items → 前端轮询任务状态获取

### 数据流约定
- parts 写入: emitPart() 先收集 → persistAssistantParts() 统一写入 DB
- content 清洗: cleanMessageContent() 必须在 saveConversationMessage 前调用
- task_outputs 清洗: saveOutput 必须传 cleanedAssistantMessage（不是原始 assistantMessage）
- SSE 事件: 前端不处理 'error' 和 'task' 事件，只处理 'done'/'content'/'message_part' 等

### 数据库约定
- 三环境(LOCAL/DEV/PROD)必须对齐，每次 Schema 变更后执行 compare-db-schema.ts 验证
- 新表迁移通过 supabase/migrations/ 幂等 SQL
- Supabase 客户端是自研兼容层(supabase-client.ts)，不要用原生 Supabase SDK 语法

### 认证约定
- 双 JWT 验证路径: requireAuth (api-kit.ts) / verifyToken (auth.ts) — 两者签名相同但错误处理不同
- Token 刷新: /api/auth/refresh 端点 + api.ts 的 fetchWithAuthRetry 自动重试
- 全局 401 处理: AuthProvider 注册 handler → 清 localStorage → 跳 /login

### 前端状态关键点
- 双状态存储: messages(渲染) + conversationHistory.current(API payload) — 必须同步更新
- SSE 重连: 无自动重连，失败后 setSendError 提示用户手动重试
- 会话持久化: sessionStorage 保存 activeSessionId，刷新后自动恢复
- WorkerTasks 8秒轮询 + 终端状态自动注入系统消息

---

## 关键文件地图

### API 层
- `src/app/api/xiaohai/agent/chat/route.ts` — 创意小海唯一入口 (SSE, ~1250行)
- `src/app/api/xiaohai/agent/sessions/route.ts` — 会话 CRUD
- `src/app/api/xiaohai/agent/tasks/route.ts` — 任务列表 + 重试/取消 + stale清理
- `src/app/api/auth/refresh/route.ts` — Token刷新 (Phase 5 新增)
- `src/app/api/agent/finance/route.ts` — 财务Agent (独立架构，用 FinanceToolExecutor)

### 服务层
- `src/lib/agent-tools-service.ts` — 24个工具的定义+执行 (核心，~2200行)
- `src/lib/server/task-state-service.ts` — Worker任务状态机 (确保/流转/聚合)
- `src/lib/video-generation-poller.ts` — 视频完成后台轮询 (单例，30s间隔)
- `src/lib/seedance-client.ts` — Seedance 2.0 HTTP API 封装
- `src/lib/user-profile-service.ts` — 用户画像 复盘+摘要 (Phase 1 新增)
- `src/lib/script-generator-service.ts` — 脚本生成 (同步LLM，独立prompt)

### 提示词
- `src/lib/xiaohai-system-prompt-v3.ts` — 系统提示词+Seedance最佳实践+连续性引导
- 工具列表声称34个，实际 agent-tools-service 注册24个 (差异在 memory/learning 子类别)

### 数据库
- `src/storage/database/shared/schema.ts` — Drizzle ORM 表定义 (videos/users/billing等)
- `src/storage/database/supabase-client.ts` — 自研 Supabase 兼容客户端
- `supabase/migrations/` — 幂等迁移 SQL

### 前端
- `src/app/agent/create/page.tsx` — 创意小海主页面 (~2000行，核心UI)
- `src/components/agent/MessageBubble.tsx` — 消息气泡+分组
- `src/components/agent/RichMessageContent.tsx` — 富内容渲染 (tables/images/videos/cards)
- `src/components/agent/ActionCards.tsx` — 交互卡片 (ScriptCard/FirstFrameCard/VideoResultCard/TaskProgressCard)
- `src/components/agent/RightSidebar.tsx` — 5标签侧栏
- `src/contexts/AuthContext.tsx` — Auth状态管理 + Token刷新 + 跨标签页同步

---

## 已知语义冲突

| # | 状态 | 冲突 | 位置 |
|---|------|------|------|
| 1 | ✅ 已修复 | generate_script 从 LONG_RUNNING_TOOLS 移除 | route.ts |
| 2 | ✅ 已修复 | analyze_video/image/multi: 异步执行+结果回推LLM+SSE推送+DB持久化 | route.ts void async回调 |
| 3 | ✅ 已修复 | 提示词工具数34→35 | CLAUDE.md |
| 4 | ✅ 已修复 | 前端 error SSE 事件处理 | page.tsx switch |
| 5 | ✅ 已修复 | 前端 task SSE 事件处理 | page.tsx switch |
| 6 | ✅ 已修复 | Script.description 从 content 第一行自动提取 | route.ts:344 |
| 7 | ✅ 已修复 | script_options SSE 附加 currentParts | page.tsx |
| 8 | ✅ 已修复 | get_script_detail 工具不存在 | ActionCards.tsx |

## 审计覆盖维度（2026-05-04 已完成全部50项修复）

1.架构层 2.安全层 3.数据流层 4.前端渲染层 5.认证生命周期 6.运行时韧性 7.环境配置 8.跨用户数据隔离
9.语义层（工具分类/数据流约定/代码理解）
