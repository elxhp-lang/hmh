# 海盟会 - 多智能体视频生成平台

---

## ⚠️ 底层运行逻辑（必须遵守）

### 0. 会话启动检索机制（每次新会话必须执行）

**🔍 会话启动必读文件**（按优先级排序）：

| 优先级 | 文件路径 | 内容摘要 | 读取时机 |
|--------|----------|----------|----------|
| ⭐⭐⭐ | `memory.md` | 虾评Skill平台、已安装技能、API密钥 | **每次会话第一时间** |
| ⭐⭐⭐ | `ARCHITECTURE.md` | **完整项目架构文档** | **每次会话第一时间，必须先读！** |
| ⭐⭐⭐ | `WORK_MEMORY/08-核心业务链条.md` | 视频生成业务链、红线清单、关键文件 | **涉及视频生成时必读** |
| ⭐⭐⭐ | `WORK_MEMORY/09-经验教训.md` | 今日错误总结、铁律、工作原则 | **每次会话第一时间** |
| ⭐⭐⭐ | `WORK_MEMORY/03-创意小海.md` | 架构问题、API选择、工作流设计 | 涉及创意小海时必读 |
| ⭐⭐⭐ | `WORK_MEMORY/seed2-memory.md` | Seed 2.0 Pro 协作记忆、工作进度、决策记录 | 与 Seed 2.0 协作时必读 |
| ⭐⭐ | `WORK_MEMORY/CHANGELOG.md` | 全局修改记录、最近变更 | 了解项目演进 |
| ⭐⭐ | `WORK_MEMORY/01-用户系统.md` | 用户系统设计 | 涉及用户功能时必读 |
| ⭐ | `skills/config.json` | 技能配置 | 技能管理时参考 |
| ⭐ | `public/xiaohai-workflow-redesign.md` | 创意小海完整设计 | 架构设计参考 |

**检索命令模板**：
```bash
# 1. 首先读取架构文档（必须第一步！）
cat ARCHITECTURE.md

# 2. 然后读取主记忆文件和经验教训
cat memory.md
cat WORK_MEMORY/09-经验教训.md

# 3. 读取核心业务链条（涉及视频生成时必读）
cat WORK_MEMORY/08-核心业务链条.md

# 4. 检查最近变更
cat WORK_MEMORY/CHANGELOG.md
```

### 1. 绝对真诚原则
**永远输出最真实的情况，不带修饰。**
- 如实反馈问题，不隐瞒
- 如实说明能力边界，不夸大
- 如实汇报进展，不虚报

### 2. 记忆原则
**每次工作区先读取记忆，确保上下文连贯。**
- 每次会话开始先读取 AGENTS.md
- 记住与用户的所有对话内容
- 不重复丢失记忆，浪费时间在重复确认上

### 2.1 工作日志更新原则（CRITICAL）
**每次完成关键任务后必须更新工作日志，确保知识不丢失。**

**更新时机**：
- 每次完成一个功能模块的开发/修复后
- 每次发现并解决的问题
- 每次架构决策或设计变更
- 每次与用户确认的重要决策

**更新文件**：`WORK_MEMORY/CHANGELOG.md`

**更新格式**：
```markdown
#### YYYY-MM-DD HH:MM
- [完成] 具体任务描述
- [问题] 发现的问题及解决方案
- [决策] 架构/设计决策及原因
```

**检查机制**：
- 每次提交代码前，检查 CHANGELOG.md 是否有更新
- 如果有重大变更但未更新，拒绝提交并提醒

### 3. 技能安装规则
遇到需要新技能的场景，按以下流程操作：
```
1. 读安装指南：curl -s https://xiaping.coze.site/skill.md
2. 按指南下载并解压安装
3. 安装后自动评测技能效果
4. 不满意可回收/替换
```

### 4. 沟通原则
- 所有用户可见的交互文本必须是中文
- 如果无法理解需求或无法实现，**直接说明，不要敷衍或简单修补**
- 交付前进行深度自查，避免低级逻辑错误
- 工作流应自动执行，步骤间无需用户确认
- 有素材自动分析，无素材使用默认值

### 4.1 修改谨慎原则（安全红线）
**仅当代码修改会影响已正常运行的功能、业务逻辑时触发。**

如果需要进行调整才能完成当前工作：
1. **先以大白话的方式告诉用户**：
   - 需要调整什么
   - 为什么会这样调整
   - 可能会带来什么影响
   - 可能导致的后果（我预想到的）
2. **等用户确认后再进行修改**
3. **避免因为修改一个错误，带来更多的错误**

**禁止行为**：
- ❌ 未经用户确认就修改已正常运行的现有功能
- ❌ 口头说"小改动"但实际上影响核心流程
- ❌ 不说明风险就进行数据库字段变更

### 4.2 变更追踪原则
**每次需要调整现有功能时，必须在代办实现文件中添加对应描述。**

追踪内容：
- 需要调整什么
- 因为什么而调整
- 可能影响什么功能
- 当前状态（待确认/进行中/已完成）

执行流程：
1. 调整前：在代办实现文件中添加变更描述
2. 调整中：标记状态为"进行中"
3. 调整后：对被影响的功能进行测试
4. 测试通过：标记状态为"已完成"

**禁止行为**：
- ❌ 修改后不更新代办事项
- ❌ 不测试被影响的功能就交付
- ❌ 忽略可能的影响功能

### 4.3 先观察再修改原则
**如果暂时无法精准定位问题，通过添加调试日志或其他方式，让用户帮助复现问题，观察代码变化，尝试更精准定位后再修改。**

适用场景：
- 问题根因不明确
- 需要用户实际使用才能观察到的偶发问题
- 需要对比正常和异常状态的差异

执行流程：
1. 添加调试日志或检查点
2. 让用户复现问题
3. 分析日志/观察变化
4. 精准定位根因
5. 进行修改
6. 验证修复

**禁止行为**：
- ❌ 在根因不明时盲目修改
- ❌ 不通过用户复现就假设问题所在

### 5. 已安装技能（虾评Skill平台）

**平台**: https://xiaping.coze.site
**API_KEY**: agent-world-a75436a1d78c1d68d5cceb57151ad471262f35a86d7ab000
**AGENT_ID**: 73ae252e-0fb4-4650-9d57-076278eb4b96

#### 🤖 智能体核心能力
| 技能 | 路径 | 用途 | 状态 |
|-----|------|-----|------|
| agent-evolution | `skills/agent-evolution/` | AI自我进化、错误学习 | ✅ 已配置 |
| context-relay | `skills/context-relay/` | 跨会话记忆传递 | ✅ 已配置 |
| memory-system | `skills/memory-system/` | 长期记忆、知识蒸馏 | ✅ 已配置 |
| ai-text-humanizer | `skills/ai-text-humanizer/` | 去除AI痕迹 | ✅ 已配置 |

#### 🎨 前端设计
| 技能 | 路径 | 用途 | 状态 |
|-----|------|-----|------|
| ui-ux-pro-max | `skills/ui-ux-design/ui-ux-pro-max-skill/` | 50+设计风格、97配色方案 | ✅ 已配置 |
| frontend-dev | `skills/frontend-dev/` | 全栈前端、Tailwind/React | ✅ 已配置 |
| cover-image | `skills/cover-image/` | 封面图生成 | ✅ 已配置 |

#### 💻 全栈开发
| 技能 | 路径 | 用途 | 状态 |
|-----|------|-----|------|
| 全栈开发 | `skills/references/` | API设计、认证流程 | ✅ 已配置 |
| deep-reading | `skills/deep-reading/` | 10+思维模型深度分析 | ✅ 已配置 |

#### ⚡ 工作流与效率
| 技能 | 路径 | 用途 | 状态 |
|-----|------|-----|------|
| workflows | `skills/` | 工作流自动化引擎 | ✅ 已配置 |
| 从忙碌到高效 | `skills/SKILL.md` | Agent精准工作法 | ✅ 已配置 |
| openclaw心智矩阵 | `skills/tools/` | 规则进化 | ✅ 已配置 |

#### 📚 记忆文件说明
- **`memory.md`** - 主记忆文件（虾评平台、已安装技能、API密钥）
- **`WORK_MEMORY/`** - 模块化工作记忆
  - `01-用户系统.md` - 用户系统设计
  - `02-视频生成.md` - 视频生成功能
  - `03-创意小海.md` - ⚠️ 包含架构问题记录，必读
  - `04-学习库.md` - 学习库功能
  - `05-商品图库.md` - 商品图库功能
  - `06-财务系统.md` - 财务系统
  - `07-UI主题.md` - UI主题配置
  - `CHANGELOG.md` - 全局修改记录

---

## 项目概览

海盟会是一个基于 Seedance 2.0 模型的多智能体协作视频生成平台，支持用户权限管理、视频生成、财务统计、素材智能体对话等功能。

### 核心功能

1. **用户系统**: 注册、登录、权限管理（超级管理员/管理员/财务/普通用户）
   - **注册审核流程**: 新用户注册后需管理员审核
   - 第一个注册用户自动成为超级管理员
   - 后续用户注册后状态为 `pending`，需管理员审核通过
   - 注册成功后自动发送飞书通知给管理员
   - 审核中的用户尝试登录时显示"审核中"提示弹窗
2. **视频生成**: 文生视频、图生视频、视频延长、音频生成
   - 视频生成后自动存储到 TOS 对象存储（持久化）
   - 按用户隔离存储：`users/{user_id}/videos/`
   - **多模态参考视频**：支持用户上传的视频或视频链接作为参考
     - 用户上传视频文件：直接作为参考传给 Seedance 2.0
     - 视频链接（抖音、快手等）：自动解析并下载，作为参考传给 Seedance 2.0
     - 自动检测URL可访问性，不可访问时下载并上传到TOS
3. **智能体系统**: 素材智能体、财务智能体、权限智能体、创意小海
4. **财务管理**: 账单查询、发票申请、消费统计
5. **文件管理**: TOS 对象存储、多平台视频链接解析
   - 支持平台：抖音、快手、B站、小红书、微博等
6. **创意小海**: 智能视频创作助手
   - 支持多模态输入（图片、视频、多平台视频链接）
   - 文件学习功能（PDF、Word、Excel、TXT、Markdown等）
   - 长期记忆系统，持续学习用户上传的文档
   - 脚本创作、视频分析、工作流引擎
   - 视频链接模仿：自动解析视频风格，提供创作建议
   - **视频链接自动保存**：发送的视频链接会自动添加到学习库，后台分析并学习
   - **商品识别**：自动识别用户输入中的商品名称，从商品图库获取参考信息
   - **双层能力系统**: "先观察大师，再自己动手"的渐进式学习机制
     - 学习模式（评分<60）：观察大模型执行，积累经验
     - 对比模式（评分60-85）：双路执行，用户选择最佳结果
     - 独立模式（评分>85）：智能体独立执行，定期抽查
     - 多维度评分：完整性、准确性、创意性、实用性、效率
     - **知识库增强**：智能体使用学习库内容增强输出
     - **真正的学习进化**：大模型输出 vs 智能体输出（带学习库参考）
   - **模型信息展示**: 前端显示各任务使用的AI模型
7. **学习库**: 视频学习系统
   - 用户上传优秀视频供创意小海学习
   - 支持视频文件上传和多平台视频链接解析
   - **智能视频分析**: 使用视觉模型（doubao-seed-1-6-vision）直接分析视频内容
   - **多维度分析**: 视频类型识别、场景分析、镜头语言、色彩风格、创作技巧
   - **商品展示分析**: 自动识别视频中的商品展示方式
   - 提取创作知识并应用于对话创作
   - 支持视频管理、重新分析、删除等操作
   - 支持向量嵌入语义搜索
8. **商品图库**: 商品图片管理系统
   - 支持商品图片上传、命名、多视角管理
   - 自动整合多视角图片为单一图片并标注
   - 创意小海自动识别商品名称并获取参考
   - 存储路径：`users/{user_id}/products/{product_id}/images/`
9. **能力看板**: 智能体能力评分系统
   - 展示智能体各任务类型的能力评分
   - 多维度评分：完整性、准确性、创意性、实用性、效率
   - 五级能力等级：新手、学徒、熟练、专家、大师
   - 评分历史追踪和学习进度可视化
   - 页面路径：`/agent/ability`
10. **创意小海工作流**: 完整的8步骤视频创作工作流
    - **步骤1：唤醒与偏好展示** - 展示用户偏好，询问是否开始
    - **步骤2：任务识别与确认** - 识别用户意图，确认工作内容
    - **步骤3：模型调用与进度反馈** - 分析视频/生成脚本，实时反馈进度
    - **步骤4：脚本呈现与确认** - 展示参考脚本，询问是否微调
    - **步骤5：脚本生成** - 生成3个不同风格的脚本供选择
    - **步骤6：视频生成** - 调用 Seedance 2.0 生成视频
    - **步骤7：批量生成** - 自动循环生成多个视频
    - **步骤8：结束与保存** - 蒸馏用户偏好，结束工作流
    - **脚本格式**：以3秒为时间维度，包含画面、人物（面部细节）、动作、口播、风格
    - **多工作流并行**：支持同时发起多个任务，工作流隔离
    - **断点续接**：保存工作流进度，随时切换并恢复
    - **进度反馈**：实时显示当前阶段、使用的模型、预计等待时间
    - **测试页面**：`/xiaohai/test`

### 创意小海新架构（主模型 + 工具调用）

**架构特点**：
- **主模型协调**：使用 `doubao-seed-1-8-251228` 作为协调器，通过系统提示词管理工作流
- **工具层执行**：16个工具负责具体执行（内容生成、记忆、工作流、学习、健康检查）
- **简化架构**：易于维护，支持工具扩展

**核心文件**：
- `src/lib/xiaohai-tools-v2.ts` - 16个工具定义（内容生成4个、记忆3个、工作流5个、学习3个、健康检查1个）
- `src/lib/xiaohai-system-prompt-v2.ts` - 优化的系统提示词
- `src/app/api/xiaohai/chat/route.ts` - 对话API（流式输出）

**工具列表**：
1. `analyze_video` - 分析视频内容并提取脚本
2. `generate_script` - 生成视频脚本
3. `regenerate_script` - 重新生成脚本
4. `generate_video` - 使用 Seedance 2.0 生成视频
5. `save_workflow_progress` - 保存工作流进度
6. `get_workflow_progress` - 获取工作流进度
7. `save_workflow_artifact` - 保存工作流产物
8. `create_workflow` - 创建工作流
9. `start_workflow` - 开始工作流
10. `confirm_workflow` - 确认工作流
11. `reject_workflow` - 拒绝工作流
12. `get_workflow_status` - 获取工作流状态
13. `record_user_feedback` - 记录用户反馈
14. `rule_get_all` - 获取所有规则
15. `apply_learning` - 应用学习结果
16. `health_check` - 健康检查

**前端配置**：
- 默认模式：`useLLM = true`（大模型模式）
- 页面路径：`/agent/create`

## 技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (Amber 主题)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL + RLS)
- **AI Services**: coze-coding-dev-sdk
  - Seedance 2.0 (视频生成)
  - LLM (doubao-seed-1-6-vision 视频理解, doubao-seed-1-8 多模态对话)
  - Embedding (向量嵌入)
  - Knowledge (知识库)
  - S3 Storage (文件存储)

## 📄 页面清单与作用

| 页面路径 | 页面名称 | 作用 | 权限 |
|----------|----------|------|------|
| `/` | 首页 | 重定向到仪表盘或登录 | 公开 |
| `/login` | 登录/注册 | 用户认证 | 公开 |
| `/dashboard` | 仪表盘 | 主页面，展示概览统计 | 用户 |
| `/video` | 视频生成 | 直接生成视频入口 | 用户 |
| `/billing` | 账单管理 | 查看账单、发票申请 | 用户 |
| `/settings` | 设置 | 用户设置 | 用户 |
| `/notifications` | 消息中心 | 视频生成通知列表 | 用户 |
| `/agent` | 智能体中心 | 智能体入口页面 | 用户 |
| `/agent/create` | 创意小海 | **核心页面** AI对话生成视频 | 用户 |
| `/agent/ability` | 能力看板 | 智能体能力评分展示 | 用户 |
| `/material/history` | 素材历史 | 用户生成的视频历史 | 用户 |
| `/learning-library` | 学习库 | 管理学习视频 | 用户 |
| `/product-library` | 商品图库 | 管理商品图片 | 用户 |
| `/design-preview` | 设计预览 | 页面设计参考 | 公开 |
| `/admin/users` | 用户管理 | 管理员管理用户 | 管理员 |

### 页面分类

| 分类 | 页面 |
|------|------|
| **核心业务** | `/agent/create`, `/video` |
| **用户功能** | `/material/history`, `/learning-library`, `/product-library`, `/billing`, `/settings`, `/notifications` |
| **管理功能** | `/admin/users` |
| **其他** | `/dashboard`, `/agent`, `/agent/ability`, `/design-preview` |

---

## 目录结构

```
├── public/                     # 静态资源
├── src/
│   ├── app/                    # 页面路由与布局
│   │   ├── api/                # API 路由
│   │   │   ├── auth/           # 认证相关 API
│   │   │   ├── video/          # 视频生成 API
│   │   │   ├── upload/         # 文件上传 API
│   │   │   ├── billing/        # 账单管理 API
│   │   │   ├── invoice/        # 发票管理 API
│   │   │   ├── stats/          # 统计 API
│   │   │   ├── admin/          # 管理员 API
│   │   │   ├── agent/          # 智能体 API
│   │   │   │   ├── ability/     # 能力档案 API
│   │   │   │   └── compare/     # 双层能力对比模式 API
│   │   │   ├── creative-agent/ # 创意小海 API
│   │   │   │   ├── chat/       # 对话流式输出
│   │   │   │   └── memory/     # 长期记忆管理
│   │   │   ├── learning-library/ # 学习库 API
│   │   │   └── product-library/  # 商品图库 API
│   │   │       ├── route.ts    # 商品增删改查
│   │   │       ├── upload/     # 图片上传
│   │   │       ├── reference/  # 商品参考查询
│   │   │       └── integrate/  # 多视角图片整合
│   │   ├── login/                    # 登录/注册页面
│   │   ├── dashboard/                # 仪表盘页面
│   │   ├── video/                    # 视频生成页面
│   │   ├── billing/                  # 账单管理页面
│   │   ├── settings/                 # 用户设置页面
│   │   ├── notifications/            # 消息中心页面
│   │   ├── material/history/         # 素材历史页面
│   │   ├── agent/                   # 智能体入口页面
│   │   │   ├── page.tsx             # 智能体首页
│   │   │   ├── create/              # 创意小海核心页面
│   │   │   └── ability/             # 能力看板页面
│   │   ├── learning-library/         # 学习库页面
│   │   ├── product-library/          # 商品图库页面
│   │   ├── design-preview/          # 设计预览页面
│   │   └── admin/users/             # 用户管理页面（管理员）
│   ├── components/             # 组件
│   │   ├── ui/                 # Shadcn UI 组件
│   │   ├── layout/             # 布局组件
│   │   └── agent/              # 智能体相关组件
│   │       ├── ModelInfoPanel.tsx  # AI模型信息展示
│   │       └── CompareModePanel.tsx  # 对比模式展示组件
│   ├── contexts/               # React Context
│   ├── hooks/                  # 自定义 Hooks
│   ├── lib/                    # 工具库
│   │   ├── api.ts              # API 请求工具
│   │   ├── utils.ts            # 通用工具函数
│   │   ├── file-parser-service.ts  # 文件解析服务
│   │   ├── video-learning-service.ts  # 视频学习服务
│   │   ├── video-link-parser.ts  # 多平台视频链接解析服务
│   │   ├── product-library-service.ts  # 商品图库服务
│   │   ├── image-integration-service.ts  # 多视角图片整合服务
│   │   ├── product-video-workflow-service.ts  # 商品视频工作流服务
│   │   ├── dual-layer-service.ts  # 双层能力系统核心服务
│   │   ├── agent-ability-service.ts  # 智能体能力服务
│   │   └── model-config.ts  # AI模型配置
│   └── storage/                # 存储相关
│       └── database/           # 数据库相关
│           ├── schema.ts       # 数据表定义
│           └── supabase-client.ts  # Supabase 客户端
├── next.config.ts              # Next.js 配置
├── package.json                # 项目依赖管理
└── tsconfig.json               # TypeScript 配置
```

## 创意小海 - Agent 模式架构

### ⭐ 核心原则：Seed 2.0 是唯一入口

**架构设计**：
1. 前端只调用 `/api/xiaohai/agent/chat`
2. 所有业务功能通过工具调用执行
3. Agent 返回结构化响应，前端渲染对应 UI

### API 入口
- **唯一入口**：`POST /api/xiaohai/agent/chat`
- **废弃的 API**：/api/video/generate, /api/video/analyze, /api/xiaohai/quick-generate 等

### 响应格式
```json
{
  "type": "text" | "video_analysis" | "script_options" | "task_submitted" | "task_done" | "error",
  "content": "文本描述",
  "data": {...}
}
```

### 工具列表（16个）
- 基础：get_user_preference, save_user_preference, search_product
- 视频：analyze_video, generate_script, submit_video_task, query_task_status
- 图片：analyze_image, analyze_multiple_images, generate_first_frame
- 模板：get_templates, get_template, create_template, batch_generate
- 协作：get_collaboration_status, update_collaboration_memory

### 完整工作流
```
用户发送消息 → Agent 解析意图 → 调用工具 → 返回结构化响应 → 前端渲染
```

## 纯 Agent 架构（新版）

### 核心文件
| 文件 | 说明 |
|------|------|
| `src/lib/tool-types.ts` | 工具类型定义（操作类 + 渲染类） |
| `src/lib/pure-agent-service.ts` | 纯 Agent 核心服务 |
| `src/app/pure-agent/page.tsx` | 纯 Agent 前端页面 |
| `src/app/api/pure-agent/chat/route.ts` | 纯 Agent API |

### 工具分类
- **操作类工具**：执行后返回结果给 Seed 2.0
- **渲染类工具**：告诉前端怎么展示（MessageBubble, VideoAnalysisCard, ScriptSelectCards 等）

### API 测试结果
- ✅ 基本对话正常
- ✅ 工具调用正常（analyze_video 测试通过）
- ✅ 流式输出正常
- ✅ 前端页面加载正常

---

## 开发规范

### 包管理

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

```bash
# 安装依赖
pnpm install

# 添加依赖
pnpm add <package>

# 添加开发依赖
pnpm add -D <package>
```

### API 开发规范

1. **认证**: 所有 API 使用 JWT Token 认证，从 `Authorization: Bearer <token>` 获取
2. **错误处理**: 统一返回 `{ error: string }` 格式
3. **数据库**: 使用 Supabase Client，字段名使用 snake_case
4. **文件上传**: 使用 TOS 对象存储，返回 key 而非 URL

### 视频存储流程

```
用户请求生成视频
    ↓
创建 videos 记录（status=processing）
    ↓
调用 Seedance API
    ↓
前端轮询 /api/video/generate?taskId=xxx
    ↓
视频生成成功（status=succeeded）
    ↓
下载视频并存储到 TOS
    ↓
更新 videos 记录（tos_key, status=completed）
    ↓
前端通过 tos_key 获取签名 URL 播放视频
```

### TOS 存储结构

```
hmhv/                          # 存储桶
├── users/
│   └── {user_id}/
│       ├── videos/            # 用户生成的视频
│       │   └── video_xxx.mp4
│       ├── images/            # 用户上传的图片
│       └── temp/              # 临时文件
└── system/                    # 系统资源
```

### 环境变量

#### ⚠️ 重要：两套凭证不要混淆

| 凭证类型 | 用途 | 环境变量 | 使用位置 |
|---------|------|---------|---------|
| **ARK API Key** | Seedance 2.0 视频生成 | `ARK_API_KEY` | `src/lib/seedance-client.ts` |
| **火山引擎 AK/SK** | TOS 对象存储、财务 API | `VOLCENGINE_ACCESS_KEY_ID`<br>`VOLCENGINE_SECRET_ACCESS_KEY` | `src/lib/tos-storage.ts`<br>`src/lib/volcengine-billing.ts` |

#### TOS 对象存储配置
- `TOS_BUCKET_NAME`: TOS 存储桶名称（hmhv）
- `TOS_ENDPOINT`: TOS 端点（tos-cn-beijing.volces.com）
- `TOS_REGION`: TOS 区域（cn-beijing）
- `VOLCENGINE_ACCESS_KEY_ID`: 火山引擎 Access Key（TOS 存储）
- `VOLCENGINE_SECRET_ACCESS_KEY`: 火山引擎 Secret Key（TOS 存储）

#### Seedance 2.0 视频生成配置
- `ARK_API_KEY`: ARK 平台 API Key（专门用于 Seedance 2.0 视频生成）
- **已开通模型**:
  - `doubao-seedance-2-0-260128` (Seedance 2.0 标准版) ✅
  - `doubao-seedance-2-0-fast-260128` (Seedance 2.0 快速版) ✅

#### 其他配置
- `JWT_SECRET`: JWT 密钥
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_ANON_KEY`: Supabase 匿名密钥
- `FEISHU_WEBHOOK_URL`: 飞书群机器人 Webhook URL（用于注册审核通知）

### 前端开发规范

1. **状态管理**: 使用 `AuthContext` 管理用户状态，`useApi` 进行 API 请求
2. **UI 组件**: 统一使用 `shadcn/ui` 组件
3. **路由保护**: 使用 `usePermission` Hook 检查权限
4. **流式输出**: 使用 `streamRequest` 处理 SSE 流式响应

### 权限体系

| 角色 | 权限等级 | 权限范围 |
|------|---------|---------|
| super_admin | 100 | 所有权限，包括用户管理 |
| admin | 80 | 用户管理、所有数据查看 |
| finance | 60 | 账单查看、发票管理 |
| member | 20 | 个人数据操作 |

### 数据库表结构

1. **users**: 用户表（user_id, username, email, role, status）
   - 角色类型：super_admin, finance, material_leader, material_member
2. **videos**: 视频表（task_id, user_id, prompt, status, video_url）
3. **billing**: 账单表（billing_id, user_id, task_type, amount）
4. **invoices**: 发票表（invoice_id, user_id, amount, status）
5. **operation_logs**: 操作日志表
6. **product_library**: 商品图库表
   - id, user_id, product_name, product_description, category, tags
   - images (JSONB): 多视角图片数组
   - primary_image_index: 主图索引
   - usage_count: 使用次数
   - last_used_at: 最后使用时间
7. **agent_conversations**: 智能体对话表
8. **uploaded_files**: 上传文件表
9. **daily_stats**: 每日统计表
10. **creative_memories**: 创意小海长期记忆表
    - 存储用户上传的文档知识、对话总结
    - 支持关键词搜索和相关记忆检索
11. **learning_library**: 学习库视频表
    - 存储用户上传的学习视频信息
    - 包含视频分析结果（风格、场景、镜头、色彩等）
    - 支持关键词搜索和相关参考推荐
12. **agent_ability_profiles**: 智能体能力档案表
    - 存储智能体各任务类型的能力评分
    - 包含完整性、准确性、创意性、实用性、效率等多维度评分
    - 支持学习模式（<60）、对比模式（60-85）、独立模式（>85）
13. **creative_workflows**: 创意工作流表
    - 存储创意小海的8阶段工作流状态
    - 包含输入收集、脚本生成、视频生成等阶段

### 权限体系

| 角色 | 权限等级 | 权限范围 |
|------|---------|---------|
| super_admin | 100 | 所有权限，包括用户管理、财务数据概览、查看所有素材 |
| finance | 60 | 账单查看、发票管理、财务数据导出 |
| material_leader | 40 | 团队数据查看、成员管理、团队成员素材历史查看 |
| material_member | 20 | 个人数据操作、个人素材历史查看 |

## 常用命令

```bash
# 开发环境
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm ts-check

# 代码检查
pnpm lint

# 手动健康检查
/workspace/projects/scripts/check-health.sh

# 启动健康监控（后台运行）
nohup bash /workspace/projects/scripts/health-monitor.sh > /app/work/logs/bypass/health-monitor.log 2>&1 &
```

## 健康监控机制

项目内置自动健康检查和修复机制，防止服务异常导致 404 错误。

### 组件

1. **健康检查 API** (`/api/health`): 返回服务状态信息
2. **健康监控脚本** (`scripts/health-monitor.sh`): 后台定期检查服务状态
3. **快速检查脚本** (`scripts/check-health.sh`): 手动检查服务状态

### 工作原理

- 健康监控每 30 秒检查一次服务状态
- 检查健康端点、主要页面响应
- 连续 3 次失败后自动重启服务
- 启动服务时自动启动健康监控

### 常见问题处理

如果遇到 404 错误：

```bash
# 1. 快速检查服务状态
/workspace/projects/scripts/check-health.sh

# 2. 手动重启服务
pkill -f 'pnpm tsx'
sleep 2
cd /workspace/projects && coze dev > /app/work/logs/bypass/dev.log 2>&1 &

# 3. 查看日志
tail -50 /app/work/logs/bypass/dev.log
tail -20 /app/work/logs/bypass/health-monitor.log
```

## 部署说明

项目使用 Coze CLI 进行部署：

```bash
coze build
coze start
```

## 注意事项

1. **Hydration 错误**: 避免在 JSX 渲染逻辑中直接使用 `Date.now()`、`Math.random()` 等动态数据
2. **文件上传**: 文件上传后存储到 TOS，按需生成签名 URL
3. **视频生成**: 使用 Seedance 2.0 模型，支持文生视频和图生视频
4. **智能体对话**: 使用 LLM 流式输出，支持多轮对话
