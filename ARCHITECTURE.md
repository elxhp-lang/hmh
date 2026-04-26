# 海盟会 - 完整架构文档

> **最后更新**: 2025-04-15
> **版本**: v1.0

---

## 🚀 快速启动检查清单

每次会话开始时，执行以下步骤恢复完整记忆：

```bash
# 1. 扫描所有页面
ls -la src/app/

# 2. 扫描所有API
ls -la src/app/api/

# 3. 扫描所有组件
ls -la src/components/

# 4. 扫描所有服务
ls -la src/lib/

# 5. 读取最近修改
cat WORK_MEMORY/CHANGELOG.md | head -30

# 6. 读取核心业务链
cat WORK_MEMORY/08-核心业务链条.md
```

---

## 📁 项目结构总览

```
src/
├── app/                          # Next.js App Router 页面
│   ├── page.tsx                  # 首页（登录后跳转）
│   ├── login/                    # 登录/注册页面
│   ├── dashboard/               # 仪表盘
│   ├── video/                   # 视频生成（旧版）
│   ├── billing/                 # 账单管理
│   ├── material/
│   │   └── history/            # 素材历史
│   ├── admin/                   # 管理员
│   │   └── users/              # 用户管理
│   ├── agent/
│   │   ├── create/             # 创意小海（主入口）
│   │   └── ability/            # 能力看板
│   ├── product-library/         # 商品图库
│   ├── learning-library/        # 学习库
│   └── xiaohai/
│       └── test/               # 创意小海测试页
├── components/                   # React 组件
│   ├── ui/                     # Shadcn UI 组件
│   ├── layout/                 # 布局组件
│   │   ├── DashboardLayout.tsx # 仪表盘布局
│   │   └── Header.tsx         # 头部
│   └── agent/                  # 智能体相关
│       ├── ChatInterface.tsx   # 聊天界面
│       ├── MessageBubble.tsx   # 消息气泡
│       ├── ModelInfoPanel.tsx # 模型信息
│       └── VideoPlayer.tsx    # 视频播放器
├── contexts/                    # React Context
│   └── AuthContext.tsx         # 认证上下文
├── lib/                        # 工具库
│   ├── api.ts                 # API 请求工具
│   ├── utils.ts               # 通用工具
│   ├── seedance-client.ts     # Seedance 客户端
│   ├── tos-storage.ts         # TOS 存储服务
│   ├── agent-tools-service.ts  # 创意小海工具服务
│   ├── video-generation-poller.ts # 视频轮询服务
│   └── ...
├── server.ts                   # 服务器启动入口
└── storage/
    └── database/
        └── shared/
            └── schema.ts      # 数据库 Schema 定义

scripts/
├── dev-start.sh               # 开发环境启动脚本
├── monitor-video-tasks.ts     # 视频任务监控脚本
└── ...
```

---

## 📄 页面清单与作用

### 1. /login - 登录注册页

**路径**: `src/app/login/page.tsx`

**作用**: 用户登录和注册

**工作逻辑**:
1. 用户输入用户名/密码或邮箱
2. 调用 `/api/auth/login` 或 `/api/auth/register`
3. 登录成功返回 JWT token，存入 localStorage
4. 跳转到 `/agent/create`

**关键组件**:
- `AuthForm` - 登录/注册表单

---

### 2. /dashboard - 仪表盘

**路径**: `src/app/dashboard/page.tsx`

**作用**: 展示用户概览统计

**工作逻辑**:
1. 进入页面自动获取用户信息
2. 显示用户角色、视频数量、消费金额等
3. 快捷入口跳转到各功能模块

**显示内容**:
- 用户名和角色
- 视频生成总数
- 账单总金额
- 快捷入口按钮

---

### 3. /video - 视频生成（旧版）

**路径**: `src/app/video/page.tsx`

**作用**: 直接调用 Seedance 2.0 生成视频（旧版入口）

**工作逻辑**:
1. 用户输入提示词、选择参数
2. 点击生成，调用 `POST /api/video/generate`
3. 写入 `videos` 表，status = 'processing'
4. 轮询 `/api/video/generate?taskId=xxx` 查询状态
5. Seedance 返回 succeeded 后，下载到 TOS，更新 status = 'completed'

**重要**: 此页面是直接生成视频，不经过创意小海

---

### 4. /agent/create - 创意小海（主入口）⭐

**路径**: `src/app/agent/create/page.tsx`

**作用**: 创意小海智能对话，生成视频

**工作逻辑**:

```
用户输入 → 流式请求 /api/xiaohai/agent/chat
    ↓
Agent 解析意图 → 调用工具
    ↓
工具执行 → 返回结果
    ↓
前端渲染 → 流式显示
```

**关键机制**:
1. **流式输出**: SSE 协议，实时显示 AI 回复
2. **工具调用**: 显示工具执行进度
3. **视频提交**: submit_video_task 写入 videos 表
4. **任务轮询**: 前端每60秒轮询 /api/material/history
5. **通知弹窗**: 检测到 completed 状态时显示通知

**组件结构**:
- `ChatInterface` - 主聊天界面
- `MessageBubble` - 消息气泡
- `ModelInfoPanel` - 模型信息面板
- `RightSidebar` - 右侧边栏（素材历史）

---

### 5. /agent/ability - 能力看板

**路径**: `src/app/agent/ability/page.tsx`

**作用**: 展示创意小海各任务的能力评分

**显示内容**:
- 完整性、准确性、创意性、实用性、效率
- 五级能力等级：新手、学徒、熟练、专家、大师
- 评分历史追踪

---

### 6. /billing - 账单管理

**路径**: `src/app/billing/page.tsx`

**作用**: 查看视频生成消费记录

**工作逻辑**:
1. 调用 `GET /api/billing`
2. 展示消费明细列表
3. 显示总消费金额

**权限**:
- 普通用户：只能查看自己的账单
- 管理员/财务：可以查看所有账单

---

### 7. /material/history - 素材历史

**路径**: `src/app/material/history/page.tsx`

**作用**: 展示用户生成的所有视频和学习库素材

**工作逻辑**:
1. 调用 `GET /api/material/history`
2. 同时查询 `videos` 表和 `learning_library` 表
3. 展示视频列表、状态、预览

**关键功能**:
- 状态筛选（全部/处理中/已完成）
- 视频预览播放
- 签名 URL 获取（24小时有效）

---

### 8. /product-library - 商品图库

**路径**: `src/app/product-library/page.tsx`

**作用**: 管理商品图片，支持多视角整合

**工作逻辑**:
1. 调用 `GET /api/product-library` 获取商品列表
2. 上传商品图片
3. 多视角图片整合
4. 创意小海可调用 search_product 搜索商品参考

**API**:
- `GET /api/product-library` - 获取商品列表
- `POST /api/product-library` - 创建商品
- `PUT /api/product-library` - 更新商品
- `DELETE /api/product-library` - 删除商品

---

### 9. /learning-library - 学习库

**路径**: `src/app/learning-library/page.tsx`

**作用**: 存储用户上传的优秀视频供创意小海学习

**工作逻辑**:
1. 上传视频或视频链接
2. 调用视觉模型分析视频内容
3. 提取风格、场景、镜头语言等
4. 存入 `learning_library` 表
5. 创意小海可参考学习

**API**:
- `GET /api/learning-library` - 获取学习库列表
- `POST /api/learning-library` - 添加视频到学习库

---

### 10. /admin - 管理员面板

**路径**: `src/app/admin/page.tsx`

**作用**: 管理员功能入口

**子页面**:
- `/admin/users` - 用户管理

---

### 11. /admin/users - 用户管理

**路径**: `src/app/admin/users/page.tsx`

**作用**: 管理员审核新用户、管理用户权限

**工作逻辑**:
1. 调用 `GET /api/admin/users` 获取用户列表
2. 审核新注册用户（pending → approved）
3. 修改用户角色
4. 封禁/解封用户

---

### 12. /xiaohai/test - 创意小海测试页

**路径**: `src/app/xiaohai/test/page.tsx`

**作用**: 创意小海工作流测试页面

**特点**: 8步骤工作流模式（已废弃，被 /agent/create 取代）

---

## 🔌 API 清单与作用

### 认证相关

| API | 方法 | 作用 |
|-----|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |

### 视频相关

| API | 方法 | 作用 |
|-----|------|------|
| `/api/video/generate` | POST | 视频生成（旧版） |
| `/api/video/generate` | GET | 轮询视频状态 |
| `/api/video/history` | GET | 视频历史记录 |

### 创意小海

| API | 方法 | 作用 |
|-----|------|------|
| `/api/xiaohai/agent/chat` | POST | 创意小海对话（主入口） |

### 素材相关

| API | 方法 | 作用 |
|-----|------|------|
| `/api/material/history` | GET | 素材历史（videos + learning_library） |
| `/api/learning-library` | GET/POST | 学习库管理 |

### 商品相关

| API | 方法 | 作用 |
|-----|------|------|
| `/api/product-library` | GET | 获取商品列表 |
| `/api/product-library` | POST | 创建商品 |
| `/api/product-library` | PUT | 更新商品 |
| `/api/product-library` | DELETE | 删除商品 |
| `/api/product-library/upload` | POST | 上传商品图片 |
| `/api/product-library/integrate` | POST | 整合商品图片 |

### 账单相关

| API | 方法 | 作用 |
|-----|------|------|
| `/api/billing` | GET | 获取账单列表 |

### 管理员

| API | 方法 | 作用 |
|-----|------|------|
| `/api/admin/users` | GET | 获取用户列表 |
| `/api/admin/users` | PUT | 更新用户状态 |
| `/api/admin/stats` | GET | 获取统计数据 |

### 其他

| API | 方法 | 作用 |
|-----|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 通用文件上传 |

---

## 🗄️ 数据库表结构

### videos - 视频表（核心）

```sql
id, user_id, task_id, task_type, model, prompt,
first_frame, last_frame,
reference_images, reference_videos, reference_audios,
ratio, duration, generate_audio, watermark,
status, result_url, tos_key, audio_url, cover_url,
cost, error_message,
created_at, updated_at
```

**状态流转**: `processing` → `completed` / `failed`

---

### learning_library - 学习库表

```sql
id, user_id, video_url, video_name, video_type,
style, scene, camera, color, creation_tips,
status, created_at
```

---

### product_library - 商品图库表

```sql
id, user_id, product_name, product_description,
category, tags, images (JSONB),
primary_image_index, usage_count, last_used_at,
created_at, updated_at
```

---

### billing - 账单表

```sql
id, user_id, task_id, task_type, model, amount,
created_at
```

---

### users - 用户表

```sql
id, username, email, password_hash, role,
status, last_sign_in_at, created_at
```

---

### creative_workflows - 创意工作流表

```sql
id, user_id, status, current_step,
input_data, generated_scripts, selected_script,
current_video, batch_results,
created_at, updated_at
```

---

## 🔄 核心业务链

### 视频生成完整流程

```
┌─────────────────────────────────────────────────────────────┐
│                    方式1: /video 页面                       │
├─────────────────────────────────────────────────────────────┤
│ 用户输入提示词                                               │
│     ↓                                                        │
│ POST /api/video/generate                                      │
│     ↓                                                        │
│ 写入 videos 表 (status=processing)                           │
│     ↓                                                        │
│ 调用 Seedance API                                            │
│     ↓                                                        │
│ 前端轮询 GET /api/video/generate?taskId=xxx                   │
│     ↓                                                        │
│ Seedance 返回 succeeded                                       │
│     ↓                                                        │
│ 下载视频到 TOS                                               │
│     ↓                                                        │
│ 更新 videos 表 (status=completed, tos_key)                    │
│     ↓                                                        │
│ 记录账单 billing 表                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 方式2: /agent/create 创意小海                │
├─────────────────────────────────────────────────────────────┤
│ 用户对话                                                      │
│     ↓                                                        │
│ POST /api/xiaohai/agent/chat                                │
│     ↓                                                        │
│ Agent 解析意图，调用 submit_video_task                        │
│     ↓                                                        │
│ 写入 videos 表 (status=processing)                           │
│     ↓                                                        │
│ 调用 Seedance API                                            │
│     ↓                                                        │
│ VideoGenerationPoller 后台轮询 (每30秒)                       │
│     ↓                                                        │
│ Seedance 返回 succeeded                                       │
│     ↓                                                        │
│ 下载视频到 TOS，更新 videos 表                                │
│     ↓                                                        │
│ 发送 WebSocket 通知                                          │
│     ↓                                                        │
│ 前端检测到 completed，显示通知弹窗                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ 后台服务

### VideoGenerationPoller - 视频轮询服务

**路径**: `src/lib/video-generation-poller.ts`

**作用**: 后台轮询 Seedance 状态，自动下载视频到 TOS

**启动方式**: `server.ts` 启动时初始化

```typescript
const poller = new VideoGenerationPoller(client);
poller.start(); // 每30秒检查一次
```

**工作流程**:
1. 查询 status = 'processing' 的视频
2. 调用 Seedance API 获取最新状态
3. 如果 succeeded，下载视频到 TOS
4. 更新 videos 表
5. 发送 WebSocket 通知

---

### server.ts - 服务器入口

**路径**: `src/server.ts`

**作用**: 启动 Next.js 开发服务器，初始化后台服务

**初始化内容**:
- VideoGenerationPoller
- 健康检查

---

## 🔧 组件清单

### ChatInterface

**路径**: `src/components/agent/ChatInterface.tsx`

**作用**: 创意小海主聊天界面

**功能**:
- 消息列表展示
- 流式输出渲染
- 工具调用状态显示
- 输入框

---

### MessageBubble

**路径**: `src/components/agent/MessageBubble.tsx`

**作用**: 单条消息气泡

**类型**:
- `text` - 文本消息
- `tool_start` - 工具开始调用
- `tool_result` - 工具执行结果
- `error` - 错误消息

---

### ModelInfoPanel

**路径**: `src/components/agent/ModelInfoPanel.tsx`

**作用**: 显示当前使用的 AI 模型信息

---

### RightSidebar

**路径**: `src/components/agent/RightSidebar.tsx`

**作用**: 右侧素材历史面板

**功能**:
- 展示最近生成的视频
- 轮询获取最新状态
- 视频预览播放

---

### VideoPlayer

**路径**: `src/components/agent/VideoPlayer.tsx`

**作用**: 视频播放器

**功能**:
- 支持多种 URL 来源
- 自动检测视频类型
- 播放控制

---

### DashboardLayout

**路径**: `src/components/layout/DashboardLayout.tsx`

**作用**: 仪表盘页面布局

**包含**:
- 侧边栏导航
- Header 头部
- 页面内容区

---

### AuthContext

**路径**: `src/contexts/AuthContext.tsx`

**作用**: 全局认证状态管理

**状态**:
- user - 当前用户信息
- isAuthenticated - 是否登录
- login() - 登录方法
- logout() - 登出方法

---

## 🔗 页面间协同关系

```
/login
    ↓ 登录成功
/dashboard
    ↓
├── /video              # 直接生成视频
├── /agent/create      # 创意小海生成视频
├── /billing           # 查看账单
├── /material/history  # 查看素材
├── /product-library   # 管理商品
├── /learning-library  # 管理学习库
└── /admin/users       # 管理用户
```

**数据流向**:
```
/agent/create (创意小海)
    ↓ submit_video_task
videos 表
    ↓
VideoGenerationPoller (后台轮询)
    ↓
TOS 存储
    ↓
/material/history (前端展示)
```

---

## ⚠️ 重要约束（红线）

### 1. videos 表必须写入
- 每次视频生成必须写入 `videos` 表
- `user_id` 必须正确传递
- `status` 必须正确更新

### 2. 工具名称必须匹配
- 系统提示词中的工具名必须与 `agent-tools-service.ts` 中的名称一致
- 当前正确名称: `submit_video_task`

### 3. TOS 存储必须执行
- 视频生成完成后必须下载到 TOS
- `tos_key` 必须写入 videos 表

---

## 📝 CHANGELOG 最近修改

### 2025-04-15

- [完成] 系统提示词工具列表更新 - 补充完整24个工具
- [完成] Seedance 2.0 最佳实践指南集成
- [完成] query_task_status 参数兼容修复
- [完成] VideoPoller handleSuccess 修复

### 2025-04-14

- [完成] 语法错误修复 - continue 语句位置错误
- [完成] user_id 自动注入 - 模型返回 user_id 为空问题

---

## 🆘 常见问题排查

### 1. 视频生成失败
检查: videos 表是否有记录？Seedance API 是否可用？

### 2. 视频没有保存到 TOS
检查: VideoGenerationPoller 是否启动？TOS 配置是否正确？

### 3. 创意小海无法生成视频
检查: 工具名称是否正确？submit_video_task 是否写入 videos 表？

### 4. 页面 404
```bash
# 检查服务状态
/workspace/projects/scripts/check-health.sh

# 重启服务
pkill -f 'pnpm tsx'
sleep 2
cd /workspace/projects && coze dev > /app/work/logs/bypass/dev.log 2>&1 &
```
