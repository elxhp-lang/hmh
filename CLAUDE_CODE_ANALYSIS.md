# 海盟会代码分析任务

## 项目概述

海盟会是一个基于 Seedance 2.0 模型的多智能体协作视频生成平台。

### 技术栈
- Next.js 16 (App Router)
- React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Supabase (PostgreSQL)
- TOS 对象存储

---

## 核心业务链（请勿删除）

### 视频生成链路（最重要）
```
用户对话 → /api/xiaohai/agent/chat → creative-agent-service
    → submit_video_task → videos 表
    → Seedance 2.0 API
    → video-generation-poller 轮询状态
    → 下载到 TOS → 返回签名 URL
```

### 认证流程
```
/api/auth/login → JWT token → 前端存储 → 访问受保护 API
```

---

## 已知的无用/冗余代码（高优先级检查）

### 1. 多版本 xiaohai 工具和提示词
```
src/lib/xiaohai-tools.ts          # v3 是最新版本
src/lib/xiaohai-tools-v2.ts       # v3 是最新版本
src/lib/xiaohai-system-prompt.ts  # v3 是最新版本
src/lib/xiaohai-system-prompt-v2.ts  # v3 是最新版本
```

### 2. 多版本工作流服务
```
src/lib/xiaohai-workflow-service.ts    # v2 是最新版本
src/lib/xiaohai-workflow-service-v2.ts # 可能需要检查引用
```

### 3. 测试文件
```
src/lib/test-auth.ts
src/lib/test-sse.ts
src/lib/xiaohai-self-check.ts
```

### 4. 页面备份文件
```
src/app/agent/create/page-new.tsx      # 可能是备份
src/app/agent/create/page-old.tsx.bak  # 旧版本备份
src/app/test-sse/page.tsx              # 测试页面
```

### 5. 未使用的 API
```
src/app/api/analyze-design/route.ts       # 检查是否有前端引用
src/app/api/design-consultation/route.ts  # 检查是否有前端引用
src/app/api/cleanup/conversation-history/route.ts
src/app/api/init/route.ts
src/app/api/knowledge/seedance-guide/route.ts
```

---

## 需要注意的架构决策

### 1. 三个并存的 Agent 服务（功能有重叠）
| 服务 | 用途 | 状态 |
|------|------|------|
| creative-agent-service | 创意小海主服务 | 正在使用 |
| simple-agent-service | 简单对话 | 正在使用 |
| pure-agent-service | 纯 Agent 模式 | 正在使用 |

**注意**: 不要只因为"功能相似"就删除其中一个

### 2. 视频生成 API 多版本并存
| API | 被引用页面 |
|-----|-----------|
| /api/video/generate | /video/page.tsx, /agent/create/page.tsx |
| /api/video/history | /video/page.tsx, /agent/create/page.tsx |
| /api/video/edit | /video/page.tsx |
| /api/video/extend | /video/page.tsx |

**注意**: /video/page.tsx 是视频生成入口页面，与创意小海并存

### 3. 多视角图片整合服务
```
src/lib/image-integration-service.ts  # 商品图库多视角整合
```
被商品图库页面使用，不要删除

---

## 分析任务

### 请执行以下分析：

1. **找出未被引用的文件**
   - 检查每个文件的 import 语句
   - 追踪 import 链，确认是否真的无人使用

2. **找出重复实现**
   - 检查功能相似的文件
   - 但要考虑它们可能被不同场景使用

3. **检查 API 路由**
   - 确认每个 route.ts 是否被前端页面调用
   - 确认每个 route.ts 是否有对应的服务实现

4. **检查组件**
   - 确认每个组件是否被页面使用
   - 注意 shadcn/ui 组件在 components/ui/ 下

5. **输出格式**
   ```
   ## 可删除文件（确认度 100%）
   - 文件路径: 原因
   
   ## 疑似无用（需人工确认）
   - 文件路径: 原因
   
   ## 保留但有疑问
   - 文件路径: 疑问说明
   ```

---

## 快速检查清单

### scripts/ 目录
大部分 scripts/*.ts 是测试脚本，理论上可以删除，但请确认：
- 是否有被 package.json 的 scripts 引用
- 是否有被其他配置文件引用

### dist/ 目录
- 是构建产物，可以删除
- 重新 pnpm build 会重新生成

### 根目录文件
- ask-xiaohai-*.ts/js - 测试脚本，可删除
- *.bak - 备份文件，可删除

---

## 重要提醒

1. **不要删除核心业务链**：认证、视频生成、TOS 存储
2. **不要删除数据库 Schema**：src/storage/database/
3. **删除后必须运行 pnpm build 验证**
4. **删除前检查 git 状态**，方便回滚
