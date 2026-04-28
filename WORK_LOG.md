# 工作日志

---

## 2026-04-29 - Worker双轨收尾、契约检查与统一推送

### 工作内容
完成本轮“Worker 驱动双轨 + 全链路一致性修复”的收尾，补齐最小契约检查、业务冒烟清单，并将主仓库成品统一提交推送。

### 为什么做
目标是把“任务状态一致、ID 一致、查询语义一致、学习库链路一致”从代码层推进到可验收层，避免出现“UI显示成功但Agent查询失败”这类业务错判。

### 做了什么
1. **落地最小契约检查脚本**
   - 新增 `scripts/contract-check.ts`
   - 增加 `package.json` 脚本：`pnpm run contract-check`
   - 覆盖检查项：
     - `count/head` 语义
     - `.or()` 过滤语义
     - 学习库 `video_key` 命名空间一致性
   - 在未注入 `DATABASE_URL/PGDATABASE_URL` 场景下输出 `SKIP`，避免阻塞无库终端

2. **补齐验收资产**
   - 新增 `WORK_MEMORY/11-业务冒烟验收清单-2026-04-28.md`
   - 按角色拆分（素材成员/素材组长/财务与管理员）
   - 明确关键一致性断言与失败处理规则

3. **完成代码质量与可构建性确认**
   - `pnpm run ts-check` 通过
   - `pnpm run contract-check` 可执行（当前环境无 DB 时为 `SKIP`）

4. **统一提交与推送**
   - 按“主仓库统一成品推送”要求，执行全量 `git add -A` 并提交
   - 处理网络不稳定导致的 GitHub 443 连接失败，自动重试推送
   - 主仓库最终已成功推送并与 `origin/main` 同步

### 用了什么方法
- 一次性收敛：代码修复 + 契约脚本 + 验收清单 + 提交推送一体化完成
- 失败自动重试：循环 `git push` 直到成功
- 保持业务优先：先确保核心链路语义一致，再补验收与交付文档

### 进行哪些尝试
- 推送初期出现多次 `github.com:443` 连接失败（reset/empty reply/could not connect）
- 通过自动重试在第 4 次推送成功

### 备注
- 主仓库已同步到远端（`main...origin/main` clean）
- 本次“仅主仓库推送”已按要求执行；嵌套仓库未继续推送

---

## 2025-04-09 - 调试日志系统 & 历史消息同步修复

### 工作内容
给 /agent/create 页面添加调试日志系统，并修复历史消息加载后 conversationHistory.current 不同步的问题。

### 为什么做
用户反映无法收到创意小海的最新对话回复，需要添加调试日志帮助定位问题。

### 做了什么

#### 1. 添加调试日志系统
- 创建 `DebugLog` 接口和 `addDebugLog` 函数
- 创建 `DebugPanel` 调试面板组件
- 左下角添加"调试"按钮，点击显示/隐藏面板
- 支持清空日志、导出日志到文件

#### 2. 修复历史消息同步问题
- **问题**：加载历史消息后只更新了 `messages` 状态，没有更新 `conversationHistory.current`
- **修复**：在加载历史消息后，同时更新 `conversationHistory.current`
```typescript
// 🔧 修复：同时更新 conversationHistory.current
const historyForAI = historyData.data.conversationHistory.map((msg: any) => ({
  role: msg.role,
  content: msg.content
}));
conversationHistory.current = historyForAI;
```

#### 3. 添加关键调试日志
- **API 调用**：加载历史消息、发送消息
- **SSE 事件**：收到的事件类型
- **状态更新**：messages、conversationHistory
- **渲染次数**：组件渲染计数

### 用了什么方法
- 直接修改代码
- 添加全局日志数组 + 状态同步更新

### 进行哪些尝试
- 无

### 备注
- 调试面板左下角，点击"调试"按钮可查看
- 控制台也会输出带颜色的调试信息
- 需要用户复现问题后导出日志分析

---

## 2025-04-09 - 修复历史消息 key 重复 & 视频卡片缩略图

### 工作内容
1. 修复历史消息 key 重复问题
2. 修复卡片渲染 key 冲突
3. 实现视频卡片缩略图+弹窗方案

### 为什么做
用户反馈：
1. React 报错 "Encountered two children with the same key"
2. 提交一次生成任务，对话页面出现多个卡片
3. 视频卡片太大，影响继续对话

### 做了什么

#### 1. 添加唯一 ID 生成函数
```typescript
let idCounter = 0;
function generateId(prefix: string = 'msg'): string {
  return `${prefix}_${Date.now()}_${++idCounter}_${Math.random().toString(36).substr(2, 9)}`;
}
```

#### 2. 替换所有 Date.now().toString()
- 用户消息 id
- AI 消息 id
- 流式消息 id
- 所有任务卡片 id

#### 3. 实现视频卡片缩略图+弹窗
- 默认显示 180px 宽的缩略图预览
- 点击缩略图弹出 Dialog 显示大视频
- 添加 Play 和 Maximize2 图标提示用户可点击
- 弹窗包含下载、分享、关闭按钮

### 用了什么方法
- 修改 page.tsx
- 添加 generateId 函数
- 修改 ResultCard 组件

### 进行哪些尝试
- 无

### 备注
- 缩略图模式下，视频静音自动播放，用户可以快速预览
- 点击后弹窗可全屏观看，带控制栏
- 不影响对话继续交流

---

### 工作内容
实现用户消息中心通知功能（方案二），让用户不管在哪个页面都能收到视频生成完成通知。

### 为什么做
方案一只能在页面上等待，方案二让用户离开页面也能收到通知。

### 做了什么

#### 1. 创建数据库表
- 创建 `user_notifications` 表
- 包含字段：user_id, notification_type, title, content, related_video_id, related_video_name, related_video_url, is_read, read_at, action_url, created_at
- 配置 RLS 策略

#### 2. 修改后端轮询服务
- 修改 `/workspace/projects/src/lib/video-generation-poller.ts`
- 添加 `sendUserNotification()` 方法
- 视频生成成功/失败时自动发送通知到 user_notifications 表

#### 3. 创建消息 API
- `GET /api/notifications` - 查询通知列表（支持分页、筛选）
- `POST /api/notifications/read` - 标记已读（支持单个和全部）

#### 4. 修改前端 DashboardLayout
- 侧边栏底部添加消息中心入口
- 未读消息显示小红点
- 点击展开通知列表
- 支持标记已读、查看全部

#### 5. 创建消息列表页面
- `/notifications` - 消息列表页面
- 统计未读数和总数
- 支持全部/未读筛选
- 分页功能

### 用了什么方法
- Supabase 数据库技能
- exec_sql 工具创建表
- 直接修改代码

### 进行哪些尝试
- 无

### 备注
- 轮询服务每30秒检查一次，视频完成后自动发送通知
- 用户可以在任意页面看到消息中心小红点

---

### 工作内容
更新了 AGENTS.md 工作风格文件，新增两个工作原则。

### 为什么做
用户提出的要求，希望我遵守更严谨的工作流程。

### 做了什么
1. **新增 4.1 修改谨慎原则（安全红线）**
   - 仅当代码修改会影响已正常运行的功能时才触发
   - 需要先大白话说明：调整什么、为什么、可能影响什么
   - 等用户确认后再进行修改

2. **新增 4.2 变更追踪原则**
   - 每次调整现有功能时，在代办实现文件中添加追踪描述
   - 修改后必须对被影响的功能进行测试

3. **更新 TODO-notebook-system-v3.md**
   - 添加"问题5：前端轮询通知机制"的追踪记录
   - 记录当前机制的问题和可能的解决方案

### 用了什么方法
- 使用 edit_file 工具直接编辑文件
- 修改前先读取文件确认内容

### 进行哪些尝试
- 无

### 备注
- 用户明确说明：只有当修改会影响已正常运行的功能时才触发确认流程，日常小调整不需要每次都告知

---

## 2025-04-08 - 3号笔记本问题排查

### 工作内容
排查 3号笔记本（videos表）视频生成后没有 seedance_task_id 的问题。

### 为什么做
用户反馈视频生成后没有对应的 task_id，无法查询视频结果，也无法更新到 /material/history 页面。

### 做了什么
1. **发现并修复数据库字段不匹配问题**
   - submitVideoTask 方法保存 seedance_task_id，但数据库只有 task_id 字段
   - 修复：改为保存 task_id 字段

2. **发现并修复轮询服务字段不匹配问题**
   - 轮询服务更新 public_video_url，但数据库只有 result_url 字段
   - 修复：改为更新 result_url 字段

3. **发现并修复轮询服务单例问题**
   - 开发模式下 Next.js 保留模块状态，代码不更新
   - 修复：getVideoPoller 函数在开发环境下每次返回新实例

4. **清理无效视频**
   - 2个没有 seedance_task_id 的视频标记为失败

### 用了什么方法
- 直接查看代码、修改代码
- 修改后验证数据库记录

### 进行哪些尝试
- 多次杀死旧进程、清空 .next 缓存、重新编译
- 多次测试视频生成流程

### 备注
- 旧视频（4月5日-7日）的 URL 已过期，用户表示不需要修复

---

## 2025-04-08 - Turbopack Panic 错误修复

### 工作内容
修复 Turbopack 内部错误，导致服务无法启动。

### 为什么做
服务启动时报错，无法正常使用。

### 做了什么
1. 回滚到 git 历史版本 `88142fa`
2. 杀死重复的进程
3. 重新启动服务

### 用了什么方法
- git 回滚
- 进程管理

### 进行哪些尝试
- 无

### 备注
- 无

---
