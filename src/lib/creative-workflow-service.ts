/**
 * 创意小海工作流服务
 * 
 * 完整的工作流流程：
 * 1. 输入收集 (input_collecting) - 收集用户需求（文字、图片、视频链接等）
 * 2. 脚本生成 (script_generating) - AI生成详细分镜脚本
 * 3. 脚本确认 (script_confirming) - 用户确认或修改脚本
 * 4. 视频生成 (video_generating) - 根据确认的脚本生成视频
 * 5. 审核修改 (reviewing) - 用户审核视频，可要求修改
 * 6. 批量准备 (batch_preparing) - 生成10个修改方向供用户选择
 * 7. 批量生成 (batch_generating) - 根据用户选择批量生成视频
 * 8. 完成 (completed) - 工作流结束
 * 
 * 记忆系统：基于虾评Skill的分层记忆
 * - SESSION-STATE: 保存当前工作流状态，确保对话不丢失
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { ImageGenerationService, imageGenerationService } from '@/lib/image-generation-service';
import { VideoLinkParser, PLATFORM_CONFIG } from '@/lib/video-link-parser';
import { agentMemoryService } from '@/lib/agent-memory-service';
import { createVideoLearningService, VideoAnalysisResult } from '@/lib/video-learning-service';
import {
  productVideoWorkflowService,
  ProductReference,
} from '@/lib/product-video-workflow-service';
import { productLibraryService } from '@/lib/product-library-service';
import { DualLayerService, type ExecutionMode, type CompareResult } from '@/lib/dual-layer-service';
import { MemoryLayerService, MemoryLayer, MemoryStatus } from '@/lib/memory-layer-service';

// ========== 类型定义 ==========

/** 工作流阶段 */
export type WorkflowStage = 
  | 'input_collecting'
  | 'script_generating'
  | 'script_confirming'
  | 'video_generating'
  | 'reviewing'
  | 'batch_preparing'
  | 'batch_generating'
  | 'completed';

/** 工作流状态 */
export type WorkflowStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'failed';

/** 输入类型 */
export type InputType = 'text' | 'image' | 'video_link' | 'multi_reference';

/** 分镜脚本项 */
export interface StoryboardItem {
  id: string;
  sequence: number;
  duration: number; // 秒
  
  // 场景与画面
  scene_description: string; // 场景描述
  visual_reference: string; // 画面参考描述（用于AI生图）
  
  // 镜头信息
  camera_movement: string; // 运镜方式（推、拉、摇、移、跟、升降、环绕等）
  camera_angle: string; // 镜头角度（俯视、仰视、平视、斜角、荷兰角等）
  
  // 光影与色调
  lighting: string; // 光线设置（自然光、人工光、逆光、侧光、柔光、硬光等）
  color_tone: string; // 色调（暖色调、冷色调、高饱和、低饱和、电影感等）
  shadow_highlight?: string; // 阴影与高光
  
  // 场景细节
  background: string; // 背景环境
  props?: string; // 道具
  atmosphere?: string; // 氛围感
  
  // 人物相关
  characters?: string; // 人物描述（外貌、服装、表情等）
  character_actions?: string; // 人物动作
  character_emotion?: string; // 人物情绪
  
  // 内容相关
  dialogue?: string; // 对白/口播内容
  voiceover?: string; // 旁白
  text_overlay?: string; // 字幕/文字
  
  // 音频
  background_music?: string; // 背景音乐
  sound_effects?: string; // 音效
  audio?: string; // 其他音频说明
  
  // 转场
  transition?: string; // 转场效果
  
  // 生成相关
  prompt: string; // Seedance 提示词
  reference_image_url?: string; // AI 生成的参考图（供用户理解画面）
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

/** 完整脚本 */
export interface Script {
  title: string;
  theme: string;
  style: string;
  total_duration: number;
  target_platform: string;
  storyboards: StoryboardItem[];
  overall_notes: string;
}

/** 参考素材 */
export interface ReferenceMaterial {
  type: 'image' | 'video' | 'video_link';
  url: string;
  description?: string;
  parsed_info?: {
    platform?: string;
    title?: string;
    author?: string;
    video_url?: string;
  };
  // 视频分析结果
  video_analysis?: VideoAnalysisResult;
}

/** 用户输入 */
export interface UserInput {
  type: InputType;
  content: string; // 文字描述或链接
  references: ReferenceMaterial[];
}

/** 生成的视频 */
export interface GeneratedVideo {
  task_id: string;
  video_url: string;
  prompt_used: string;
  storyboard_id?: string;
  generated_at: string;
  duration: number;
}

/** 批量生成方向 */
export interface BatchDirection {
  id: string;
  name: string;
  description: string;
  prompt_variation: string;
  style_adjustments: string[];
  example: string;
}

/** 对比模式结果 */
export interface CompareModeResult {
  mode: ExecutionMode;
  masterScript?: Script;
  agentScript?: Script;
  masterContext?: string;
  agentContext?: string;
  profile?: {
    overall: number;
    level: string;
  };
}

/** 工作流状态 */
export interface WorkflowState {
  id: string;
  user_id: string;
  session_id?: string;
  current_stage: WorkflowStage;
  status: WorkflowStatus;
  input: UserInput;
  script?: Script;
  script_version: number;
  script_confirmed: boolean;
  current_video?: GeneratedVideo;
  video_iterations: GeneratedVideo[];
  batch_directions?: BatchDirection[];
  selected_directions: string[];
  batch_count: number;
  batch_results: GeneratedVideo[];
  learned_preferences: Record<string, unknown>;
  compare_result?: CompareModeResult;
}

// ========== 常量 ==========

/** 阶段提示词模板 */
const STAGE_PROMPTS: Record<WorkflowStage, string> = {
  input_collecting: `你是创意小海，一个专业的视频创作助手。现在处于【需求收集】阶段。

请帮助用户明确他们的视频创作需求：
- 视频主题和风格
- 目标平台（抖音、快手、视频号等）
- 参考素材（可提供图片或视频链接）
- 特殊要求

引导用户提供足够的信息来生成优质的分镜脚本。`,

  script_generating: `你是创意小海，正在为用户生成详细的分镜脚本。

请根据用户的需求，生成专业的分镜脚本，每个分镜包含：
- 场景描述
- 画面参考（详细的视觉描述）
- 运镜方式（推、拉、摇、移、跟等）
- 镜头角度（俯视、仰视、平视、斜角等）
- 光线设置（自然光、人工光、逆光等）
- 色调风格
- 背景环境
- 转场效果
- 音频建议`,

  script_confirming: `你是创意小海，用户正在审核分镜脚本。

请解释脚本的创意思路，并等待用户确认或提出修改意见。如果用户有修改意见，请相应调整脚本。`,

  video_generating: `你是创意小海，正在根据确认的脚本生成视频。

请告知用户视频正在生成中，并说明预计等待时间。`,

  reviewing: `你是创意小海，用户正在审核生成的视频。

请询问用户对视频的满意度，是否有修改意见。如果满意，将进入批量生成准备阶段。`,

  batch_preparing: `你是创意小海，正在为用户生成10个修改方向。

这些方向应该在保持核心创意的基础上，进行微调变化，如：
- 色调微调
- 运镜方式变化
- 光线调整
- 背景变化
- 角度变换
- 节奏调整
等。`,

  batch_generating: `你是创意小海，正在批量生成视频。

请确认用户选择的方向和数量，并告知批量生成的进度。`,

  completed: `你是创意小海，工作流已完成。

请总结本次创作成果，并询问用户是否需要其他帮助。`,
};

// ========== 服务类 ==========

class CreativeWorkflowService {
  private headers: Record<string, string>;

  constructor(headers: Record<string, string> = {}) {
    this.headers = headers;
  }

  /**
   * 创建新工作流
   */
  async createWorkflow(userId: string, sessionId?: string): Promise<WorkflowState> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('creative_workflows')
      .insert({
        user_id: userId,
        session_id: sessionId,
        current_stage: 'input_collecting',
        status: 'active',
        input_content: {},
        reference_materials: [],
        script_version: 1,
        script_confirmed: false,
        video_iterations: [],
        selected_directions: [],
        batch_count: 0,
        batch_results: [],
        learned_preferences: {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建工作流失败: ${(error as any).message || '创建失败'}`);
    }

    return this.mapToState(data as any);
  }

  /**
   * 获取工作流
   */
  async getWorkflow(workflowId: string, userId: string): Promise<WorkflowState | null> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('creative_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapToState(data as any);
  }

  /**
   * 获取用户的活动工作流
   */
  async getActiveWorkflow(userId: string): Promise<WorkflowState | null> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('creative_workflows')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.mapToState(data as any);
  }

  /**
   * 更新工作流阶段
   */
  async updateStage(workflowId: string, stage: WorkflowStage): Promise<void> {
    const client = getSupabaseClient();
    
    await client
      .from('creative_workflows')
      .update({
        current_stage: stage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);
  }

  /**
   * 更新工作流参考素材（用于后台分析完成后）
   */
  private async updateWorkflowReferences(workflowId: string, references: ReferenceMaterial[]): Promise<void> {
    const client = getSupabaseClient();
    
    await client
      .from('creative_workflows')
      .update({
        reference_materials: references,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);
    
    console.log('[工作流] 参考素材已更新到数据库');
  }

  /**
   * 保存会话状态到SESSION-STATE层（基于虾评Skill设计）
   * 确保对话不丢失
   */
  private async saveSessionStateToMemory(
    userId: string,
    workflowId: string,
    stage: WorkflowStage,
    lastMessage: string
  ): Promise<void> {
    try {
      const memoryService = new MemoryLayerService(this.headers);
      
      await memoryService.saveSessionState(userId, {
        currentTask: `工作流: ${workflowId}`,
        completed: [],
        blockers: [],
        nextSteps: [`当前阶段: ${stage}`],
        recoveryInfo: JSON.stringify({
          workflowId,
          stage,
          lastMessage: lastMessage.slice(0, 200), // 保存最后一条消息摘要
          timestamp: new Date().toISOString(),
        }),
      });
      
      console.log('[工作流] 会话状态已保存到SESSION-STATE层');
    } catch (error) {
      console.error('[工作流] 保存会话状态失败:', error);
    }
  }

  /**
   * 处理用户输入
   */
  async processUserInput(
    workflowId: string,
    userId: string,
    message: string,
    attachments?: Array<{ type: string; url: string }>
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    script?: Script;
    requiresAction: boolean;
    actionType?: string;
    compareResult?: CompareModeResult;
  }> {
    const workflow = await this.getWorkflow(workflowId, userId);
    if (!workflow) {
      throw new Error('工作流不存在');
    }

    // 保存用户消息
    await this.saveMessage(workflowId, 'user', message);

    // ===== 统一处理视频附件（任何阶段） =====
    if (attachments && attachments.length > 0) {
      const hasVideoAttachment = attachments.some(a => a.type === 'video');
      
      if (hasVideoAttachment) {
        // 有新的视频上传，重置到输入收集阶段
        console.log('[工作流] 检测到新视频上传，重置到输入收集阶段');
        
        // 更新工作流阶段
        const client = getSupabaseClient();
        await client
          .from('creative_workflows')
          .update({
            current_stage: 'input_collecting',
            updated_at: new Date().toISOString(),
          })
          .eq('id', workflowId);
        
        // 重新获取更新后的工作流
        const updatedWorkflow = await this.getWorkflow(workflowId, userId);
        if (updatedWorkflow) {
          // 调用输入收集阶段处理
          const result = await this.handleInputCollecting(updatedWorkflow, message, attachments);
          // 保存会话状态
          await this.saveSessionStateToMemory(userId, workflowId, result.stage, result.response);
          return result;
        }
      }
    }

    // 根据当前阶段处理
    let result;
    switch (workflow.current_stage) {
      case 'input_collecting':
        result = await this.handleInputCollecting(workflow, message, attachments);
        break;
      case 'script_confirming':
        result = await this.handleScriptConfirming(workflow, message);
        break;
      case 'reviewing':
        result = await this.handleReviewing(workflow, message);
        break;
      case 'batch_preparing':
        result = await this.handleBatchPreparing(workflow, message);
        break;
      default:
        result = await this.handleDefaultStage(workflow, message);
        break;
    }

    // 保存会话状态到SESSION-STATE层（确保对话不丢失）
    await this.saveSessionStateToMemory(userId, workflowId, result.stage, result.response);

    return result;
  }

  /**
   * 处理输入收集阶段
   */
  private async handleInputCollecting(
    workflow: WorkflowState,
    message: string,
    attachments?: Array<{ type: string; url: string }>
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    script?: Script;
    requiresAction: boolean;
    actionType?: string;
    compareResult?: CompareModeResult;
  }> {
    const client = getSupabaseClient();
    
    // ===== 先加载工作流中已有的参考素材 =====
    const existingReferences: ReferenceMaterial[] = workflow.input.references || [];
    console.log(`[工作流] 已有参考素材: ${existingReferences.length} 个`);
    
    // 解析新附件（如果有）
    const newReferences: ReferenceMaterial[] = [];
    const videoAnalysisPromises: Promise<void>[] = []; // 异步分析任务
    
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.type === 'image') {
          newReferences.push({ type: 'image', url: att.url });
        } else if (att.type === 'video') {
          // 用户上传的视频文件（已上传到TOS）
          // 先添加引用，视频分析异步执行
          console.log('[工作流] 用户上传视频:', att.url);
          
          const videoRef: ReferenceMaterial = { 
            type: 'video_link', 
            url: att.url,
            description: '用户上传的视频文件',
            video_analysis: undefined, // 稍后异步填充
          };
          newReferences.push(videoRef);
          
          // 异步分析视频（不阻塞用户反馈）
          const analysisPromise = (async () => {
            try {
              const videoLearningService = createVideoLearningService(this.headers);
              const analysis = await videoLearningService.analyzeVideo(att.url, '用户上传视频');
              videoRef.video_analysis = analysis;
              console.log('[工作流] 视频分析完成:', analysis.videoType);
            } catch (error) {
              console.error('[工作流] 视频分析失败:', error);
            }
          })();
          videoAnalysisPromises.push(analysisPromise);
          
        } else if (att.type === 'video_link' || att.type === 'link') {
          // 视频链接（抖音、快手等）
          const parsed = await this.parseVideoLink(att.url);
          if (parsed?.parsed_info?.video_url) {
            newReferences.push(parsed);
            
            // 异步分析视频链接
            const videoUrl = parsed.parsed_info.video_url;
            const videoTitle = parsed.parsed_info.title || '视频链接';
            console.log('[工作流] 视频链接:', videoUrl);
            const analysisPromise = (async () => {
              try {
                const videoLearningService = createVideoLearningService(this.headers);
                parsed.video_analysis = await videoLearningService.analyzeVideo(videoUrl, videoTitle);
                console.log('[工作流] 视频链接分析完成:', parsed.video_analysis.videoType);
              } catch (error) {
                console.error('[工作流] 视频链接分析失败:', error);
              }
            })();
            videoAnalysisPromises.push(analysisPromise);
          }
        }
      }
    }

    // 检测消息中的视频链接
    const videoLinks = this.extractVideoLinks(message);
    for (const link of videoLinks) {
      const parsed = await this.parseVideoLink(link);
      if (parsed?.parsed_info?.video_url) {
        newReferences.push(parsed);
        
        // 异步分析视频链接
        const videoUrl = parsed.parsed_info.video_url;
        const videoTitle = parsed.parsed_info.title || '视频链接';
        console.log('[工作流] 消息中的视频链接:', videoUrl);
        const analysisPromise = (async () => {
          try {
            const videoLearningService = createVideoLearningService(this.headers);
            parsed.video_analysis = await videoLearningService.analyzeVideo(videoUrl, videoTitle);
            console.log('[工作流] 视频链接分析完成:', parsed.video_analysis.videoType);
          } catch (error) {
            console.error('[工作流] 视频链接分析失败:', error);
          }
        })();
        videoAnalysisPromises.push(analysisPromise);
      }
    }

    // 确定输入类型
    let inputType: InputType = 'text';
    if (newReferences.length > 0 || existingReferences.length > 0) {
      const totalReferences = existingReferences.length + newReferences.length;
      if (totalReferences === 1) {
        const ref = existingReferences[0] || newReferences[0];
        inputType = ref.type === 'image' ? 'image' : 'video_link';
      } else {
        inputType = 'multi_reference';
      }
    }

    // 合并所有参考素材（已有的 + 新上传的）
    const allReferences = [...existingReferences, ...newReferences];
    console.log(`[工作流] 合并后参考素材: ${allReferences.length} 个`);
    
    // 保存到数据库
    await client
      .from('creative_workflows')
      .update({
        input_type: inputType,
        input_content: { content: message },
        reference_materials: allReferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflow.id);

    // 判断是否有视频参考（支持 video 和 video_link 两种类型）
    const hasVideoReferences = allReferences.some(r => r.type === 'video_link' || r.type === 'video');
    
    // 检查用户是否已经表达了明确意图（在视频接收反馈之前判断）
    const lowerMessage = message.toLowerCase();
    const hasIntent = 
      lowerMessage.includes('抖音') || 
      lowerMessage.includes('短视频') || 
      lowerMessage.includes('引流') ||
      lowerMessage.includes('直播') ||
      lowerMessage.includes('参考') ||
      lowerMessage.includes('生成') ||
      lowerMessage.includes('创作') ||
      lowerMessage.includes('制作');
    
    // 如果有新的视频参考且用户没有明确意图，启动后台分析并给用户即时反馈
    if (hasVideoReferences && videoAnalysisPromises.length > 0 && !hasIntent) {
      // 给用户即时反馈
      let response = '🎬 **视频已成功接收！**\n\n';
      response += '我正在后台分析视频内容（风格、镜头、色彩等），这可能需要几秒钟...\n\n';
      response += '**在等待分析的同时，您可以：**\n';
      response += '1. 告诉我您想创作什么类型的视频？\n';
      response += '2. 想达到什么效果？（如：模仿、创新、特定风格）\n';
      response += '3. 目标平台是什么？（抖音、小红书、B站等）\n\n';
      response += '视频分析完成后，我会根据您的需求结合分析结果为您创作！';
      
      // 保存助手回复
      await this.saveMessage(workflow.id, 'assistant', response);
      
      // 后台启动视频分析（不阻塞响应）
      Promise.all(videoAnalysisPromises).then(() => {
        console.log('[工作流] 所有视频分析任务完成');
        // 分析完成后更新数据库中的参考素材
        this.updateWorkflowReferences(workflow.id, allReferences);
      }).catch(err => {
        console.error('[工作流] 视频分析任务出错:', err);
      });
      
      return {
        response,
        stage: 'input_collecting',
        requiresAction: false,
      };
    }
    
    // 如果有视频且用户有明确意图，启动后台分析但不阻塞，直接进入脚本生成
    if (hasVideoReferences && videoAnalysisPromises.length > 0 && hasIntent) {
      console.log('[工作流] 用户有明确意图，后台分析视频，直接生成脚本');
      
      // 后台启动视频分析（不阻塞脚本生成）
      Promise.all(videoAnalysisPromises).then(() => {
        console.log('[工作流] 所有视频分析任务完成');
        // 分析完成后更新数据库中的参考素材
        this.updateWorkflowReferences(workflow.id, allReferences);
      }).catch(err => {
        console.error('[工作流] 视频分析任务出错:', err);
      });
    }

    // ===== 商品识别 =====
    // 尝试识别用户输入中的商品
    let productReferences: ProductReference[] = [];
    try {
      productReferences = await productVideoWorkflowService.identifyProducts(
        workflow.user_id,
        message
      );
    } catch (error) {
      console.error('商品识别失败:', error);
    }

    // 检查是否识别到商品
    const foundProducts = productReferences.filter(r => r.found);
    const learnedPreferences = workflow.learned_preferences as Record<string, unknown> || {};
    const hasAskedForProduct = learnedPreferences.asked_for_product === true;
    const confirmedProduct = learnedPreferences.confirmed_product as string;

    // 如果没有识别到商品且还没有询问过，主动询问（仅在无视频参考时）
    if (!hasVideoReferences && foundProducts.length === 0 && !hasAskedForProduct && message.length > 10) {
      // 更新状态，标记已询问过商品
      await client
        .from('creative_workflows')
        .update({
          learned_preferences: { ...learnedPreferences, asked_for_product: true },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      // 获取用户的商品列表用于推荐
      const products = await productLibraryService.getProducts(workflow.user_id, { limit: 5 });
      const productNames = products.map(p => p.product_name);

      let response = '🏷️ **商品确认**\n\n';
      response += '我注意到您还没有提到具体的商品。为了帮您生成更精准的商品视频，请告诉我：\n\n';
      response += '**您想为哪款商品制作视频？**\n\n';

      if (productNames.length > 0) {
        response += '您商品库中已有的商品：\n';
        productNames.forEach(name => {
          response += `- ${name}\n`;
        });
        response += '\n您可以直接说出商品名称，或者告诉我一个新的商品。';
      } else {
        response += '您的商品图库目前是空的。您可以：\n';
        response += '1. 先去「商品图库」添加商品图片\n';
        response += '2. 或者直接告诉我商品名称，我会根据您的描述来创作\n\n';
        response += '请问您想为哪款商品制作视频？';
      }

      await this.saveMessage(workflow.id, 'assistant', response);

      return {
        response,
        stage: 'input_collecting',
        requiresAction: false,
      };
    }

    // 如果已询问过商品但用户还没有确认商品，继续引导（仅在无视频参考时）
    if (!hasVideoReferences && hasAskedForProduct && !confirmedProduct && foundProducts.length === 0 && message.length > 5) {
      // 检查用户回复是否是在说明商品
      const products = await productLibraryService.getProducts(workflow.user_id, { limit: 10 });
      const productNames = products.map(p => p.product_name.toLowerCase());
      const lowerMessage = message.toLowerCase();
      
      // 检查用户消息中是否提到了商品名
      const mentionedProduct = productNames.find(name => lowerMessage.includes(name));
      
      if (mentionedProduct) {
        // 用户提到了商品，确认并继续
        await client
          .from('creative_workflows')
          .update({
            learned_preferences: { ...learnedPreferences, confirmed_product: mentionedProduct },
            updated_at: new Date().toISOString(),
          })
          .eq('id', workflow.id);
      } else {
        // 用户没有明确商品，再次询问
        let response = '好的，我理解您的需求。但为了生成更精准的商品视频，请您确认：\n\n';
        response += '**您想为哪款商品制作视频？**\n\n';
        if (productNames.length > 0) {
          response += '商品库中的商品：' + products.map(p => p.product_name).join('、') + '\n';
        }
        response += '\n请直接告诉我商品名称即可。';
        
        await this.saveMessage(workflow.id, 'assistant', response);
        return {
          response,
          stage: 'input_collecting',
          requiresAction: false,
        };
      }
    }

    // 判断是否可以进入脚本生成阶段
    const hasEnoughInfo = message.length > 20 || allReferences.length > 0 || foundProducts.length > 0;
    
    // 如果有视频参考但没有足够的文字描述，智能判断是否需要询问
    if (hasVideoReferences && message.length < 10) {
      // 检查视频分析结果（支持 video 和 video_link 两种类型）
      const videoRefs = allReferences.filter(r => r.type === 'video_link' || r.type === 'video');
      const hasAnalysis = videoRefs.some(r => r.video_analysis);
      
      // 检查用户是否已经表达了明确意图
      const lowerMessage = message.toLowerCase();
      const hasIntent = 
        lowerMessage.includes('抖音') || 
        lowerMessage.includes('短视频') || 
        lowerMessage.includes('引流') ||
        lowerMessage.includes('直播') ||
        lowerMessage.includes('参考') ||
        lowerMessage.includes('生成') ||
        lowerMessage.includes('创作') ||
        lowerMessage.includes('制作');
      
      if (hasIntent) {
        // 用户已有明确意图，直接生成脚本（无论是否有分析结果）
        console.log('[工作流] 检测到用户明确意图，跳过询问直接生成脚本');
      } else if (hasAnalysis && !hasIntent) {
        // 有视频分析结果但用户意图不明确，询问用户具体需求
        let response = '✅ **我已经分析了您上传的视频！**\n\n';
        response += '我看到了视频的风格、镜头和创作技巧。\n\n';
        response += '**请告诉我：**\n';
        response += '1. 您想生成什么类型的视频？（如：产品展示、故事剧情、Vlog等）\n';
        response += '2. 目标平台是什么？（如：抖音、小红书、B站等）\n';
        response += '3. 有什么特别想模仿或调整的地方吗？\n\n';
        response += '我会根据视频分析结果为您创作脚本！';
        
        await this.saveMessage(workflow.id, 'assistant', response);
        return {
          response,
          stage: 'input_collecting',
          requiresAction: false,
        };
      }
    }
    
    if (hasEnoughInfo) {
      // 更新阶段并生成脚本
      await this.updateStage(workflow.id, 'script_generating');
      
      // 使用双层能力系统生成脚本
      const scriptResult = await this.generateScriptWithDualLayer({
        ...workflow,
        input: { type: inputType, content: message, references: allReferences },
      });
      
      const { script, scripts, compareResult } = scriptResult;

      // 保存脚本和对比结果
      const updateData: Record<string, unknown> = {
        script: script as unknown as Record<string, unknown>,
        current_stage: 'script_confirming',
        updated_at: new Date().toISOString(),
      };
      
      if (compareResult) {
        updateData.compare_result = compareResult as unknown as Record<string, unknown>;
      }
      
      if (scripts && scripts.length > 1) {
        updateData.script_alternatives = scripts as unknown as Record<string, unknown>[];
      }
      
      await client
        .from('creative_workflows')
        .update(updateData)
        .eq('id', workflow.id);

      // 构建响应 - 展示多个方案
      let response = '';
      const allScripts = scripts || [script];
      
      if (allScripts.length > 1) {
        // 多个方案
        response = `✅ **已为您生成 ${allScripts.length} 个不同风格的脚本方案！**\n\n`;
        response += `请查看下方的方案，选择您最喜欢的一个：\n\n`;
        response += `---\n\n`;
        
        for (let i = 0; i < allScripts.length; i++) {
          response += this.formatScriptResponse(allScripts[i], i);
          response += `\n\n---\n\n`;
        }
        
        response += `💡 **请告诉我您选择哪个方案（如"选择方案一"），或者需要修改的地方。**`;
      } else if (compareResult?.mode === 'compare') {
        // 对比模式：展示两个版本供用户选择
        response = `✅ **脚本生成完成！**\n\n`;
        response += `📊 当前能力评分：**${compareResult.profile?.overall?.toFixed(0)}分**（${compareResult.profile?.level}）\n\n`;
        response += `智能体正在学习阶段，我为您准备了两个版本的脚本。\n\n`;
        response += `请仔细查看下面的表格，选择您认为更好的版本：\n\n`;
        response += `---\n\n`;
        response += `### 📜 版本一（大师版本）\n`;
        response += `> 由大模型直接生成，代表标准专业水准\n\n`;
        response += this.formatScriptResponse(compareResult.masterScript!);
        response += `\n---\n\n`;
        response += `### 🎓 版本二（智能体版本）\n`;
        response += `> 由智能体结合学习库知识生成，代表学习成果\n\n`;
        response += this.formatScriptResponse(compareResult.agentScript!);
        response += `\n\n💡 **请告诉我您更喜欢哪个版本，帮助智能体学习成长。**`;
      } else if (compareResult?.mode === 'learning') {
        // 学习模式：只展示大师版本
        response = `✅ **脚本已生成！**\n\n`;
        response += `📊 当前能力评分：**${compareResult.profile?.overall?.toFixed(0)}分**（${compareResult.profile?.level}）\n\n`;
        response += `智能体正在学习阶段，这是大模型的输出供您参考。\n\n`;
        response += `查看下面的分镜表格，如需修改请告诉我：\n\n`;
        response += this.formatScriptResponse(script);
        response += `\n\n💬 **请查看上方的分镜表格。如需调整请告诉我，确认后可开始生成视频。**`;
      } else if (compareResult?.mode === 'independent') {
        // 独立模式：只展示智能体版本
        response = `✅ **脚本创作完成！**\n\n`;
        response += `📊 能力评分：**${compareResult.profile?.overall?.toFixed(0)}分**（${compareResult.profile?.level}）\n\n`;
        response += `智能体已具备独立创作能力，为您生成了以下分镜脚本：\n\n`;
        response += this.formatScriptResponse(script);
        response += `\n\n💬 **如果需要调整，请告诉我具体需求。确认无误后，点击「开始生成视频」即可。**`;
      } else {
        response = `✅ **分镜脚本已生成！**\n\n`;
        response += this.formatScriptResponse(script);
        response += `\n\n💬 **请查看上方的分镜表格。如需修改请告诉我，确认后可开始生成视频。**`;
      }
      
      // 保存助手回复
      await this.saveMessage(workflow.id, 'assistant', response, 'script');

      return {
        response,
        stage: 'script_confirming',
        script,
        requiresAction: false,
        compareResult,
      };
    }

    // 信息不足，继续收集 - 添加友好的引导
    let continueMsg = `好的，我已记录您的需求。`;
    
    // 反馈识别到的素材
    if (allReferences.length > 0) {
      continueMsg += `\n\n📋 **我已收到您的素材**：`;
      for (const ref of allReferences) {
        if (ref.type === 'video' || ref.type === 'video_link') {
          continueMsg += `\n- 🎬 视频：${ref.description || '参考视频'}`;
        } else if (ref.type === 'image') {
          continueMsg += `\n- 🖼️ 图片参考`;
        }
      }
    }
    
    continueMsg += `\n\n💡 **为了帮您创作更好的视频，请告诉我更多细节：**`;
    continueMsg += `\n- 视频的主题或想表达的内容是什么？`;
    continueMsg += `\n- 有没有特定的风格偏好？（如：电影感、Vlog、产品展示等）`;
    continueMsg += `\n- 目标时长大概多少秒？`;
    
    await this.saveMessage(workflow.id, 'assistant', continueMsg);

    return {
      response: continueMsg,
      stage: 'input_collecting',
      requiresAction: false,
    };
  }

  /**
   * 生成详细分镜脚本（同时生成参考图）
   * 集成商品识别功能，自动识别用户输入中的商品并生成参考提示词
   */
  async generateScript(workflow: WorkflowState): Promise<Script> {
    const llmClient = new LLMClient(new Config(), this.headers);
    
    // 获取用户偏好上下文
    const userPreferences = await agentMemoryService.getContextForLLM('material', workflow.user_id);
    
    // ===== 商品识别 =====
    let productReferences: ProductReference[] = [];
    let productContext = '';
    
    try {
      // 从用户输入中识别商品
      productReferences = await productVideoWorkflowService.identifyProducts(
        workflow.user_id,
        workflow.input.content
      );
      
      if (productReferences.length > 0) {
        const foundProducts = productReferences.filter(r => r.found);
        const notFoundProducts = productReferences.filter(r => !r.found);
        
        if (foundProducts.length > 0) {
          productContext = '\n\n**已识别的商品**：\n';
          for (const ref of foundProducts) {
            productContext += `- ${ref.productName}`;
            if (ref.product?.product_description) {
              productContext += `：${ref.product.product_description}`;
            }
            if (ref.integratedImage) {
              productContext += `（已整合${ref.integratedImage.viewLabels.length}个视角图片）`;
            }
            productContext += '\n';
          }
        }
        
        if (notFoundProducts.length > 0) {
          productContext += '\n**未找到的商品**：' + notFoundProducts.map(r => r.productName).join('、') + '\n';
          productContext += '提示：您可以在商品图库中上传这些商品的图片，以便生成更精准的视频。\n';
        }
      }
    } catch (error) {
      console.error('商品识别失败:', error);
    }
    
    // 构建系统提示
    const systemPrompt = `你是一位专业的短视频导演和分镜师，精通抖音、快手、视频号等平台的短视频创作。
${userPreferences ? `用户偏好参考：\n${userPreferences}\n` : ''}
${productContext ? productContext + '\n' : ''}
请根据用户需求，生成 **2-3个不同风格** 的分镜脚本方案供用户选择。

**重要规则**：
1. 每个方案必须有不同的创意方向和风格
2. 每个分镜时长控制在3秒左右（可以是2-4秒）
3. 场景描述(scene_description)必须详细描述画面从开始到结束的变化过程
4. prompt字段是用于AI视频生成的英文提示词

**方案风格建议**：
- 方案一：可以是干货/知识分享类，快节奏剪辑
- 方案二：可以是情感/故事类，慢节奏氛围感
- 方案三：可以是产品展示类，突出商品特点

每个分镜必须包含以下字段：

**表格展示字段**
- scene_description: 画面内容描述（详细描述画面变化）
- dialogue: 对白/口播内容
- voiceover: 旁白内容
- text_overlay: 字幕文字
- camera_movement: 运镜方式
- camera_angle: 镜头角度
- lighting: 光线设置
- atmosphere: 氛围感
- background_music: 背景音乐
- transition: 转场效果
- prompt: 英文AI生成提示词

请以JSON格式返回多个方案。示例：
{
  "plans": [
    {
      "title": "方案一：干货/知识分享类",
      "theme": "主题描述",
      "style": "快节奏、干货输出",
      "total_duration": 15,
      "target_platform": "抖音",
      "storyboards": [
        {
          "id": "sb_1",
          "sequence": 1,
          "duration": 3,
          "scene_description": "博主怼脸特写，神情夸张或严肃，字幕打出醒目大字",
          "dialogue": "你是不是每天忙得要死，结果一事无成？",
          "voiceover": "",
          "text_overlay": "别再浪费时间了！",
          "camera_movement": "固定镜头",
          "camera_angle": "平视",
          "lighting": "正面柔光",
          "atmosphere": "紧迫感、痛点切入",
          "background_music": "快节奏电子乐",
          "transition": "硬切",
          "prompt": "Close-up of Asian blogger with serious expression, bold text overlay, front soft lighting, urgent atmosphere"
        }
      ],
      "overall_notes": "痛点切入，语速要快，抓住注意力"
    },
    {
      "title": "方案二：情感/故事类",
      "theme": "主题描述",
      "style": "慢节奏、氛围感",
      "total_duration": 15,
      "target_platform": "抖音",
      "storyboards": [...]
    }
  ]
}

**注意**：必须返回2-3个不同风格的方案，每个方案包含完整的分镜信息。`;


    // 构建用户消息
    let userMessage = `请根据以下需求生成分镜脚本：\n\n${workflow.input.content}`;
    
    // 添加商品参考信息
    if (productReferences.length > 0) {
      const foundProducts = productReferences.filter(r => r.found);
      if (foundProducts.length > 0) {
        userMessage += '\n\n**商品库中的商品**：';
        for (const ref of foundProducts) {
          userMessage += `\n- ${ref.productName}`;
          if (ref.product?.product_description) {
            userMessage += `：${ref.product.product_description}`;
          }
          if (ref.imageUrls && ref.imageUrls.length > 0) {
            userMessage += `（有${ref.imageUrls.length}张多视角商品图片可用）`;
          }
        }
      }
    }
    
    if (workflow.input.references && workflow.input.references.length > 0) {
      userMessage += '\n\n参考素材：';
      for (const ref of workflow.input.references) {
        if (ref.type === 'video_link' && ref.parsed_info) {
          userMessage += `\n- 视频链接（${ref.parsed_info.platform || '未知平台'}）：${ref.parsed_info.title || '未知标题'}`;
          if (ref.description) {
            userMessage += `，${ref.description}`;
          }
        } else if (ref.type === 'image') {
          userMessage += `\n- 参考图片：${ref.description || '用户提供的参考图'}`;
        }
      }
    }

    // 调用LLM生成脚本
    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    // 解析返回的JSON
    let script: Script;
    try {
      const content = response.content || '';
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]) as Script;
      } else {
        // 如果解析失败，返回一个默认脚本
        script = this.createDefaultScript(workflow);
      }
    } catch (error) {
      console.error('解析脚本JSON失败:', error);
      script = this.createDefaultScript(workflow);
    }

    // 为每个分镜生成参考图
    console.log(`[创意小海] 开始为 ${script.storyboards.length} 个分镜生成参考图...`);
    for (let i = 0; i < script.storyboards.length; i++) {
      const storyboard = script.storyboards[i];
      try {
        const imageUrl = await this.generateReferenceImage(storyboard);
        if (imageUrl) {
          script.storyboards[i].reference_image_url = imageUrl;
          console.log(`[创意小海] 分镜 ${i + 1} 参考图生成成功`);
        }
      } catch (error) {
        console.error(`[创意小海] 分镜 ${i + 1} 参考图生成失败:`, error);
        // 参考图生成失败不影响主流程
      }
    }

    return script;
  }

  /**
   * 工作前阅读体系
   * 在生成脚本前，自动读取所有相关信息作为上下文
   */
  async prepareWorkingContext(userId: string): Promise<{
    learningLibrary: string[];
    longTermMemory: string[];
    productLibrary: string[];
    allContext: string;
  }> {
    console.log('[工作前阅读] 开始准备上下文...');
    
    const client = getSupabaseClient();
    
    // 1. 读取学习库
    const learningLibrary: string[] = [];
    try {
      const { data: videos } = await client
        .from('learning_library')
        .select('title, video_type, style_analysis, camera_work, color_style')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (videos && videos.length > 0) {
        for (const video of videos) {
          const summary = `【${video.title}】类型:${video.video_type || '未知'} 风格:${video.style_analysis || '未知'} 镜头:${video.camera_work || '未知'}`;
          learningLibrary.push(summary);
        }
        console.log(`[工作前阅读] 学习库: ${learningLibrary.length} 条`);
      }
    } catch (error) {
      console.error('[工作前阅读] 读取学习库失败:', error);
    }
    
    // 2. 读取长期记忆
    const longTermMemory: string[] = [];
    try {
      const { data: memories } = await client
        .from('agent_memories')
        .select('title, summary, content')
        .eq('user_id', userId)
        .eq('layer', 'long_term')
        .order('importance_score', { ascending: false })
        .limit(10);
      
      if (memories && memories.length > 0) {
        for (const memory of memories as any[]) {
          longTermMemory.push(`${(memory as any).title}: ${(memory as any).summary || ((memory as any).content?.slice(0, 100) as string) || ''}`);
        }
        console.log(`[工作前阅读] 长期记忆: ${longTermMemory.length} 条`);
      }
    } catch (error) {
      console.error('[工作前阅读] 读取长期记忆失败:', error);
    }
    
    // 3. 读取商品图库
    const productLibrary: string[] = [];
    try {
      const { data: products } = await client
        .from('product_library')
        .select('product_name, product_description')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false })
        .limit(5);
      
      if (products && products.length > 0) {
        for (const product of products) {
          productLibrary.push(`${product.product_name}: ${product.product_description || '无描述'}`);
        }
        console.log(`[工作前阅读] 商品图库: ${productLibrary.length} 条`);
      }
    } catch (error) {
      console.error('[工作前阅读] 读取商品图库失败:', error);
    }
    
    // 4. 整合所有上下文
    const allContext = [
      learningLibrary.length > 0 ? `【学习库参考】\n${learningLibrary.join('\n')}` : '',
      longTermMemory.length > 0 ? `【用户偏好】\n${longTermMemory.join('\n')}` : '',
      productLibrary.length > 0 ? `【商品库】\n${productLibrary.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');
    
    console.log(`[工作前阅读] 完成，总上下文长度: ${allContext.length} 字符`);
    
    return {
      learningLibrary,
      longTermMemory,
      productLibrary,
      allContext,
    };
  }

  /**
   * 使用双层能力系统生成脚本
   * 根据用户能力等级选择不同执行模式
   * 现在支持生成多个不同风格的方案
   */
  async generateScriptWithDualLayer(workflow: WorkflowState): Promise<{
    script: Script;
    scripts?: Script[];  // 多个方案
    compareResult?: CompareModeResult;
  }> {
    const dualLayerService = new DualLayerService(this.headers);
    
    // 【核心】工作前阅读：读取所有相关信息
    const workingContext = await this.prepareWorkingContext(workflow.user_id);
    
    // 获取用户能力档案
    const profile = await dualLayerService.getAbilityProfile(workflow.user_id);
    const mode = dualLayerService.getExecutionMode(profile);
    
    console.log(`[双层能力] 用户评分: ${profile.overall}, 执行模式: ${mode}`);
    
    // 构建任务输入（包含工作前阅读的上下文）
    const taskInput = this.buildTaskInput(workflow);
    const enhancedInput = workingContext.allContext 
      ? `${taskInput}\n\n【参考信息】\n${workingContext.allContext}`
      : taskInput;
    
    // 根据模式执行
    const result = await dualLayerService.executeTask(
      workflow.user_id,
      { type: 'script_generation', name: '脚本创作', description: '生成视频分镜脚本' },
      enhancedInput,
      {
        style: workflow.input.references?.[0]?.description,
        productInfo: await this.getProductInfo(workflow),
      }
    );
    
    // 解析脚本（支持多方案）
    const parseScriptsFromOutput = (output: string): Script[] => {
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // 检查是否是多方案格式
          if (parsed.plans && Array.isArray(parsed.plans)) {
            return parsed.plans.map((plan: Record<string, unknown>, index: number) => ({
              title: plan.title || `方案${index + 1}`,
              theme: plan.theme || '',
              style: plan.style || '',
              total_duration: plan.total_duration || 15,
              target_platform: plan.target_platform || '抖音',
              storyboards: (plan.storyboards as Array<Record<string, unknown>>) || [],
              overall_notes: plan.overall_notes || '',
            }));
          }
          // 单方案格式
          return [parsed as Script];
        }
      } catch (error) {
        console.error('解析脚本JSON失败:', error);
      }
      return [this.createDefaultScript(workflow)];
    };
    
    if (result.mode === 'compare' && typeof result.result !== 'string') {
      // 对比模式：返回两个版本
      const compareData = result.result as CompareResult;
      const masterScripts = parseScriptsFromOutput(compareData.masterOutput);
      const agentScripts = parseScriptsFromOutput(compareData.agentOutput);
      
      // 为脚本生成参考图
      for (const script of [...masterScripts, ...agentScripts]) {
        await this.generateReferenceImagesForScript(script);
      }
      
      return {
        script: agentScripts[0], // 默认返回智能体版本的第一个方案
        scripts: agentScripts,   // 所有智能体方案
        compareResult: {
          mode: 'compare',
          masterScript: masterScripts[0],
          agentScript: agentScripts[0],
          masterContext: compareData.masterContext,
          agentContext: compareData.agentContext,
          profile: {
            overall: profile.overall,
            level: profile.level,
          },
        },
      };
    } else if (result.mode === 'learning') {
      // 学习模式：只返回大模型输出
      const scripts = parseScriptsFromOutput(result.result as string);
      for (const script of scripts) {
        await this.generateReferenceImagesForScript(script);
      }
      
      return {
        script: scripts[0],
        scripts,
        compareResult: {
          mode: 'learning',
          masterScript: scripts[0],
          profile: {
            overall: profile.overall,
            level: profile.level,
          },
        },
      };
    } else {
      // 独立模式：返回智能体输出
      const scripts = parseScriptsFromOutput(result.result as string);
      for (const script of scripts) {
        await this.generateReferenceImagesForScript(script);
      }
      
      return {
        script: scripts[0],
        scripts,
        compareResult: {
          mode: 'independent',
          agentScript: scripts[0],
          profile: {
            overall: profile.overall,
            level: profile.level,
          },
        },
      };
    }
  }

  /**
   * 为脚本生成参考图
   */
  private async generateReferenceImagesForScript(script: Script): Promise<void> {
    console.log(`[创意小海] 开始为 ${script.storyboards.length} 个分镜生成参考图...`);
    for (let i = 0; i < script.storyboards.length; i++) {
      const storyboard = script.storyboards[i];
      try {
        const imageUrl = await this.generateReferenceImage(storyboard);
        if (imageUrl) {
          script.storyboards[i].reference_image_url = imageUrl;
          console.log(`[创意小海] 分镜 ${i + 1} 参考图生成成功`);
        }
      } catch (error) {
        console.error(`[创意小海] 分镜 ${i + 1} 参考图生成失败:`, error);
      }
    }
  }

  /**
   * 构建任务输入
   */
  private buildTaskInput(workflow: WorkflowState): string {
    let input = `请根据以下需求生成分镜脚本：\n\n${workflow.input.content}`;
    
    if (workflow.input.references && workflow.input.references.length > 0) {
      input += '\n\n参考素材：';
      for (const ref of workflow.input.references) {
        if (ref.type === 'video_link' && ref.parsed_info) {
          input += `\n- 视频链接（${ref.parsed_info.platform || '未知平台'}）：${ref.parsed_info.title || '未知标题'}`;
        } else if (ref.type === 'image') {
          input += `\n- 参考图片：${ref.description || '用户提供的参考图'}`;
        }
        
        // 添加视频分析结果
        if (ref.video_analysis) {
          const analysis = ref.video_analysis;
          input += `\n\n### 视频分析结果`;
          input += `\n**视频类型**：${analysis.videoType || '未识别'}`;
          input += `\n**整体风格**：${analysis.videoStyle || '未识别'}`;
          input += `\n**视频主题**：${analysis.videoTheme || '未识别'}`;
          input += `\n**内容摘要**：${analysis.summary || '无'}`;
          
          if (analysis.sceneAnalysis) {
            input += `\n\n**场景分析**：`;
            if (analysis.sceneAnalysis.scenes?.length) {
              input += `\n- 主要场景：${analysis.sceneAnalysis.scenes.join('、')}`;
            }
            if (analysis.sceneAnalysis.transitions?.length) {
              input += `\n- 转场方式：${analysis.sceneAnalysis.transitions.join('、')}`;
            }
            if (analysis.sceneAnalysis.pacing) {
              input += `\n- 节奏特点：${analysis.sceneAnalysis.pacing}`;
            }
          }
          
          if (analysis.cameraAnalysis) {
            input += `\n\n**镜头语言**：`;
            if (analysis.cameraAnalysis.movements?.length) {
              input += `\n- 镜头运动：${analysis.cameraAnalysis.movements.join('、')}`;
            }
            if (analysis.cameraAnalysis.angles?.length) {
              input += `\n- 拍摄角度：${analysis.cameraAnalysis.angles.join('、')}`;
            }
            if (analysis.cameraAnalysis.techniques?.length) {
              input += `\n- 拍摄技巧：${analysis.cameraAnalysis.techniques.join('、')}`;
            }
          }
          
          if (analysis.colorAnalysis) {
            input += `\n\n**视觉风格**：`;
            if (analysis.colorAnalysis.dominantColors?.length) {
              input += `\n- 主色调：${analysis.colorAnalysis.dominantColors.join('、')}`;
            }
            if (analysis.colorAnalysis.colorMood) {
              input += `\n- 色彩情绪：${analysis.colorAnalysis.colorMood}`;
            }
            if (analysis.colorAnalysis.lightingStyle) {
              input += `\n- 光影风格：${analysis.colorAnalysis.lightingStyle}`;
            }
          }
          
          if (analysis.keyLearnings?.length) {
            input += `\n\n**可借鉴的要点**：`;
            analysis.keyLearnings.forEach((learning, i) => {
              input += `\n${i + 1}. ${learning}`;
            });
          }
          
          if (analysis.creationSuggestions?.length) {
            input += `\n\n**创作建议**：`;
            analysis.creationSuggestions.forEach((suggestion, i) => {
              input += `\n${i + 1}. ${suggestion}`;
            });
          }
        }
      }
    }
    
    return input;
  }

  /**
   * 获取商品信息
   */
  private async getProductInfo(workflow: WorkflowState): Promise<string | undefined> {
    try {
      const productReferences = await productVideoWorkflowService.identifyProducts(
        workflow.user_id,
        workflow.input.content
      );
      
      const foundProducts = productReferences.filter(r => r.found);
      if (foundProducts.length > 0) {
        return foundProducts.map(r => {
          let info = r.productName;
          if (r.product?.product_description) {
            info += `：${r.product.product_description}`;
          }
          return info;
        }).join('\n');
      }
    } catch (error) {
      console.error('获取商品信息失败:', error);
    }
    return undefined;
  }

  /**
   * 生成参考图片
   */
  async generateReferenceImage(storyboard: StoryboardItem): Promise<string | null> {
    try {
      const prompt = `Professional cinematography shot: ${storyboard.visual_reference}
Camera: ${storyboard.camera_movement} movement, ${storyboard.camera_angle} angle
Lighting: ${storyboard.lighting}
Color grading: ${storyboard.color_tone}
Background: ${storyboard.background}
High quality, cinematic, detailed`;

      const images = await imageGenerationService.generateImage(prompt, {
        size: '2K',
      });

      return images.success ? (images.imageUrl || null) : null;
    } catch (error) {
      console.error('生成参考图失败:', error);
      return null;
    }
  }

  /**
   * 处理脚本确认阶段
   */
  private async handleScriptConfirming(
    workflow: WorkflowState,
    message: string
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    requiresAction: boolean;
    actionType?: string;
  }> {
    const client = getSupabaseClient();
    const lowerMessage = message.toLowerCase();

    // 检测确认关键词
    const confirmKeywords = ['确认', '可以', '没问题', '好', 'ok', '确认生成', '开始生成', '通过'];
    const modifyKeywords = ['修改', '调整', '改一下', '换个', '不太对'];

    const isConfirmed = confirmKeywords.some(kw => lowerMessage.includes(kw));
    const needsModification = modifyKeywords.some(kw => lowerMessage.includes(kw));

    if (isConfirmed) {
      // 用户确认，进入视频生成阶段
      await client
        .from('creative_workflows')
        .update({
          script_confirmed: true,
          script_confirmed_at: new Date().toISOString(),
          current_stage: 'video_generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      const response = '好的，脚本已确认！我现在开始为您生成视频。根据您确认的分镜脚本，我将生成高质量的视频内容。\n\n请稍候，视频生成中...';

      await this.saveMessage(workflow.id, 'assistant', response, 'confirmation');

      return {
        response,
        stage: 'video_generating',
        requiresAction: true,
        actionType: 'generate_video',
      };
    }

    if (needsModification) {
      // 用户需要修改，重新生成脚本
      const newScript = await this.modifyScript(workflow, message);
      
      await client
        .from('creative_workflows')
        .update({
          script: newScript as unknown as Record<string, unknown>,
          script_version: workflow.script_version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      const response = `好的，我已根据您的意见调整了脚本（版本 ${workflow.script_version + 1}）：\n\n${this.formatScriptResponse(newScript)}\n\n请确认是否满意，或者继续提出修改意见。`;

      await this.saveMessage(workflow.id, 'assistant', response, 'script');

      return {
        response,
        stage: 'script_confirming',
        requiresAction: false,
      };
    }

    // 默认回复
    const response = '请告诉我您对脚本的看法。您可以：\n1. 确认脚本（回复"确认"）\n2. 提出修改意见（告诉我需要调整的地方）';
    await this.saveMessage(workflow.id, 'assistant', response);

    return {
      response,
      stage: 'script_confirming',
      requiresAction: false,
    };
  }

  /**
   * 修改脚本
   */
  private async modifyScript(workflow: WorkflowState, modificationRequest: string): Promise<Script> {
    if (!workflow.script) {
      return this.createDefaultScript(workflow);
    }

    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一位专业的视频导演，用户对当前的分镜脚本有一些修改意见。
请根据用户的反馈调整脚本，保持JSON格式不变。只修改相关的部分，其他保持不变。

当前脚本：
${JSON.stringify(workflow.script, null, 2)}`;

    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请根据以下意见修改脚本：${modificationRequest}` },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.6,
    });

    try {
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Script;
      }
    } catch (error) {
      console.error('解析修改后的脚本失败:', error);
    }

    return workflow.script;
  }

  /**
   * 处理审核阶段
   */
  private async handleReviewing(
    workflow: WorkflowState,
    message: string
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    requiresAction: boolean;
    actionType?: string;
  }> {
    const client = getSupabaseClient();
    const lowerMessage = message.toLowerCase();

    const satisfiedKeywords = ['满意', '可以', '好的', '不错', '很好', '喜欢', '没问题'];
    const modifyKeywords = ['修改', '调整', '改一下', '不太好', '再改'];

    const isSatisfied = satisfiedKeywords.some(kw => lowerMessage.includes(kw));
    const needsModification = modifyKeywords.some(kw => lowerMessage.includes(kw));

    if (isSatisfied) {
      // 用户满意，进入批量准备阶段
      await this.updateStage(workflow.id, 'batch_preparing');

      // 生成10个修改方向
      const directions = await this.generateBatchDirections(workflow);

      await client
        .from('creative_workflows')
        .update({
          batch_directions: directions as unknown as Record<string, unknown>[],
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      const response = this.formatBatchDirectionsResponse(directions);

      await this.saveMessage(workflow.id, 'assistant', response, 'direction');

      return {
        response,
        stage: 'batch_preparing',
        requiresAction: false,
      };
    }

    if (needsModification) {
      // 用户需要修改视频
      const response = '好的，请告诉我您希望如何修改视频？我会根据您的意见重新生成。';
      await this.saveMessage(workflow.id, 'assistant', response);

      return {
        response,
        stage: 'reviewing',
        requiresAction: true,
        actionType: 'modify_video',
      };
    }

    const response = '您对这个视频满意吗？如果满意，我可以为您提供更多类似的变体方向。如果需要修改，请告诉我具体需要调整的地方。';
    await this.saveMessage(workflow.id, 'assistant', response);

    return {
      response,
      stage: 'reviewing',
      requiresAction: false,
    };
  }

  /**
   * 处理批量准备阶段
   */
  private async handleBatchPreparing(
    workflow: WorkflowState,
    message: string
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    requiresAction: boolean;
    actionType?: string;
    selectedDirections?: string[];
  }> {
    const client = getSupabaseClient();

    // 尝试解析用户选择的方向
    const selectedIds = this.parseDirectionSelection(message, workflow.batch_directions || []);

    if (selectedIds.length > 0) {
      await client
        .from('creative_workflows')
        .update({
          selected_directions: selectedIds,
          current_stage: 'batch_generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflow.id);

      const selectedNames = workflow.batch_directions
        ?.filter(d => selectedIds.includes(d.id))
        .map(d => d.name)
        .join('、');

      const response = `好的，您选择了：${selectedNames}\n\n请问每个方向需要生成多少个视频？（默认每个方向生成1个）`;

      await this.saveMessage(workflow.id, 'assistant', response);

      return {
        response,
        stage: 'batch_generating',
        requiresAction: false,
        selectedDirections: selectedIds,
      };
    }

    // 用户可能想看更多说明或调整方向
    const response = '您可以：\n1. 选择感兴趣的方向（例如"选择1、3、5"）\n2. 调整某个方向（例如"把第2个改成更暗的色调"）\n3. 直接告诉我您的想法';
    await this.saveMessage(workflow.id, 'assistant', response);

    return {
      response,
      stage: 'batch_preparing',
      requiresAction: false,
    };
  }

  /**
   * 生成10个批量修改方向（简洁版）
   */
  private async generateBatchDirections(workflow: WorkflowState): Promise<BatchDirection[]> {
    // 直接返回预设的简洁方向，不再调用LLM
    const basePrompt = workflow.current_video?.prompt_used || '';
    
    return [
      {
        id: 'dir_1',
        name: '暖色调版本',
        description: '整体画面偏暖，增加温馨感',
        prompt_variation: 'warm color tone, golden hour feeling',
        style_adjustments: ['色调变暖'],
        example: '夕阳般的温暖氛围',
      },
      {
        id: 'dir_2',
        name: '冷色调版本',
        description: '整体画面偏冷，增加科技感',
        prompt_variation: 'cool color tone, blue tint',
        style_adjustments: ['色调变冷'],
        example: '未来感的冷峻风格',
      },
      {
        id: 'dir_3',
        name: '高饱和度版本',
        description: '色彩更加鲜艳明快',
        prompt_variation: 'high saturation, vivid colors',
        style_adjustments: ['提高饱和度'],
        example: '色彩鲜艳的广告风格',
      },
      {
        id: 'dir_4',
        name: '低饱和度版本',
        description: '色彩柔和淡雅',
        prompt_variation: 'low saturation, muted colors, desaturated',
        style_adjustments: ['降低饱和度'],
        example: '日系清新淡雅风格',
      },
      {
        id: 'dir_5',
        name: '电影感版本',
        description: '增加电影质感和颗粒感',
        prompt_variation: 'cinematic look, film grain, letterbox',
        style_adjustments: ['电影调色'],
        example: '电影大片质感',
      },
      {
        id: 'dir_6',
        name: '明亮版本',
        description: '提高曝光和亮度',
        prompt_variation: 'brighter exposure, high key lighting',
        style_adjustments: ['提高亮度'],
        example: '明亮清新的日系风格',
      },
      {
        id: 'dir_7',
        name: '暗调版本',
        description: '降低曝光，增加神秘感',
        prompt_variation: 'darker exposure, low key lighting, dramatic shadows',
        style_adjustments: ['降低亮度'],
        example: '暗调戏剧性风格',
      },
      {
        id: 'dir_8',
        name: '柔光版本',
        description: '增加柔和的光晕效果',
        prompt_variation: 'soft lighting, dreamy atmosphere, glow effect',
        style_adjustments: ['柔光效果'],
        example: '梦幻柔美风格',
      },
      {
        id: 'dir_9',
        name: '对比度增强版本',
        description: '增强明暗对比',
        prompt_variation: 'high contrast, dramatic lighting',
        style_adjustments: ['增强对比度'],
        example: '强烈视觉冲击',
      },
      {
        id: 'dir_10',
        name: '复古版本',
        description: '复古胶片质感',
        prompt_variation: 'vintage look, retro film style, nostalgic',
        style_adjustments: ['复古调色'],
        example: '老照片般的复古质感',
      },
    ];
  }

  /**
   * 学习用户偏好
   */
  async learnUserPreferences(workflow: WorkflowState): Promise<void> {
    const preferences: Record<string, unknown> = {};

    if (workflow.script) {
      // 从脚本中学习风格偏好
      preferences.preferred_style = workflow.script.style;
      preferences.preferred_theme = workflow.script.theme;
      preferences.preferred_platform = workflow.script.target_platform;
    }

    if (workflow.selected_directions && workflow.batch_directions) {
      // 从选择的方向中学习
      const selected = workflow.batch_directions.filter(
        d => workflow.selected_directions.includes(d.id)
      );
      preferences.preferred_directions = selected.map(d => d.name);
    }

    // 记录到用户记忆
    await agentMemoryService.recordFact(
      'material',
      workflow.user_id,
      `workflow_${workflow.id}_preferences`,
      {
        ...preferences,
        created_at: new Date().toISOString(),
      }
    );

    // 更新工作流
    const client = getSupabaseClient();
    await client
      .from('creative_workflows')
      .update({
        learned_preferences: preferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflow.id);
  }

  /**
   * 完成工作流
   */
  async completeWorkflow(workflowId: string): Promise<void> {
    const client = getSupabaseClient();
    
    await client
      .from('creative_workflows')
      .update({
        status: 'completed',
        current_stage: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);
  }

  // ========== 辅助方法 ==========

  private mapToState(data: Record<string, unknown>): WorkflowState {
    return {
      id: data.id as string,
      user_id: data.user_id as string,
      session_id: data.session_id as string | undefined,
      current_stage: data.current_stage as WorkflowStage,
      status: data.status as WorkflowStatus,
      input: {
        type: (data.input_type as InputType) || 'text',
        content: (data.input_content as Record<string, unknown>)?.content as string || '',
        references: (data.reference_materials as ReferenceMaterial[]) || [],
      },
      script: data.script as Script | undefined,
      script_version: data.script_version as number,
      script_confirmed: data.script_confirmed as boolean,
      current_video: data.current_video as GeneratedVideo | undefined,
      video_iterations: (data.video_iterations as GeneratedVideo[]) || [],
      batch_directions: data.batch_directions as BatchDirection[] | undefined,
      selected_directions: (data.selected_directions as string[]) || [],
      batch_count: data.batch_count as number,
      batch_results: (data.batch_results as GeneratedVideo[]) || [],
      learned_preferences: (data.learned_preferences as Record<string, unknown>) || {},
    };
  }

  private async saveMessage(
    workflowId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    messageType?: string
  ): Promise<void> {
    const client = getSupabaseClient();
    
    // 保存到工作流消息表
    await client.from('workflow_messages').insert({
      workflow_id: workflowId,
      role,
      content,
      message_type: messageType || 'chat',
    });
    
    // 同时保存到对话记忆表（用于长期记忆）
    // 获取工作流的用户ID
    const { data: workflow } = await client
      .from('creative_workflows')
      .select('user_id')
      .eq('id', workflowId)
      .single();
    
    if (workflow?.user_id && role !== 'system') {
      // 直接保存消息到 agent_conversations 表
      // 用户消息和助手消息分开保存，确保历史加载时都能正确显示
      if (role === 'user') {
        // 用户消息直接保存，response 为空
        await client.from('agent_conversations').insert({
          user_id: workflow.user_id,
          agent_type: 'creative',
          message: content,
          response: '', // 暂时为空，等助手回复后更新
          status: 'pending', // 标记为待回复
        });
        console.log('[工作流] 用户消息已保存到对话历史');
      } else if (role === 'assistant') {
        // 助手消息：更新最近一条待回复的用户消息
        const { data: lastPendingMsg } = await client
          .from('agent_conversations')
          .select('id, message')
          .eq('user_id', workflow.user_id)
          .eq('agent_type', 'creative')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastPendingMsg) {
          // 更新待回复的消息
          await client
            .from('agent_conversations')
            .update({
              response: content,
              status: 'completed',
            })
            .eq('id', lastPendingMsg.id);
          console.log('[工作流] 助手回复已保存到对话历史');
        } else {
          // 没有待回复的消息，直接保存（可能是系统消息或主动推送）
          await client.from('agent_conversations').insert({
            user_id: workflow.user_id,
            agent_type: 'creative',
            message: '', // 没有对应的用户消息
            response: content,
            status: 'completed',
          });
          console.log('[工作流] 助手消息已独立保存');
        }
      }
    }
  }

  private async generateGuidanceResponse(
    workflow: WorkflowState,
    message: string,
    references: ReferenceMaterial[]
  ): Promise<string> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是创意小海，一个友好的视频创作助手。
当前正在帮助用户收集视频创作需求。请根据用户的输入，提供专业且有启发性的回复。

如果信息不足，可以询问：
- 视频主题和风格
- 目标平台
- 特殊效果需求
- 参考素材`;

    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `用户说：${message}\n\n当前已收集的参考素材：${references.length}个` },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    return response.content || '请告诉我更多关于您想创作的视频内容。';
  }

  private async parseVideoLink(url: string): Promise<ReferenceMaterial | null> {
    try {
      const platform = VideoLinkParser.detectPlatform(url);
      const info = await VideoLinkParser.parse(url);

      return {
        type: 'video_link',
        url,
        description: info.title,
        parsed_info: {
          platform: PLATFORM_CONFIG[platform]?.name,
          title: info.title,
          author: info.author,
          video_url: info.videoUrl,
        },
      };
    } catch (error) {
      console.error('解析视频链接失败:', error);
      return null;
    }
  }

  private extractVideoLinks(text: string): string[] {
    const patterns = [
      /https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/g,
      /https?:\/\/www\.douyin\.com\/video\/\d+/g,
      /https?:\/\/v\.kuaishou\.com\/[A-Za-z0-9]+/g,
      /https?:\/\/www\.bilibili\.com\/video\/BV[A-Za-z0-9]+/g,
      /https?:\/\/www\.xiaohongshu\.com\/discovery\/item\/[A-Za-z0-9]+/g,
    ];

    const links: string[] = [];
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        links.push(...matches);
      }
    }

    return [...new Set(links)];
  }

  /**
   * 格式化脚本响应 - 专业表格格式
   */
  private formatScriptResponse(script: Script, planIndex?: number): string {
    // 方案标题
    let planTitle = script.title;
    if (planIndex !== undefined) {
      planTitle = `方案${planIndex + 1}：${script.title}`;
    }
    
    let response = `### 📋 ${planTitle}\n\n`;
    
    // 基础信息
    response += `| 属性 | 内容 |\n`;
    response += `|------|------|\n`;
    response += `| 📌 主题 | ${script.theme} |\n`;
    response += `| 🎨 风格 | ${script.style} |\n`;
    response += `| ⏱️ 时长 | ${script.total_duration}秒 |\n`;
    response += `| 🎯 平台 | ${script.target_platform || '抖音/短视频'} |\n\n`;
    
    // 分镜头执行表格
    response += `#### 🎬 分镜头执行表\n\n`;
    response += `| 时间 | 画面内容 | 台词/文案 | 备注 |\n`;
    response += `|------|----------|-----------|------|\n`;
    
    let currentTime = 0;
    for (const sb of script.storyboards) {
      const startTime = currentTime;
      const endTime = currentTime + sb.duration;
      const timeRange = `${startTime}-${endTime}秒`;
      currentTime = endTime;
      
      // 画面内容（包含场景描述和运镜信息）
      let visualContent = `**${sb.scene_description || ''}**`;
      if (sb.camera_movement) {
        visualContent += `<br>📷 ${sb.camera_movement}`;
      }
      if (sb.camera_angle) {
        visualContent += `<br>🔭 ${sb.camera_angle}`;
      }
      if (sb.lighting) {
        visualContent += `<br>💡 ${sb.lighting}`;
      }
      
      // 台词/文案
      let scriptContent = '';
      if (sb.dialogue) {
        scriptContent += `"${sb.dialogue}"`;
      }
      if (sb.voiceover) {
        scriptContent += `<br>（旁白：${sb.voiceover}）`;
      }
      if (sb.text_overlay) {
        scriptContent += `<br>【字幕：${sb.text_overlay}】`;
      }
      if (!scriptContent) {
        scriptContent = '-';
      }
      
      // 备注
      let notes = '';
      if (sb.atmosphere) {
        notes += `🎭 ${sb.atmosphere}`;
      }
      if (sb.background_music) {
        notes += `<br>🎵 ${sb.background_music}`;
      }
      if (sb.transition) {
        notes += `<br>🔄 ${sb.transition}`;
      }
      if (!notes) {
        notes = '-';
      }
      
      // 使用管道符转义
      visualContent = visualContent.replace(/\|/g, '\\|');
      scriptContent = scriptContent.replace(/\|/g, '\\|');
      notes = notes.replace(/\|/g, '\\|');
      
      response += `| ${timeRange} | ${visualContent} | ${scriptContent} | ${notes} |\n`;
    }
    
    // 整体备注
    if (script.overall_notes) {
      response += `\n**📝 创作说明**：${script.overall_notes}\n`;
    }
    
    // Prompt 信息（折叠）
    response += `\n<details>`;
    response += `<summary>📝 查看 AI 生成提示词</summary>\n\n`;
    for (const sb of script.storyboards) {
      response += `**镜头${sb.sequence}**: \`${sb.prompt}\`\n\n`;
    }
    response += `</details>\n`;
    
    return response;
  }

  private formatBatchDirectionsResponse(directions: BatchDirection[]): string {
    let response = `太棒了！视频已确认 ✅\n\n`;
    response += `我为您准备了 **10个微调方向**，您可以选择感兴趣的方向进行批量生成变体：\n\n`;

    directions.forEach((dir, index) => {
      response += `**${index + 1}. ${dir.name}** - ${dir.description}\n`;
    });

    response += `\n---\n`;
    response += `💡 **选择方式**：\n`;
    response += `- 选择多个方向（如"1、3、5"或"暖色调和电影感"）\n`;
    response += `- 选择全部（回复"全部"）\n`;
    response += `- 告诉我您的想法，我可以调整方向`;

    return response;
  }

  private parseDirectionSelection(message: string, directions: BatchDirection[]): string[] {
    const selectedIds: string[] = [];
    const lowerMessage = message.toLowerCase();

    // 检测"全部"或"所有"
    if (lowerMessage.includes('全部') || lowerMessage.includes('所有')) {
      return directions.map(d => d.id);
    }

    // 提取数字
    const numbers = message.match(/\d+/g);
    if (numbers) {
      for (const num of numbers) {
        const index = parseInt(num, 10) - 1;
        if (index >= 0 && index < directions.length) {
          selectedIds.push(directions[index].id);
        }
      }
    }

    return selectedIds;
  }

  private createDefaultScript(workflow: WorkflowState): Script {
    return {
      title: '视频创作脚本',
      theme: '创意短视频',
      style: '现代简约',
      total_duration: 5,
      target_platform: 'douyin',
      storyboards: [{
        id: 'sb_1',
        sequence: 1,
        duration: 5,
        scene_description: workflow.input.content || '创意场景',
        visual_reference: '清晰明亮的画面，主体突出',
        camera_movement: '推镜头',
        camera_angle: '平视',
        lighting: '自然光，柔和均匀',
        color_tone: '明亮清新',
        shadow_highlight: '柔和的阴影过渡',
        background: '简洁干净的背景',
        props: '',
        atmosphere: '轻松愉悦',
        characters: '',
        character_actions: '',
        character_emotion: '',
        dialogue: '',
        voiceover: '',
        text_overlay: '',
        background_music: '轻快的背景音乐',
        sound_effects: '',
        transition: '硬切',
        prompt: workflow.input.content || 'A creative video scene, high quality, cinematic',
        status: 'pending',
      }],
      overall_notes: '这是一个基础的分镜脚本，请提供更多细节让我完善脚本内容。',
    };
  }

  private async handleDefaultStage(
    workflow: WorkflowState,
    message: string
  ): Promise<{
    response: string;
    stage: WorkflowStage;
    requiresAction: boolean;
  }> {
    const llmClient = new LLMClient(new Config(), this.headers);
    
    const systemPrompt = STAGE_PROMPTS[workflow.current_stage];
    
    const response = await llmClient.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.7,
    });

    return {
      response: response.content || '请继续操作',
      stage: workflow.current_stage,
      requiresAction: false,
    };
  }
}

// 导出服务工厂函数
export function createCreativeWorkflowService(headers: Record<string, string> = {}): CreativeWorkflowService {
  return new CreativeWorkflowService(headers);
}

export { CreativeWorkflowService };
export type { WorkflowState as CreativeWorkflowState };
