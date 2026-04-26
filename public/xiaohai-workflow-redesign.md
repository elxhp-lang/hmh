# 创意小海工作流重构设计方案

> 创建时间：2025-01-XX
> 目的：重新设计并重构创意小海工作流，解决之前修修补补导致的问题

---

## 核心目标
**创意小海**：智能视频创作助手，帮助用户从参考视频或产品信息生成视频

---

## 完整工作流（8步骤）

```
步骤1: 唤醒与偏好展示
  ↓ 用户打开页面
  → 展示用户偏好（风格、时长、平台等）
  → 询问是否开始

步骤2: 任务识别与确认
  ↓ 用户输入（文本 + 视频/图片/链接）
  → 识别任务类型（视频分析 / 商品生成）
  → 提取关键信息（产品名称、参考视频）
  → 确认理解

步骤3: 模型调用与进度反馈
  ↓ 开始处理
  → 调用 LLM / 视觉模型
  → 实时更新进度（模型、任务、百分比）
  → 显示预计等待时间

步骤4: 脚本呈现与确认
  ↓ 生成参考脚本
  → 展示脚本表格（3秒维度）
  → 询问是否需要微调

步骤5: 脚本生成（3个变体）
  ↓ 确认产品
  → 生成3个不同风格的脚本
  → 展示供用户选择

步骤6: 视频生成
  ↓ 选择脚本
  → 调用 Seedance 2.0 生成视频
  → 实时更新进度
  → 完成后展示视频

步骤7: 批量生成
  ↓ 用户选择批量制作
  → 循环生成多个视频
  → 参考视频动态更新（原视频 + 已生成视频）

步骤8: 结束与保存
  ↓ 完成所有工作
  → 蒸馏用户偏好
  → 保存到数据库
  → 询问是否继续
```

---

## 详细步骤说明

### 步骤2: 任务识别与信息收集（已优化）

#### 输入
用户输入（文本 + 视频/图片/链接）

#### 处理流程

**1. 识别任务意图**

检测用户输入中的关键词，判断用户想要：
- 分析视频（提取风格、场景、镜头语言）
- 生成脚本（根据产品/主题）
- 生成视频（根据脚本）
- 批量生成（多个视频）

**2. 提取关键信息**

| 信息类型 | 提取方式 | 处理逻辑 |
|----------|----------|----------|
| **产品名称** | 用户输入 / 视频分析 | 提取后搜索商品图库，获取参考图片 |
| **任务类型** | 关键词检测 | 分析/生成脚本/生成视频/批量生成 |
| **参考视频** | 附件 / 链接 | 上传到临时存储，分析视频内容 |
| **平台** | 用户输入 / 偏好 | 抖音/快手/B站等（可选） |
| **时长** | 用户输入 / 偏好 | 15秒/30秒/60秒（可选） |
| **风格偏好** | 用户输入 / 偏好 | 简约/专业/创意等（可选） |

**3. 信息完整性检查**

✅ **必需信息**：
- 任务类型（分析/生成/批量生成）
- 产品名称（如果需要生成脚本）
- 参考视频（如果有）

⚠️ **可选信息**（有默认值）：
- 平台：用户偏好 → 抖音（9:16）
- 时长：用户偏好 → 30秒
- 风格：用户偏好 → 简洁专业

**4. 向用户展示识别结果**

```
【我理解了您的需求】

任务类型：生成30秒抖音短视频脚本
产品名称：海飞丝洗发水
参考视频：抖音视频（已解析）
创作方向：参考视频是产品展示类，风格偏简洁专业

如果理解正确，请回复"开始创作"
如需修改，请告诉我
```

**5. 等待用户确认**

- 用户回复"开始创作" → 进入步骤3
- 用户修改需求 → 重新提取信息
- 用户取消 → 结束工作流

#### 典型场景

**场景1：用户提供完整信息 ✅**

用户输入：
```
帮我为"海飞丝洗发水"生成一个30秒的抖音短视频，
参考视频：https://www.douyin.com/video/123456
```

系统处理：
1. ✅ 检测到产品名称："海飞丝洗发水"
2. ✅ 搜索商品图库，找到产品图片
3. ✅ 解析参考视频，提取视频信息
4. ✅ 展示识别结果
5. ✅ 等待确认

**场景2：用户未提供产品名称 ⚠️**

用户输入：
```
帮我生成一个引流短视频
```

系统处理：
1. ✅ 检测到任务类型：生成脚本
2. ❌ 缺少产品名称
3. ⚠️ 询问用户：
```
【我需要更多信息】

您想要为哪个产品/主题创作视频？
请告诉我产品名称或上传产品图片
```
4. 等待用户补充信息

**场景3：用户只提供视频 🎥**

用户输入：
```
[上传视频文件]
```

系统处理：
1. ✅ 检测到视频文件
2. ✅ 上传到临时存储
3. ✅ 调用视觉模型分析视频
4. ✅ 展示分析结果：
```
【我正在分析您的视频...】

正在分析视频内容...
视频时长：25秒
视频类型：产品展示
场景：家庭浴室
风格：温馨生活化

分析完成！您想要：
A. 分析这个视频的创作技巧
B. 仿照这个视频创作新视频
C. 其他需求

请告诉我您想要做什么
```

**场景4：用户提供视频链接 🔗**

用户输入：
```
帮我分析这个视频：https://www.douyin.com/video/123456
```

系统处理：
1. ✅ 检测到视频链接
2. ✅ 下载视频
3. ✅ 上传到临时存储
4. ✅ 调用视觉模型分析
5. ✅ 展示分析结果

#### 伪代码

```typescript
async function step2TaskRecognition(
  message: string,
  attachments: Attachment[]
): Promise<ProcessingResult> {
  // 1. 检测任务意图
  const intent = detectIntent(message);

  // 2. 提取关键信息
  const productName = extractProductName(message);

  // 3. 处理附件
  const videos = attachments.filter(a => a.type === 'video');
  const images = attachments.filter(a => a.type === 'image');

  // 4. 如果有视频，分析视频
  if (videos.length > 0) {
    const videoAnalysis = await analyzeVideo(videos[0].url);

    // 尝试从视频提取产品名称
    const extractedProductName = extractProductNameFromVideo(videoAnalysis);

    // 如果用户没提供产品名，但视频能提取到
    if (!productName && extractedProductName) {
      // 用提取到的产品名
      await updateWorkflow(workflowId, { productName: extractedProductName });
    }
  }

  // 5. 信息完整性检查
  const missingInfo = checkMissingInfo(workflowId);

  if (missingInfo.length > 0) {
    // 缺少关键信息，询问用户
    return {
      status: 'waiting_for_info',
      message: `我需要更多信息：${missingInfo.join(', ')}`
    };
  }

  // 6. 展示识别结果，等待确认
  const summary = generateSummary(workflowId);
  return {
    status: 'waiting_for_confirmation',
    message: `【我理解了您的需求】\n\n${summary}\n\n如果理解正确，请回复"开始创作"`
  };
}
```

#### 关键改进点

| 改进项 | 原设计 | 新设计 |
|--------|--------|--------|
| **任务类型** | 视频分析 / 商品生成 | 分析/脚本/视频/批量（统一流程） |
| **产品名称** | 让用户提供 | 智能提取 + 商品图库搜索 + 缺失时才询问 |
| **视频处理** | 仅作为参考 | 分析视频内容，提取更多信息 |
| **确认方式** | 不明确 | 清晰展示识别结果 + 用户确认 |
| **用户体验** | 可能反复询问 | 尽量减少询问，一次性收集信息 |

---

### 步骤6: 视频生成（已优化）

#### 输入
- 用户选择的脚本
- 工作流中的参考视频（如果有）
- 工作流中的参考图片（如果有）

#### 处理流程

**1. 准备 Seedance 2.0 请求内容**

⚠️ **关键要求**：调用 Seedance 2.0 时，必须**同时提交**以下内容：

| 内容类型 | 来源 | 格式 | 说明 |
|----------|------|------|------|
| **脚本** | 用户选择的脚本 | text | 格式化后的脚本文本（包含画面、口播、风格） |
| **参考短视频** | 工作流中的参考视频 | video_url | 最多3个，role: 'reference_video' |
| **参考图片** | 商品图库/用户上传 | image_url | 最多5个，role: 'reference_image' |

**2. 构建请求内容数组**

```typescript
const content: Content[] = [];

// 1. 添加脚本文本（必需）
content.push({
  type: 'text',
  text: formatScriptForSeedance(selectedScript),
});

// 2. 添加参考视频（可选，最多3个）
const referenceVideos = selectReferenceVideos(workflow);
for (let i = 0; i < Math.min(referenceVideos.length, 3); i++) {
  content.push({
    type: 'video_url',
    video_url: { url: referenceVideos[i] },
    role: 'reference_video',
  });
}

// 3. 添加参考图片（可选，最多5个）
const referenceImages = selectReferenceImages(workflow);
for (let i = 0; i < Math.min(referenceImages.length, 5); i++) {
  content.push({
    type: 'image_url',
    image_url: { url: referenceImages[i] },
    role: 'reference_image',
  });
}
```

**3. 调用 Seedance 2.0 生成视频**

```typescript
const request: CreateTaskRequest = {
  model: 'doubao-seedance-2-0-260128', // 标准版
  content: content, // 同时包含脚本、视频、图片
  ratio: '9:16', // 竖屏
  duration: selectedScript.duration, // 根据脚本时长
  generate_audio: true, // 生成配音
  watermark: false, // 无水印
  camerafixed: false, // 允许相机移动
};

const response = await seedanceClient.createTask(request);
const taskId = response.id;
```

**4. 轮询任务状态**

```typescript
while (true) {
  const task = await seedanceClient.getTask(taskId);

  // 实时更新进度
  sendProgress({
    currentModel: 'Seedance 2.0',
    currentTask: '视频生成中',
    percentage: calculateVideoProgress(task.status),
    estimatedTime: estimateRemainingTime(task.status, task.updated_at),
  });

  if (task.status === 'succeeded') {
    // 视频生成成功
    const videoUrl = task.content?.video_url;
    break;
  }

  if (task.status === 'failed') {
    // 视频生成失败
    throw new Error(task.error?.message || '视频生成失败');
  }

  // 等待3秒后继续轮询
  await sleep(3000);
}
```

**5. 下载并存储视频**

```typescript
// 1. 下载视频到本地临时目录
const tempPath = `/tmp/users/${userId}/temp_video_${Date.now()}.mp4`;
await downloadVideo(videoUrl, tempPath);

// 2. 上传到 TOS
const tosKey = `users/${userId}/videos/video_${Date.now()}_${random}.mp4`;
await uploadToTOS(tempPath, tosKey);

// 3. 删除本地临时文件
await fs.unlink(tempPath);

// 4. 更新数据库记录
await updateWorkflow(workflowId, {
  generatedVideos: workflow.generatedVideos.concat({
    tosKey: tosKey,
    scriptId: selectedScript.id,
    createdAt: new Date(),
  }),
});
```

**6. 展示生成的视频**

```
【视频生成完成！】

✅ 视频已生成
时长：30秒
分辨率：720p

[视频预览]

您想要：
A. 下载视频
B. 批量生成更多视频
C. 修改脚本重新生成
D. 结束

请告诉我您的选择
```

#### 参考资源获取策略

**参考短视频来源**：
1. 用户在步骤2上传的参考视频
2. 用户在步骤2提供的视频链接（已解析）
3. 之前生成的视频（批量生成时）
4. 学习库中的相关视频

**参考图片来源**：
1. 商品图库中的产品图片（自动搜索）
2. 用户在步骤2上传的图片
3. 从参考视频中提取的帧（作为参考）

**选择优先级**：
- 用户上传的视频 > 视频链接 > 学习库视频 > 已生成视频
- 商品图库图片 > 用户上传图片 > 视频帧

#### 脚本格式化示例

```typescript
function formatScriptForSeedance(script: Script): string {
  let text = `请根据以下脚本生成短视频：\n\n`;

  for (const scene of script.scenes) {
    text += `${scene.time}秒: ${scene.visual}\n`;
    if (scene.character) {
      text += `人物：${scene.character}\n`;
    }
    if (scene.voiceover) {
      text += `口播：${scene.voiceover}\n`;
    }
    text += `风格：${scene.style}\n\n`;
  }

  text += `\n整体风格：${script.style}`;
  text += `\n时长：${script.duration}秒`;
  text += `\n平台：${script.platform}`;

  return text;
}
```

#### 错误处理

| 错误类型 | 处理方式 | 恢复策略 |
|----------|----------|----------|
| **Seedance API 超时** | 提示用户 | 重试（最多3次），切换快速版模型 |
| **内容审核失败** | 提示用户修改脚本 | 去除敏感内容后重试 |
| **配额不足** | 提示用户 | 升级配额或删除旧视频 |
| **下载失败** | 自动重试 | 指数退避，最多3次 |
| **上传失败** | 自动重试 | 指数退避，最多3次 |
| **网络问题** | 等待恢复 | 自动重试，间隔10秒→30秒→60秒 |

#### 关键改进点

| 改进项 | 原设计 | 新设计 |
|--------|--------|--------|
| **内容提交** | 脚本 + 视频可选 | 脚本 + 视频 + 图片（同时提交） |
| **参考图片** | 不支持 | 支持参考图片（商品图库/用户上传） |
| **错误处理** | 简单提示 | 详细错误 + 恢复策略 |
| **进度反馈** | 简单状态 | 模型名称 + 任务 + 百分比 + 预计时间 |
| **存储流程** | 仅保存 URL | 下载 + 上传TOS + 删除本地 + 记录key |

---

## 关键设计问题（待确认）

### 1. 任务启动方式 ✅ 已确认：方案A

用户说"我想创作一个短视频"时，应该：

**选项A**：引导用户上传参考视频或输入产品名称 ✅ **已选择**
- 优点：明确引导，用户知道该做什么
- 缺点：增加一个交互步骤

**选项B**：直接创建工作流，等待用户提供更多信息
- 优点：简化流程
- 缺点：用户可能不知道要做什么

**选项C**：询问用户是想"分析参考视频"还是"制作产品视频"
- 优点：精准识别需求
- 缺点：增加询问次数

**实现方式**：
```
用户打开创意小海页面
  ↓
显示欢迎消息：
"您好！我是创意小海，智能视频创作助手。

我可以帮您：
• 分析参考视频，提取创作技巧
• 根据产品信息生成脚本
• 批量生成短视频

请选择：
A. 上传参考视频（推荐）
B. 输入产品名称
C. 直接开始（我会引导您）"
  ↓
用户选择后，进入步骤2
```

---

### 2. 探索性表达的处理
用户说"帮我看看"或"我想创作"时，应该：

**选项A**：返回引导消息，告知可以做什么
- 优点：用户明确知道功能
- 缺点：消息较长

**选项B**：默认等待用户提供视频或产品名称
- 优点：简化流程
- 缺点：用户可能不知道要做什么

**选项C**：询问用户的具体需求
- 优点：精准定位
- 缺点：增加交互

**✅ 已选择：选项A**

**实现方式**：
```
用户输入："帮我看看"
  ↓
系统回复：
"您好！我是创意小海，智能视频创作助手。

我可以帮您完成以下任务：

📹 **视频分析**
• 分析参考视频的创作技巧
• 提取视频的风格、场景、镜头语言
• 生成视频分析报告

📝 **脚本创作**
• 根据产品信息生成脚本
• 生成3个不同风格的脚本方案
• 支持手动修改和优化

🎬 **视频生成**
• 根据脚本生成短视频
• 支持多模态参考（视频+图片）
• 批量生成多个视频

📚 **学习库**
• 上传优秀视频供我学习
• 自动提取创作知识
• 应用到新的创作中

📦 **商品图库**
• 上传商品图片
• 我会自动识别商品信息
• 提供创作参考

请告诉我您想要做什么，或直接上传视频/图片开始！"
```

---

### 3. 工作流状态管理
工作流数据应该存在哪里？

**选项A**：内存（activeWorkflows Map）
- 优点：速度快，简单
- 缺点：服务重启丢失

**选项B**：数据库（xiaohai_workflows 表）
- 优点：持久化，支持断点续接
- 缺点：读写有延迟

**选项C**：混合（内存 + 数据库同步） ✅ **已选择**
- 优点：兼顾速度和持久化
- 缺点：实现复杂

**实现方式**：
```typescript
// 工作流状态管理策略

// 内存：实时数据（快速访问）
const activeWorkflows = new Map<string, Workflow>();

// 数据库：持久化数据（断点续接）
// 表：xiaohai_workflows

// 状态分类：

// 🔴 关键状态（必须持久化到数据库）
- workflow_id
- user_id
- current_step (当前步骤)
- status (active/paused/completed/failed)
- created_at
- updated_at

// 🟡 重要数据（需要持久化）
- selected_script (选择的脚本)
- generated_videos (已生成的视频列表)
- reference_videos (参考视频列表)
- reference_images (参考图片列表)
- product_name (产品名称)

// 🟢 临时数据（仅存内存）
- current_task (当前任务)
- progress (当前进度)
- estimated_time (预计时间)
- last_message (最后一条消息)

// 同步策略：

// 1. 状态变更时同步
- current_step 改变 → 更新数据库
- status 改变 → 更新数据库
- 新增视频 → 更新数据库

// 2. 定期同步（每30秒）
- 内存状态 → 数据库
- 防止丢失

// 3. 页面加载时恢复
- 从数据库加载工作流
- 恢复到内存
- 继续执行

// 4. 服务重启时恢复
- 扫描数据库中的 active 工作流
- 重新加载到内存
- 用户刷新页面后继续
```

**存储示例**：
```typescript
// 内存中的工作流
{
  id: "workflow_123",
  user_id: "user_456",
  current_step: 4,
  status: "active",

  // 关键数据（内存+数据库）
  product_name: "海飞丝洗发水",
  selected_script: { ... },
  generated_videos: [
    { tosKey: "...", scriptId: "...", createdAt: "..." }
  ],
  reference_videos: ["url1", "url2"],
  reference_images: ["url1", "url2", "url3"],

  // 临时数据（仅内存）
  current_task: "正在生成视频...",
  progress: 65,
  estimated_time: 45,
  last_message: "视频生成中，预计还需45秒"
}
```

---

### 4. 消息回复时机
什么时候发送消息给用户：

**选项A**：每个步骤完成后立即发送 ✅ **已选择**
- 优点：用户实时了解进度
- 缺点：消息可能较多

**选项B**：批量发送（例如：确认消息 + 处理结果 + 下一步提示）
- 优点：消息聚合，更清晰
- 缺点：等待时间可能较长

**选项C**：只发送关键节点消息（开始、完成、错误）
- 优点：消息精简
- 缺点：进度不够详细

**实现方式**：
```typescript
// 消息发送策略

// 1. 步骤开始时发送
sendMessage({
  type: 'text',
  content: '【开始任务】正在分析参考视频...',
  workflow: { currentStep: 3, currentTask: '视频分析' }
});

// 2. 处理中发送进度
sendMessage({
  type: 'progress',
  progress: {
    currentModel: 'doubao-seed-1-6-vision',
    currentTask: '正在提取视频帧...',
    percentage: 45,
    estimatedTime: 15
  }
});

// 3. 步骤完成时发送结果
sendMessage({
  type: 'text',
  content: '【分析完成】视频分析结果：\n\n• 视频时长：25秒\n• 场景：家庭浴室\n• 风格：温馨生活化'
});

// 4. 等待用户输入时发送提示
sendMessage({
  type: 'text',
  content: '您可以选择：\nA. 继续生成脚本\nB. 修改分析结果\nC. 取消'
});

// 5. 错误时立即发送
sendMessage({
  type: 'error',
  content: '【错误】视频解析失败，请检查视频链接是否正确'
});
```

**消息类型**：
- `text`：普通文本消息
- `progress`：进度更新（实时）
- `workflow`：工作流状态变更
- `script`：脚本生成完成
- `video`：视频生成完成
- `error`：错误消息

**发送时机**：
| 步骤 | 发送时机 | 消息类型 | 示例 |
|------|----------|----------|------|
| 步骤1 | 用户打开页面 | text | 欢迎消息 |
| 步骤2 | 意图识别完成 | text + workflow | 识别结果 |
| 步骤3 | 模型调用开始 | progress | 进度更新 |
| 步骤3 | 模型调用完成 | text | 处理结果 |
| 步骤4 | 脚本生成完成 | script | 脚本表格 |
| 步骤5 | 3个脚本生成完成 | text | 脚本选项 |
| 步骤6 | 视频生成开始 | progress | 进度更新 |
| 步骤6 | 视频生成完成 | video | 视频预览 |
| 任何时候 | 发生错误 | error | 错误提示 |

---

### 5. 脚本展示方式
生成的脚本应该如何展示：

**选项A**：Markdown 表格（支持渲染） ✅ **已选择**
- 优点：可读性好，易于维护
- 缺点：需要前端支持 Markdown

**选项B**：纯文本表格
- 优点：简单，无依赖
- 缺点：可读性一般

**选项C**：组件化展示（可交互）
- 优点：交互丰富，体验好
- 缺点：开发复杂

**实现方式**：
```markdown
【脚本方案1：简约专业风格】

| 时间 | 画面内容 | 人物 | 动作 | 口播/文案 | 风格 |
|------|----------|------|------|-----------|------|
| 0-3秒 | 产品特写，包装清晰 | - | 缓慢旋转 | 海飞丝洗发水，去屑更彻底 | 简约专业 |
| 3-6秒 | 泡沫丰富，冲洗效果 | - | 泡沫流动 | 告别头屑，自信每一天 | 清爽洁净 |
| 6-9秒 | 秀发柔顺，光泽动人 | - | 秀发飘动 | 轻盈柔顺，焕发魅力 | 温馨舒适 |
| 9-12秒 | 产品组合展示 | - | 并排展示 | 海飞丝系列，全方位呵护 | 品牌展示 |

整体风格：简约专业
总时长：12秒
平台：抖音（9:16）
```

**格式说明**：
- 表格列：时间、画面内容、人物、动作、口播/文案、风格
- 时间维度：每3秒为一个节点
- 支持前端 Markdown 渲染（react-markdown）

**选择交互**：
```
您可以选择：
A. 脚本方案1（简约专业）
B. 脚本方案2（温馨生活）
C. 脚本方案3（活力创意）
D. 自定义修改
```

**前端实现**：
```typescript
import ReactMarkdown from 'react-markdown';

function ScriptDisplay({ script }: { script: Script }) {
  const markdown = generateScriptMarkdown(script);

  return (
    <div className="script-container">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}

function generateScriptMarkdown(script: Script): string {
  let markdown = `【${script.title}】\n\n`;

  markdown += `| 时间 | 画面内容 | 人物 | 动作 | 口播/文案 | 风格 |\n`;
  markdown += `|------|----------|------|------|-----------|------|\n`;

  for (const scene of script.scenes) {
    markdown += `| ${scene.time} | ${scene.visual} | ${scene.character || '-'} | ${scene.action || '-'} | ${scene.voiceover || '-'} | ${scene.style} |\n`;
  }

  markdown += `\n**整体风格**：${script.style}\n`;
  markdown += `**总时长**：${script.duration}秒\n`;
  markdown += `**平台**：${script.platform}\n`;

  return markdown;
}
```

---

### 6. 多工作流切换 ✅ 已确认：下拉框

用户同时有多个工作流时：

**展示方式**：
- 列表（清晰，占用空间大）
- **下拉框（简洁，不够直观）** ✅ **已选择**
- Tab 页签（直观，数量有限）

**状态保留**：
- 切换后是否保留当前状态：✅ 保留
- 暂停的工作流如何恢复：✅ 可随时恢复

**实现方式**：
```typescript
// 工作流切换器

function WorkflowSwitcher({ workflows, currentWorkflowId, onSelect }) {
  const currentWorkflow = workflows.find(w => w.id === currentWorkflowId);

  return (
    <div className="workflow-switcher">
      <Label>当前工作流</Label>
      <Select value={currentWorkflowId} onValueChange={onSelect}>
        <SelectTrigger>
          <SelectValue placeholder="选择工作流" />
        </SelectTrigger>
        <SelectContent>
          {workflows.map((workflow) => (
            <SelectItem key={workflow.id} value={workflow.id}>
              {workflow.product_name || '未命名工作流'}
              <span className="ml-2 text-xs text-muted-foreground">
                ({workflow.status === 'active' ? '进行中' : '已完成'})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 当前工作流信息 */}
      {currentWorkflow && (
        <div className="mt-2 p-2 bg-muted rounded">
          <p className="text-sm font-medium">{currentWorkflow.product_name}</p>
          <p className="text-xs text-muted-foreground">
            步骤：{currentWorkflow.current_step}/8 | 状态：{workflowStatusText(currentWorkflow.status)}
          </p>
        </div>
      )}
    </div>
  );
}

// 切换逻辑
async function switchWorkflow(oldWorkflowId: string, newWorkflowId: string) {
  // 1. 暂停当前工作流
  await pauseWorkflow(oldWorkflowId);

  // 2. 加载新工作流
  const newWorkflow = await loadWorkflow(newWorkflowId);

  // 3. 切换前端状态
  setCurrentWorkflow(newWorkflow);

  // 4. 加载历史消息
  const messages = await loadMessages(newWorkflowId);
  setMessages(messages);
}
```

**工作流状态显示**：
- 进行中：`active` + 绿色图标
- 已暂停：`paused` + 黄色图标
- 已完成：`completed` + 蓝色图标
- 已失败：`failed` + 红色图标

**切换规则**：
- ✅ 支持任意时间切换
- ✅ 切换后自动暂停旧工作流
- ✅ 旧工作流状态保留
- ✅ 可随时恢复旧工作流
- ✅ 工作流独立隔离

---

## 技术架构

### 模型选择与使用策略

#### 基准对话模型
**模型选择**：`doubao-seed-1-8-251228`
- **用途**：所有通用对话、意图识别、文案生成
- **调用方式**：SSE 流式输出（stream）
- **温度参数**：0.7（平衡创造性和准确性）
- **思考模式**：disabled（快速响应）
- **缓存模式**：enabled（多轮对话加速）

#### 视觉理解模型
**模型选择**：`doubao-seed-1-6-vision-250815`
- **用途**：视频分析、图片理解、多模态输入
- **调用方式**：非流式（invoke）
- **参数**：
  - `fps`: 1.0（默认，平衡成本和效果）
  - `detail`: "high"（需要详细分析时）
  - `detail`: "low"（快速预览时）
- **使用场景**：
  - 分析参考视频风格（步骤3）
  - 分析学习库视频
  - 分析商品图片（商品图库）

#### 视频生成模型
**模型选择**：`doubao-seedance-2-0-260128`（标准版）
**备用模型**：`doubao-seedance-2-0-fast-260128`（快速版）
- **用途**：文生视频、图生视频、视频延长
- **调用方式**：异步任务（创建任务 → 轮询状态）
- **参数**：
  - `ratio`: "9:16"（竖屏，适合短视频平台）
  - `duration`: 4-15秒（根据脚本时长）
  - `generate_audio`: true（生成配音）
  - `watermark`: false（无水印）
  - `camerafixed`: false（允许相机移动）
- **参考视频**：最多3个（role: "reference_video"）
- **预计等待时间**：
  - 标准版：60-120秒
  - 快速版：30-60秒

#### 嵌入模型
**模型选择**：`doubao-embedding-v2`
- **用途**：
  - 脚本向量化（用于相似度匹配）
  - 视频内容向量化（学习库语义搜索）
  - 用户偏好向量化（蒸馏用户偏好）
- **维度**：1024
- **用途场景**：
  - 步骤8：蒸馏用户偏好
  - 学习库：视频语义搜索
  - 商品图库：相似商品推荐

#### 模型调用策略总结

| 步骤 | 任务 | 模型 | 调用方式 | 预计时间 |
|------|------|------|----------|----------|
| 2 | 意图识别 | doubao-seed-1-8 | stream | 2-5秒 |
| 3 | 视频分析 | doubao-seed-1-6-vision | invoke | 15-30秒 |
| 3 | 产品分析 | doubao-seed-1-8 | stream | 5-10秒 |
| 4 | 生成参考脚本 | doubao-seed-1-8 | stream | 5-15秒 |
| 5 | 生成3个变体脚本 | doubao-seed-1-8 | stream | 15-30秒 |
| 6 | 生成视频 | Seedance 2.0 | async | 60-120秒 |
| 7 | 批量生成视频 | Seedance 2.0 | async | 60-120秒/个 |
| 8 | 蒸馏偏好 | doubao-embedding-v2 | invoke | 3-5秒 |

### 视频存储方案

#### 存储位置
**对象存储**：火山引擎 TOS（兼容 S3）
- **存储桶**：`hmhv`
- **区域**：`cn-beijing`
- **端点**：`tos-cn-beijing.volces.com`

#### 存储路径设计
```
hmhv/
├── users/
│   └── {user_id}/
│       ├── videos/              # 生成的视频
│       │   └── video_{timestamp}_{random}.mp4
│       ├── images/              # 上传的图片
│       │   └── image_{timestamp}_{random}.jpg
│       ├── learning-library/    # 学习库视频
│       │   └── video_{timestamp}_{random}.mp4
│       ├── products/            # 商品图库
│       │   └── {product_id}/
│       │       └── images/
│       │           ├── primary.jpg    # 主图
│       │           └── view_{n}.jpg   # 多视角图
│       └── temp/                # 临时文件（自动清理）
├── system/                      # 系统资源
│   ├── templates/               # 脚本模板
│   └── defaults/                # 默认资源
└── cache/                       # 缓存（7天自动清理）
```

#### 存储流程

**1. 文件上传（用户上传视频/图片）**
```typescript
// 步骤：用户上传 → 临时存储 → 分析完成 → 正式存储
临时路径：/tmp/users/{user_id}/temp_{timestamp}.ext
正式路径：users/{user_id}/{type}/{timestamp}_{random}.ext
清理策略：24小时后自动清理临时文件
```

**2. 视频生成（Seedance 2.0 输出）**
```typescript
// 步骤：生成视频 → 下载到本地 → 上传到 TOS → 删除本地
流程：
1. Seedance 2.0 返回视频 URL（临时，1小时有效）
2. 下载视频到本地临时目录（/tmp）
3. 上传到 TOS：users/{user_id}/videos/video_{timestamp}.mp4
4. 删除本地临时文件
5. 数据库记录：tos_key（相对路径）
```

**3. 学习库视频**
```typescript
// 用户上传视频链接 → 下载 → 上传到 TOS
路径：users/{user_id}/learning-library/video_{timestamp}.mp4
附加：
- 提取视频帧（每5秒1帧）
- 生成向量嵌入
- 存储到 learning_library 表
```

**4. 商品图库**
```typescript
// 用户上传商品图片
路径：users/{user_id}/products/{product_id}/images/
文件：
- primary.jpg（主图，自动选择第一张）
- view_1.jpg, view_2.jpg, ...（多视角）
处理：
- 调整尺寸（最大2048x2048）
- 生成缩略图（400x400）
- 生成向量嵌入
```

#### 签名 URL 生成
```typescript
// 访问控制：签名 URL（15分钟有效）
获取签名 URL：
1. 用户请求播放视频
2. 后端生成 TOS 签名 URL
3. 返回给前端
4. 15分钟内可访问
5. 过期后重新生成

安全性：
- 仅授权用户可访问自己的文件
- 签名 URL 包含过期时间
- 防止盗链和未授权访问
```

#### 存储配额管理
```typescript
// 按用户限制存储空间
默认配额：10GB/用户
扩容：管理员可调整
配额检查：
- 上传前检查剩余空间
- 超过配额提示用户
- 提供扩容或清理选项
```

#### 自动清理策略
```typescript
// 定期任务（每天凌晨3点执行）
清理规则：
1. 临时文件：超过24小时
2. 缓存文件：超过7天
3. 失败视频：超过30天
4. 已删除工作流相关文件：超过90天

手动清理：
- 用户可手动清理
- 管理员可批量清理
```

### 恢复机制设计

#### 场景1：服务重启后恢复工作流
```typescript
// 恢复流程
1. 用户打开页面
2. 前端请求：GET /api/xiaohai/workflow?status=active
3. 后端查询数据库：xiaohai_workflows 表
4. 返回所有 active 状态的工作流
5. 前端展示工作流列表
6. 用户选择恢复哪个工作流
7. 后端加载工作流数据到内存
8. 继续执行

恢复点：
- 保存了 workflow 当前状态
- 保存了所有中间结果（脚本、视频等）
- 用户可以从中断的地方继续
```

#### 场景2：视频生成失败后重试
```typescript
// 失败恢复策略
1. 检测失败原因
2. 根据原因选择恢复方式

情况A：Seedance API 超时
  → 重试（最多3次）
  → 增加超时时间
  → 切换到快速版模型

情况B：配额不足
  → 提示用户升级配额
  → 或删除旧视频释放空间

情况C：内容审核失败
  → 提示用户修改脚本
  → 去除敏感内容
  → 重新生成

情况D：网络问题
  → 自动重试（指数退避）
  → 间隔：10秒 → 30秒 → 60秒

恢复流程：
- 保存失败的脚本
- 记录失败原因和次数
- 提供用户手动重试按钮
```

#### 场景3：用户刷新页面后继续
```typescript
// 状态持久化
1. 当前工作流 ID 存 localStorage
2. 页面加载后读取 workflow_id
3. 请求：GET /api/xiaohai/workflow/{id}
4. 恢复工作流状态
5. 重新加载消息历史
6. 继续当前步骤

// 断点续接
支持的工作流步骤：
- 步骤2：任务识别后
- 步骤4：脚本生成后
- 步骤5：脚本选择后
- 步骤6：视频生成后

不可续接的步骤：
- 步骤3：模型调用中（重新开始）
- 步骤7：批量生成中（提示用户）
```

#### 场景4：多工作流切换
```typescript
// 切换机制
1. 用户点击"切换工作流"
2. 暂停当前工作流
3. 保存当前状态到数据库
4. 加载新工作流
5. 恢复新工作流状态
6. 展示新工作流界面

// 状态保留
保留内容：
- 工作流 ID
- 当前步骤
- 已生成的脚本
- 已生成的视频
- 用户输入的内容

不保留：
- 实时进度（重新开始）
- 临时文件（已清理）
- 未保存的输入（需要重新输入）
```

#### 场景5：批量生成中断后恢复
```typescript
// 批量生成状态保存
保存内容：
- 总数：batch_count
- 当前索引：batch_current_index
- 已生成视频列表
- 失败记录

恢复流程：
1. 用户重新发起批量生成
2. 检测到未完成的批量任务
3. 提示用户："上次批量生成已完成 X/Y，是否继续？"
4. 用户选择继续
5. 从 batch_current_index + 1 开始
6. 完成剩余任务

错误处理：
- 某个视频失败 → 记录失败原因，继续下一个
- 所有视频失败 → 提示用户，建议修改脚本
- 用户取消 → 保存当前进度，下次可继续
```

#### 场景6：学习库视频分析失败
```typescript
// 分析失败恢复
1. 视频上传到 TOS 成功
2. 调用视觉模型分析失败
3. 记录失败状态：analyzing_failed
4. 用户可以：
   - 删除视频
   - 重新分析
   - 手动填写元数据

恢复方式：
- 自动重试（最多3次）
- 手动重新分析
- 降级：使用默认元数据
```

### 后端（API）
```
/api/xiaohai/chat
  - POST: 处理所有对话和工作流操作
  - SSE 流式输出
  - 支持 action:
    * welcome - 唤醒
    * recognize - 任务识别
    * confirm_product - 确认产品
    * select_script - 选择脚本
    * batch_generate - 批量生成
    * end - 结束工作流
    * get_progress - 获取进度
    * get_workflows - 获取工作流列表
    * pause_workflow - 暂停工作流
    * resume_workflow - 恢复工作流

/api/xiaohai/upload
  - POST: 上传文件（视频/图片）

/api/xiaohai/parse-link
  - POST: 解析视频链接（抖音、快手等）
```

### 前端（组件）
```
XiaohaiTestPage (主页面)
  ├── WorkflowProgress (进度条组件)
  ├── ScriptTable (脚本表格组件)
  ├── WorkflowSwitcher (工作流切换器)
  ├── MessageList (消息列表，支持流式)
  ├── InputArea (输入框 + 附件上传)
  └── VideoPreview (视频预览)
```

### 数据模型

#### xiaohai_workflows 表
```sql
CREATE TABLE xiaohai_workflows (
  id VARCHAR(36) PRIMARY KEY,              -- UUID
  user_id VARCHAR(36) NOT NULL,             -- 用户ID
  status VARCHAR(20) NOT NULL,              -- active, paused, completed, failed
  current_step INTEGER NOT NULL,            -- 1-8

  -- 任务信息
  task_type VARCHAR(50) NOT NULL,          -- video_analysis, product_generation
  product TEXT,                             -- 产品名称
  reference_videos JSONB,                  -- 参考视频URL数组

  -- 脚本（JSON格式）
  reference_script JSONB,                  -- 参考脚本
  generated_scripts JSONB,                 -- 生成的3个脚本
  selected_script_index INTEGER,           -- 选中的脚本索引

  -- 视频生成
  generated_videos JSONB,                  -- 已生成的视频URL数组
  video_tos_keys JSONB,                    -- 视频的TOS存储路径

  -- 进度
  progress JSONB NOT NULL,                 -- {currentModel, currentTask, percentage, estimatedTime}

  -- 用户偏好
  preferences JSONB,                       -- {style, duration, platform, cameraWork, ...}

  -- 批量生成
  batch_count INTEGER DEFAULT 1,           -- 批量生成数量
  batch_current_index INTEGER DEFAULT 0,   -- 当前索引

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

#### user_personalities 表
```sql
CREATE TABLE user_personalities (
  user_id VARCHAR(36) PRIMARY KEY,

  -- 创作偏好
  style TEXT[],                             -- 风格标签（数组）
  duration INTEGER DEFAULT 15,              -- 默认时长（秒）
  platform VARCHAR(50) DEFAULT '抖音',      -- 目标平台
  camera_work TEXT[],                       -- 镜头语言（数组）

  -- 光影偏好
  lighting VARCHAR(50) DEFAULT '自然光',   -- 光线
  color_tone VARCHAR(50) DEFAULT '暖色调', -- 色调
  saturation INTEGER DEFAULT 70,            -- 饱和度（0-100）

  -- 节奏偏好
  pacing VARCHAR(50) DEFAULT '中等',       -- 节奏
  transition_style VARCHAR(50) DEFAULT '流畅', -- 转场风格

  -- 音乐偏好
  music_style VARCHAR(50),                  -- 音乐风格
  voiceover_style VARCHAR(50),              -- 配音风格

  -- 更新时间
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_updated_at (updated_at)
);
```

#### learning_library 表
```sql
CREATE TABLE learning_library (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,

  -- 视频信息
  title TEXT,                               -- 视频标题
  tos_key TEXT NOT NULL,                    -- TOS存储路径
  original_url TEXT,                        -- 原始链接（如适用）

  -- 分析结果
  video_type VARCHAR(50),                   -- 视频类型
  scenes JSONB,                             -- 场景描述
  character_features TEXT,                  -- 人物特征
  camera_language TEXT[],                   -- 镜头语言
  color_style VARCHAR(50),                  -- 色彩风格
  creation_techniques TEXT[],               -- 创作技巧

  -- 向量嵌入（用于语义搜索）
  embedding vector(1024),                   -- 向量嵌入

  -- 商品展示分析
  product_display TEXT,                     -- 商品展示方式
  product_shots INTEGER DEFAULT 0,          -- 商品镜头数量

  -- 元数据
  duration INTEGER,                         -- 视频时长
  resolution VARCHAR(20),                   -- 分辨率
  frame_rate INTEGER,                       -- 帧率

  -- 统计
  usage_count INTEGER DEFAULT 0,            -- 使用次数
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_usage_count (usage_count)
);
```

#### product_library 表
```sql
CREATE TABLE product_library (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,

  -- 商品信息
  product_name TEXT NOT NULL,               -- 商品名称
  product_description TEXT,                 -- 商品描述
  category VARCHAR(100),                    -- 商品分类
  tags TEXT[],                              -- 标签（数组）

  -- 图片管理
  images JSONB NOT NULL,                    -- 图片信息数组
  -- [{url, tos_key, type, order}, ...]
  -- type: primary, view_1, view_2, ...
  primary_image_index INTEGER DEFAULT 0,    -- 主图索引

  -- 向量嵌入（用于相似商品推荐）
  embedding vector(1024),                   -- 向量嵌入

  -- 统计
  usage_count INTEGER DEFAULT 0,            -- 使用次数
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_category (category),
  INDEX idx_created_at (created_at),
  INDEX idx_usage_count (usage_count)
);
```

#### creative_memories 表（创意小海长期记忆）
```sql
CREATE TABLE creative_memories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,

  -- 记忆类型
  memory_type VARCHAR(50) NOT NULL,         -- script, workflow, preference, feedback

  -- 记忆内容
  title TEXT,                               -- 标题
  content TEXT NOT NULL,                    -- 内容（JSON格式）

  -- 关联信息
  related_workflow_id VARCHAR(36),          -- 关联的工作流ID
  related_product_id VARCHAR(36),           -- 关联的商品ID

  -- 向量嵌入（用于语义搜索）
  embedding vector(1024),                   -- 向量嵌入

  -- 评分和重要性
  importance_score INTEGER DEFAULT 50,      -- 重要性（0-100）
  recall_count INTEGER DEFAULT 0,           -- 回忆次数

  -- 时间信息
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_recalled_at TIMESTAMPTZ,             -- 最后回忆时间

  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_memory_type (memory_type),
  INDEX idx_importance (importance_score),
  INDEX idx_last_recalled (last_recalled_at)
);
```

#### agent_conversations 表（对话历史）
```sql
CREATE TABLE agent_conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(50) DEFAULT 'xiaohai',   -- 智能体ID

  -- 关联工作流
  workflow_id VARCHAR(36),                  -- 关联的工作流ID

  -- 消息内容
  role VARCHAR(20) NOT NULL,                -- user, assistant, system
  content TEXT NOT NULL,                    -- 消息内容
  content_type VARCHAR(20) DEFAULT 'text',  -- text, image, video, audio

  -- 附件信息
  attachments JSONB,                        -- 附件信息

  -- 元数据
  model_used VARCHAR(100),                  -- 使用的模型
  tokens_used INTEGER,                      -- Token 使用量
  processing_time_ms INTEGER,               -- 处理时间（毫秒）

  -- 时间信息
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  INDEX idx_user_id (user_id),
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_created_at (created_at)
);
```

### 消息格式规范

#### 用户消息格式
```typescript
interface UserMessage {
  action: string;                          // 动作类型
  message?: string;                        // 文本消息
  workflowId?: string;                     // 工作流ID
  attachments?: Attachment[];              // 附件
  data?: any;                              // 额外数据
}

interface Attachment {
  type: 'image' | 'video' | 'video_link';  // 类型
  url: string;                             // URL或TOS路径
  name?: string;                           // 文件名
  size?: number;                           // 文件大小
  metadata?: any;                          // 元数据
}
```

#### SSE 流式输出格式
```typescript
// 消息类型
type SSEMessage =
  | { type: 'text'; content: string }           // 文本消息
  | { type: 'workflow'; workflow: Workflow }    // 工作流更新
  | { type: 'progress'; progress: Progress }   // 进度更新
  | { type: 'script'; script: Script }         // 脚本
  | { type: 'scripts'; scripts: Script[] }     // 多个脚本
  | { type: 'video'; video: VideoInfo }        // 视频信息
  | { type: 'error'; error: string }           // 错误
  | { type: 'done' };                           // 完成标记

// 进度格式
interface Progress {
  currentModel: string;      // 当前模型
  currentTask: string;       // 当前任务
  percentage: number;        // 百分比（0-100）
  estimatedTime: number;     // 预计剩余时间（秒）
  currentStep: number;       // 当前步骤
  totalSteps: number;        // 总步骤
}

// 视频信息格式
interface VideoInfo {
  url: string;               // 视频URL（签名URL）
  duration: number;          // 时长
  resolution: string;        // 分辨率
  tosKey: string;            // TOS存储路径
  generatedAt: string;       // 生成时间
}
```

### 错误处理规范

#### 错误类型
```typescript
enum ErrorType {
  AUTH_ERROR = 'AUTH_ERROR',                 // 认证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',     // 验证错误
  MODEL_ERROR = 'MODEL_ERROR',               // 模型调用错误
  STORAGE_ERROR = 'STORAGE_ERROR',           // 存储错误
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',         // 配额超限
  WORKFLOW_ERROR = 'WORKFLOW_ERROR',         // 工作流错误
  NETWORK_ERROR = 'NETWORK_ERROR',           // 网络错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'            // 未知错误
}

interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: any;
  retryable: boolean;        // 是否可重试
  retryAfter?: number;       // 重试间隔（秒）
}
```

#### 错误恢复策略
```typescript
// 根据错误类型选择恢复策略
const errorRecoveryStrategies = {
  [ErrorType.AUTH_ERROR]: {
    retryable: false,
    action: 'redirect_to_login',
    message: '登录已过期，请重新登录'
  },

  [ErrorType.VALIDATION_ERROR]: {
    retryable: false,
    action: 'show_validation_error',
    message: '输入数据格式错误'
  },

  [ErrorType.MODEL_ERROR]: {
    retryable: true,
    maxRetries: 3,
    retryDelay: [5000, 10000, 20000],
    action: 'retry_with_fallback_model',
    message: 'AI模型调用失败，正在重试...'
  },

  [ErrorType.STORAGE_ERROR]: {
    retryable: true,
    maxRetries: 3,
    retryDelay: [2000, 5000, 10000],
    action: 'retry_upload',
    message: '文件上传失败，正在重试...'
  },

  [ErrorType.QUOTA_EXCEEDED]: {
    retryable: false,
    action: 'show_quota_alert',
    message: '存储配额已用完，请清理空间或升级配额'
  },

  [ErrorType.WORKFLOW_ERROR]: {
    retryable: false,
    action: 'reset_to_previous_step',
    message: '工作流执行失败，已回退到上一步'
  },

  [ErrorType.NETWORK_ERROR]: {
    retryable: true,
    maxRetries: 5,
    retryDelay: [2000, 5000, 10000, 20000, 30000],
    action: 'exponential_backoff',
    message: '网络连接异常，正在重试...'
  },

  [ErrorType.UNKNOWN_ERROR]: {
    retryable: false,
    action: 'log_error_and_alert',
    message: '发生未知错误，请联系管理员'
  }
};
```

---

## 我的建议

### 简化版本（稳定优先）✅ 推荐
**特点**：
1. 去掉复杂的意图识别，用户提供什么就处理什么
2. 每次对话创建一个新工作流（暂不支持多工作流）
3. 消息回复采用简单方式：每步完成立即发送一条消息
4. 脚本使用 Markdown 表格展示
5. 工作流数据存在数据库，内存做缓存

**优点**：
- 实现简单，易于维护
- 稳定可靠，不易出错
- 快速上线，逐步迭代

**缺点**：
- 功能相对简单
- 用户体验一般

---

### 完整版本（功能丰富）
**特点**：
1. 智能意图识别，引导用户
2. 支持多工作流并行
3. 消息流式输出，实时反馈
4. 组件化脚本展示，支持交互
5. 完整的状态管理和错误处理

**优点**：
- 功能丰富，体验好
- 智能化程度高
- 可扩展性强

**缺点**：
- 实现复杂，开发周期长
- 出错概率高
- 维护成本高

---

## 待确认问题清单

请回答以下问题，我会根据你的反馈重新设计：

1. **任务启动方式**：A / B / C？
2. **探索性表达处理**：A / B / C？
3. **工作流状态管理**：内存 / 数据库 / 混合？
4. **消息回复时机**：A / B / C？
5. **脚本展示方式**：A / B / C？
6. **多工作流切换**：列表 / 下拉框？是否保留状态？
7. **整体复杂度**：简化版本（稳定优先） / 完整版本（功能丰富）？

**最核心的需求是什么？**
- 快速生成视频
- 精确控制脚本
- 批量生成能力
- 学习视频风格
- 其他？

---

## 重构计划

### Phase 1: 确认设计（当前）
- ✅ 梳理工作流步骤
- ✅ 列出设计问题
- ⏳ 等待用户确认

### Phase 2: 设计详细方案
- 根据确认的需求设计详细方案
- 设计数据库表结构
- 设计 API 接口
- 设计前端组件

### Phase 3: 代码重构
- 重写后端服务（xiaohai-workflow-service.ts）
- 重写 API 路由（/api/xiaohai/chat/route.ts）
- 重写前端页面（/xiaohai/test/page.tsx）
- 更新相关组件

### Phase 4: 测试验证
- 单元测试
- 集成测试
- 端到端测试
- 用户体验测试

---

## 代码结构（重构后）

```
src/
├── lib/
│   └── xiaohai-workflow-service.ts    # 工作流服务（重写）
├── app/
│   ├── api/
│   │   └── xiaohai/
│   │       ├── chat/
│   │       │   └── route.ts           # API 路由（重写）
│   │       ├── upload/
│   │       │   └── route.ts           # 文件上传
│   │       └── parse-link/
│   │           └── route.ts           # 视频链接解析
│   └── xiaohai/
│       ├── test/
│       │   └── page.tsx              # 测试页面（重写）
│       └── components/               # 新增专用组件
│           ├── WorkflowProgress.tsx
│           ├── ScriptTable.tsx
│           ├── MessageList.tsx
│           └── InputArea.tsx
└── storage/
    └── database/
        └── xiaohai-schema.sql        # 数据库表定义
```

---

## 当前问题总结

### 之前的痛点
1. 消息回复缺失，用户体验差
2. 意图识别不准确，流程混乱
3. 对话框不自动滚动，新消息不可见
4. 代码修修补补，复杂度越来越高
5. 状态管理混乱，容易出错

### 重构目标
1. 简化状态管理，降低复杂度
2. 优化消息回复机制，确保每步有反馈
3. 改进意图识别逻辑，更智能
4. 提升用户体验，流畅自然
5. 代码结构清晰，易于维护

---

## 当前问题总结

### 之前的痛点
1. 消息回复缺失，用户体验差
2. 意图识别不准确，流程混乱
3. 对话框不自动滚动，新消息不可见
4. 代码修修补补，复杂度越来越高
5. 状态管理混乱，容易出错

### 重构目标
1. 简化状态管理，降低复杂度
2. 优化消息回复机制，确保每步有反馈
3. 改进意图识别逻辑，更智能
4. 提升用户体验，流畅自然
5. 代码结构清晰，易于维护

---

## 性能优化策略

### 前端性能优化

#### 1. 消息渲染优化
```typescript
// 虚拟滚动（消息超过50条时）
import { useVirtualizer } from '@tanstack/react-virtual';

// 延迟加载图片/视频
const [loadedImages, setLoadedImages] = useState(new Set());

// 流式输出优化（减少重渲染）
- 使用 ref 保存流式内容
- 使用 requestAnimationFrame 批量更新
- 避免频繁的 setState 调用
```

#### 2. 状态管理优化
```typescript
// 使用 Context + useReducer 管理复杂状态
const WorkflowContext = createContext();

// 避免深层对象更新
使用 Immer 或类似库：
import { produce } from 'immer';
const newState = produce(state, draft => {
  draft.workflow.progress.percentage = 50;
});
```

#### 3. 资源加载优化
```typescript
// 图片懒加载
import Image from 'next/image';

// 视频懒加载和预加载
const videoRef = useRef<HTMLVideoElement>();
useEffect(() => {
  if (shouldLoad) {
    videoRef.current?.load();
  }
}, [shouldLoad]);

// 智能预加载（预测下一步可能需要的资源）
- 用户在步骤4时，预加载步骤5的组件
- 用户在步骤6时，预下载生成的视频
```

### 后端性能优化

#### 1. 数据库查询优化
```typescript
// 使用连接池
const pool = new Pool({ max: 20, min: 5 });

// 添加必要的索引
CREATE INDEX idx_user_status_step ON xiaohai_workflows(user_id, status, current_step);

// 使用只读副本（如果有）
const replicaClient = getSupabaseClient({ readonly: true });

// 批量查询代替N+1查询
const workflows = await db('xiaohai_workflows')
  .whereIn('id', workflowIds)
  .select('*');
```

#### 2. 缓存策略
```typescript
// Redis 缓存（可选）
const cacheKey = `workflow:${workflowId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// 内存缓存（已激活的工作流）
const activeWorkflowsCache = new Map();

// LRU 缓存（最近使用的工作流）
import { LRUCache } from 'lru-cache';
const workflowCache = new LRUCache({ max: 100, ttl: 1000 * 60 * 30 });
```

#### 3. 异步任务优化
```typescript
// 使用消息队列（长时间任务）
// 步骤6（视频生成）和步骤7（批量生成）使用队列

// 任务队列结构
interface VideoGenerationTask {
  id: string;
  workflowId: string;
  script: Script;
  referenceVideos: string[];
  priority: 'high' | 'normal' | 'low';
  createdAt: Date;
}

// Worker 处理任务
- 从队列取出任务
- 调用 Seedance 2.0
- 轮询状态
- 保存结果
- 通知用户

// 队列管理
- 优先级队列（VIP用户优先）
- 重试队列（失败任务）
- 死信队列（多次失败）
```

#### 4. 并发控制
```typescript
// 限制同时处理的任务数
const MAX_CONCURRENT_TASKS = 10;
const semaphore = new Semaphore(MAX_CONCURRENT_TASKS);

async function processWithConcurrencyLimit(task: Task) {
  await semaphore.acquire();
  try {
    await processTask(task);
  } finally {
    semaphore.release();
  }
}

// 用户级并发限制
const userConcurrencyMap = new Map<string, number>();
const MAX_USER_CONCURRENT = 3;

function checkUserConcurrency(userId: string): boolean {
  const count = userConcurrencyMap.get(userId) || 0;
  return count < MAX_USER_CONCURRENT;
}
```

### 存储优化

#### 1. 视频转码和压缩
```typescript
// 生成视频后自动优化
- 降低码率（10Mbps → 5Mbps）
- 降低分辨率（720p，如用户需要可更高）
- 转换为 H.264 编码
- 优化音频（AAC 128kbps）

// 工具：FFmpeg
ffmpeg -i input.mp4 -c:v libx264 -crf 23 -c:a aac -b:a 128k output.mp4
```

#### 2. 图片优化
```typescript
// 上传时自动优化
- 调整尺寸（最大2048px）
- 压缩质量（85%）
- 生成缩略图（400px）
- 格式转换（WebP，节省30-50%空间）

// 工具：Sharp
await sharp(input)
  .resize(2048, 2048, { fit: 'inside' })
  .webp({ quality: 85 })
  .toBuffer();
```

#### 3. CDN 加速
```typescript
// 配置 CDN 加速访问
- TOS 默认支持 CDN
- 视频文件缓存时间：7天
- 图片文件缓存时间：30天
- 签名 URL 不缓存

// CDN 配置
Cache-Control: public, max-age=604800
Edge-Cache-Tag: video,user_123
```

### 监控和日志

#### 1. 性能监控
```typescript
// 关键指标监控
const metrics = {
  // API 响应时间
  apiResponseTime: {
    '/api/xiaohai/chat': { p50: 500, p95: 2000, p99: 5000 },
    '/api/xiaohai/upload': { p50: 1000, p95: 5000, p99: 10000 },
  },

  // 模型调用时间
  modelLatency: {
    'doubao-seed-1-8': { avg: 3000 },
    'doubao-seed-1-6-vision': { avg: 15000 },
    'Seedance 2.0': { avg: 90000 },
  },

  // 错误率
  errorRate: {
    '/api/xiaohai/chat': 0.02,  // 2%
    'Seedance 2.0': 0.05,       // 5%
  },

  // 并发数
  concurrentUsers: {
    peak: 50,
    avg: 20,
  },
};

// 上报到监控系统（如 Prometheus）
```

#### 2. 日志规范
```typescript
// 日志级别
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

// 日志格式
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  userId?: string;
  workflowId?: string;
  action: string;
  message: string;
  data?: any;
  error?: any;
}

// 关键操作日志
- 工作流创建
- 工作流状态变更
- 模型调用开始/结束
- 视频生成开始/完成
- 错误发生

// 示例
logger.info('Workflow created', {
  userId: 'user_123',
  workflowId: 'workflow_456',
  taskType: 'video_analysis',
  referenceVideos: ['video1.mp4']
});

logger.error('Video generation failed', {
  workflowId: 'workflow_456',
  error: error.message,
  retryCount: 2,
});
```

#### 3. 告警规则
```typescript
// 告警规则
const alertRules = [
  {
    name: 'High Error Rate',
    condition: 'errorRate > 0.1',  // 错误率超过10%
    severity: 'high',
    action: 'send_slack_notification',
  },

  {
    name: 'Slow Response Time',
    condition: 'apiResponseTime.p95 > 5000',  // P95超过5秒
    severity: 'medium',
    action: 'send_email',
  },

  {
    name: 'Model Down',
    condition: 'modelAvailability < 0.95',  // 模型可用率低于95%
    severity: 'critical',
    action: 'call_admin',
  },

  {
    name: 'Quota Almost Full',
    condition: 'storageUsage > 0.9',  // 存储使用超过90%
    severity: 'medium',
    action: 'alert_admin',
  },
];
```

---

## 安全性设计

### 1. 认证和授权
```typescript
// JWT Token 验证
- Token 有效期：7天
- Refresh Token：30天
- 权限检查：每个 API 都验证用户权限

// 权限等级
enum UserRole {
  SUPER_ADMIN = 100,
  ADMIN = 80,
  FINANCE = 60,
  MEMBER = 20,
}

// 权限检查中间件
function checkPermission(requiredRole: UserRole) {
  return (req, res, next) => {
    const user = req.user;
    if (user.role >= requiredRole) {
      next();
    } else {
      res.status(403).json({ error: '权限不足' });
    }
  };
}
```

### 2. 数据安全
```typescript
// 敏感数据加密
- API Key：环境变量，不提交到代码库
- 用户密码：bcrypt 加密存储
- 临时文件：定期清理

// 签名 URL
- TOS 签名 URL：15分钟有效期
- 防止盗链和未授权访问

// 数据脱敏
- 日志中隐藏敏感信息
- 错误消息不暴露内部细节
```

### 3. 内容审核
```typescript
// 自动内容审核
- 调用内容审核 API（如火山引擎内容审核）
- 审核类型：色情、暴力、政治、广告
- 审核结果：通过/拒绝/人工审核

// 审核流程
1. 用户上传视频/图片
2. 自动审核
3. 审核通过 → 继续处理
4. 审核拒绝 → 提示用户
5. 人工审核 → 等待管理员审核
```

---

## 成本控制

### 1. API 成本优化
```typescript
// 模型调用成本控制
- 选择合适的模型（避免过度使用旗舰模型）
- 控制上下文长度（避免超长对话）
- 使用缓存（减少重复调用）

// 成本估算
const modelCosts = {
  'doubao-seed-1-8': 0.002,      // ¥/千tokens
  'doubao-seed-1-6-vision': 0.05, // ¥/次
  'doubao-embedding-v2': 0.0001, // ¥/千tokens
  'Seedance 2.0': 2.0,            // ¥/次
};

// 用户配额
- 免费用户：10次视频生成/月
- 付费用户：100次视频生成/月
- 超出配额：按次计费
```

### 2. 存储成本优化
```typescript
// 自动清理策略
- 临时文件：24小时
- 缓存文件：7天
- 失败视频：30天
- 已删除工作流：90天

// 存储分级
- 热数据：SSD存储
- 冷数据：对象存储
- 归档数据：压缩存储
```

### 3. 带宽成本优化
```typescript
// CDN 缓存
- 视频文件：7天
- 图片文件：30天

// 智能压缩
- 视频码率控制
- 图片格式优化（WebP）
- 缩略图优先加载

// 按需加载
- 视频懒加载
- 图片懒加载
- 预加载预测
```

---

## 测试策略

### 1. 单元测试
```typescript
// 测试覆盖率目标：80%+

// 测试重点
- 工作流状态机逻辑
- 模型调用封装
- 错误处理逻辑
- 数据转换函数

// 工具
- Jest
- Testing Library
- MSW（Mock Service Worker）
```

### 2. 集成测试
```typescript
// API 测试
- 所有 API 接口
- 错误场景
- 边界条件

// 数据库测试
- CRUD 操作
- 事务处理
- 索引有效性
```

### 3. 端到端测试
```typescript
// 完整流程测试
1. 用户登录
2. 创建工作流
3. 上传视频
4. 生成脚本
5. 生成视频
6. 批量生成
7. 结束工作流

// 工具
- Playwright
- Cypress
```

### 4. 性能测试
```typescript
// 压力测试
- 并发用户：50人
- 每秒请求：100 QPS
- 响应时间：P95 < 2秒

// 负载测试
- 持续运行：24小时
- 监控内存泄漏
- 监控数据库连接
```

---

## 备注

### 设计原则

1. **简单优先**：能不复杂的就不要复杂
2. **用户至上**：所有设计以用户体验为中心
3. **可扩展性**：预留扩展接口，支持未来功能
4. **可维护性**：代码结构清晰，易于理解和修改
5. **可观测性**：完善的日志和监控，便于问题排查

### 技术选型理由

**后端框架**：Next.js 16 + TypeScript
- 成熟的生态，丰富的文档
- 内置 API Routes，简化开发
- 优秀的性能和 SEO 支持

**数据库**：Supabase (PostgreSQL)
- 开箱即用的认证和 RLS
- 实时订阅支持
- 强大的 JSONB 支持

**对象存储**：火山引擎 TOS
- 与 Seedance 2.0 同平台
- S3 兼容，易于迁移
- CDN 加速支持

**AI 模型**：豆包系列
- 国产模型，访问稳定
- 性价比高
- 多模态支持完善

### 开发规范

**代码风格**：
- 使用 ESLint + Prettier
- 遵循 TypeScript 严格模式
- 函数式编程优先

**提交规范**：
- feat: 新功能
- fix: 修复bug
- refactor: 重构
- docs: 文档
- test: 测试
- chore: 构建/工具

**分支策略**：
- main: 生产环境
- develop: 开发环境
- feature/*: 功能分支
- hotfix/*: 紧急修复

### 部署策略

**环境隔离**：
- 开发环境：DEV
- 测试环境：STAGING
- 生产环境：PROD

**部署流程**：
1. 代码提交到 develop
2. CI/CD 自动构建
3. 部署到 STAGING
4. 自动化测试
5. 人工验收
6. 合并到 main
7. 自动部署到 PROD

**回滚策略**：
- 保留最近3个版本
- 出现问题可快速回滚
- 回滚时间 < 5分钟

### 运维策略

**监控告警**：
- 7x24小时监控
- 关键指标告警
- 多渠道通知（邮件、短信、Slack）

**备份策略**：
- 数据库：每日备份，保留30天
- 对象存储：开启版本控制
- 代码：Git 仓库

**灾难恢复**：
- RPO（恢复点目标）：< 1小时
- RTO（恢复时间目标）：< 4小时
- 定期演练

---

## 附录

### A. 模型参数配置表

| 模型 | 温度 | 最大Token | 缓存 | 思考模式 | 用途 |
|------|------|-----------|------|----------|------|
| doubao-seed-1-8 | 0.7 | 4096 | enabled | disabled | 通用对话 |
| doubao-seed-1-8 | 0.2 | 8192 | disabled | enabled | 代码生成 |
| doubao-seed-1-6-vision | N/A | N/A | N/A | N/A | 视觉理解 |
| doubao-embedding-v2 | N/A | N/A | N/A | N/A | 向量嵌入 |
| Seedance 2.0 | N/A | N/A | N/A | N/A | 视频生成 |

### B. 文件类型支持

| 类型 | 格式 | 最大大小 | 处理方式 |
|------|------|----------|----------|
| 图片 | JPG, PNG, WEBP, GIF | 10MB | 自动优化 |
| 视频 | MP4, MOV, AVI | 500MB | 转码优化 |
| 音频 | MP3, WAV, AAC | 50MB | 转换为AAC |
| 文档 | PDF, TXT, MD | 20MB | 文本提取 |

### C. 配额限制

| 资源 | 免费用户 | 付费用户 | 超出处理 |
|------|----------|----------|----------|
| 视频生成/月 | 10次 | 100次 | 按次计费 |
| 存储空间 | 10GB | 100GB | 升级配额 |
| API调用/天 | 1000次 | 10000次 | 限流 |
| 并发任务 | 1个 | 3个 | 排队等待 |

### D. 环境变量清单

```bash
# 数据库
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# AI 模型
ARK_API_KEY=ark_xxx...

# 对象存储
TOS_BUCKET_NAME=hmhv
TOS_ENDPOINT=tos-cn-beijing.volces.com
VOLCENGINE_ACCESS_KEY_ID=AK...
VOLCENGINE_SECRET_ACCESS_KEY=xxx...

# 认证
JWT_SECRET=xxx...

# 应用
COZE_PROJECT_DOMAIN_DEFAULT=https://xxx.dev.coze.site
DEPLOY_RUN_PORT=5000
COZE_PROJECT_ENV=DEV|PROD

# 飞书通知
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx

# 可选
REDIS_URL=redis://localhost:6379
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### E. API 响应状态码

| 状态码 | 含义 | 处理方式 |
|--------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 请求错误 | 检查参数 |
| 401 | 未授权 | 重新登录 |
| 403 | 权限不足 | 升级权限 |
| 404 | 资源不存在 | 提示用户 |
| 429 | 请求过多 | 限流等待 |
| 500 | 服务器错误 | 重试或联系管理员 |
| 503 | 服务不可用 | 稍后重试 |

### F. 常见问题 FAQ

**Q1: 视频生成失败怎么办？**
A1: 检查脚本内容是否合规，网络是否正常，配额是否足够。可以重试或联系客服。

**Q2: 存储空间不足？**
A2: 清理旧视频，或升级配额。系统会自动清理临时文件。

**Q3: 如何提高生成速度？**
A3: 使用快速版模型，减少参考视频数量，优化脚本长度。

**Q4: 批量生成中途失败？**
A4: 系统会保存进度，可以从中断的地方继续。失败的视频可以单独重试。

**Q5: 如何导出视频？**
A5: 点击视频预览，选择下载。视频以签名URL形式提供，15分钟内有效。

**Q6: 能否使用自己的素材？**
A6: 可以。支持上传图片、视频作为参考，或使用视频链接。

**Q7: 脚本能否编辑？**
A7: 可以。在脚本展示页面，可以编辑脚本内容，然后重新生成。

**Q8: 支持哪些平台？**
A8: 支持9:16竖屏（抖音、快手、视频号），16:9横屏（B站、YouTube），1:1正方形（小红书）。

**Q9: 如何撤销操作？**
A9: 工作流可以暂停和恢复，但不能撤销已完成的步骤。可以创建新工作流重新开始。

**Q10: 数据安全吗？**
A10: 所有数据存储在私有云，使用加密传输，严格的权限控制。可以随时删除数据。

---

## 联系方式

- **技术支持**：support@example.com
- **商务合作**：business@example.com
- **问题反馈**：https://github.com/example/issues
- **文档地址**：https://docs.example.com

---

## 版本历史

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2025-01-XX | AI Agent | 初始版本，完整设计方案 |

---

## 许可证

MIT License

---

**请确认后通知我，我会立即开始重构！** 🚀
