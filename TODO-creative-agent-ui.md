# 创意小海 UI 重构任务清单

**创建时间**: 2025-04-09
**项目**: 海盟会 - 创意小海
**状态**: 待执行
**激活语**: 代办事项

---

## ⚠️ 重要说明

1. **激活语**: 当用户说"代办事项"时，必须检查本文件的任务完成状态并汇报
2. **持久化**: 本文件保存在 `/workspace/projects/TODO-creative-agent-ui.md`，不会因会话结束或重启丢失
3. **非强制**: 以下任务是对创意小海的工作建议，没有任何强制要求模型必须执行的动作
4. **创意小海自主决策**: 所有工具调用和流程执行由创意小海根据用户对话自主决定

---

## 背景说明

### 项目目标
重构创意小海 (`/agent/create` 页面)，实现：
1. 完整的8步创作工作流
2. 美观的对话界面
3. 素材管理功能
4. 服务端会话管理

### 创意小海8步工作流（建议）
1. 唤醒与偏好展示
2. 任务识别与确认
3. 模型调用与进度反馈（分析视频/生成脚本）
4. 脚本呈现与确认
5. 脚本生成（3个风格选项）
6. 视频生成
7. 批量生成
8. 结束与保存

### 脚本分析格式（建议）
- 画面：场景、构图、色彩、光线
- 动作：人物/物体的具体动作
- 人物：面部细节、表情、穿着
- 口播：旁白/台词内容

---

## 任务清单

### 一、后端工具开发

---

#### 任务 1: delete_material - 删除素材工具

**描述**: 
在 `agent-tools-service.ts` 中新增删除素材工具，用户可以删除上传错误的素材。

**详细步骤**:
1. 在 `AgentToolsService` 类中新增 `deleteMaterial` 方法
2. 从 Supabase `uploaded_files` 表中删除指定记录
3. 如果是 TOS 文件，同时删除 TOS 中的文件
4. 在 `getAllTools()` 中注册 `delete_material` 工具

**验收标准**:
- 工具可被创意小海调用
- 成功返回 `{ success: true }`
- 素材从数据库和存储中删除

**依赖**: Supabase 数据库、 TOS 存储

---

#### 任务 2: update_material - 修改素材工具

**描述**: 
在 `agent-tools-service.ts` 中新增修改素材工具，用户可以重命名、修改分类、添加标签。

**详细步骤**:
1. 在 `AgentToolsService` 类中新增 `updateMaterial` 方法
2. 更新 Supabase `uploaded_files` 表中的对应记录
3. 在 `getAllTools()` 中注册 `update_material` 工具

**参数**:
```typescript
{
  material_id: string;
  name?: string;        // 新名称
  category?: string;    // 分类
  tags?: string[];      // 标签
}
```

**验收标准**:
- 工具可被创意小海调用
- 成功返回更新后的素材信息

**依赖**: Supabase 数据库

---

#### 任务 3: get_materials - 获取素材列表

**描述**: 
在 `agent-tools-service.ts` 中新增获取素材列表工具，支持分页和筛选。

**详细步骤**:
1. 在 `AgentToolsService` 类中新增 `getMaterials` 方法
2. 从 Supabase `uploaded_files` 表查询用户素材
3. 支持按类型（video/image）、时间排序
4. 在 `getAllTools()` 中注册 `get_materials` 工具

**参数**:
```typescript
{
  type?: 'video' | 'image' | 'all';
  limit?: number;       // 默认20
  offset?: number;      // 默认0
  sort_by?: 'created_at' | 'name';
  sort_order?: 'asc' | 'desc';
}
```

**验收标准**:
- 工具可被创意小海调用
- 返回素材列表和总数

**依赖**: Supabase 数据库

---

#### 任务 4: session_id 会话管理

**描述**: 
用服务端会话ID替代前端传history，解决安全风险和请求过大的问题。

**详细步骤**:
1. 在 Supabase 创建 `agent_sessions` 表
   - id (uuid, primary key)
   - user_id (uuid, foreign key)
   - messages (jsonb) - 存储对话历史
   - created_at, updated_at
   - last_active_at
2. 修改 API `/api/xiaohai/agent/chat`:
   - 接收 `session_id` 参数（可选）
   - 如果有 session_id，从数据库加载历史
   - 如果没有，创建新会话
   - 每次对话后保存历史到数据库
3. 前端修改:
   - 保存当前 session_id 到 localStorage
   - 每次请求带上 session_id
4. 设置过期策略:
   - 24小时无活动自动过期
   - 用户可主动清除

**验收标准**:
- 对话历史正确保存和加载
- 支持跨页面/跨设备同步
- 历史数据不通过请求传递

**依赖**: Supabase 数据库、前端状态管理

---

### 二、前端UI重构

---

#### 任务 5: 右侧功能区布局

**描述**:
将 `/agent/create` 页面改为左对话+右功能的经典聊天布局。

**详细步骤**:
1. 创建新的页面布局结构
   - 左侧 65%: 对话区域
   - 右侧 35%: 功能配置区
2. 右侧区域包含:
   - 创作选项配置
   - 模板选择
   - 历史任务
   - 素材管理
3. 响应式设计:
   - 移动端：功能区折叠为底部抽屉
   - 桌面端：双栏布局

**设计参考**: UI/UX Pro Max 技能

**验收标准**:
- 页面布局美观
- 功能区清晰可见
- 响应式适配正常

**依赖**: UI/UX Pro Max、Frontend Studio

---

#### 任务 6: 欢迎页重构

**描述**:
重新设计欢迎页面，添加预设需求标签。

**详细步骤**:
1. 设计欢迎页布局
   - Logo 和欢迎语
   - 功能说明
   - 快速开始按钮
2. 添加预设标签（点击快速填充）:
   - 美妆带货
   - 美食种草
   - 数码测评
   - 服装展示
   - 知识科普
   - 剧情演绎
3. 每个标签可设置默认提示词

**设计参考**: UI/UX Pro Max - 现代简约风格

**验收标准**:
- 欢迎页美观
- 预设标签可点击
- 点击后自动填充输入框

**依赖**: UI/UX Pro Max

---

#### 任务 7: 对话气泡设计

**描述**:
用户说当前对话框"太丑了"，需要全新设计的聊天气泡。

**详细步骤**:
1. 用户消息气泡:
   - 右侧对齐
   - 主色调背景
   - 圆角设计
   - 可显示附件图标
2. 助手消息气泡:
   - 左侧对齐
   - 次要色调背景
   - 头像标识（创意小海）
   - 时间戳显示
3. 加载中动画:
   - 打字机效果
   - 流式输出样式
4. 消息分组:
   - 连续消息合并
   - 时间间隔显示

**设计参考**: UI/UX Pro Max - 避免AI味的现代设计

**验收标准**:
- 对话气泡美观现代
- 用户和助手区分清晰
- 打字机效果流畅

**依赖**: UI/UX Pro Max

---

#### 任务 8: 创作选项配置

**描述**:
在右侧功能区添加创作参数配置选项。

**详细步骤**:
1. 视频比例选择:
   - 9:16 (竖版) - 默认
   - 16:9 (横版)
   - 1:1 (方形)
2. 时长选择:
   - 3秒
   - 5秒 - 默认
   - 7秒
   - 10秒
3. 风格偏好:
   - 口播为主
   - 画面展示为主
   - 剧情类
4. 保存为默认选项

**验收标准**:
- 配置选项可见可点
- 选择后影响视频生成参数
- 默认值正确

**依赖**: Shadcn UI

---

#### 任务 9: 模板选择入口

**描述**:
在右侧功能区添加模板快速选择入口。

**详细步骤**:
1. 显示已保存的模板列表
2. 模板卡片展示:
   - 模板名称
   - 缩略图
   - 使用次数
3. 点击模板:
   - 填充脚本参数
   - 快速开始生成
4. 创建新模板入口

**验收标准**:
- 模板列表正确加载
- 点击可快速使用模板
- 显示使用次数

**依赖**: get_templates 工具、Shadcn UI

---

#### 任务 10: 历史任务侧边栏

**描述**:
在右侧功能区显示最近3个创作任务。

**详细步骤**:
1. 从 Supabase 查询用户最近的视频生成任务
2. 任务卡片展示:
   - 缩略图
   - 创建时间
   - 状态（完成/进行中）
3. 点击可查看详情或继续操作
4. 支持清空历史

**验收标准**:
- 正确显示最近任务
- 可点击查看详情
- 支持清空

**依赖**: Supabase 数据库、Shadcn UI

---

#### 任务 11: 素材管理界面

**描述**:
在右侧功能区添加素材管理界面（列表+删除+编辑）。

**详细步骤**:
1. 素材列表展示:
   - 缩略图
   - 名称
   - 类型
   - 时间
2. 操作按钮:
   - 编辑（重命名/分类）
   - 删除
3. 新增素材上传入口
4. 筛选和排序

**验收标准**:
- 素材列表正确显示
- 编辑功能可用
- 删除功能可用（调用 delete_material）

**依赖**: get_materials、update_material、delete_material 工具、Shadcn UI

---

#### 任务 12: 混合输入框

**描述**:
优化底部输入框，支持文字+链接+拖拽上传。

**详细步骤**:
1. 文字输入框:
   - 支持多行
   - 自动增高
2. 视频链接输入:
   - 快捷粘贴按钮
   - 自动识别链接格式
3. 文件上传:
   - 拖拽上传区域
   - 点击上传按钮
   - 支持视频和图片
4. 发送按钮:
   - 回车发送
   - 点击发送

**验收标准**:
- 文字输入正常
- 链接自动识别
- 拖拽上传可用
- 上传进度可见

**依赖**: Frontend Studio

---

#### 任务 13: 上传进度显示

**描述**:
显示视频上传状态和进度。

**详细步骤**:
1. 上传中状态:
   - 进度条
   - 百分比
   - 取消按钮
2. 上传完成:
   - 预览图
   - 文件名
   - 清除按钮
3. 上传失败:
   - 错误提示
   - 重试按钮

**验收标准**:
- 进度条实时更新
- 状态切换正常
- 错误处理完善

**依赖**: 前端状态管理

---

#### 任务 14: 脚本预览卡片

**描述**:
显示脚本预览，包含分镜信息和预览图。

**详细步骤**:
1. 脚本信息展示:
   - 脚本标题
   - 风格标签
   - 总时长
2. 分镜列表:
   - 每个分镜一段（3秒）
   - 画面描述
   - 动作描述
   - 口播内容
3. 预览图区域:
   - 为每段生成预览图
   - 点击放大查看
4. 操作按钮:
   - 重新生成脚本
   - 调整参数
   - 确认使用

**验收标准**:
- 脚本内容清晰展示
- 预览图正确显示
- 操作按钮可用

**依赖**: generate_first_frame 工具、UI/UX Pro Max

---

#### 任务 15: 视频结果卡片

**描述**:
美化视频生成结果展示。

**详细步骤**:
1. 视频播放区:
   - 视频预览
   - 播放控制
   - 全屏按钮
2. 缩略图展示
3. 操作按钮:
   - 下载视频
   - 分享链接
   - 生成配文
   - 保存到素材库
   - 重新生成
4. 视频信息:
   - 生成时间
   - 使用模型
   - 分辨率

**验收标准**:
- 视频播放流畅
- 操作按钮可用
- 样式美观

**依赖**: UI/UX Pro Max

---

#### 任务 16: 新对话判断UI

**描述**:
当检测到上下文断层时，询问用户是否开启新对话。

**详细步骤**:
1. 检测逻辑（前端或后端）:
   - 上下文关联度低于阈值
   - 或超过10分钟无交互
2. 弹窗询问:
   - "检测到话题切换，是否开启新对话？"
   - 选项: "继续当前对话" / "开启新对话"
3. 选择后:
   - 继续: 保持当前上下文
   - 新对话: 清除历史，重新开始

**验收标准**:
- 弹窗正确显示
- 选择后行为正确
- 不影响正常对话流程

**依赖**: session_id 管理、前端状态管理

---

#### 任务 17: 分镜预览流程（增强版）

**描述**:
生成前3秒的脚本预览图，同步展示脚本内容，支持灵活的首帧配置选项。

**详细步骤**:
1. 前端触发:
   - 脚本生成完成后
   - 提取第一段分镜（0-3秒）的内容
   - 显示"正在生成预览..."
2. 调用 generate_first_frame:
   - 提取第一段分镜的：画面+动作+人物描述
   - 单次调用，生成一张预览图
3. 预览图展示（增强版）:
   ```
   ┌─────────────────────────────────────────┐
   │  前3秒预览图                              │
   │  ┌─────────────┐                         │
   │  │   预览图     │  【画面】近景暖色调...    │
   │  └─────────────┘  【口播】姐妹们看过来...  │
   │                  【动作】手部拿起产品...   │
   │                                         │
   │  ○ 使用此图作为首帧    ○ 调整脚本        │
   │  ○ 重新生成首帧        ○ 指定其他分镜    │
   └─────────────────────────────────────────┘
   ```
4. 首帧配置选项:
   - **使用此图作为首帧** → 传给 Seedance 2.0
   - **调整脚本** → 重新生成脚本
   - **重新生成首帧** → 再次调用 generate_first_frame
   - **指定其他分镜** → 下拉选择其他分镜（3-6秒、6-9秒等）
5. 选择后执行对应操作

**新增组件**:
- 创作选项配置增加"分镜选择"下拉（任务 8.1）

**验收标准**:
- 只生成一张预览图（第一段3秒）
- 预览图同步展示脚本文本（画面/口播/动作）
- 提供4种首帧配置选项
- 选择"指定其他分镜"时显示下拉选择

**依赖**: generate_first_frame 工具、前端状态管理、任务8（创作选项配置）

**备注**: 整合创意小海建议的增强版方案

---

## 三、给创意小海的建议（非强制）

| # | 建议 | 说明 | 执行方式 |
|---|------|------|---------|
| A | 批量生成首帧图 | 脚本生成后，自主决定是否批量调用 generate_first_frame | 创意小海自主决策 |
| B | 脚本分析格式 | 建议按3秒/4维度格式输出分析结果 | 建议，非强制 |
| C | 上下文断层检测 | 自主判断上下文关联度，必要时询问用户 | 建议，非强制 |

### 四、创意小海对任务17的反馈（2025-04-09）

**用户方案**：
- 只生成前3秒的脚本预览图
- 预览图可作为首帧图传给 Seedance 2.0

**创意小海回复**：

✅ **方案优势**：
1. 降本提效 - 减少无效生成
2. 复用性强 - 预览图直接复用为首帧
3. 流程更顺滑 - 降低返工率

⚠️ **潜在问题**：
1. 前3秒预览如果只展示画面风格，没有同步对应脚本的口播、动作标注，用户可能没法判断内容和画面的匹配度
2. 部分用户的视频核心卖点可能不在前3秒
3. 直接复用前3秒帧为首帧可能会出现首帧信息不足、不够抓人的情况

💡 **改进建议**：
1. 预览输出时同步绑定前3秒的脚本内容（画面、口播、动作标注）
2. 给用户提供可选配置：可选择默认生成前3秒预览，也可自定义指定某段分镜做预览
3. 增加首帧二次确认环节：默认把预览图作为首帧候选，支持用户选择「微调首帧」或「重新生成专属首帧」

**✅ 已采纳**：以上3条建议已整合到任务17增强版中

---

## 执行顺序

```
第一阶段（基础能力）:
  4 → session_id 会话管理
  12 → 混合输入框
  7 → 对话气泡设计

第二阶段（核心功能）:
  14 → 脚本预览卡片
  15 → 视频结果卡片
  17 → 分镜预览流程

第三阶段（功能区）:
  5 → 右侧功能区布局
  8 → 创作选项配置
  9 → 模板选择入口
  10 → 历史任务侧边栏
  13 → 上传进度显示

第四阶段（素材管理）:
  1 → delete_material
  2 → update_material
  3 → get_materials
  11 → 素材管理界面

第五阶段（细节优化）:
  6 → 欢迎页重构
  16 → 新对话判断UI
```

---

## 状态追踪

| 任务 | 状态 | 完成时间 | 备注 |
|------|------|---------|------|
| 1. delete_material | ✅ 已完成 | 2025-04-09 | 素材删除工具 |
| 2. update_material | ✅ 已完成 | 2025-04-09 | 素材修改工具 |
| 3. get_materials | ✅ 已完成 | 2025-04-09 | 素材列表查询工具 |
| 4. session_id | ✅ 已完成 | 2025-04-09 | 会话管理工具 |
| 5. 右侧功能区布局 | ✅ 已完成 | 2025-04-09 | 新建 RightSidebar 组件 + 新页面 |
| 6. 欢迎页重构 | ✅ 已完成 | 2025-04-09 | 整合到新页面 |
| 7. 对话气泡设计 | ✅ 已完成 | 2025-04-09 | MessageBubble 组件 |
| 8. 创作选项配置 | ✅ 已完成 | 2025-04-09 | CreationOptions 组件 |
| 9. 模板选择入口 | ✅ 已完成 | 2025-04-09 | 整合到 RightSidebar |
| 10. 历史任务侧边栏 | ✅ 已完成 | 2025-04-09 | HistoryList 组件 |
| 11. 素材管理界面 | ✅ 已完成 | 2025-04-09 | MaterialManager 组件 |
| 12. 混合输入框 | ✅ 已完成 | 2025-04-09 | HybridInput 组件 |
| 13. 上传进度显示 | ✅ 已完成 | 2025-04-09 | 整合到 HybridInput |
| 14. 脚本预览卡片 | ✅ 已完成 | 2025-04-09 | ScriptPreviewCard 组件 |
| 15. 视频结果卡片 | ✅ 已完成 | 2025-04-09 | ResultCard 组件 |
| 16. 新对话判断UI | ⬜ 待开发 | - | 可在后续版本添加 |
| 17. 分镜预览流程 | ⬜ 待开发 | - | 依赖前端集成 |

---

## 需要的技能

| 技能 | 路径 | 用途 |
|-----|------|------|
| UI/UX Pro Max | `skills/ui-ux-design/ui-ux-pro-max-skill/` | 配色、布局、动效设计 |
| Frontend Studio | `skills/frontend-dev/` | React/Next.js + Tailwind CSS |
| Design Style Thinking | 已加载 | 设计风格指导 |
| Shadcn UI | `src/components/ui/` | UI组件库 |

---

## 数据库设计

### agent_sessions 表
```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  messages JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON agent_sessions(user_id);
CREATE INDEX idx_sessions_active ON agent_sessions(last_active_at);
```

---

*最后更新: 2025-04-09*
*激活语: 代办事项*

---

## 双笔记本用户记忆系统（新增任务）

### 背景
用户需要创意小海能够区分不同用户的记忆，包括：
1. 用户对话历史（24小时，双方都能看）
2. 用户偏好（永久保存，AI自己读写）

### 与创意小海的确认
- ✅ 创意小海自身没有持久化记忆能力
- ✅ 只需要外部记忆系统就够了
- ✅ 偏好更新应该由AI自己决定
- ✅ 系统只给读写工具，不硬编码规则

---

## 任务清单（双笔记本系统）

---

### 任务 18: 创建数据库表 - agent_conversation_messages
**描述**: 创建对话历史表，存储用户和AI的对话记录（24小时清理）

**表结构**:
```sql
CREATE TABLE agent_conversation_messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- user/assistant
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conv_messages_user ON agent_conversation_messages(user_id);
CREATE INDEX idx_conv_messages_created ON agent_conversation_messages(created_at);
```

**验收标准**:
- 表创建成功
- 索引创建成功
- 外键约束正确

**依赖**: Supabase 数据库

---

### 任务 19: 创建数据库表 - creative_user_preferences
**描述**: 创建用户偏好表，存储用户偏好设置（永久保存，带分类标签）

**表结构**:
```sql
CREATE TABLE creative_user_preferences (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
  preference_type VARCHAR(50) NOT NULL, -- aspect_ratio/duration/style/industry/product_tags/custom
  content TEXT NOT NULL,
  tags JSONB, -- 分类标签（可选）
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_preferences_user ON creative_user_preferences(user_id);
CREATE INDEX idx_preferences_type ON creative_user_preferences(preference_type);
```

**验收标准**:
- 表创建成功
- 索引创建成功
- 外键约束正确
- tags 字段是 JSONB 类型

**依赖**: Supabase 数据库

---

### 任务 20: 增强 chat API - 加载记忆并注入提示词
**描述**: 修改 `/api/xiaohai/agent/chat`，加载对话历史和用户偏好，注入提示词

**详细步骤**:
1. 验证用户身份
2. 查询表1（对话历史）：最近24小时，正序（最早→最近）
3. 查询表2（用户偏好）：所有偏好
4. 前端显示：对话历史正序（最早在最上面）
5. 给AI提示词：对话历史倒序（最近在最上面）+ 用户偏好
6. 保存用户消息到表1
7. 保存AI回复到表1

**给AI的提示词格式**:
```
📔 最近24小时对话：
（倒序，最近的在最上面）
10:05 - AI：好的...
10:04 - 用户：要科技感风格
...

📕 用户偏好：
- 比例：9:16
- 时长：8秒
- 风格：科技感

🛠️ 你可以用的工具：
- save_user_preference(type, content, tags)
```

**验收标准**:
- 对话历史正确加载（用户正序看，AI倒序看）
- 用户偏好正确加载
- 对话历史自动保存
- 提示词格式正确

**依赖**: 任务 18、任务 19

---

### 任务 21: 修改前端页面 - 显示历史消息
**描述**: 修改 `/agent/create` 页面，页面加载时自动显示最近24小时对话历史

**详细步骤**:
1. 页面加载时（useEffect），向后端请求用户数据
2. 显示对话历史：正序显示（最早在最上面）
3. 新消息追加在下面
4. 保持现有功能不变

**验收标准**:
- 页面加载时自动显示历史消息
- 历史消息正序显示（符合聊天记录习惯）
- 新消息正确追加
- 现有功能不受影响

**依赖**: 任务 20、现有的 `/agent/create` 页面

---

### 任务 22: 添加 save_user_preference 工具
**描述**: 在 `agent-tools-service.ts` 中新增保存用户偏好工具（带 tags 参数）

**详细步骤**:
1. 在 `AgentToolsService` 类中新增 `saveUserPreference` 方法
2. 插入/更新 `creative_user_preferences` 表
3. 如果是同一 preference_type，覆盖旧的
4. 在 `getAllTools()` 中注册 `save_user_preference` 工具

**参数**:
```typescript
{
  preference_type: "aspect_ratio" | "style" | "duration" | "industry" | "product_tags" | "custom";
  content: string;
  tags?: string[]; // 可选
}
```

**验收标准**:
- 工具可被创意小海调用
- 成功保存到数据库
- 相同类型的偏好会覆盖

**依赖**: 任务 19、`agent-tools-service.ts`

---

### 任务 23: 添加定时任务 - 清理24小时前的对话历史
**描述**: 添加定时任务，每小时真实删除24小时前的对话历史（避免文件过大）

**详细步骤**:
1. 创建定时任务脚本（或使用 Supabase cron）
2. 每小时执行一次
3. 执行 SQL:
   ```sql
   DELETE FROM agent_conversation_messages
   WHERE created_at < NOW() - INTERVAL '24 hours'
   ```
4. 记录日志

**验收标准**:
- 定时任务正常运行
- 24小时前的记录被真实删除
- 日志记录正确

**依赖**: 任务 18

---

## 执行顺序

```
第一阶段（数据库）:
  18 → agent_conversation_messages 表
  19 → creative_user_preferences 表

第二阶段（后端）:
  20 → 增强 chat API
  22 → save_user_preference 工具
  23 → 定时清理任务

第三阶段（前端）:
  21 → 修改前端页面显示历史消息

第四阶段（测试）:
  测试整个流程
```

---

## 状态追踪

| 任务 | 状态 | 完成时间 | 备注 |
|------|------|---------|------|
| 18. agent_conversation_messages 表 | ⬜ 待开发 | - | |
| 19. creative_user_preferences 表 | ⬜ 待开发 | - | |
| 20. 增强 chat API | ⬜ 待开发 | - | |
| 21. 修改前端页面 | ⬜ 待开发 | - | |
| 22. save_user_preference 工具 | ⬜ 待开发 | - | |
| 23. 定时清理任务 | ⬜ 待开发 | - | |

---
