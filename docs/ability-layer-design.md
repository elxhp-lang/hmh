# 双层能力系统架构设计

## 一、核心理念

**"先观察大师，再自己动手"**

智能体不是直接执行任务，而是：
1. 先让大模型（大师）完成任务
2. 观察学习大模型的方法
3. 对比自己的能力差距
4. 逐步强化直到达到用户满意水平
5. 让用户决定何时"毕业"

## 二、能力分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户请求                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    能力路由层 (Router)                       │
│  - 判断任务类型                                              │
│  - 检查智能体能力等级                                        │
│  - 决定执行路径                                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
      ┌───────────┐   ┌───────────┐   ┌───────────┐
      │ 学习模式   │   │ 对比模式   │   │ 独立模式   │
      │(Learning) │   │(Compare)  │   │(Indep.)   │
      └───────────┘   └───────────┘   └───────────┘
              │               │               │
              ▼               ▼               ▼
      ┌───────────┐   ┌───────────┐   ┌───────────┐
      │ 大模型执行 │   │ 双路执行   │   │ 智能体执行 │
      │ + 观察    │   │ + 评分    │   │           │
      └───────────┘   └───────────┘   └───────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    能力评估与学习层                          │
│  - 对比分析大模型输出与智能体输出                            │
│  - 提取大模型的优秀模式                                      │
│  - 更新智能体知识库                                          │
│  - 计算能力评分                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    用户反馈与决策层                          │
│  - 展示两种结果对比                                          │
│  - 提供综合评分                                              │
│  - 让用户选择使用哪种                                        │
│  - 记录用户偏好                                              │
└─────────────────────────────────────────────────────────────┘
```

## 三、执行模式详解

### 3.1 学习模式 (Learning Mode)

**适用场景**: 智能体能力评分 < 60分，或新任务类型

**执行流程**:
```
1. 大模型直接执行任务
   ↓
2. 智能体全程观察：
   - 大模型的推理过程
   - 使用的工具和参数
   - 输出结构和内容
   ↓
3. 提取学习要点：
   - 成功模式
   - 失败教训
   - 最佳实践
   ↓
4. 存入智能体知识库
   ↓
5. 向用户展示：大模型结果 + 学习进度
```

### 3.2 对比模式 (Compare Mode)

**适用场景**: 智能体能力评分 60-85分

**执行流程**:
```
1. 并行执行：
   - 大模型执行 → 结果A
   - 智能体执行 → 结果B
   ↓
2. 多维度评分：
   - 完整性 (0-100)
   - 准确性 (0-100)
   - 创意性 (0-100)
   - 实用性 (0-100)
   ↓
3. 综合评分对比
   ↓
4. 向用户展示：
   - 结果A vs 结果B
   - 各维度评分
   - 综合评分
   - 推荐选择
   ↓
5. 用户选择后：
   - 记录选择偏好
   - 更新智能体学习权重
```

### 3.3 独立模式 (Independent Mode)

**适用场景**: 智能体能力评分 > 85分，且用户确认

**执行流程**:
```
1. 智能体独立执行
   ↓
2. 定期抽查对比：
   - 每10次任务中，随机选1次进行对比
   - 确保能力不退化
   ↓
3. 持续学习：
   - 从用户反馈中学习
   - 更新知识库
```

## 四、能力评分体系

### 4.1 评分维度

| 维度 | 权重 | 评估方式 |
|------|------|----------|
| **完整性** | 25% | 输出是否包含所有必要元素 |
| **准确性** | 25% | 内容是否符合用户需求 |
| **创意性** | 20% | 是否有创新点或亮点 |
| **实用性** | 20% | 是否可直接使用 |
| **效率** | 10% | 执行速度和资源消耗 |

### 4.2 评分计算

```typescript
interface AbilityScore {
  overall: number;      // 综合评分 (0-100)
  dimensions: {
    completeness: number;  // 完整性
    accuracy: number;      // 准确性
    creativity: number;    // 创意性
    practicality: number;  // 实用性
    efficiency: number;    // 效率
  };
  confidence: number;   // 置信度 (基于样本数量)
  trend: 'improving' | 'stable' | 'declining';  // 趋势
}

// 综合评分计算
function calculateOverallScore(dimensions: AbilityScore['dimensions']): number {
  return (
    dimensions.completeness * 0.25 +
    dimensions.accuracy * 0.25 +
    dimensions.creativity * 0.20 +
    dimensions.practicality * 0.20 +
    dimensions.efficiency * 0.10
  );
}
```

### 4.3 能力等级

| 等级 | 分数范围 | 执行模式 | 说明 |
|------|----------|----------|------|
| **新手** | 0-40 | 学习模式 | 主要观察大模型，积累经验 |
| **学徒** | 40-60 | 学习模式 | 偶尔尝试独立执行，大模型审核 |
| **熟练** | 60-85 | 对比模式 | 可独立执行，但需对比验证 |
| **专家** | 85-95 | 独立模式 | 可独立执行，定期抽查 |
| **大师** | 95-100 | 独立模式 | 可教导其他智能体 |

## 五、学习机制

### 5.1 模式提取

从大模型的优秀输出中提取模式：

```typescript
interface LearningPattern {
  id: string;
  taskType: 'script_generation' | 'video_analysis' | 'style_transfer';
  
  // 触发条件
  triggers: {
    keywords: string[];
    context: string[];
    constraints: string[];
  };
  
  // 执行模式
  execution: {
    steps: string[];
    tools: string[];
    parameters: Record<string, unknown>;
    outputFormat: string;
  };
  
  // 学习元数据
  metadata: {
    sourceCount: number;      // 学习来源数量
    successRate: number;      // 成功率
    lastUpdated: Date;
    learnedFrom: string[];    // 学习来源（大模型版本/案例ID）
  };
}
```

### 5.2 知识迁移

```typescript
// 从大模型输出中学习
async function learnFromMasterOutput(
  taskType: string,
  input: unknown,
  masterOutput: unknown,
  evaluation: AbilityScore
): Promise<LearningPattern> {
  
  // 1. 分析大模型的执行路径
  const executionPath = analyzeExecutionPath(masterOutput);
  
  // 2. 提取成功模式
  const patterns = extractPatterns(executionPath);
  
  // 3. 与现有知识对比
  const existingPatterns = await getExistingPatterns(taskType);
  
  // 4. 合并或创建新模式
  if (shouldMerge(patterns, existingPatterns)) {
    return mergePatterns(patterns, existingPatterns);
  } else {
    return createNewPattern(patterns);
  }
}
```

### 5.3 强化学习

```typescript
// 基于用户反馈的强化学习
async function reinforceFromFeedback(
  patternId: string,
  userChoice: 'master' | 'agent',
  feedback?: string
): Promise<void> {
  
  const pattern = await getPattern(patternId);
  
  if (userChoice === 'agent') {
    // 用户选择智能体结果 → 强化该模式
    pattern.metadata.successRate += 0.05;
  } else {
    // 用户选择大模型结果 → 调整学习方向
    pattern.metadata.successRate -= 0.02;
    
    // 触发深度学习
    await scheduleDeepLearning(patternId);
  }
  
  await savePattern(pattern);
}
```

## 六、用户界面设计

### 6.1 能力看板

```
┌─────────────────────────────────────────────────────────────┐
│                    智能体能力看板                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  综合评分: ████████░░ 78/100    等级: 熟练                 │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 完整性      │  │ 准确性      │  │ 创意性      │         │
│  │ ████████░  │  │ ███████░░   │  │ ██████░░░   │         │
│  │ 82/100     │  │ 75/100     │  │ 65/100     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ 实用性      │  │ 效率        │                          │
│  │ ████████░  │  │ █████████░  │                          │
│  │ 80/100     │  │ 88/100     │                          │
│  └─────────────┘  └─────────────┘                          │
│                                                             │
│  趋势: ↗ 正在提升 (过去30天提升12分)                        │
│                                                             │
│  学习进度:                                                   │
│  - 观察大模型次数: 156次                                     │
│  - 独立执行次数: 89次                                        │
│  - 用户选择智能体比例: 67%                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 对比结果展示

```
┌─────────────────────────────────────────────────────────────┐
│                    脚本生成结果对比                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  主题: 为某护肤品制作抖音带货视频                            │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 大模型输出 (参考)    │  │ 智能体输出          │          │
│  ├─────────────────────┤  ├─────────────────────┤          │
│  │ 风格: 美妆博主推荐   │  │ 风格: 产品展示      │          │
│  │ 时长: 15秒          │  │ 时长: 10秒          │          │
│  │ 镜头: 3个           │  │ 镜头: 2个           │          │
│  │                     │  │                     │          │
│  │ 评分:               │  │ 评分:               │          │
│  │ 完整性: 95          │  │ 完整性: 75          │          │
│  │ 准确性: 90          │  │ 准确性: 85          │          │
│  │ 创意性: 88          │  │ 创意性: 60          │          │
│  │ 实用性: 92          │  │ 实用性: 80          │          │
│  │ ─────────────       │  │ ─────────────       │          │
│  │ 综合: 91/100        │  │ 综合: 75/100        │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  差异分析:                                                   │
│  ✓ 大模型: 考虑了博主人设、粉丝互动、产品痛点              │
│  ✓ 智能体: 基础产品展示，缺少情感共鸣和互动设计            │
│                                                             │
│  推荐选择: [大模型输出] (评分高16分)                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 使用大模型  │  │ 使用智能体  │  │ 让智能体    │         │
│  │             │  │             │  │ 再学习一次  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 学习进度追踪

```
┌─────────────────────────────────────────────────────────────┐
│                    学习进度报告                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  本周学习摘要 (2024.01.15 - 2024.01.21)                     │
│                                                             │
│  📊 能力变化                                                 │
│  - 综合评分: 72 → 78 (+6)                                   │
│  - 创意性提升最大: 58 → 65 (+7)                             │
│                                                             │
│  📚 学习内容                                                 │
│  - 观察大模型执行: 12次                                      │
│  - 独立执行: 8次                                            │
│  - 用户选择智能体: 5次 (62.5%)                              │
│                                                             │
│  💡 学到的模式                                               │
│  1. 护肤品脚本: 开头用痛点吸引 → 中间展示效果 → 结尾促单   │
│  2. 美食视频: 特写镜头占比应>40%                            │
│  3. 带货脚本: 前3秒必须有视觉冲击                           │
│                                                             │
│  ⚠️ 待改进                                                   │
│  - 创意性仍低于大模型 (65 vs 88)                            │
│  - 建议多学习创意类视频脚本                                  │
│                                                             │
│  是否开启"强化学习模式"? (本周学习更多创意类案例)           │
│  [开启] [暂不] [下周提醒]                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 七、数据结构设计

### 7.1 能力档案表 (agent_ability_profile)

```sql
CREATE TABLE agent_ability_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,  -- 'creative_agent', 'video_analyzer', etc.
  
  -- 综合评分
  overall_score DECIMAL(5,2) DEFAULT 0,
  level VARCHAR(20) DEFAULT 'novice',  -- novice, apprentice, skilled, expert, master
  
  -- 维度评分
  score_completeness DECIMAL(5,2) DEFAULT 0,
  score_accuracy DECIMAL(5,2) DEFAULT 0,
  score_creativity DECIMAL(5,2) DEFAULT 0,
  score_practicality DECIMAL(5,2) DEFAULT 0,
  score_efficiency DECIMAL(5,2) DEFAULT 0,
  
  -- 学习统计
  total_observations INT DEFAULT 0,  -- 观察大模型次数
  total_executions INT DEFAULT 0,    -- 独立执行次数
  successful_executions INT DEFAULT 0,
  user_selections INT DEFAULT 0,     -- 用户选择智能体次数
  user_rejections INT DEFAULT 0,     -- 用户选择大模型次数
  
  -- 趋势
  score_trend VARCHAR(20) DEFAULT 'stable',
  weekly_progress JSONB,  -- 每周进度
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 7.2 学习记录表 (agent_learning_records)

```sql
CREATE TABLE agent_learning_records (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  
  -- 任务信息
  task_type VARCHAR(50) NOT NULL,
  task_input JSONB,
  
  -- 执行结果
  execution_mode VARCHAR(20) NOT NULL,  -- 'learning', 'compare', 'independent'
  master_output JSONB,  -- 大模型输出
  agent_output JSONB,   -- 智能体输出
  
  -- 评分
  master_score JSONB,   -- 大模型评分
  agent_score JSONB,    -- 智能体评分
  
  -- 用户选择
  user_choice VARCHAR(20),  -- 'master', 'agent', 'both', 'neither'
  user_feedback TEXT,
  
  -- 学习成果
  patterns_learned JSONB,  -- 学习到的模式
  knowledge_updated BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 7.3 学习模式表 (agent_learning_patterns)

```sql
CREATE TABLE agent_learning_patterns (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  
  -- 模式内容
  pattern_name VARCHAR(100),
  triggers JSONB,      -- 触发条件
  execution JSONB,     -- 执行模式
  examples JSONB,      -- 示例
  
  -- 学习元数据
  source_count INT DEFAULT 1,
  success_rate DECIMAL(5,2) DEFAULT 0.5,
  last_used_at TIMESTAMP,
  usage_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 八、API 设计

### 8.1 能力查询 API

```typescript
// GET /api/agent/ability
interface AbilityResponse {
  profile: {
    overall: number;
    level: string;
    dimensions: AbilityScore['dimensions'];
    trend: string;
  };
  stats: {
    observations: number;
    executions: number;
    successRate: number;
    userPreference: number;  // 用户选择智能体的比例
  };
  recommendation: {
    mode: 'learning' | 'compare' | 'independent';
    reason: string;
  };
}
```

### 8.2 对比执行 API

```typescript
// POST /api/agent/compare
interface CompareRequest {
  taskType: 'script_generation' | 'video_analysis' | ...;
  input: unknown;
  options?: {
    forceCompare?: boolean;  // 强制对比模式
    skipEvaluation?: boolean;
  };
}

interface CompareResponse {
  masterOutput: unknown;
  agentOutput: unknown;
  masterScore: AbilityScore;
  agentScore: AbilityScore;
  recommendation: 'master' | 'agent' | 'either';
  analysis: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}
```

### 8.3 学习反馈 API

```typescript
// POST /api/agent/feedback
interface FeedbackRequest {
  recordId: string;
  choice: 'master' | 'agent';
  feedback?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
}

interface FeedbackResponse {
  updated: boolean;
  newScore: number;
  patternsLearned: number;
  message: string;
}
```

## 九、实施路线图

### 阶段一：基础设施 (1-2周)
1. 创建数据库表结构
2. 实现能力评分计算
3. 实现执行路由逻辑

### 阶段二：学习机制 (2-3周)
1. 实现大模型输出分析
2. 实现模式提取算法
3. 实现知识库更新

### 阶段三：对比执行 (1-2周)
1. 实现并行执行
2. 实现评分对比
3. 实现用户选择记录

### 阶段四：用户界面 (1-2周)
1. 能力看板页面
2. 对比结果展示
3. 学习进度追踪

### 阶段五：持续优化 (持续)
1. 优化评分算法
2. 改进学习效率
3. 添加更多任务类型
