/**
 * 智能体能力服务 - 双层能力系统核心
 * 
 * 实现理念："先观察大师，再自己动手"
 * 
 * 核心功能：
 * 1. 能力评分与分级
 * 2. 执行模式路由（学习/对比/独立）
 * 3. 大模型输出观察与学习
 * 4. 模式提取与知识存储
 * 5. 用户反馈收集与能力强化
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ========== 类型定义 ==========

/** 执行模式 */
export type ExecutionMode = 'learning' | 'compare' | 'independent';

/** 能力等级 */
export type AbilityLevel = 'novice' | 'apprentice' | 'skilled' | 'expert' | 'master';

/** 任务类型 */
export type TaskType = 
  | 'script_generation'      // 脚本生成
  | 'video_analysis'         // 视频分析
  | 'style_transfer'         // 风格迁移
  | 'prompt_optimization'    // 提示词优化
  | 'creative_suggestion';   // 创意建议

/** 智能体类型 */
export type AgentType = 
  | 'creative_agent'         // 创意小海
  | 'video_analyzer'         // 视频分析
  | 'style_expert';          // 风格专家

/** 能力评分 */
export interface AbilityScore {
  overall: number;           // 综合评分 (0-100)
  dimensions: {
    completeness: number;    // 完整性 (0-100)
    accuracy: number;        // 准确性 (0-100)
    creativity: number;      // 创意性 (0-100)
    practicality: number;    // 实用性 (0-100)
    efficiency: number;      // 效率 (0-100)
  };
  confidence: number;        // 置信度 (基于样本数量)
  trend: 'improving' | 'stable' | 'declining';
}

/** 能力档案 */
export interface AbilityProfile {
  id: string;
  userId: string;
  agentType: AgentType;
  overallScore: number;
  level: AbilityLevel;
  dimensions: AbilityScore['dimensions'];
  stats: {
    observations: number;    // 观察大模型次数
    executions: number;      // 独立执行次数
    successRate: number;     // 成功率
    userPreference: number;  // 用户选择比例
  };
  trend: AbilityScore['trend'];
  createdAt: Date;
  updatedAt: Date;
}

/** 学习记录 */
export interface LearningRecord {
  id: string;
  userId: string;
  agentType: AgentType;
  taskType: TaskType;
  executionMode: ExecutionMode;
  
  // 输入
  taskInput: unknown;
  
  // 输出
  masterOutput?: unknown;
  agentOutput?: unknown;
  
  // 评分
  masterScore?: AbilityScore;
  agentScore?: AbilityScore;
  
  // 用户反馈
  userChoice?: 'master' | 'agent' | 'both' | 'neither';
  userFeedback?: string;
  
  // 学习成果
  patternsLearned?: LearningPattern[];
  
  createdAt: Date;
}

/** 学习模式 */
export interface LearningPattern {
  id: string;
  userId: string;
  agentType: AgentType;
  taskType: TaskType;
  patternName: string;
  
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
    sourceCount: number;
    successRate: number;
    lastUsedAt?: Date;
    usageCount: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

/** 执行结果 */
export interface ExecutionResult {
  mode: ExecutionMode;
  output: unknown;
  
  // 对比模式特有
  comparison?: {
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
  };
  
  // 学习模式特有
  learning?: {
    patternsExtracted: number;
    knowledgeUpdated: boolean;
  };
}

// ========== 核心服务类 ==========

export class AgentAbilityService {
  private llmClient: LLMClient;
  private headers: Record<string, string>;
  
  constructor(headers?: Record<string, string>) {
    this.headers = headers || {};
    this.llmClient = new LLMClient(new Config(), this.headers);
  }
  
  // ========== 能力评分 ==========
  
  /**
   * 获取智能体能力档案
   */
  async getAbilityProfile(
    userId: string,
    agentType: AgentType
  ): Promise<AbilityProfile | null> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_ability_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .single();
    
    if (error || !data) {
      // 创建初始档案
      return this.createAbilityProfile(userId, agentType);
    }
    
    return this.mapToProfile(data);
  }
  
  /**
   * 创建能力档案
   */
  private async createAbilityProfile(
    userId: string,
    agentType: AgentType
  ): Promise<AbilityProfile> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_ability_profiles')
      .insert({
        user_id: userId,
        agent_type: agentType,
        overall_score: 0,
        level: 'novice',
        score_completeness: 0,
        score_accuracy: 0,
        score_creativity: 0,
        score_practicality: 0,
        score_efficiency: 0,
        total_observations: 0,
        total_executions: 0,
        successful_executions: 0,
        user_selections: 0,
        user_rejections: 0,
        score_trend: 'stable',
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`创建能力档案失败: ${(error as any).message}`);
    }
    
    return this.mapToProfile(data as any);
  }
  
  /**
   * 更新能力评分
   */
  async updateAbilityScore(
    userId: string,
    agentType: AgentType,
    score: Partial<AbilityScore['dimensions']>,
    success: boolean
  ): Promise<void> {
    const client = getSupabaseClient();
    
    // 获取当前档案
    const profile = await this.getAbilityProfile(userId, agentType);
    if (!profile) return;
    
    // 计算新的维度分数（移动平均）
    const newDimensions = {
      completeness: this.calculateMovingAverage(
        profile.dimensions.completeness,
        score.completeness,
        profile.stats.executions
      ),
      accuracy: this.calculateMovingAverage(
        profile.dimensions.accuracy,
        score.accuracy,
        profile.stats.executions
      ),
      creativity: this.calculateMovingAverage(
        profile.dimensions.creativity,
        score.creativity,
        profile.stats.executions
      ),
      practicality: this.calculateMovingAverage(
        profile.dimensions.practicality,
        score.practicality,
        profile.stats.executions
      ),
      efficiency: this.calculateMovingAverage(
        profile.dimensions.efficiency,
        score.efficiency,
        profile.stats.executions
      ),
    };
    
    // 计算综合评分
    const newOverall = this.calculateOverallScore(newDimensions);
    
    // 确定能力等级
    const newLevel = this.determineLevel(newOverall);
    
    // 确定趋势
    const trend = this.determineTrend(profile.overallScore, newOverall);
    
    // 更新数据库
    await client
      .from('agent_ability_profiles')
      .update({
        overall_score: newOverall,
        level: newLevel,
        score_completeness: newDimensions.completeness,
        score_accuracy: newDimensions.accuracy,
        score_creativity: newDimensions.creativity,
        score_practicality: newDimensions.practicality,
        score_efficiency: newDimensions.efficiency,
        total_executions: profile.stats.executions + 1,
        successful_executions: profile.stats.successRate * profile.stats.executions + (success ? 1 : 0),
        score_trend: trend,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('agent_type', agentType);
  }
  
  // ========== 执行模式决策 ==========
  
  /**
   * 决定执行模式
   */
  async determineExecutionMode(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    forceMode?: ExecutionMode
  ): Promise<{
    mode: ExecutionMode;
    reason: string;
  }> {
    // 强制模式
    if (forceMode) {
      return {
        mode: forceMode,
        reason: '用户指定执行模式',
      };
    }
    
    // 获取能力档案
    const profile = await this.getAbilityProfile(userId, agentType);
    
    if (!profile) {
      return {
        mode: 'learning',
        reason: '首次执行，进入学习模式',
      };
    }
    
    // 根据评分决定模式
    const score = profile.overallScore;
    
    if (score < 40) {
      return {
        mode: 'learning',
        reason: `当前评分 ${score}分，需要更多学习`,
      };
    } else if (score < 85) {
      return {
        mode: 'compare',
        reason: `当前评分 ${score}分，建议对比验证`,
      };
    } else {
      // 检查是否需要定期抽查
      const shouldSpotCheck = await this.shouldPerformSpotCheck(userId, agentType);
      
      if (shouldSpotCheck) {
        return {
          mode: 'compare',
          reason: '定期抽查验证，确保能力稳定',
        };
      }
      
      return {
        mode: 'independent',
        reason: `当前评分 ${score}分，可独立执行`,
      };
    }
  }
  
  /**
   * 是否需要抽查
   */
  private async shouldPerformSpotCheck(
    userId: string,
    agentType: AgentType
  ): Promise<boolean> {
    const client = getSupabaseClient();
    
    // 获取最近10次执行
    const { data: records } = await client
      .from('agent_learning_records')
      .select('execution_mode, created_at')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!records || records.length < 10) {
      return false;
    }
    
    // 检查最近10次是否有对比模式
    const hasRecentComparison = records.some(r => r.execution_mode === 'compare');
    
    return !hasRecentComparison;
  }
  
  // ========== 执行与对比 ==========
  
  /**
   * 执行任务（自动选择模式）
   */
  async executeTask(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    input: unknown,
    agentExecuteFn: (input: unknown) => Promise<unknown>,
    masterExecuteFn?: (input: unknown) => Promise<unknown>
  ): Promise<ExecutionResult> {
    // 决定执行模式
    const { mode, reason } = await this.determineExecutionMode(userId, agentType, taskType);
    
    console.log(`[能力服务] 执行模式: ${mode}, 原因: ${reason}`);
    
    switch (mode) {
      case 'learning':
        return this.executeLearningMode(userId, agentType, taskType, input, masterExecuteFn!);
      case 'compare':
        return this.executeCompareMode(userId, agentType, taskType, input, agentExecuteFn, masterExecuteFn!);
      case 'independent':
        return this.executeIndependentMode(userId, agentType, taskType, input, agentExecuteFn);
    }
  }
  
  /**
   * 学习模式执行
   */
  private async executeLearningMode(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    input: unknown,
    masterExecuteFn: (input: unknown) => Promise<unknown>
  ): Promise<ExecutionResult> {
    console.log(`[能力服务] 学习模式: 观察大模型执行`);
    
    // 大模型执行
    const masterOutput = await masterExecuteFn(input);
    
    // 提取学习模式
    const patterns = await this.extractPatterns(userId, agentType, taskType, input, masterOutput);
    
    // 记录学习
    await this.recordLearning(userId, agentType, taskType, 'learning', input, {
      masterOutput,
      patternsLearned: patterns,
    });
    
    // 更新观察次数
    const client = getSupabaseClient();
    await client.rpc('increment_observations', {
      p_user_id: userId,
      p_agent_type: agentType,
    });
    
    return {
      mode: 'learning',
      output: masterOutput,
      learning: {
        patternsExtracted: patterns.length,
        knowledgeUpdated: true,
      },
    };
  }
  
  /**
   * 对比模式执行
   */
  private async executeCompareMode(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    input: unknown,
    agentExecuteFn: (input: unknown) => Promise<unknown>,
    masterExecuteFn: (input: unknown) => Promise<unknown>
  ): Promise<ExecutionResult> {
    console.log(`[能力服务] 对比模式: 并行执行`);
    
    // 并行执行
    const [masterOutput, agentOutput] = await Promise.all([
      masterExecuteFn(input),
      agentExecuteFn(input),
    ]);
    
    // 评分
    const [masterScore, agentScore] = await Promise.all([
      this.evaluateOutput(taskType, input, masterOutput),
      this.evaluateOutput(taskType, input, agentOutput),
    ]);
    
    // 分析差异
    const analysis = await this.analyzeDifference(taskType, masterOutput, agentOutput, masterScore, agentScore);
    
    // 记录对比
    await this.recordLearning(userId, agentType, taskType, 'compare', input, {
      masterOutput,
      agentOutput,
      masterScore,
      agentScore,
    });
    
    // 决定推荐
    const recommendation = this.determineRecommendation(masterScore, agentScore);
    
    return {
      mode: 'compare',
      output: recommendation === 'agent' ? agentOutput : masterOutput,
      comparison: {
        masterOutput,
        agentOutput,
        masterScore,
        agentScore,
        recommendation,
        analysis,
      },
    };
  }
  
  /**
   * 独立模式执行
   */
  private async executeIndependentMode(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    input: unknown,
    agentExecuteFn: (input: unknown) => Promise<unknown>
  ): Promise<ExecutionResult> {
    console.log(`[能力服务] 独立模式: 智能体自主执行`);
    
    // 智能体执行
    const agentOutput = await agentExecuteFn(input);
    
    // 记录执行
    await this.recordLearning(userId, agentType, taskType, 'independent', input, {
      agentOutput,
    });
    
    return {
      mode: 'independent',
      output: agentOutput,
    };
  }
  
  // ========== 评估与评分 ==========
  
  /**
   * 评估输出质量
   */
  async evaluateOutput(
    taskType: TaskType,
    input: unknown,
    output: unknown
  ): Promise<AbilityScore> {
    // 构建评估提示词
    const evaluationPrompt = this.buildEvaluationPrompt(taskType, input, output);
    
    // 调用 LLM 评估
    const response = await this.llmClient.invoke([
      { role: 'system', content: this.getEvaluationSystemPrompt() },
      { role: 'user', content: evaluationPrompt },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.3,
    });
    
    // 解析评估结果
    return this.parseEvaluationResponse(response.content);
  }
  
  /**
   * 获取评估系统提示词
   */
  private getEvaluationSystemPrompt(): string {
    return `你是一个专业的作品评估专家，负责评估AI生成内容的质量。

请从以下五个维度进行评估（每项0-100分）：

1. **完整性** (completeness): 是否包含所有必要元素，是否有遗漏
2. **准确性** (accuracy): 是否符合用户需求，信息是否准确
3. **创意性** (creativity): 是否有创新点或亮点，是否独特
4. **实用性** (practicality): 是否可以直接使用，是否需要修改
5. **效率** (efficiency): 输出是否简洁有效，是否有多余内容

评估标准：
- 90-100: 优秀，可以完全满足需求
- 80-89: 良好，基本满足需求
- 70-79: 合格，需要少量修改
- 60-69: 一般，需要较多修改
- 0-59: 不合格，需要重新生成

请返回JSON格式的评估结果：
{
  "dimensions": {
    "completeness": 分数,
    "accuracy": 分数,
    "creativity": 分数,
    "practicality": 分数,
    "efficiency": 分数
  },
  "reasoning": "评分理由（简短说明每个维度的评分依据）"
}`;
  }
  
  /**
   * 构建评估提示词
   */
  private buildEvaluationPrompt(
    taskType: TaskType,
    input: unknown,
    output: unknown
  ): string {
    const taskDescriptions: Record<TaskType, string> = {
      script_generation: '视频脚本创作',
      video_analysis: '视频内容分析',
      style_transfer: '视频风格迁移',
      prompt_optimization: '提示词优化',
      creative_suggestion: '创意建议',
    };
    
    return `请评估以下${taskDescriptions[taskType]}任务的结果：

## 用户输入
${JSON.stringify(input, null, 2)}

## 生成结果
${JSON.stringify(output, null, 2)}

请按照五个维度进行评估，并返回JSON格式的评分。`;
  }
  
  /**
   * 解析评估响应
   */
  private parseEvaluationResponse(response: string): AbilityScore {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const dimensions = parsed.dimensions || {};
        
        const score: AbilityScore = {
          overall: this.calculateOverallScore({
            completeness: dimensions.completeness || 0,
            accuracy: dimensions.accuracy || 0,
            creativity: dimensions.creativity || 0,
            practicality: dimensions.practicality || 0,
            efficiency: dimensions.efficiency || 0,
          }),
          dimensions: {
            completeness: dimensions.completeness || 0,
            accuracy: dimensions.accuracy || 0,
            creativity: dimensions.creativity || 0,
            practicality: dimensions.practicality || 0,
            efficiency: dimensions.efficiency || 0,
          },
          confidence: 0.8,
          trend: 'stable',
        };
        
        return score;
      }
    } catch (e) {
      console.error('解析评估响应失败:', e);
    }
    
    // 返回默认分数
    return {
      overall: 50,
      dimensions: {
        completeness: 50,
        accuracy: 50,
        creativity: 50,
        practicality: 50,
        efficiency: 50,
      },
      confidence: 0.3,
      trend: 'stable',
    };
  }
  
  /**
   * 分析差异
   */
  private async analyzeDifference(
    taskType: TaskType,
    masterOutput: unknown,
    agentOutput: unknown,
    masterScore: AbilityScore,
    agentScore: AbilityScore
  ): Promise<{
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  }> {
    const analysisPrompt = `请分析以下两个输出的差异：

## 大模型输出（评分：${masterScore.overall}）
${JSON.stringify(masterOutput, null, 2)}

## 智能体输出（评分：${agentScore.overall}）
${JSON.stringify(agentOutput, null, 2)}

请分析：
1. 智能体输出的优点（strengths）
2. 智能体输出的不足（weaknesses）
3. 改进建议（suggestions）

返回JSON格式：
{
  "strengths": ["优点1", "优点2"],
  "weaknesses": ["不足1", "不足2"],
  "suggestions": ["建议1", "建议2"]
}`;

    const response = await this.llmClient.invoke([
      { role: 'user', content: analysisPrompt },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.5,
    });
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('解析差异分析失败:', e);
    }
    
    return {
      strengths: [],
      weaknesses: [],
      suggestions: [],
    };
  }
  
  /**
   * 决定推荐
   */
  private determineRecommendation(
    masterScore: AbilityScore,
    agentScore: AbilityScore
  ): 'master' | 'agent' | 'either' {
    const diff = agentScore.overall - masterScore.overall;
    
    if (diff >= 5) {
      return 'agent';
    } else if (diff <= -5) {
      return 'master';
    } else {
      return 'either';
    }
  }
  
  // ========== 学习与模式提取 ==========
  
  /**
   * 提取学习模式
   */
  private async extractPatterns(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    input: unknown,
    output: unknown
  ): Promise<LearningPattern[]> {
    const extractionPrompt = `请分析以下成功的任务执行案例，提取可学习的模式：

## 任务类型
${taskType}

## 输入
${JSON.stringify(input, null, 2)}

## 成功输出
${JSON.stringify(output, null, 2)}

请提取执行模式，返回JSON数组：
[
  {
    "patternName": "模式名称",
    "triggers": {
      "keywords": ["触发关键词"],
      "context": ["适用场景"],
      "constraints": ["限制条件"]
    },
    "execution": {
      "steps": ["步骤1", "步骤2"],
      "tools": ["使用的工具"],
      "parameters": {"参数名": "参数值"},
      "outputFormat": "输出格式说明"
    }
  }
]`;

    const response = await this.llmClient.invoke([
      { role: 'user', content: extractionPrompt },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });
    
    try {
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const patterns = JSON.parse(jsonMatch[0]);
        
        // 保存模式到数据库
        const savedPatterns: LearningPattern[] = [];
        for (const pattern of patterns) {
          const saved = await this.savePattern(userId, agentType, taskType, pattern);
          if (saved) {
            savedPatterns.push(saved);
          }
        }
        
        return savedPatterns;
      }
    } catch (e) {
      console.error('提取学习模式失败:', e);
    }
    
    return [];
  }
  
  /**
   * 保存学习模式
   */
  private async savePattern(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    pattern: Partial<LearningPattern>
  ): Promise<LearningPattern | null> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_learning_patterns')
      .insert({
        user_id: userId,
        agent_type: agentType,
        task_type: taskType,
        pattern_name: pattern.patternName,
        triggers: pattern.triggers,
        execution: pattern.execution,
        source_count: 1,
        success_rate: 0.5,
      })
      .select()
      .single();
    
    if (error) {
      console.error('保存学习模式失败:', error);
      return null;
    }
    
    return this.mapToPattern(data as any);
  }
  
  /**
   * 获取相关学习模式
   */
  async getRelevantPatterns(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    context: string
  ): Promise<LearningPattern[]> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_learning_patterns')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .eq('task_type', taskType)
      .order('success_rate', { ascending: false })
      .limit(5);
    
    if (error || !data) {
      return [];
    }
    
    return data.map(this.mapToPattern);
  }
  
  // ========== 用户反馈处理 ==========
  
  /**
   * 记录用户选择
   */
  async recordUserChoice(
    recordId: string,
    choice: 'master' | 'agent',
    feedback?: string
  ): Promise<{
    updated: boolean;
    newScore: number;
    message: string;
  }> {
    const client = getSupabaseClient();
    
    // 更新学习记录
    const { data: record, error: fetchError } = await client
      .from('agent_learning_records')
      .select('*')
      .eq('id', recordId)
      .single();
    
    if (fetchError || !record) {
      throw new Error('学习记录不存在');
    }
    
    await client
      .from('agent_learning_records')
      .update({
        user_choice: choice,
        user_feedback: feedback,
      })
      .eq('id', recordId);
    
    // 更新能力档案
    const success = choice === 'agent';
    
    // 更新用户选择统计
    if (success) {
      await client.rpc('increment_user_selections', {
        p_user_id: record.user_id,
        p_agent_type: record.agent_type,
      });
    } else {
      await client.rpc('increment_user_rejections', {
        p_user_id: record.user_id as string,
        p_agent_type: record.agent_type as string,
      });
    }
    
    // 获取更新后的档案
    const profile = await this.getAbilityProfile(record.user_id as string, record.agent_type as AgentType);
    const newScore = profile?.overallScore || 0;
    
    // 如果用户选择大模型，触发深度学习
    if (choice === 'master' && record.master_output) {
      await this.scheduleDeepLearning(record.user_id as string, record.agent_type as AgentType, record as any);
    }
    
    return {
      updated: true,
      newScore,
      message: success 
        ? `感谢肯定！智能体能力已提升至 ${newScore.toFixed(1)} 分` 
        : `已记录反馈，智能体将继续学习提升`,
    };
  }
  
  /**
   * 安排深度学习
   */
  private async scheduleDeepLearning(
    userId: string,
    agentType: string,
    record: Record<string, unknown>
  ): Promise<void> {
    // 从大模型输出中提取更多学习模式
    console.log(`[能力服务] 安排深度学习: 用户 ${userId}, 智能体 ${agentType}`);
    
    // 这里可以触发异步学习任务
    // 实际实现中可以使用消息队列或后台任务
  }
  
  // ========== 辅助方法 ==========
  
  /**
   * 记录学习
   */
  private async recordLearning(
    userId: string,
    agentType: AgentType,
    taskType: TaskType,
    executionMode: ExecutionMode,
    taskInput: unknown,
    data: Partial<LearningRecord>
  ): Promise<string> {
    const client = getSupabaseClient();
    
    const { data: record, error } = await client
      .from('agent_learning_records')
      .insert({
        user_id: userId,
        agent_type: agentType,
        task_type: taskType,
        execution_mode: executionMode,
        task_input: taskInput,
        master_output: data.masterOutput,
        agent_output: data.agentOutput,
        master_score: data.masterScore,
        agent_score: data.agentScore,
        patterns_learned: data.patternsLearned,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('记录学习失败:', error);
      return '';
    }
    
    return (record as any).id as string;
  }
  
  /**
   * 计算移动平均
   */
  private calculateMovingAverage(
    current: number,
    newValue: number | undefined,
    count: number
  ): number {
    if (newValue === undefined) return current;
    const weight = Math.min(1 / (count + 1), 0.2); // 最大权重20%
    return current * (1 - weight) + newValue * weight;
  }
  
  /**
   * 计算综合评分
   */
  private calculateOverallScore(dimensions: AbilityScore['dimensions']): number {
    return (
      dimensions.completeness * 0.25 +
      dimensions.accuracy * 0.25 +
      dimensions.creativity * 0.20 +
      dimensions.practicality * 0.20 +
      dimensions.efficiency * 0.10
    );
  }
  
  /**
   * 确定能力等级
   */
  private determineLevel(score: number): AbilityLevel {
    if (score >= 95) return 'master';
    if (score >= 85) return 'expert';
    if (score >= 60) return 'skilled';
    if (score >= 40) return 'apprentice';
    return 'novice';
  }
  
  /**
   * 确定趋势
   */
  private determineTrend(
    oldScore: number,
    newScore: number
  ): AbilityScore['trend'] {
    const diff = newScore - oldScore;
    if (diff > 2) return 'improving';
    if (diff < -2) return 'declining';
    return 'stable';
  }
  
  /**
   * 映射到档案对象
   */
  private mapToProfile(data: Record<string, unknown>): AbilityProfile {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      agentType: data.agent_type as AgentType,
      overallScore: data.overall_score as number,
      level: data.level as AbilityLevel,
      dimensions: {
        completeness: data.score_completeness as number,
        accuracy: data.score_accuracy as number,
        creativity: data.score_creativity as number,
        practicality: data.score_practicality as number,
        efficiency: data.score_efficiency as number,
      },
      stats: {
        observations: data.total_observations as number,
        executions: data.total_executions as number,
        successRate: data.successful_executions && data.total_executions 
          ? (data.successful_executions as number) / (data.total_executions as number) 
          : 0,
        userPreference: data.user_selections && data.total_executions 
          ? (data.user_selections as number) / (data.total_executions as number) 
          : 0,
      },
      trend: data.score_trend as AbilityScore['trend'],
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
  
  /**
   * 映射到模式对象
   */
  private mapToPattern(data: Record<string, unknown>): LearningPattern {
    return {
      id: data.id as string,
      userId: data.user_id as string,
      agentType: data.agent_type as AgentType,
      taskType: data.task_type as TaskType,
      patternName: data.pattern_name as string,
      triggers: data.triggers as LearningPattern['triggers'],
      execution: data.execution as LearningPattern['execution'],
      metadata: {
        sourceCount: data.source_count as number,
        successRate: data.success_rate as number,
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at as string) : undefined,
        usageCount: data.usage_count as number,
      },
      createdAt: new Date(data.created_at as string),
      updatedAt: new Date(data.updated_at as string),
    };
  }
}

// ========== 导出工厂函数 ==========

export function createAgentAbilityService(headers?: Record<string, string>): AgentAbilityService {
  return new AgentAbilityService(headers);
}
