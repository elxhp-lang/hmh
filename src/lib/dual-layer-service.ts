/**
 * 双层能力系统 - 对比模式核心服务
 * 
 * 核心理念：先观察大师，再自己动手
 * 
 * 执行模式：
 * 1. 学习模式（评分<60）：只观察大模型执行
 * 2. 对比模式（评分60-85）：双路执行，用户选择
 * 3. 独立模式（评分>85）：智能体独立执行
 */

import { LLMClient, Config, KnowledgeClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createVideoLearningService } from './video-learning-service';
import type { AbilityLevel } from './agent-ability-service';

// ========== 类型定义 ==========

export type ExecutionMode = 'learning' | 'compare' | 'independent';

export interface AbilityProfile {
  overall: number;
  level: 'novice' | 'apprentice' | 'skilled' | 'expert' | 'master';
  dimensions: {
    completeness: number;
    accuracy: number;
    creativity: number;
    practicality: number;
    efficiency: number;
  };
  totalObservations: number;
  totalExecutions: number;
  userSelections: number;
}

export interface CompareResult {
  masterOutput: string;       // 大模型输出（大师版本）
  agentOutput: string;        // 智能体输出（学徒版本）
  masterContext: string;      // 大模型使用的上下文
  agentContext: string;       // 智能体使用的上下文（包含学习库）
  mode: ExecutionMode;
  timestamp: Date;
}

export interface TaskType {
  type: 'script_generation' | 'video_analysis' | 'prompt_optimization' | 'creative_suggestion';
  name: string;
  description: string;
}

interface AbilityProfileRow {
  id?: string;
  overall_score?: number;
  level?: AbilityLevel;
  score_completeness?: number;
  score_accuracy?: number;
  score_creativity?: number;
  score_practicality?: number;
  score_efficiency?: number;
  total_observations?: number;
  total_executions?: number;
  user_selections?: number;
  user_rejections?: number;
}

// ========== 核心服务 ==========

export class DualLayerService {
  private llmClient: LLMClient;
  private knowledgeClient: KnowledgeClient;
  private headers: Record<string, string>;

  constructor(headers: Record<string, string> = {}) {
    const config = new Config();
    this.headers = headers;
    this.llmClient = new LLMClient(config, headers);
    this.knowledgeClient = new KnowledgeClient(config, headers);
  }

  /**
   * 获取用户的能力档案
   */
  async getAbilityProfile(userId: string, agentType: string = 'creative_agent'): Promise<AbilityProfile> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_ability_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_type', agentType)
      .single();

    if (error || !data) {
      // 创建默认档案
      return {
        overall: 0,
        level: 'novice',
        dimensions: {
          completeness: 0,
          accuracy: 0,
          creativity: 0,
          practicality: 0,
          efficiency: 0,
        },
        totalObservations: 0,
        totalExecutions: 0,
        userSelections: 0,
      };
    }

    const row = data as AbilityProfileRow;
    return {
      overall: Number(row.overall_score) || 0,
      level: row.level || 'novice',
      dimensions: {
        completeness: Number(row.score_completeness) || 0,
        accuracy: Number(row.score_accuracy) || 0,
        creativity: Number(row.score_creativity) || 0,
        practicality: Number(row.score_practicality) || 0,
        efficiency: Number(row.score_efficiency) || 0,
      },
      totalObservations: row.total_observations || 0,
      totalExecutions: row.total_executions || 0,
      userSelections: row.user_selections || 0,
    };
  }

  /**
   * 确定执行模式
   */
  getExecutionMode(profile: AbilityProfile): ExecutionMode {
    if (profile.overall < 60) {
      return 'learning';
    } else if (profile.overall < 85) {
      return 'compare';
    } else {
      return 'independent';
    }
  }

  /**
   * 核心方法：执行任务（根据能力等级选择模式）
   */
  async executeTask(
    userId: string,
    taskType: TaskType,
    userInput: string,
    options: {
      style?: string;
      productInfo?: string;
    } = {}
  ): Promise<{
    mode: ExecutionMode;
    result: CompareResult | string;
    profile: AbilityProfile;
  }> {
    // 获取能力档案
    const profile = await this.getAbilityProfile(userId);
    const mode = this.getExecutionMode(profile);

    console.log(`[双层系统] 用户评分: ${profile.overall}, 执行模式: ${mode}`);

    switch (mode) {
      case 'learning':
        // 学习模式：只观察大模型
        return {
          mode: 'learning',
          result: await this.masterExecute(taskType, userInput, options),
          profile,
        };

      case 'compare':
        // 对比模式：双路执行
        return {
          mode: 'compare',
          result: await this.compareExecute(userId, taskType, userInput, options),
          profile,
        };

      case 'independent':
        // 独立模式：智能体独立执行
        return {
          mode: 'independent',
          result: await this.agentExecute(userId, taskType, userInput, options),
          profile,
        };
    }
  }

  /**
   * 大模型执行（大师版本）- 不使用学习库
   */
  private async masterExecute(
    taskType: TaskType,
    userInput: string,
    options: { style?: string; productInfo?: string }
  ): Promise<string> {
    console.log(`[双层系统] 大模型执行: ${taskType.type}`);

    // 构建标准Prompt（不包含学习库内容）
    const prompt = this.buildMasterPrompt(taskType, userInput, options);

    // 流式生成
    const stream = this.llmClient.stream([{ role: 'user', content: prompt }], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    let output = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        output += chunk.content.toString();
      }
    }

    return output;
  }

  /**
   * 智能体执行（学徒版本）- 使用学习库增强
   */
  private async agentExecute(
    userId: string,
    taskType: TaskType,
    userInput: string,
    options: { style?: string; productInfo?: string }
  ): Promise<string> {
    console.log(`[双层系统] 智能体执行: ${taskType.type}`);

    // 1. 检索学习库内容
    const learningContext = await this.retrieveLearningContext(userId, userInput);
    
    // 2. 获取用户偏好
    const userPreferences = await this.getUserPreferences(userId);
    
    // 3. 构建增强Prompt
    const prompt = this.buildAgentPrompt(taskType, userInput, options, learningContext, userPreferences);

    // 流式生成
    const stream = this.llmClient.stream([{ role: 'user', content: prompt }], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    let output = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        output += chunk.content.toString();
      }
    }

    return output;
  }

  /**
   * 对比执行：双路并行
   */
  private async compareExecute(
    userId: string,
    taskType: TaskType,
    userInput: string,
    options: { style?: string; productInfo?: string }
  ): Promise<CompareResult> {
    console.log(`[双层系统] 对比模式执行: ${taskType.type}`);

    // 获取智能体需要的上下文
    const learningContext = await this.retrieveLearningContext(userId, userInput);
    const userPreferences = await this.getUserPreferences(userId);

    // 并行执行
    const [masterOutput, agentOutput] = await Promise.all([
      this.masterExecute(taskType, userInput, options),
      this.agentExecute(userId, taskType, userInput, options),
    ]);

    return {
      masterOutput,
      agentOutput,
      masterContext: '标准Prompt（无学习库参考）',
      agentContext: `增强Prompt（包含学习库参考和用户偏好）\n\n学习库参考:\n${learningContext.slice(0, 500)}...\n\n用户偏好:\n${userPreferences.slice(0, 300)}...`,
      mode: 'compare',
      timestamp: new Date(),
    };
  }

  /**
   * 检索学习库上下文
   */
  private async retrieveLearningContext(userId: string, query: string): Promise<string> {
    try {
      const videoLearningService = createVideoLearningService(this.headers);
      const results = await videoLearningService.semanticSearch(userId, query, 5);

      if (results.length === 0) {
        return '';
      }

      return results.map((r, i) => `
${i + 1}. 《${r.videoName}》
   风格: ${r.style}
   相似度: ${(r.score * 100).toFixed(0)}%
   摘要: ${r.summary}
      `).join('\n');
    } catch (error) {
      console.error('[双层系统] 检索学习库失败:', error);
      return '';
    }
  }

  /**
   * 获取用户偏好
   */
  private async getUserPreferences(userId: string): Promise<string> {
    try {
      const client = getSupabaseClient();
      
      // 从学习记录中提取用户偏好
      const { data: patterns } = await client
        .from('agent_learning_patterns')
        .select('pattern_name, success_rate, usage_count')
        .eq('user_id', userId)
        .order('success_rate', { ascending: false })
        .limit(5);

      if (!patterns || patterns.length === 0) {
        return '';
      }

      return patterns.map(p => `- ${p.pattern_name} (成功率: ${Number(p.success_rate) * 100}%, 使用${p.usage_count}次)`).join('\n');
    } catch (error) {
      console.error('[双层系统] 获取用户偏好失败:', error);
      return '';
    }
  }

  /**
   * 构建大模型Prompt（标准版，无学习库）
   */
  private buildMasterPrompt(
    taskType: TaskType,
    userInput: string,
    options: { style?: string; productInfo?: string }
  ): string {
    const styleInfo = options.style ? `风格要求：${options.style}\n` : '';
    const productInfo = options.productInfo ? `商品信息：${options.productInfo}\n` : '';

    switch (taskType.type) {
      case 'script_generation':
        return `你是一位专业的视频脚本创作者。请根据用户需求创作一个视频分镜脚本。

${styleInfo}${productInfo}
用户需求：${userInput}

**重要规则**：
1. 每个分镜时长控制在3秒左右（可以是2-4秒）
2. 画面描述必须详细描述从开始到结束的变化过程，不能只是静态描述
3. 例如："镜头从全景缓缓推进，阳光透过窗户洒在桌面上，咖啡杯中升起袅袅热气，人物抬起头看向窗外"

请以JSON格式输出详细的分镜脚本：
{
  "title": "视频标题",
  "theme": "主题",
  "style": "整体风格",
  "total_duration": 总时长（秒）,
  "target_platform": "目标平台",
  "storyboards": [
    {
      "id": "sb_1",
      "sequence": 1,
      "duration": 3,
      "scene_description": "详细的画面变化描述",
      "visual_reference": "画面参考关键词",
      "camera_movement": "运镜方式",
      "camera_angle": "镜头角度",
      "lighting": "光线设置",
      "color_tone": "色调风格",
      "background": "背景环境",
      "atmosphere": "氛围感",
      "characters": "人物描述",
      "character_actions": "人物动作",
      "character_emotion": "人物情绪",
      "dialogue": "对白/口播",
      "voiceover": "旁白",
      "text_overlay": "字幕文字",
      "background_music": "背景音乐风格",
      "sound_effects": "音效",
      "transition": "转场效果",
      "prompt": "英文AI生成提示词"
    }
  ],
  "overall_notes": "创作说明"
}
`;

      case 'video_analysis':
        return `你是一位专业的视频分析师。请分析以下视频内容。

视频信息：${userInput}

请从以下维度分析：
1. 视频类型和风格
2. 场景和镜头分析
3. 色彩和光影
4. 创作技巧
`;

      case 'prompt_optimization':
        return `你是一位视频生成Prompt专家。请将用户的中文描述转换为高质量的英文Prompt。

用户描述：${userInput}

请输出：
1. 优化的英文Prompt
2. 关键画面描述
3. 建议的参数设置
`;

      default:
        return userInput;
    }
  }

  /**
   * 构建智能体Prompt（增强版，包含学习库）
   */
  private buildAgentPrompt(
    taskType: TaskType,
    userInput: string,
    options: { style?: string; productInfo?: string },
    learningContext: string,
    userPreferences: string
  ): string {
    const styleInfo = options.style ? `风格要求：${options.style}\n` : '';
    const productInfo = options.productInfo ? `商品信息：${options.productInfo}\n` : '';

    // 学习库上下文
    const learningSection = learningContext ? `
## 学习库参考（你之前学习过的优秀视频）

${learningContext}

请参考这些视频的优点，应用到你的创作中。
` : '';

    // 用户偏好
    const preferencesSection = userPreferences ? `
## 用户偏好（根据历史记录总结）

${userPreferences}

请在创作中体现这些偏好。
` : '';

    switch (taskType.type) {
      case 'script_generation':
        return `你是一位正在学习成长的视频脚本创作者（智能体）。你已经学习了用户上传的优秀视频，请结合学习成果创作更符合用户风格的脚本。

${styleInfo}${productInfo}
${learningSection}
${preferencesSection}

用户需求：${userInput}

**重要规则**：
1. 每个分镜时长控制在3秒左右（可以是2-4秒）
2. 画面描述必须详细描述从开始到结束的变化过程，不能只是静态描述
3. 结合学习库中的优秀技巧和用户偏好

请以JSON格式输出详细的分镜脚本：
{
  "title": "视频标题",
  "theme": "主题",
  "style": "整体风格",
  "total_duration": 总时长（秒）,
  "target_platform": "目标平台",
  "storyboards": [
    {
      "id": "sb_1",
      "sequence": 1,
      "duration": 3,
      "scene_description": "详细的画面变化描述",
      "visual_reference": "画面参考关键词",
      "camera_movement": "运镜方式",
      "camera_angle": "镜头角度",
      "lighting": "光线设置",
      "color_tone": "色调风格",
      "background": "背景环境",
      "atmosphere": "氛围感",
      "characters": "人物描述",
      "character_actions": "人物动作",
      "character_emotion": "人物情绪",
      "dialogue": "对白/口播",
      "voiceover": "旁白",
      "text_overlay": "字幕文字",
      "background_music": "背景音乐风格",
      "sound_effects": "音效",
      "transition": "转场效果",
      "prompt": "英文AI生成提示词"
    }
  ],
  "overall_notes": "创作说明"
}
`;

      case 'video_analysis':
        return `你是一位正在学习成长的视频分析师（智能体）。请结合你的学习经验分析视频。

${learningSection}
${preferencesSection}

视频信息：${userInput}

请从以下维度分析，并结合学习库中的参考：
1. 视频类型和风格
2. 场景和镜头分析
3. 色彩和光影
4. 创作技巧
`;

      case 'prompt_optimization':
        return `你是一位正在学习成长的视频生成Prompt专家（智能体）。请结合学习成果优化Prompt。

${learningSection}

用户描述：${userInput}

请输出：
1. 优化的英文Prompt（参考学习库中的成功案例）
2. 关键画面描述
3. 建议的参数设置
`;

      default:
        return userInput;
    }
  }

  /**
   * 记录用户选择并更新评分
   */
  async recordUserChoice(
    userId: string,
    recordId: string,
    choice: 'master' | 'agent' | 'both' | 'neither',
    taskType: string,
    masterOutput: string,
    agentOutput: string
  ): Promise<{ newProfile: AbilityProfile }> {
    const client = getSupabaseClient();

    // 获取当前档案
    const { data: currentProfile } = await client
      .from('agent_ability_profiles')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_type', 'creative_agent')
      .single();

    // 计算评分变化
    let scoreDelta = 0;
    switch (choice) {
      case 'agent':
        scoreDelta = 5; // 选择智能体，加分
        break;
      case 'master':
        scoreDelta = -2; // 选择大模型，轻微扣分（继续学习）
        break;
      case 'both':
        scoreDelta = 2; // 两个都不错，轻微加分
        break;
      case 'neither':
        scoreDelta = -5; // 都不好，扣分
        break;
    }

    // 更新或创建档案
    const currentScore = Number(currentProfile?.overall_score) || 0;
    const newScore = Math.max(0, Math.min(100, currentScore + scoreDelta));
    const newLevel = this.calculateLevel(newScore);

    // 更新学习记录
    await client
      .from('agent_learning_records')
      .insert({
        user_id: userId,
        agent_type: 'creative_agent',
        task_type: taskType,
        execution_mode: 'compare',
        master_output: { content: masterOutput },
        agent_output: { content: agentOutput },
        user_choice: choice,
      });

    const p = (currentProfile || null) as AbilityProfileRow | null;
    
    // 更新能力档案
    const updateData = {
      overall_score: newScore,
      level: newLevel,
      total_executions: (p?.total_executions || 0) + 1,
      user_selections: choice === 'agent' ? (p?.user_selections || 0) + 1 : p?.user_selections || 0,
      user_rejections: choice === 'master' ? (p?.user_rejections || 0) + 1 : p?.user_rejections || 0,
      updated_at: new Date().toISOString(),
    };

    if (currentProfile) {
      await client
        .from('agent_ability_profiles')
        .update(updateData)
        .eq('id', p?.id);
    } else {
      await client
        .from('agent_ability_profiles')
        .insert({
          user_id: userId,
          agent_type: 'creative_agent',
          ...updateData,
        });
    }

    console.log(`[双层系统] 用户选择: ${choice}, 评分变化: ${scoreDelta}, 新评分: ${newScore}`);

    return {
      newProfile: {
        overall: newScore,
        level: newLevel as AbilityProfile['level'],
        dimensions: {
          completeness: Number(p?.score_completeness) || 50,
          accuracy: Number(p?.score_accuracy) || 50,
          creativity: Number(p?.score_creativity) || 50,
          practicality: Number(p?.score_practicality) || 50,
          efficiency: Number(p?.score_efficiency) || 50,
        },
        totalObservations: p?.total_observations || 0,
        totalExecutions: updateData.total_executions,
        userSelections: updateData.user_selections,
      },
    };
  }

  /**
   * 根据评分计算等级
   */
  private calculateLevel(score: number): string {
    if (score >= 95) return 'master';
    if (score >= 85) return 'expert';
    if (score >= 60) return 'skilled';
    if (score >= 30) return 'apprentice';
    return 'novice';
  }
}

// ========== 工厂函数 ==========

export function createDualLayerService(headers: Record<string, string> = {}): DualLayerService {
  return new DualLayerService(headers);
}
