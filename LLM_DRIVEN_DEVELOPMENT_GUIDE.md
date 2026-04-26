# 大模型驱动开发规范

## 目的

本规范旨在指导团队使用大模型驱动的方式开发应用，减少硬编码，提升系统的智能化水平和用户体验。

## 核心原则

### 1. 大模型优先，代码为辅

**原则说明**：
- 优先使用大模型的推理能力，而不是硬编码规则
- 代码只负责执行大模型的决策
- 大模型决定"做什么"，代码负责"怎么做"

**示例对比**：

❌ **硬编码方式**：
```typescript
const feedbackKeywords = ['太', '短', '长', '不', '修改', '调整'];
const isFeedback = feedbackKeywords.some(kw => message.includes(kw));
```

✅ **大模型驱动方式**：
```typescript
const decision = await orchestrator.processMessage(message, workflowState);
if (decision.action === 'regenerate_script') {
  // 执行重新生成逻辑
}
```

### 2. 提示词即逻辑

**原则说明**：
- 业务逻辑尽可能在提示词中定义
- 提示词是系统的"大脑"
- 修改业务逻辑时，优先修改提示词，而不是代码

**示例**：

```typescript
const SYSTEM_PROMPT = `
你是工作流协调器。

决策规则：
1. 如果用户上传素材 → analyze
2. 如果用户提供产品信息 → generate_script
3. 如果用户反馈脚本 → regenerate_script
...

（所有决策规则都在这里定义）
`;
```

### 3. 代码负责执行，不负责判断

**原则说明**：
- 代码应该只负责执行大模型的决策
- 不要在代码中进行复杂的业务判断
- 保持代码简单、可测试

**示例**：

✅ **正确**：
```typescript
const decision = await orchestrator.processMessage(message, state);
await executor.executeDecision(decision, state);
```

❌ **错误**：
```typescript
if (message.includes('生成') && state.hasProduct) {
  // 复杂的业务判断
} else if (message.includes('修改')) {
  // 更多硬编码逻辑
}
```

### 4. 容错与回退

**原则说明**：
- 大模型可能返回无效结果
- 必须有验证和容错机制
- 提供安全的回退策略

**示例**：

```typescript
try {
  const decision = parseDecision(llmResponse);
  return decision;
} catch (error) {
  // 返回安全的默认决策
  return {
    action: 'chat',
    message: '抱歉，我没理解您的需求。请重新说一下？'
  };
}
```

## 开发流程

### 步骤1：设计大模型角色

定义大模型的角色和职责：

```
角色：工作流协调器
职责：
1. 理解用户意图
2. 管理工作流状态
3. 决定下一步操作
4. 生成对话回复
```

### 步骤2：编写系统提示词

编写详细的系统提示词，包含：

1. **角色定义**：明确大模型的身份
2. **能力描述**：列出大模型的能力范围
3. **决策规则**：定义如何做决策
4. **响应格式**：指定输出格式
5. **示例**：提供决策示例

### 步骤3：设计接口

定义大模型输入输出：

```typescript
interface OrchestratorInput {
  userMessage: string;
  workflowState: WorkflowState;
  context: Context;
}

interface OrchestratorOutput {
  action: string;
  message: string;
  parameters?: Record<string, unknown>;
}
```

### 步骤4：实现协调器

实现调用大模型的代码：

```typescript
class Orchestrator {
  async process(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const prompt = this.buildPrompt(input);
    const response = await this.llmClient.invoke([
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt }
    ]);
    return this.parseOutput(response);
  }
}
```

### 步骤5：实现执行器

实现执行大模型决策的代码：

```typescript
class Executor {
  async execute(decision: OrchestratorOutput, state: State): Promise<Result> {
    switch (decision.action) {
      case 'action1':
        return await this.doAction1(decision);
      case 'action2':
        return await this.doAction2(decision);
    }
  }
}
```

### 步骤6：测试验证

1. 测试大模型的决策准确性
2. 测试各种边界情况
3. 测试容错机制
4. 性能测试

### 步骤7：监控和优化

1. 记录大模型的决策
2. 分析失败案例
3. 优化提示词
4. 优化性能

## 最佳实践

### 1. 提示词质量

**好的提示词特点**：
- 角色明确
- 规则清晰
- 示例充分
- 格式严格

**示例**：

```typescript
const GOOD_PROMPT = `
你是创意小海的工作流协调器。

## 决策规则
1. 如果用户上传素材 → analyze
2. 如果用户提供产品信息 → generate_script
3. 如果用户反馈脚本 → regenerate_script

## 示例
用户："太长了" → regenerate_script
用户："第一个不错" → select_script

## 格式
返回JSON格式：
{
  "action": "操作",
  "message": "回复"
}
`;
```

### 2. JSON 解析安全

**原则**：
- 使用代码块提取 JSON
- 提供默认值
- 记录解析失败

**示例**：

```typescript
function parseDecision(content: string): Decision {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[1] : content;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('解析失败:', content);
    return getDefaultDecision();
  }
}
```

### 3. 成本控制

**策略**：
1. 使用合适的模型（不必是最贵的）
2. 优化提示词长度
3. 实现缓存机制
4. 监控调用次数

**示例**：

```typescript
// 使用缓存
const cache = new Map();
async function processMessage(message: string) {
  if (cache.has(message)) {
    return cache.get(message);
  }
  const result = await llmClient.invoke([...]);
  cache.set(message, result);
  return result;
}
```

### 4. 性能优化

**策略**：
1. 使用流式输出
2. 并行处理（如果可能）
3. 预加载常用决策
4. 异步执行耗时操作

**示例**：

```typescript
// 流式输出
for await (const chunk of llmClient.stream(messages)) {
  if (chunk.content) {
    controller.enqueue(encoder.encode(chunk.content));
  }
}
```

## 禁止事项

### ❌ 禁止硬编码业务逻辑

**错误示例**：
```typescript
if (message.includes('生成') && message.includes('视频')) {
  // 硬编码的业务逻辑
}
```

### ❌ 禁止在代码中做复杂的意图识别

**错误示例**：
```typescript
const intent = classifyMessage(message); // 复杂的分类逻辑
if (intent === 'generate_video') { ... }
```

**正确方式**：让大模型识别意图

### ❌ 禁止忽略大模型的决策

**错误示例**：
```typescript
const decision = await orchestrator.process(...);
// 忽略 decision，直接执行固定逻辑
if (user.something) { ... }
```

### ❌ 禁止无容错机制

**错误示例**：
```typescript
const decision = JSON.parse(llmResponse); // 直接解析，无容错
```

**正确方式**：添加 try-catch 和默认值

## 应用场景

### 适合使用大模型的场景

1. **工作流协调** - 管理复杂的业务流程
2. **意图识别** - 理解用户的真实需求
3. **对话交互** - 自然语言对话
4. **内容生成** - 生成脚本、文案等
5. **决策支持** - 辅助业务决策

### 不适合使用大模型的场景

1. **简单的 CRUD 操作** - 直接调用数据库即可
2. **纯计算任务** - 数学计算、数据处理
3. **高频且低延迟要求** - 大模型可能太慢
4. **完全确定性的逻辑** - 规则清晰，无需推理

## 检查清单

在提交代码前，检查以下项目：

- [ ] 是否使用了大模型替代硬编码？
- [ ] 系统提示词是否清晰、完整？
- [ ] 是否有容错机制？
- [ ] JSON 解析是否安全？
- [ ] 是否有缓存机制（如果需要）？
- [ ] 是否有监控日志？
- [ ] 是否测试了边界情况？
- [ ] 代码是否简洁、可维护？

## 总结

大模型驱动的开发方式可以带来显著的优势：

1. **更智能** - 理解用户意图，而非机械执行
2. **更灵活** - 修改提示词即可调整业务逻辑
3. **更易维护** - 逻辑集中在提示词中
4. **更好的用户体验** - 自然、流畅的对话

但同时也要注意：

1. **成本** - 大模型调用需要费用
2. **延迟** - 比硬编码慢
3. **不确定性** - 需要容错机制
4. **调优** - 需要不断优化提示词

遵循本规范，可以最大化大模型的价值，同时控制风险。
