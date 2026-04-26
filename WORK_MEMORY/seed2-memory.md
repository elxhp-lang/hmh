# Seed 2.0 Pro 协作记忆

## 核心角色
- **我（用户代理）**：负责前端开发、用户交互、代码实现
- **Seed 2.0 Pro**：负责 AI 能力评估、架构设计、技术决策

## 当前项目：海盟会 - 多智能体视频生成平台

### 项目概述
基于 Seedance 2.0 模型的多智能体协作视频生成平台

### 技术栈
- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase (PostgreSQL + RLS)
- coze-coding-dev-sdk
- TOS 对象存储

### 核心功能
1. 用户系统（注册、审核、权限）
2. 视频生成（Seedance 2.0 文生视频、图生视频）
3. 智能体系统（创意小海 Agent）
4. 财务管理
5. 学习库（视频学习）
6. 商品图库

## 当前工作进度

### 2025-04-10 最新工作

#### ✅ 已完成
- [2025-04-10] **⭐ 纯 Agent 架构核心文件**
  - `src/lib/tool-types.ts` - 工具类型定义（操作类 + 渲染类）
  - `src/lib/pure-agent-service.ts` - 纯 Agent 核心服务（修复 client.stream 调用）
  - `src/app/pure-agent/page.tsx` - 纯 Agent 前端页面
  - `src/app/api/pure-agent/chat/route.ts` - 纯 Agent API
  - **API 测试通过**：
    - ✅ 基本对话正常
    - ✅ 工具调用正常工作（analyze_video 测试通过）
    - ✅ 流式输出正常

#### 🔄 进行中
- [2025-04-10] 纯 Agent 架构完整测试
- [2025-04-10] 验证前端渲染指令

#### 📋 待办
- [ ] 测试完整工作流（参考视频 → 分析 → 脚本 → 生成）
- [ ] 验证前端 /pure-agent 页面渲染
- [ ] 完善 Seed 2.0 系统提示词
- [ ] 测试脚本选择、用户交互回调

### 2025-04-08 最新工作

#### ✅ 已完成
- [2025-04-08] **⭐ 架构改造：Seed 2.0 是唯一入口**
  - 前端只调用 `/api/xiaohai/agent/chat`
  - 废弃独立 API 调用（quick-generate, video/analyze 等）
  - 所有业务功能通过工具调用执行
  - Agent 返回结构化响应（video_analysis, script_options, task_done 等）
- [2025-04-07] 实现 Agent 模式架构（16 个工具）
- [2025-04-07] 实现首帧图生成功能
- [2025-04-07] 添加协作记忆工具
- [2025-04-07] **JSON 格式问题结论**：不是 SDK 问题，是图片 URL 不可访问

#### 🔄 进行中
- [2025-04-08] 视频上传 Bug 修复
- [2025-04-08] 测试完整工作流

#### 📋 待办
- [x] 实现 3 个新工具（modify_script, save_material, generate_copywriting）
- [x] 更新系统提示词（欢迎语 + 对话策略）
- [x] 添加前端 UI 组件（配文卡片、微调对话框）
- [ ] 测试完整工作流（分析 → 脚本 → 微调 → 生成 → 配文）
- [ ] 首帧图生成前端集成
- [ ] 快速生成模式优化

### 重要决策记录

#### 2025-04-08 与 Seed 2.0 讨论架构（第二轮）

**Seed 2.0 反馈的优化方案**：

1. **generate_copywriting 工具优化**：
   - 新增可选参数：`key_selling_points`（核心卖点）、`script_highlight`（视频亮点）
   - 使用固定 LLM 提示词生成配文
   - 三种风格：亲民种草款、专业干货款、互动引流款
   - 统一结构化返回

2. **对话引导策略**：
   - 场景化引导：发视频后问产品、生成脚本后选风格、生成完成后问配文
   - 工具能力透传：用户提需求时告知对应能力

**已更新**：
- ✅ generate_copywriting 工具已按 Seed 2.0 方案优化
- ✅ 系统提示词已添加对话引导策略
- ✅ 欢迎语已添加

#### 2025-04-08 与 Seed 2.0 讨论架构（第一轮）

**Seed 2.0 确认的实现方案**：

1. **新增 3 个工具**：
   - `modify_script` - 脚本微调
   - `save_material` - 素材保存复用
   - `generate_copywriting` - 配文生成（抖音/小红书/微博）

2. **不开发**：
   - `modify_video_task` - Seedance 2.0 不支持局部修改，用重新生成代替

3. **对话引导策略**：
   - 首次固定欢迎语
   - 后续自主响应，无需固定话术

**已实现**：
- ✅ 3 个新工具已实现
- ✅ 系统提示词已更新

## 2026-04-09 问题发现与修复

### 🔴 严重问题：工具调用失败

#### 问题现象
- admin 用户能生成视频，但 test3、admin2 等其他用户无法调用工具
- AI 返回空的 tool_calls JSON，但工具没有真正执行
- AI 被用户 PUA 后开始否认自己有工具能力

#### 根本原因
1. **工具注册缺失**：`xiaohai-agent-chat` API 只注册了旧版工具，没有注册 `create_workflow`、`generate_script` 等 16 个核心工具
2. **user_id 硬编码**：工作流创建时使用 `"default_user"` 而不是真实用户ID
3. **对话历史污染**：test3 用户多次质疑 AI，导致 AI 形成错误的自我认知

#### 修复措施
1. ✅ 导入完整的 `xiaohai-tools-v2` 工具集（16个工具）
2. ✅ 实现自动注入 userId 机制
3. ✅ 清理 test3 的 18 条被污染对话
4. ✅ 加强系统提示词：明确告诉 AI 不要被用户质疑误导

### 📊 工具注册对比

| 组件 | 修复前 | 修复后 |
|------|--------|--------|
| 系统提示词 | 16个工具描述 | 16个工具描述 |
| API 工具注册 | 旧版工具（缺少核心工具） | 完整 16 个工具 |

### 🔧 修复文件
- `src/app/api/xiaohai/agent/chat/route.ts` - 导入完整工具集
- `src/lib/xiaohai-tools-v2.ts` - 新增 `getAllToolsV2()` 和自动注入 userId
- `src/lib/xiaohai-system-prompt-v2.ts` - 加强核心原则

### 📝 4个笔记本系统状态
| 笔记本 | 表名 | 创建时机 | 状态 |
|--------|------|----------|------|
| 1号 | agent_conversation_messages | 对话时自动 | ✅ 正常 |
| 2号 | creative_user_preferences | 保存偏好时 | ✅ 正常 |
| 3号 | videos | 生成视频时 | ⚠️ 只有admin有记录 |
| 4号 | learning_library | 上传学习视频时 | ✅ 正常（无人上传） |

### ⚠️ 待验证
- [ ] test3 用户是否能正确调用工具
- [ ] admin2 用户是否能正确调用工具
- [ ] 新用户是否能正常创建工作流
