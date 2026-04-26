# 创意小海工作流逻辑检查报告

## 检查时间
2026-04-07

## 检查范围
- `/src/lib/xiaohai-workflow-service-v2.ts` - 工作流服务核心逻辑
- `/src/app/api/xiaohai/chat/route.ts` - API 路由和智能自动模式
- `/src/app/agent/create/page.tsx` - 前端交互逻辑

---

## 一、工作流设计（8步骤）

### 标准流程
1. **步骤1：唤醒** - 欢迎用户，展示能力
2. **步骤2：任务识别** - 识别意图，提取信息
3. **步骤3：分析** - 分析参考视频/图片
4. **步骤4：生成参考脚本** - 生成单个参考脚本
5. **步骤5：生成3个脚本** - 生成3个不同风格的脚本
6. **步骤6：生成视频** - 选择脚本并生成视频
7. **步骤7：批量生成** - 批量生成多个视频
8. **步骤8：结束** - 完成工作流

---

## 二、发现的问题

### 🔴 问题1：步骤2的误导性提示（已修复 ✅）

**位置**：`src/lib/xiaohai-workflow-service-v2.ts:321-328`

**当前代码**：
```typescript
const result: ProcessingResult = {
  type: 'text',
  content: `【识别完成】\n\n${summary}\n\n正在自动分析参考内容...`,  // ✅ 已修复
  workflow: {
    id: workflow.id,
    currentStep: workflow.currentStep,
    currentStage: 'task_received',
  },
};
```

**问题描述**：
- 步骤2返回 "正在开始分析..." 的提示（已修复为"正在自动分析参考内容..."）
- 但实际上需要用户确认后才会执行步骤3（分析）
- 用户会误以为分析已经开始了

**修复状态**：✅ 已修复
- 修改提示为"正在自动分析参考内容..."，更准确反映实际情况
- 添加 `currentStage` 信息，便于前端跟踪状态

---

### 🔴 问题2：阶段判断重复执行步骤3和步骤4（已修复 ✅）

**位置**：`src/app/api/xiaohai/chat/route.ts:293-308`（已删除）

**问题描述**：
- 在 `analyzing` 阶段，如果用户说"确认"，会重新执行步骤3和步骤4
- 这会导致重复分析和重复生成脚本
- 实际上步骤3完成后，currentStage 已经是 'analyzing'
- 步骤4完成后，currentStage 已经是 'reference_script_generated'

**修复状态**：✅ 已修复
- 删除了重复的阶段判断代码（原293-308行）
- 修改为步骤2完成后自动执行步骤3、4、5
- 不再依赖用户"确认"触发步骤3、4

---

### 🟡 问题3：工作流未自动执行（已修复 ✅）

**位置**：`src/app/api/xiaohai/chat/route.ts:276-290`

**用户需求**：
> "工作流应自动执行，步骤间无需用户确认（有素材自动分析，无素材使用默认值）"

**当前行为**：
- 步骤2完成后，需要用户说"确认"才会执行步骤3和步骤4

**修复状态**：✅ 已修复
- 步骤2完成后，自动执行步骤3、4、5
- 无需用户确认，符合用户需求

**修复代码**：
```typescript
if (workflow.currentStage === 'task_received') {
  // 步骤2完成后，自动执行步骤3、4、5
  console.log(`🤖 自动执行：步骤3 分析`);
  const analyzeResult = await workflowService.step3Analyze(workflowId);
  sendResult(controller, encoder, analyzeResult);

  console.log(`🤖 自动执行：步骤4 生成参考脚本`);
  const scriptResult = await workflowService.step4GenerateReferenceScript(workflowId);
  sendResult(controller, encoder, scriptResult);

  console.log(`🤖 自动执行：步骤5 生成3个脚本`);
  const scriptsResult = await workflowService.step5GenerateScripts(workflowId);
  sendResult(controller, encoder, scriptsResult);

  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
  controller.close();
  return;
}
```

---

### 🟡 问题4：参考脚本生成后需要用户确认（已修复 ✅）

**位置**：`src/app/api/xiaohai/chat/route.ts:310-317`（已删除）

**问题描述**：
- 步骤4生成参考脚本后，用户需要说"确认"才会执行步骤5
- 这增加了一个不必要的用户交互步骤

**修复状态**：✅ 已修复
- 步骤4完成后，自动执行步骤5（生成3个脚本）
- 减少用户交互步骤，提升用户体验

---

### 🟢 问题5：对话历史保存时机（已修复 ✅）

**位置**：`src/app/api/xiaohai/chat/route.ts:53-56, 74-75`

**当前代码**：
```typescript
// 保存对话历史（异步，不影响主流程）
if (result.content) {
  saveConversationHistory(userId, '', result.content, false).catch(err => {
    console.error('保存对话历史失败:', err);
  });
}
```

**问题描述**：
- 对话历史保存是异步的，但没有 await
- 可能导致对话历史保存失败但用户不知道

**修复状态**：✅ 已修复
- 添加 `.catch()` 错误处理
- 对话历史保存失败不影响主流程
- 添加日志记录，便于问题排查

---

### 🟡 问题6：用户修改脚本未处理（已修复 ✅）

**位置**：`src/app/api/xiaohai/chat/route.ts:346-392`

**问题描述**：
- 用户在 `scripts_generated` 阶段说"太长了，缩短一点"等反馈时
- 原代码只能处理数字选择（如"1"、"2"、"3"）
- 无法识别用户反馈并重新生成脚本

**修复状态**：✅ 已修复
- 添加反馈关键词检测：`['太', '短', '长', '不', '修改', '调整', '换', '重新']`
- 检测到反馈时，调用 `regenerateScripts` 方法重新生成3个脚本
- 检测到数字选择时，调用 `step6GenerateVideo` 生成视频

**修复代码**：
```typescript
if (workflow.currentStage === 'scripts_generated') {
  // 在脚本生成后，检查用户是选择脚本还是提供反馈
  const numberMatch = message.match(/\d+/);
  const feedbackKeywords = ['太', '短', '长', '不', '修改', '调整', '换', '重新'];
  const isFeedback = feedbackKeywords.some(kw => message.includes(kw));

  if (isFeedback) {
    // 用户提供了反馈，重新生成脚本
    console.log(`📝 用户反馈：${message}，重新生成脚本`);
    const result = await workflowService.regenerateScripts(workflowId, message);
    sendResult(controller, encoder, result);
    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
    controller.close();
    return;
  }

  // 用户选择脚本
  let selectedIndex = 0;
  if (numberMatch) {
    selectedIndex = parseInt(numberMatch[0], 10) - 1;
  }

  // ... 执行视频生成
}
```

---

## 三、正确的工作流流程设计

### 自动模式（已实现 ✅）
```
用户发送消息（或上传视频）
    ↓
步骤2：任务识别 → 返回识别结果
    ↓
【自动执行】步骤3：分析
    ↓
【自动执行】步骤4：生成参考脚本 → 用户可查看参考脚本
    ↓
【自动执行】步骤5：生成3个脚本 → 用户选择脚本或提供反馈
    ↓
    ├─ 用户选择脚本 → 步骤6：生成视频（自动执行）
    └─ 用户提供反馈 → 重新生成3个脚本 → 用户选择脚本 → 步骤6：生成视频
    ↓
步骤8：结束（自动保存视频到素材库）
```

### 用户交互流程
1. **首次对话**：
   - 用户发送消息或上传视频
   - 系统自动执行步骤2→3→4→5
   - 用户看到3个脚本选项

2. **选择脚本**：
   - 用户输入数字（如"1"、"2"、"3"）
   - 系统自动生成视频
   - 视频生成完成后自动保存到素材库

3. **修改脚本**：
   - 用户输入反馈（如"太长了，缩短一点"）
   - 系统重新生成3个脚本
   - 用户再次选择脚本
   - 系统自动生成视频

---

## 四、测试验证

### ✅ 测试场景1：用户上传视频
**步骤**：
1. 用户上传视频
2. 自动发送消息到后端
3. 步骤2：任务识别 → 返回 "识别完成，正在自动分析..."
4. 自动执行步骤3：分析
5. 自动执行步骤4：生成参考脚本
6. 自动执行步骤5：生成3个脚本
7. 用户选择脚本（输入数字）
8. 自动执行步骤6：生成视频

**结果**：✅ 通过

---

### ✅ 测试场景2：用户输入产品名称
**步骤**：
1. 用户输入 "帮我生成一个关于智能手表的产品视频"
2. 步骤2：任务识别（提取产品名称）
3. 自动执行步骤3：分析（使用默认分析结果）
4. 自动执行步骤4：生成参考脚本
5. 自动执行步骤5：生成3个脚本
6. 用户选择脚本
7. 自动执行步骤6：生成视频

**结果**：✅ 通过

---

### ✅ 测试场景3：用户修改脚本
**步骤**：
1. 用户选择脚本后说 "太长了，缩短一点"
2. 系统检测到反馈关键词
3. 重新生成3个脚本
4. 用户选择新脚本
5. 自动执行步骤6：生成视频

**结果**：✅ 通过

---

## 五、优先级

### ✅ 已修复（所有问题）
- 问题1：步骤2的误导性提示
- 问题2：阶段判断重复执行步骤3和步骤4
- 问题3：工作流未自动执行
- 问题4：参考脚本生成后需要用户确认
- 问题5：对话历史保存时机
- 问题6：用户修改脚本未处理

---

## 六、后续优化建议

1. **添加工作流状态持久化**
   - 当前工作流状态仅存储在内存中
   - 建议使用 Redis 或数据库持久化
   - 支持工作流断点续接

2. **添加工作流进度可视化**
   - 在前端显示当前步骤和进度
   - 使用进度条或步骤指示器

3. **添加工作流取消功能**
   - 允许用户取消当前工作流
   - 清理相关资源

4. **优化错误处理**
   - 添加更详细的错误提示
   - 支持重试机制

5. **添加工作流日志**
   - 记录每个步骤的执行时间
   - 用于性能分析和问题排查

---

## 七、总结

### 修复前的问题
1. ❌ 步骤2的提示具有误导性
2. ❌ 阶段判断会导致重复执行
3. ❌ 工作流未按照用户需求自动执行
4. ❌ 参考脚本生成后需要用户确认
5. ❌ 对话历史保存缺少错误处理
6. ❌ 用户修改脚本未处理

### 修复后的改进
1. ✅ 步骤2提示改为"正在自动分析参考内容..."，添加 `currentStage` 信息
2. ✅ 删除重复的阶段判断代码，避免重复执行
3. ✅ 步骤2完成后自动执行步骤3、4、5，无需用户确认
4. ✅ 步骤4完成后自动执行步骤5，减少交互步骤
5. ✅ 对话历史保存添加错误处理，不影响主流程
6. ✅ 支持用户修改脚本，检测反馈关键词并重新生成

### 测试结果
- ✅ 所有测试场景通过
- ✅ TypeScript 检查通过
- ✅ 工作流自动执行正常
- ✅ 用户交互流畅
- ✅ 脚本修改功能正常

### 结论
工作流逻辑已完全修复，符合用户需求。现在工作流能够自动执行所有步骤，用户只需提供初始输入和最终选择，无需手动确认中间步骤。
