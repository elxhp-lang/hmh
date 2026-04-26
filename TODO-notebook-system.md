# 笔记本系统 - 完整实现任务清单

**创建时间**: 2025-04-10
**项目**: 海盟会 - 笔记本系统
**状态**: 进行中
**激活语**: 笔记本系统

---

## 📚 系统设计理念（备注）

### 四个笔记本的定义与作用

| 笔记本编号 | 名称 | 数据表 | 定义 | 作用 | 保留时长 |
|----------|------|--------|------|------|---------|
| 1号 | 对话历史 | `agent_conversation_messages` | 记录用户与创意小海的完整对话历史 | 短期记忆，24小时内回溯对话上下文 | 24小时自动清理 |
| 2号 | 用户偏好 | `creative_user_preferences` | 记录用户的创作偏好（风格、时长、比例、行业等） | 长期记忆，创意小海自动读取并应用于后续创作 | 永久保存 |
| 3号 | 结果笔记本 | `videos` | 记录所有生成的视频及其创作信息 | 用户历史成果管理，可查看、下载、存到学习库 | 永久保存 |
| 4号 | 学习库 | `learning_library` | 记录用户认为优秀的视频，供创意小海学习参考 | 创意小海自动学习用户上传的优秀视频，提升创作质量 | 永久保存 |

---

### 系统设计理念

1. **双记忆系统**：短期记忆（1号）+ 长期记忆（2号）分离
   - 短期记忆：对话历史，24小时清理，避免上下文过长
   - 长期记忆：用户偏好，永久保存，持续学习用户习惯

2. **双成果系统**：结果笔记本（3号）+ 学习库（4号）分离
   - 结果笔记本：所有生成的视频，用户管理自己的成果
   - 学习库：用户筛选的优秀视频，创意小海学习参考

3. **用户隔离原则**：所有表都有 `user_id` 字段，确保用户数据完全隔离
   - 用户只能看到自己的数据
   - 团队/管理员视图通过角色隔离实现

4. **ID职责分离**：
   - `video_id`：我们系统生成（UUID v4），作为主键，用于前端展示、查询、存到学习库
   - `seedance_task_id`：Seedance 生成，仅用于后端轮询查询进度

5. **URL简化原则**：
   - 只用公开永久 URL（`public_video_url`），播放、学习、下载都用它
   - 预签名 URL 暂时不用，等以后有私密视频需求再加

---

### 对应前端页面与UI作用

| 页面路径 | UI功能 | 作用 | 后端支撑 |
|---------|--------|------|---------|
| `/agent/create` | 创意小海对话页面 | 用户与创意小海交互，生成视频 | `/api/xiaohai/agent/chat` |
| `/material/history` | 结果笔记本页面（3号） | 用户查看、管理、下载自己生成的视频，存到学习库 | `/api/material/history` |
| `/learning-library` | 学习库页面（4号） | 用户管理学习库中的优秀视频，创意小海自动学习参考 | `/api/learning-library` |

---

### `/material/history` 页面UI功能详解

| UI功能 | 作用 | 后端支撑 |
|--------|------|---------|
| 搜索框 | 关键词搜索视频（按视频名、标签、描述等） | `/api/material/history?keyword=xxx` |
| 筛选标签 | 按视频分类筛选（开箱/测评/参数科普/热点解读） | `/api/material/history?category=xxx` |
| 视频卡片 | 展示视频缩略图、标签、创建时间、创建者 | `videos` 表字段 |
| 「来源于 @username」 | 团队/全部视图时显示创建者用户名 | `videos.user_id` 关联 `users` 表 |
| 「查看创作详情」按钮 | 弹窗显示脚本、提示词、配文等创作信息 | `videos.script`/`prompt`/`copywriting` 字段 |
| 「存到学习库」按钮 | 将视频同步到4号笔记本（学习库），供创意小海学习 | 创意小海工具 `sync_to_library` |
| 「新生成」小红点 | 标识1小时内新生成的视频 | `videos.created_at` 字段 |
| 「下载」按钮 | 直接下载视频文件 | `videos.public_video_url` 字段 |

---

## ⚠️ 重要说明

1. **激活语**: 当用户说"笔记本系统"时，必须检查本文件的任务完成状态并汇报
2. **持久化**: 本文件保存在 `/workspace/projects/TODO-notebook-system.md`，不会因会话结束或重启丢失
3. **完整方案**: 本任务清单基于完整的笔记本系统设计方案，100%无遗漏、无断点、无空设计
4. **创意小海协作**: 创意小海参与整个流程，包括生成创作信息、接收回调信号、同步到学习库等

---

## 📋 完整任务清单

---

### 第一部分：数据库层

#### 任务 1: 安装 `uuid` 库

**描述**: 
安装 UUID 库，用于生成 `video_id`。

**详细步骤**:
1. 执行 `pnpm add uuid @types/uuid`
2. 确认安装成功

**验收标准**:
- `package.json` 中包含 `uuid` 依赖
- 可以在代码中导入使用

**依赖**: pnpm 包管理器

---

#### 任务 2: 增强 `videos` 表字段

**描述**: 
在数据库 schema 中增强 `videos` 表，添加笔记本系统需要的字段。

**详细步骤**:
1. 编辑 `src/storage/database/shared/schema.ts`
2. 在 `videos` 表中新增字段：
   - `video_id` (uuid, primary key) - 我们系统生成的视频ID
   - `seedance_task_id` (varchar) - Seedance 返回的任务ID（仅用于查询进度）
   - `tags` (jsonb) - 视频标签数组
   - `category` (varchar) - 视频分类（开箱/测评/参数科普/热点解读）
   - `script` (text) - 视频脚本
   - `prompt` (text) - 视频生成提示词
   - `copywriting` (text) - 视频配文
   - `public_video_url` (varchar) - 公开永久URL
   - `error_reason` (text) - 生成失败原因（创意小海建议）

**验收标准**:
- schema 文件包含所有新字段
- 字段类型和约束正确

**依赖**: Supabase 数据库 schema

---

### 第二部分：后端层

#### 任务 3: 修改 `submit_video_task` 工具

**描述**: 
修改 `agent-tools-service.ts` 中的 `submit_video_task` 工具，实现：
1. 工具内部生成 `video_id`（UUID v4）
2. 调用 Seedance API 获取 `seedance_task_id`
3. 一次性写入 `videos` 表（所有字段）
4. 返回 `{video_id, seedance_task_id, status}` 给创意小海

**详细步骤**:
1. 在 `src/lib/agent-tools-service.ts` 顶部导入 `uuid`：`import { v4 as uuidv4 } from 'uuid';`
2. 修改 `submit_video_task` 方法：
   - 生成 `video_id = uuidv4()`
   - 调用 Seedance API 获取 `seedance_task_id`
   - 同时写入所有字段到 `videos` 表（`video_id`、`seedance_task_id`、`user_id`、`status='pending'`、`script`、`prompt`、`copywriting`、`tags`、`category`、`created_at`）
   - 返回 `{video_id, seedance_task_id, status: 'submitted', message: '视频任务已提交'}`

**验收标准**:
- 工具能正常被创意小海调用
- `videos` 表正确写入所有字段
- 返回值包含 `video_id` 和 `seedance_task_id`

**依赖**: Supabase 数据库、Seedance API、uuid 库

---

#### 任务 4: 新增后端轮询服务

**描述**: 
创建 `video-generation-poller.ts`，实现：
1. 定时扫描 `videos` 表 `status=pending/processing` 的记录
2. 拿着 `seedance_task_id` 查询 Seedance 进度
3. 生成成功：下载 Seedance 临时 URL，上传 TOS，获取 `public_video_url`，更新 `videos` 表 `status=completed`
4. 生成失败：从 Seedance 获取失败原因，更新 `videos` 表 `status=failed`+`error_reason`
5. 调用回调 API 给创意小海发信号

**详细步骤**:
1. 创建 `src/lib/video-generation-poller.ts`
2. 实现轮询逻辑：
   - 定时扫描（比如每30秒）
   - 查询 `videos` 表 `where status in ('pending', 'processing')`
   - 对每条记录，拿着 `seedance_task_id` 调用 Seedance API 查询进度
   - 如果成功：调用 TOS 上传服务上传视频，更新 `videos` 表 `status='completed'`+`public_video_url`
   - 如果失败：更新 `videos` 表 `status='failed'`+`error_reason`
   - 调用回调 API `/api/video-callback`，发送信号：`{video_id, status, public_video_url, error_reason}`

**验收标准**:
- 轮询服务能正常启动和运行
- 能正确查询 Seedance 进度
- 能正确更新 `videos` 表
- 能正确调用回调 API

**依赖**: Seedance API、TOS 上传服务、回调 API

---

#### 任务 5: 新增 TOS 上传服务

**描述**: 
创建 `tos-video-saver.ts`，实现：
1. 下载 Seedance 临时 URL
2. 上传到 TOS 对象存储
3. 返回公开永久 URL（`public_video_url`）

**详细步骤**:
1. 创建 `src/lib/tos-video-saver.ts`
2. 实现上传逻辑：
   - 接收 Seedance 临时 URL 作为输入
   - 下载视频文件到临时目录
   - 上传到 TOS（路径：`users/{user_id}/videos/video_{video_id}.mp4`）
   - 设置公开读权限
   - 返回公开永久 URL

**验收标准**:
- 能正常下载 Seedance 临时 URL
- 能正常上传到 TOS
- 返回的公开 URL 能正常访问

**依赖**: TOS 对象存储、Seedance 临时 URL

---

#### 任务 6: 新增回调通知 API

**描述**: 
创建 `/api/video-callback/route.ts`，实现：
1. 接收轮询服务的回调信号
2. 触发创意小海通知用户
3. 信号包含：`video_id`、`status`、`public_video_url`、`error_reason`

**详细步骤**:
1. 创建 `src/app/api/video-callback/route.ts`
2. 实现 POST 接口：
   - 接收回调信号：`{video_id, status, public_video_url, error_reason}`
   - 查询 `videos` 表获取完整信息
   - 触发创意小海通知用户（可选，通过另一个机制）
   - 返回 `{success: true}`

**验收标准**:
- API 能正常接收回调信号
- 能正确查询 `videos` 表
- 返回正确的响应

**依赖**: Supabase 数据库、创意小海通知机制

---

#### 任务 7: 简化权限逻辑

**描述**: 
修改 `/api/material/history/route.ts`，实现双隔离：
1. 用户隔离（基础）：`where user_id = current_user_id`
2. 角色隔离（视图切换）：支持团队/全部视图
3. 支持关键词搜索、按 category 筛选

**详细步骤**:
1. 编辑 `src/app/api/material/history/route.ts`
2. 简化权限逻辑：
   - 基础查询：`where user_id = current_user_id`
   - 支持角色隔离（根据用户角色决定是否能看团队/全部数据）
   - 支持关键词搜索：`where (title ilike '%keyword%' or description ilike '%keyword%')`
   - 支持按 category 筛选：`where category = 'xxx'`
3. 返回视频列表

**验收标准**:
- 用户只能看到自己的数据（用户隔离）
- 支持关键词搜索
- 支持按 category 筛选

**依赖**: Supabase 数据库、JWT 认证

---

### 第三部分：前端层（UI 增强）

#### 任务 8: 增强 `/material/history` 页面 UI

**描述**: 
增强 `/material/history/page.tsx`，添加所有 UI 功能：
1. 搜索框
2. 筛选标签（开箱/测评/参数科普/热点解读）
3. 显示视频标签
4. 显示「来源于 @username」
5. 「查看创作详情」按钮
6. 「存到学习库」按钮（点完弹1秒提示）
7. 「新生成」小红点
8. 「下载」按钮

**详细步骤**:
1. 编辑 `src/app/material/history/page.tsx`
2. 添加搜索框组件：
   - 顶部搜索框，支持输入关键词
   - 输入后自动触发搜索
3. 添加筛选标签组件：
   - 一排筛选标签：开箱/测评/参数科普/热点解读
   - 点击标签筛选对应分类的视频
4. 视频卡片增强：
   - 显示视频标签（`tags` 字段）
   - 显示「来源于 @username」（团队/全部视图时）
   - 显示「新生成」小红点（`created_at` 在1小时内）
5. 添加「查看创作详情」按钮：
   - 点按钮弹出窗口
   - 显示 `script`/`prompt`/`copywriting` 字段
6. 添加「存到学习库」按钮：
   - 点按钮给创意小海发信号：`{user_id, video_id, action: "sync_to_library"}`
   - 前端弹1秒提示："已同步到你的学习库，后续生成内容会参考这个风格"
7. 添加「下载」按钮：
   - 点按钮直接下载 `public_video_url`

**验收标准**:
- 所有 UI 功能都能正常显示和交互
- 搜索功能正常工作
- 筛选功能正常工作
- 「查看创作详情」弹窗正常显示
- 「存到学习库」按钮能正常发信号并弹提示
- 「下载」按钮能正常下载视频

**依赖**: `/api/material/history` API、创意小海对话 API

---

## 📝 备注

- 本任务清单基于完整的笔记本系统设计方案，100%无遗漏、无断点、无空设计
- 每个字段都有对应的生成环节
- 每个UI功能都有对应的后端支撑
- 创意小海参与整个流程
- 用户隔离保证（所有表都有 `user_id` 字段）

---

**创建者**: 通用网页搭建专家
**最后更新**: 2025-04-10

---

## 🛠️ 新增修复任务（2025-04-10）

### 修复任务1：新增 `video_name` 字段，解决多任务对应问题

**为了解决什么问题**：
- 用户让创意小海同时生成多个视频时，创意小海不知道哪个 `video_id` 对应哪个视频
- 因为 `video_id` 是工具内部生成的 UUID，创意小海没有参与生成过程

**设计理念**：
- 方案1为主：创意小海在调用工具时传 `video_name`，工具保存到3号笔记本，后来通知时一起带回来
- 方案2为辅：创意小海自己也记录一下，建立映射表
- 双重保险，绝对不会搞混
- 系统只存不传、不硬编码控制AI，创意小海自己决定怎么处理

**详细步骤**：
1. 给3号笔记本（videos 表）新增 `video_name` 字段
2. 修改 `submit_video_task` 工具，接收并保存 `video_name`
3. 轮询服务发通知时，把 `video_name` 一起带回来

---

### 修复任务2：修复回调通知机制，真正通知创意小海

**为了解决什么问题**：
- 之前的回调 API 只是记录日志，没有真正通知创意小海
- 导致创意小海不知道视频生成好了，无法将生成的短视频发给用户

**设计理念**：
- 轮询服务在更新数据库后，直接调用创意小海的对话 API
- 把通知作为系统消息发给创意小海
- 通知包含完整信息：`video_id`、`video_name`、`status`、`public_video_url`、`error_reason`、`user_id`
- 创意小海收到通知后，自己决定做什么（比如给用户发消息）
- 系统只存不传、不硬编码控制AI

**详细步骤**：
1. 修改轮询服务，在更新数据库后直接调用创意小海 API
2. 通知格式清晰，包含所有必要信息
3. 创意小海收到通知后，自己决定后续操作
