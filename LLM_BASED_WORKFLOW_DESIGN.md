# 基于大模型的智能工作流管理设计方案

## 当前实现的问题分析

### 硬编码问题清单

#### 1. 工作流步骤硬编码
```typescript
// 当前实现：硬编码的8个步骤
async step1Welcome(userId: string)
async step2Recognize(message, attachments, workflowId, autoMode)
async step3Analyze(workflowId)
async step4GenerateReferenceScript(workflowId)
async step5GenerateScripts(workflowId)
async step6GenerateVideo(workflowId, selectedIndex)
async step7BatchGenerate(workflowId)
async step8End(workflowId)
```

**问题**：
- 无法动态调整工作流步骤
- 无法根据用户需求跳过某些步骤
- 无法添加新的步骤而不修改代码

#### 2. 阶段判断硬编码
```typescript
// 当前实现：硬编码的阶段判断
if (workflow.currentStage === 'task_received') {
  // 执行步骤3、4、5
}

if (workflow.currentStage === 'scripts_generated') {
  // 执行步骤6
}

if (workflow.currentStage === 'video_generating') {
  // 执行步骤7
}
```

**问题**：
- 需要维护复杂的阶段状态机
- 无法灵活处理用户跳转
- 无法处理异常流程

#### 3. 用户反馈关键词硬编码
```typescript
// 当前实现：硬编码的关键词
const feedbackKeywords = ['太', '短', '长', '不', '修改', '调整', '换', '重新'];
const isFeedback = feedbackKeywords.some(kw => message.includes(kw));
```

**问题**：
- 只能识别固定的关键词
- 无法理解复杂的用户意图
- 无法处理语义相似但表述不同的反馈

#### 4. 对话响应模板化
```typescript
// 当前实现：模板化的响应
content: `【识别完成】\n\n${summary}\n\n正在自动分析参考内容...`
content: `【请选择脚本方案】\n\n1. xxx\n2. xxx\n3. xxx`
```

**问题**：
- 响应内容固定，缺乏个性化
- 无法根据用户历史调整对话风格
- 无法处理意外的用户输入

---

## 基于大模型的智能工作流管理方案

### 核心思想

**大模型作为工作流协调器（Workflow Orchestrator）**：
- 大模型理解用户意图和上下文
- 大模型决定下一步操作
- 大模型生成对话响应
- 大模型管理工作流状态

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    用户交互层                             │
│  用户发送消息 → 前端 → API 路由                        │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│              大模型工作流协调器                          │
│  1. 接收用户消息 + 当前工作流状态                        │
│  2. 分析用户意图和上下文                                │
│  3. 决定下一步操作                                       │
│  4. 生成对话响应                                        │
│  5. 更新工作流状态                                       │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 视觉模型  │  │ LLM模型   │  │Seedance  │
│ 分析视频  │  │ 生成脚本  │  │ 生成视频  │
└──────────┘  └──────────┘  └──────────┘
```

### 关键组件

#### 1. 工作流协调器（LLM Orchestrator）

```typescript
class LLMWorkflowOrchestrator {
  /**
   * 处理用户消息，返回大模型的决策
   */
  async processMessage(
    userMessage: string,
    workflowState: WorkflowState,
    context: ConversationContext
  ): Promise<WorkflowDecision> {
    const prompt = this.buildOrchestratorPrompt(
      userMessage,
      workflowState,
      context
    );

    const response = await this.llmClient.invoke([
      { role: 'system', content: ORCHESTRATOR_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]);

    return this.parseDecision(response.content);
  }

  /**
   * 构建协调器提示词
   */
  private buildOrchestratorPrompt(
    userMessage: string,
    workflowState: WorkflowState,
    context: ConversationContext
  ): string {
    return `
你是创意小海的工作流协调器，负责管理视频创作工作流。

## 当前工作流状态
- 当前阶段：${workflowState.currentStage}
- 已完成的步骤：${workflowState.completedSteps.join(', ')}
- 用户信息：${workflowState.productName}
- 参考素材：${workflowState.attachments.map(a => a.type).join(', ')}

## 用户消息
${userMessage}

## 对话历史
${context.history.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

## 可执行的操作
1. analyze - 分析参考素材
2. generate_script - 生成脚本
3. regenerate_script - 重新生成脚本（需要反馈）
4. generate_video - 生成视频
5. end - 结束工作流
6. ask_for_info - 询问用户更多信息
7. chat - 闲聊或回答问题

## 你的任务
1. 分析用户的意图
2. 判断当前应该执行什么操作
3. 生成合适的对话回复
4. 如果需要执行操作，返回操作类型和参数

请以JSON格式返回你的决策：
{
  "action": "操作类型",
  "message": "给用户的回复",
  "parameters": {
    // 操作参数
  },
  "next_stage": "下一阶段（可选）",
  "reasoning": "决策原因"
}
`;
  }
}
```

#### 2. 系统提示词（System Prompt）

```typescript
const ORCHESTRATOR_SYSTEM_PROMPT = `
你是创意小海，海盟会的智能视频创作助手。你负责管理视频创作的整个工作流。

## 你的能力
- 理解用户的视频创作需求
- 分析参考视频和图片
- 生成专业的视频脚本
- 调用 Seedance 2.0 生成视频
- 管理工作流状态和进度

## 工作流阶段
1. **收集信息** - 收集用户需求、参考素材
2. **分析素材** - 分析参考视频/图片的风格和技巧
3. **生成脚本** - 生成视频脚本（可多次迭代）
4. **生成视频** - 根据脚本生成视频
5. **交付结果** - 完成工作流

## 对话原则
1. **自然流畅** - 像真人助手一样对话，不要机械化
2. **理解意图** - 深度理解用户的真实需求
3. **灵活应变** - 根据用户反馈调整策略
4. **保持上下文** - 记住对话历史，保持连贯性
5. **专业友好** - 既专业又亲和，乐于助人

## 响应规范
- 使用 JSON 格式返回决策
- message 字段使用自然语言
- 如果需要执行操作，提供明确的参数
- 如果需要更多信息，主动询问
- 保持对话简洁但信息完整
`;
```

#### 3. 决策执行器（Decision Executor）

```typescript
class DecisionExecutor {
  async executeDecision(
    decision: WorkflowDecision,
    workflowState: WorkflowState
  ): Promise<ExecutionResult> {
    switch (decision.action) {
      case 'analyze':
        return await this.executeAnalyze(decision, workflowState);
      case 'generate_script':
        return await this.executeGenerateScript(decision, workflowState);
      case 'regenerate_script':
        return await this.executeRegenerateScript(decision, workflowState);
      case 'generate_video':
        return await this.executeGenerateVideo(decision, workflowState);
      case 'end':
        return await this.executeEnd(decision, workflowState);
      case 'ask_for_info':
        return { success: true, message: decision.message };
      case 'chat':
        return { success: true, message: decision.message };
      default:
        return { success: false, error: '未知操作' };
    }
  }

  private async executeAnalyze(
    decision: WorkflowDecision,
    workflowState: WorkflowState
  ): Promise<ExecutionResult> {
    // 调用视觉模型分析参考素材
    const analysisResult = await this.visionModel.analyze(
      workflowState.attachments
    );

    return {
      success: true,
      message: decision.message,
      data: analysisResult,
    };
  }

  private async executeGenerateScript(
    decision: WorkflowDecision,
    workflowState: WorkflowState
  ): Promise<ExecutionResult> {
    // 调用 LLM 生成脚本
    const scripts = await this.scriptGenerator.generate(
      workflowState,
      decision.parameters
    );

    return {
      success: true,
      message: decision.message,
      data: scripts,
    };
  }

  // ... 其他执行方法
}
```

### 工作流状态管理

```typescript
interface WorkflowState {
  id: string;
  userId: string;
  currentStage: string;
  completedSteps: string[];
  productName?: string;
  attachments: Attachment[];
  scripts: Script[];
  selectedScript?: Script;
  videos: GeneratedVideo[];
  metadata: Record<string, any>;
  context: ConversationContext;
}

interface ConversationContext {
  history: Array<{ role: string; content: string; timestamp: Date }>;
  userPreferences: Record<string, any>;
  lastInteraction: Date;
}
```

### 对话流程示例

#### 场景1：用户上传视频
```
用户：[上传视频文件]

大模型协调器分析：
- 用户意图：提供参考视频
- 当前状态：初始状态
- 决策：分析视频 → 生成脚本

决策返回：
{
  "action": "analyze",
  "message": "收到您的参考视频了！让我先分析一下这个视频的风格和创作技巧...",
  "parameters": {
    "attachment_type": "video"
  }
}

执行器执行：
- 调用视觉模型分析视频
- 更新工作流状态
- 返回分析结果

大模型协调器生成下一步：
- 基于分析结果生成脚本
- 返回3个脚本供用户选择
```

#### 场景2：用户反馈"太长了"
```
用户：太长了

大模型协调器分析：
- 用户意图：对当前脚本不满，希望缩短
- 当前状态：脚本已生成
- 决策：重新生成脚本（缩短版本）

决策返回：
{
  "action": "regenerate_script",
  "message": "明白了，我来为您生成一个更短的版本，大概8秒左右...",
  "parameters": {
    "feedback": "太长了",
    "target_duration": 8,
    "adjustment": "缩短时长"
  }
}

执行器执行：
- 调用 LLM 重新生成脚本
- 应用用户反馈
- 返回新脚本
```

#### 场景3：用户意外输入
```
用户：今天天气不错

大模型协调器分析：
- 用户意图：闲聊
- 当前状态：脚本生成中
- 决策：友好回应，引导回正题

决策返回：
{
  "action": "chat",
  "message": "是啊，好天气让人心情愉快！不过我们正在创作视频呢，您对刚才的脚本有什么想法吗？或者需要调整吗？",
  "parameters": {}
}

执行器执行：
- 不执行任何操作
- 返回消息给用户
```

---

## 优势对比

| 方面 | 当前硬编码实现 | 大模型管理 |
|------|--------------|-----------|
| 灵活性 | ❌ 低，需要修改代码 | ✅ 高，动态调整 |
| 智能性 | ❌ 低，规则驱动 | ✅ 高，理解驱动 |
| 可维护性 | ❌ 难，逻辑分散 | ✅ 易，集中管理 |
| 用户体验 | ❌ 一般，机械化 | ✅ 好，自然流畅 |
| 错误处理 | ❌ 差，固定规则 | ✅ 好，智能处理 |
| 上下文理解 | ❌ 无 | ✅ 有 |
| 个性化 | ❌ 无 | ✅ 有 |
| 扩展性 | ❌ 差，需要代码变更 | ✅ 好，提示词调整 |

---

## 实施计划

### Phase 1: 基础架构（1-2天）
1. 设计 WorkflowState 数据结构
2. 实现 LLMWorkflowOrchestrator
3. 实现决策解析和执行器
4. 编写系统提示词

### Phase 2: 核心功能（2-3天）
1. 实现消息处理流程
2. 集成现有的视觉模型和脚本生成
3. 实现工作流状态管理
4. 测试基本对话流程

### Phase 3: 优化迭代（1-2天）
1. 优化系统提示词
2. 添加上下文记忆
3. 优化错误处理
4. 全面测试

### Phase 4: 部署上线（1天）
1. 性能优化
2. 监控和日志
3. 灰度发布
4. 全量上线

---

## 风险和挑战

### 1. 大模型响应不稳定
**风险**：大模型可能返回无效的 JSON 或错误的决策

**解决方案**：
- 使用结构化输出（如果模型支持）
- 添加 JSON 解析和验证
- 实现重试机制
- 提供默认回退策略

### 2. 成本问题
**风险**：每条消息都调用大模型，成本较高

**解决方案**：
- 使用更高效的模型
- 实现缓存机制
- 批量处理决策
- 监控和优化调用次数

### 3. 响应延迟
**风险**：大模型调用增加响应延迟

**解决方案**：
- 使用流式输出
- 优化提示词长度
- 预加载常用决策
- 异步处理耗时操作

### 4. 上下文限制
**风险**：大模型上下文长度有限

**解决方案**：
- 压缩历史消息
- 使用向量检索相关上下文
- 分层管理上下文
- 使用长期记忆系统

---

## 总结

基于大模型的工作流管理方案可以带来显著的优势：

1. **更智能的交互** - 理解用户意图，自然对话
2. **更灵活的流程** - 动态调整工作流步骤
3. **更好的用户体验** - 个性化、流畅的对话
4. **更易维护** - 逻辑集中在提示词中
5. **更强的扩展性** - 无需修改代码即可添加新功能

这是一个值得投资的方向，可以大幅提升产品的智能化水平和用户体验。
