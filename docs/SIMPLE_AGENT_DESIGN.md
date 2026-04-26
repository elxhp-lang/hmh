# 简化的智能体架构设计

## 核心理念

**智能体 = 模型调度器 + 偏好记录器 + 人格蒸馏器**

**核心价值：减少用户重复工作**

例如：用户要生成10条视频
- ❌ 传统方式：每次都重新沟通需求 → 生成 → 修改 → 再沟通
- ✅ 智能体方式：自动加载人格偏好 → 生成符合用户风格的结果 → 减少修改次数

不是让智能体"学会"创作，而是：
1. **协调模型**：把需求路由到正确的模型
2. **应用偏好**：基于历史人格优化输出
3. **减少重复**：避免反复沟通同样的事情

## 核心场景：批量生成（减少重复工作）

### 场景1：用户要生成10条产品视频

**传统方式（无智能体）**：
```
用户：我要生成10条产品视频
模型：好的，请告诉我产品信息、风格、时长...
用户：[重复10次相同信息]
模型：[生成10条]
用户：[修改10次，每次都说相同的修改意见]
```

**智能体方式（有人格蒸馏）**：
```
用户：我要生成10条产品视频

智能体：
1. 自动加载用户人格
   - 偏好风格：自然真实、生活化
   - 常用时长：15秒
   - 目标平台：抖音
   - 常用镜头：推镜、固定镜头
   - 常用色调：暖色调、自然光

2. 自动应用偏好
   prompt = `
     用户偏好：
     - 风格：${userPersonality.style}
     - 时长：${userPersonality.duration}
     - 平台：${userPersonality.platform}
     - 常用镜头：${userPersonality.cameraWork}
     
     请生成符合用户风格的10条视频脚本
   `

3. 生成结果（已符合用户风格，减少修改）

4. 用户修改 → 记录新偏好 → 优化人格
```

### 场景2：用户修改了3次都提同样的问题

**传统方式**：
```
用户：字幕太小了
模型：[修改]
用户：字幕还是太小
模型：[再修改]
用户：字幕依然太小
```

**智能体方式**：
```
用户：字幕太小了
智能体：
1. 记录偏好：用户喜欢大字幕
2. 更新人格：字幕大小 = 大
3. 下次自动应用：生成时直接用大字幕

用户：字幕太小了（第一次）
智能体：好的，已调整。（同时记录偏好）

下次生成：
智能体：[自动应用大字幕，无需用户再说]
```

## 正确的工作流

```
┌─────────────────────────────────────────────────────────┐
│                    用户输入                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              意图识别（简单规则匹配）                      │
│  - 包含视频链接 → 视觉分析流程                            │
│  - 包含"生成脚本" → 脚本生成流程                         │
│  - 其他 → 普通对话                                       │
└─────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                  ↓
┌──────────────────┐              ┌──────────────────┐
│   普通对话流程    │              │  视频分析流程     │
│                  │              │                  │
│ 用户消息         │              │ 1. 提取视频URL   │
│   ↓              │              │ 2. 视觉模型分析  │
│ LLM对话模型      │              │   ↓              │
│   ↓              │              │ 分析结果         │
│ 回复用户         │              │   ↓              │
│   ↓              │              │ 记录到偏好库     │
│ 记录对话历史     │              │   ↓              │
│                  │              │ LLM生成参考脚本  │
└──────────────────┘              │   ↓              │
                                  │ 反馈给用户        │
                                  └──────────────────┘
                                           ↓
                                  ┌──────────────────┐
                                  │  脚本生成流程     │
                                  │                  │
                                  │ 参考脚本         │
                                  │   ↓              │
                                  │ LLM脚本生成模型  │
                                  │   ↓              │
                                  │ 2-3条新脚本      │
                                  │   ↓              │
                                  │ 用户选择/修改    │
                                  │   ↓              │
                                  │ 记录偏好         │
                                  └──────────────────┘
```

## 核心功能模块

### 1. 意图识别器（简单规则）
```typescript
function detectIntent(message: string, attachments: Attachment[]): Intent {
  // 检查是否有视频附件
  if (attachments.some(a => a.type === 'video' || a.type === 'video_link')) {
    return 'video_analysis';
  }
  
  // 检查关键词
  if (message.includes('生成脚本') || message.includes('创作')) {
    return 'script_generation';
  }
  
  // 默认对话
  return 'conversation';
}
```

### 2. 模型调度器
```typescript
async function dispatchModel(intent: Intent, input: any) {
  switch (intent) {
    case 'conversation':
      return await callLLM(input);
    
    case 'video_analysis':
      const analysis = await callVisionModel(input.videoUrl);
      const referenceScript = await callLLM(`根据视频分析结果生成参考脚本：${analysis}`);
      return referenceScript;
    
    case 'script_generation':
      return await callScriptGenerator(input.referenceScript);
  }
}
```

### 3. 偏好记录器
```typescript
interface UserPreference {
  userId: string;
  timestamp: Date;
  
  // 用户选择
  selectedScript?: string;
  modifications?: string[];
  
  // 分析结果
  videoAnalysisResult?: any;
  
  // 模型输出
  modelOutputs?: any[];
}

// 记录偏好
function recordPreference(userId: string, preference: UserPreference) {
  // 存储到数据库
  // 用于后续蒸馏人格
}
```

### 4. 人格蒸馏器（核心功能）

**作用**：基于历史偏好形成用户画像，减少重复沟通

```typescript
interface UserPersonality {
  userId: string;
  
  // ===== 创作偏好 =====
  style: string[];           // ['自然真实', '生活化']
  duration: number;          // 15（秒）
  platform: string;          // '抖音'
  
  // ===== 视觉偏好 =====
  cameraWork: string[];      // ['推镜', '固定镜头']
  colorTone: string[];       // ['暖色调', '自然光']
  lighting: string[];        // ['自然光', '侧光']
  
  // ===== 内容偏好 =====
  subtitleSize: string;      // '大'
  subtitleStyle: string;     // '黑体白字'
  bgmType: string;           // '轻快吉他'
  
  // ===== 修改习惯 =====
  commonModifications: {     // 常见修改意见
    issue: string;           // '字幕太小'
    solution: string;        // '放大到48px'
    frequency: number;       // 出现次数
  }[];
  
  // ===== 模型输出偏好 =====
  preferredScriptStructure: string;  // 偏好的脚本结构
  preferredPromptStyle: string;      // 偏好的提示词风格
  
  // ===== 元数据 =====
  totalCreations: number;    // 总创作次数
  lastUpdated: Date;
}

// 蒸馏人格
async function distillPersonality(userId: string): Promise<UserPersonality> {
  // 1. 收集历史数据
  const preferences = await getUserPreferences(userId);
  const modifications = await getUserModifications(userId);
  const selections = await getUserSelections(userId);
  
  // 2. 分析模式
  const patterns = {
    style: findMostCommon(preferences.map(p => p.style)),
    duration: findMostCommon(preferences.map(p => p.duration)),
    platform: findMostCommon(preferences.map(p => p.platform)),
    cameraWork: findMostCommon(preferences.map(p => p.cameraWork)),
    modifications: groupModifications(modifications),
  };
  
  // 3. 生成人格
  return {
    userId,
    style: patterns.style,
    duration: patterns.duration,
    platform: patterns.platform,
    cameraWork: patterns.cameraWork,
    commonModifications: patterns.modifications,
    totalCreations: preferences.length,
    lastUpdated: new Date(),
  };
}

// 应用人格到提示词
function applyPersonality(prompt: string, personality: UserPersonality): string {
  return `
用户偏好：
- 风格：${personality.style.join('、')}
- 时长：${personality.duration}秒
- 平台：${personality.platform}
- 镜头：${personality.cameraWork.join('、')}
- 字幕大小：${personality.subtitleSize}

${prompt}

请生成符合用户风格偏好的内容。
`;
}
```

**人格蒸馏的触发时机**：
1. 用户完成一次创作（生成、选择、修改）
2. 积累到一定数量（如10次）
3. 发现新的偏好模式

**人格应用场景**：
1. 批量生成（10条视频）
2. 新的创作任务
3. 减少重复沟通

## 数据模型

### 核心表结构

```sql
-- 对话历史（用于上下文）
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID,
  message TEXT,
  response TEXT,
  created_at TIMESTAMP
);

-- 用户偏好记录（原始数据）
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID,
  
  -- 记录类型
  type VARCHAR(50), -- 'video_analysis', 'script_selection', 'modification', 'creation'
  
  -- 原始内容
  content JSONB,
  
  -- 提取的关键偏好
  extracted_preferences JSONB, -- { style: '自然真实', duration: 15, ... }
  
  created_at TIMESTAMP
);

-- 用户人格（蒸馏结果）
CREATE TABLE user_personalities (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE,
  
  -- 创作偏好
  style TEXT[],
  duration INTEGER,
  platform VARCHAR(50),
  
  -- 视觉偏好
  camera_work TEXT[],
  color_tone TEXT[],
  lighting TEXT[],
  
  -- 内容偏好
  subtitle_size VARCHAR(20),
  subtitle_style VARCHAR(50),
  bgm_type VARCHAR(50),
  
  -- 修改习惯
  common_modifications JSONB,
  
  -- 元数据
  total_creations INTEGER DEFAULT 0,
  last_distilled TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- 视频分析缓存（避免重复分析）
CREATE TABLE video_analyses (
  id UUID PRIMARY KEY,
  video_url TEXT UNIQUE,
  analysis_result JSONB,
  created_at TIMESTAMP
);

-- 批量任务（用于生成10条视频等）
CREATE TABLE batch_tasks (
  id UUID PRIMARY KEY,
  user_id UUID,
  task_type VARCHAR(50), -- 'batch_video_generation'
  
  -- 任务参数
  params JSONB, -- { count: 10, product: 'xxx', ... }
  
  -- 应用的人格
  applied_personality JSONB,
  
  -- 结果
  results JSONB,
  
  status VARCHAR(20), -- 'pending', 'processing', 'completed'
  created_at TIMESTAMP
);
```

### 数据流转

```
用户创作 → 记录偏好 → 积累数据 → 蒸馏人格 → 应用到新任务
   ↓
user_preferences (原始数据)
   ↓
定期分析（积累10次后）
   ↓
user_personalities (人格画像)
   ↓
下次生成时自动应用
```

## 删除的复杂功能

1. ❌ 8阶段工作流状态机
2. ❌ 双层能力系统
3. ❌ 能力评分
4. ❌ 学习模式/对比模式
5. ❌ 复杂的状态转换逻辑

## 保留的核心功能

1. ✅ 视频分析（视觉模型）
2. ✅ 脚本生成（LLM）
3. ✅ 对话历史记录
4. ✅ 偏好记录
5. ✅ 简单的意图识别

## 实现优先级

### Phase 1: 简化核心逻辑（立即）
- 删除8阶段工作流
- 删除双层能力系统
- 实现简单的意图识别
- 实现模型调度器
- **关键目标**：让流程跑通

### Phase 2: 人格蒸馏系统（核心价值）
- 实现偏好记录器
- 实现人格蒸馏算法
- 实现人格应用逻辑
- **关键目标**：减少用户重复工作

### Phase 3: 批量生成优化（高价值场景）
- 实现批量任务管理
- 自动应用人格
- 减少修改次数
- **关键目标**：10条视频自动符合用户风格

### Phase 4: 持续优化
- 分析修改模式
- 优化人格蒸馏算法
- 提高命中率（减少修改）

## 关键指标

### 1. 命中率（核心指标）
**定义**：首次生成就符合用户需求的比例

```
命中率 = 无需修改的生成数 / 总生成数

目标：
- 初期：30%（无人格时）
- 中期：60%（有人格后）
- 长期：80%（人格完善后）
```

### 2. 修改次数减少率
**定义**：使用人格后，修改次数的减少比例

```
修改次数减少率 = (之前平均修改次数 - 现在平均修改次数) / 之前平均修改次数

示例：
- 之前：平均每条视频修改3次
- 现在：平均每条视频修改1次
- 减少：(3-1)/3 = 66%
```

### 3. 批量生成效率
**定义**：批量生成时，符合用户风格的比例

```
批量命中率 = 无需修改的视频数 / 批量总数

示例：生成10条视频
- 无人格：可能只有2条符合，需要修改8条
- 有人格：可能有7条符合，只需修改3条
```

## 关键改进

### 从复杂到简单

**之前**：
```
用户输入 → 8阶段状态机 → 双层能力系统 → 学习模式判断 → 
对比模式 → 能力评分 → 状态转换 → ...
```

**现在**：
```
用户输入 → 意图识别 → 模型调度 → 返回结果 → 记录偏好
```

### 核心价值

1. **模型调度**：路由到正确的模型
2. **结果传递**：A模型输出 → B模型输入
3. **偏好记录**：积累用户习惯
4. **人格蒸馏**：长期目标，形成个性化助手

## 总结

智能体不应该试图"学会"创作，而是应该：
1. **做好调度**：把用户需求路由到正确的模型
2. **做好记录**：积累用户偏好和选择
3. **做好传递**：在模型之间传递上下文
4. **人格蒸馏**：形成用户画像，减少重复工作

简单、直接、有效。

## 实际案例：人格蒸馏如何减少重复工作

### 案例：用户连续生成10条抖音产品视频

**第1次生成**（无人格）：
```
用户：生成一条保温杯产品视频
智能体：好的，请告诉我风格、时长、平台...
用户：自然真实的风格，15秒，抖音平台
智能体：[生成脚本]
用户：字幕太小，镜头太快
智能体：[修改]
用户：好了

记录偏好：
- 风格：自然真实
- 时长：15秒
- 平台：抖音
- 修改：字幕要大、镜头要慢
```

**第2次生成**（有人格雏形）：
```
用户：生成一条收纳箱产品视频
智能体：
  [自动加载偏好]
  - 风格：自然真实 ✓
  - 时长：15秒 ✓
  - 平台：抖音 ✓
  - 字幕：大字号 ✓
  - 镜头：慢节奏 ✓
  
  [生成脚本，已应用偏好]

用户：很好！无需修改

记录偏好：✓ 强化人格
```

**第3-10次生成**（人格成熟）：
```
用户：批量生成8条产品视频
智能体：
  [自动应用成熟人格]
  生成8条脚本，全部符合用户风格
  
用户：全部通过！无需修改

命中率：100%（8/8）
修改次数：0
```

### 效果对比

| 指标 | 无人格 | 有人格 |
|-----|-------|-------|
| 首次满意度 | 30% | 80% |
| 平均修改次数 | 3次 | 0.5次 |
| 沟通轮次 | 5轮 | 1轮 |
| 用户工作量 | 高 | 低 |

**核心价值**：用户只需说"生成10条视频"，智能体自动应用人格，输出符合用户风格的结果，无需重复沟通。

简单、直接、有效。
