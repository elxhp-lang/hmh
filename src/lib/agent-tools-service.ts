/**
 * Agent 工具服务
 * 
 * 提供创意小海 Agent 需要的 14 个工具
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SeedanceClient } from './seedance-client';
import { VideoLearningService } from './video-learning-service';
import { ScriptGeneratorService } from './script-generator-service';
import { ScriptTemplateService } from './script-template-service';
import { ImageAnalysisService } from './image-analysis-service';
import { ImageGenerationService } from './image-generation-service';
import { XiaohaiMemoryService } from './xiaohai-memory-service';
import { XiaohaiEvolutionService } from './xiaohai-evolution-service';
import { SearchClient } from 'coze-coding-dev-sdk';
import { v4 as uuidv4 } from 'uuid';

// ========== 类型定义 ==========

export interface UserPreference {
  user_id: string;
  common_styles: string[];      // 常用风格
  common_duration: number;       // 常用时长
  common_aspect_ratio: string;  // 常用比例
  industry: string;             // 行业
  product_tags: string[];       // 产品标签
  last_used_at: string;
}

export interface Product {
  id: string;
  product_name: string;
  description: string;
  images: string[];
  category: string;
  tags: string[];
}

export interface VideoTask {
  task_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  prompt: string;
  video_url?: string;
  error?: string;
  created_at: string;
}

// ========== 工具服务 ==========

export class AgentToolsService {
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;
  private _seedance: SeedanceClient | null = null;
  private _templateService: ScriptTemplateService | null = null;
  private _imageAnalysisService: ImageAnalysisService | null = null;
  private _imageGenerationService: ImageGenerationService | null = null;
  private currentUserId: string | null = null;
  private webSearchEnabled: boolean = false;
  private _searchClient: SearchClient | null = null;

  // 延迟获取 supabase client
  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  private get seedance() {
    if (!this._seedance) {
      this._seedance = new SeedanceClient();
    }
    return this._seedance;
  }

  private get templateService() {
    if (!this._templateService) {
      this._templateService = new ScriptTemplateService();
    }
    return this._templateService;
  }

  private get imageAnalysisService() {
    if (!this._imageAnalysisService) {
      this._imageAnalysisService = new ImageAnalysisService();
    }
    return this._imageAnalysisService;
  }

  private get imageGenerationService() {
    if (!this._imageGenerationService) {
      this._imageGenerationService = new ImageGenerationService();
    }
    return this._imageGenerationService;
  }

  private get searchClient() {
    if (!this._searchClient) {
      this._searchClient = new SearchClient();
    }
    return this._searchClient;
  }

  /**
   * 设置联网搜索开关
   */
  setWebSearchEnabled(enabled: boolean) {
    this.webSearchEnabled = enabled;
  }

  /**
   * 联网搜索
   */
  async webSearch(params: { query: string; count?: number }): Promise<{
    success: boolean;
    data?: {
      summary: string;
      results: any[];
      formatted: string;
    };
    error?: string;
  }> {
    const query = params.query || '';
    const count = params.count || 5;

    if (!query) {
      return { success: false, error: '搜索关键词不能为空' };
    }

    try {
      const result = await this.searchClient.webSearch(query, count);

      if (result.web_items && result.web_items.length > 0) {
        const resultText = result.web_items
          .map((r: any, i: number) => `${i + 1}. 【${r.title}】\n   ${r.snippet}\n   来源: ${r.site_name || '未知网站'}`)
          .join('\n\n');

        return {
          success: true,
          data: {
            summary: result.summary || '',
            results: result.web_items,
            formatted: `--- 联网搜索结果（${result.web_items.length}条）---\n${result.summary ? result.summary + '\n\n' : ''}${resultText}`
          }
        };
      } else {
        return { success: false, error: '未找到相关结果' };
      }
    } catch (error) {
      console.error('[AgentTools] 联网搜索失败:', error);
      return { success: false, error: error instanceof Error ? error.message : '联网搜索失败' };
    }
  }

  /**
   * 设置当前用户 ID（由 API 层调用）
   */
  setUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  private getUserId(): string {
    // 如果是匿名用户，返回一个有效的 UUID 或空字符串
    if (!this.currentUserId || this.currentUserId === 'anonymous') {
      return '00000000-0000-0000-0000-000000000000';
    }
    return this.currentUserId;
  }

  /**
   * 工具1：用户偏好查询
   */
  async getUserPreference(userId: string): Promise<{
    success: boolean;
    data?: UserPreference;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('creative_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('memory_type', 'user_preference')
        .single();

      if (error && (error as any).code !== 'PGRST116') {
        console.error('查询用户偏好失败:', error);
        return { success: false, error: (error as any).message || '查询失败' };
      }

      // 如果没有偏好记录，返回默认值
      if (!data) {
        return {
          success: true,
          data: {
            user_id: userId,
            common_styles: ['现代简约', '科技感'],
            common_duration: 8,
            common_aspect_ratio: '9:16',
            industry: '',
            product_tags: [],
            last_used_at: new Date().toISOString()
          }
        };
      }

      const content = (data as any).content || {};
      return {
        success: true,
        data: {
          user_id: (data as any).user_id as string,
          common_styles: (content.common_styles as string[]) || ['现代简约'],
          common_duration: (content.common_duration as number) || 8,
          common_aspect_ratio: (content.common_aspect_ratio as string) || '9:16',
          industry: (content.industry as string) || '',
          product_tags: (content.product_tags as string[]) || [],
          last_used_at: (data as any).created_at as string
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }

  /**
   * 工具2：保存用户偏好
   */
  async saveUserPreference(
    userId: string,
    preference: Partial<UserPreference>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('creative_memories')
        .upsert({
          user_id: userId,
          memory_type: 'user_preference',
          content: {
            common_styles: preference.common_styles,
            common_duration: preference.common_duration,
            common_aspect_ratio: preference.common_aspect_ratio,
            industry: preference.industry,
            product_tags: preference.product_tags
          },
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('保存用户偏好失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存失败'
      };
    }
  }

  /**
   * 工具3：商品语义搜索
   */
  async searchProduct(keyword: string, count: number = 5): Promise<{
    success: boolean;
    data?: Product[];
    error?: string;
  }> {
    try {
      // 先尝试模糊搜索
      const { data, error } = await this.supabase
        .from('product_library')
        .select('*')
        .ilike('product_name', `%${keyword}%`)
        .limit(count);

      if (error) {
        console.error('搜索商品失败:', error);
        return { success: false, error: error.message };
      }

      if (data && data.length > 0) {
        return {
          success: true,
          data: data.map((p: any) => ({
            id: p.id as string,
            product_name: p.product_name as string,
            description: (p.product_description as string) || '',
            images: (p.images as string[]) || [],
            category: (p.category as string) || '',
            tags: (p.tags as string[]) || []
          }))
        };
      }

      // 如果没找到，返回空结果（不是错误）
      return {
        success: true,
        data: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败'
      };
    }
  }

  /**
   * 工具4：分析视频
   */
  async analyzeVideo(videoUrl: string, videoName?: string, headers?: Record<string, string>): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const service = new VideoLearningService(headers);
      const result = await service.analyzeVideo(videoUrl, videoName || '分析视频', headers);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '分析失败'
      };
    }
  }

  /**
   * 工具4.5：分析单张图片 ⭐ 新增
   */
  async analyzeImage(
    imageUrl: string,
    categoryHint?: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await this.imageAnalysisService.analyzeImage(imageUrl, categoryHint);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '图片分析失败'
      };
    }
  }

  /**
   * 工具4.6：分析多张图片 ⭐ 新增
   */
  async analyzeMultipleImages(
    imageUrls: string[],
    categoryHint?: string
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const result = await this.imageAnalysisService.analyzeMultipleImages(imageUrls, categoryHint);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '多图分析失败'
      };
    }
  }

  /**
   * 工具5：生成脚本
   */
  async generateScript(
    productName: string,
    style: string = '现代简约',
    duration: number = 8,
    reference?: string
  ): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const service = new ScriptGeneratorService(undefined);
      const scripts = await service.generate({
        productName,
        style,
        duration,
        reference: reference || ''
      });
      return { success: true, data: scripts };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }

  /**
   * 工具6：提交视频生成任务 ⭐ 优化版（笔记本系统）
   * 支持 reference_video 参数实现同风格生成
   * 新增：script, copywriting, tags, category, video_name 字段
   */
  async submitVideoTask(
    userId: string,
    prompt: string,
    firstFrameUrl?: string,
    duration?: number,
    options?: {
      reference_video?: string;      // 参考视频 URL（风格/动作参考）
      reference_audio?: string;      // 参考音频 URL（背景音乐）
      aspect_ratio?: string;         // 视频比例
      model?: 'standard' | 'fast';  // 模型选择
      script?: string;               // 视频脚本
      copywriting?: string;          // 视频配文
      tags?: string[];               // 视频标签
      category?: string;              // 视频分类
      video_name?: string;           // 新增：视频名称（用于多任务对应）
    }
  ): Promise<{
    success: boolean;
    data?: { 
      video_id: string;             // 我们系统的 video_id
      seedance_task_id: string;      // Seedance 的 task_id
      status: string; 
      estimated_time?: number 
    };
    error?: string;
  }> {
    try {
      // 1️⃣ 生成我们自己的 video_id（UUID）
      const videoId = uuidv4();
      
      const modelId = options?.model === 'fast' 
        ? 'doubao-seedance-2-0-fast-260128' 
        : 'doubao-seedance-2-0-260128';

      const ratio = options?.aspect_ratio as any || '9:16';
      const taskDuration = duration || 8;

      let task;
      let seedanceTaskId: string = '';

      // 根据参数选择调用方式
      if (options?.reference_video) {
        // ⭐ 核心功能：使用 reference_video 实现同风格生成
        console.log('[submitVideoTask] 使用 reference_video 模式');
        // 不等待完成，只获取 task_id
        const createResponse = await this.seedance.createTask({
          model: modelId as any,
          content: [{ type: 'text', text: prompt }],
          duration: taskDuration,
          ratio,
        } as any);
        seedanceTaskId = createResponse.id;
        console.log('[submitVideoTask] reference_video 模式获取到 seedanceTaskId:', seedanceTaskId);
      } else if (firstFrameUrl) {
        // 图生视频模式 - 不等待完成
        const createResponse = await this.seedance.createTask({
          model: modelId as any,
          content: [
            { type: 'image_url', image_url: { url: firstFrameUrl }, role: 'first_frame' },
            { type: 'text', text: prompt }
          ],
          duration: taskDuration,
          ratio,
        });
        seedanceTaskId = createResponse.id;
        console.log('[submitVideoTask] 图生视频模式获取到 seedanceTaskId:', seedanceTaskId);
      } else {
        // 文生视频模式 - 不等待完成
        const createResponse = await this.seedance.createTask({
          model: modelId as any,
          content: [{ type: 'text', text: prompt }],
          duration: taskDuration,
          ratio,
          generate_audio: true,
          watermark: false,
        });
        seedanceTaskId = createResponse.id;
        console.log('[submitVideoTask] 文生视频模式获取到 seedanceTaskId:', seedanceTaskId);
      }

      // 如果 seedance_task_id 为空，抛出错误
      if (!seedanceTaskId) {
        console.error('[submitVideoTask] seedance_task_id 为空！');
        throw new Error('无法获取 Seedance 任务 ID，视频生成失败');
      }
      
      console.log('[submitVideoTask] 任务已提交，seedanceTaskId:', seedanceTaskId);

      // 2️⃣ 保存任务记录到 videos 表
      await this.supabase.from('videos').insert({
        id: videoId,                          // 我们的 video_id
        task_id: seedanceTaskId,             // Seedance 的 task_id（保存到 task_id 字段）
        user_id: userId,
        prompt,
        task_type: options?.reference_video ? 'multi_modal' : (firstFrameUrl ? 'image_to_video' : 'text_to_video'),
        status: 'processing',
        ratio,
        duration: taskDuration,
        model: modelId,
      });

      // 3️⃣ 返回结果给创意小海
      return {
        success: true,
        data: {
          video_id: videoId,                  // 返回我们的 video_id
          seedance_task_id: seedanceTaskId,   // 返回 Seedance 的 task_id
          status: 'processing',
          estimated_time: 30 // 估计 30 秒
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '提交失败'
      };
    }
  }

  /**
   * 工具7：查询任务状态
   * 支持按 seedance_task_id 或 video_id 查询
   */
  async queryTaskStatus(taskIdOrVideoId: string): Promise<{
    success: boolean;
    data?: {
      task_id: string;
      status: string;
      progress?: number;
      video_url?: string;
      error?: string;
    };
    error?: string;
  }> {
    try {
      // 先查本地数据库 - 优先用 task_id（Seedance ID）查
      let { data, error } = await this.supabase
        .from('videos')
        .select('*')
        .eq('task_id', taskIdOrVideoId)
        .single();
      
      // 如果没找到，尝试用 video_id（我们的ID）查
      if (error || !data) {
        const result = await this.supabase
          .from('videos')
          .select('*')
          .eq('id', taskIdOrVideoId)
          .single();
        if (!result.error && result.data) {
          data = result.data;
          error = null;
        }
      }

      if (error || !data) {
        console.error('查询任务状态失败: 未找到记录', taskIdOrVideoId);
        return { success: false, error: `未找到任务: ${taskIdOrVideoId}` };
      }

      // 如果已完成，查询 Seedance 获取最新状态
      const d = data as any;
      let status = d?.status || 'pending';
      let videoUrl = d?.video_url || d?.result_url;
      let progress = 0;

      if (status === 'processing' || status === 'pending') {
        try {
          // 使用 getTask 方法查询状态（用数据库中的 Seedance task_id）
          const taskStatus = await this.seedance.getTask(d.task_id as string);
          status = taskStatus.status || status;
          videoUrl = taskStatus.content?.video_url || videoUrl;
          
          // 计算进度
          if (status === 'succeeded') {
            progress = 100;
          } else if (status === 'processing') {
            progress = 50;
          } else {
            progress = 10;
          }
        } catch (e) {
          // 忽略查询错误
          console.warn('[queryTaskStatus] 查询 Seedance 状态失败:', e);
        }
      }

      return {
        success: true,
        data: {
          task_id: d.task_id as string,
          status: status as string,
          progress: progress as number,
          video_url: videoUrl as string | undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }

  /**
   * 获取所有工具（用于注册）
   * @param webSearchEnabled - 是否启用联网搜索
   */
  getAllTools(webSearchEnabled: boolean = false) {
    const self = this;
    return {
      get_user_preference: async (_params: Record<string, any>) => 
        this.getUserPreference(this.getUserId()),
      
      // ========== 双笔记本系统：保存用户偏好（笔记本2号）==========
      save_user_preference: async (params: {
        preference_type: 'aspect_ratio' | 'duration' | 'style' | 'industry' | 'product_tags' | 'custom';
        content: string;
        tags?: string[];
      }) => this.saveCreativeUserPreference(params),
      
      search_product: async (params: { keyword: string; count?: number }) =>
        this.searchProduct(params.keyword, params.count),
      
      analyze_video: async (params: { video_url: string; video_name?: string }) =>
        this.analyzeVideo(params.video_url, params.video_name),
      
      // ========== 图片分析工具（支持视频URL）⭐ 修复 ==========
      
      analyze_image: async (params: { 
        image_url?: string; 
        video_url?: string;  // 模型可能使用这个参数名
        input?: string;      // 模型可能使用这个参数名
        url?: string;        // 模型可能使用这个参数名
        category_hint?: string;
        is_video?: boolean;
        [key: string]: any;
      }) => {
        // 处理参数可能是数组的情况
        const normalizedParams = Array.isArray(params) ? {} : params;
        
        // 如果是视频URL或参数指定为视频，调用视频分析
        // 检测多种可能的参数名
        const url = normalizedParams.image_url || normalizedParams.video_url || normalizedParams.input || normalizedParams.url || '';
        const isVideoUrl = normalizedParams.is_video || 
          url.includes('.mp4') || 
          url.includes('.mov') || 
          url.includes('.webm') ||
          url.includes('.avi') ||
          url.includes('/video/');
        
        if (isVideoUrl && url) {
          console.log(`[工具] analyze_image 检测到视频URL，转调用 analyze_video: ${url.substring(0, 80)}`);
          return this.analyzeVideo(url, '视频分析');
        }
        
        return this.analyzeImage(
          normalizedParams.image_url || normalizedParams.video_url || normalizedParams.input || normalizedParams.url || '', 
          normalizedParams.category_hint
        );
      },
      
      analyze_multiple_images: async (params: { 
        image_urls: string[]; 
        category_hint?: string;
      }) => this.analyzeMultipleImages(params.image_urls, params.category_hint),
      
      generate_script: async (params: { product_name: string; style?: string; duration?: number; reference?: string }) =>
        this.generateScript(params.product_name, params.style, params.duration, params.reference),
      
      submit_video_task: async (params: { 
        prompt: string; 
        first_frame_url?: string; 
        duration?: number;
        reference_video?: string;    // ⭐ 新增：参考视频
        reference_audio?: string;    // ⭐ 新增：参考音频
        aspect_ratio?: string;       // ⭐ 新增：视频比例
        model?: 'standard' | 'fast'; // ⭐ 新增：模型选择
      }) =>
        this.submitVideoTask(this.getUserId(), params.prompt, params.first_frame_url, params.duration, {
          reference_video: params.reference_video,
          reference_audio: params.reference_audio,
          aspect_ratio: params.aspect_ratio,
          model: params.model,
        }),
      
      query_task_status: async (params: { 
        video_id?: string; 
        seedance_task_id?: string;
        task_id?: string;
      }) => {
        // 支持多种参数名
        const id = params.video_id || params.seedance_task_id || params.task_id || '';
        return this.queryTaskStatus(id);
      },
      
      // ========== 模板相关工具 ==========
      
      get_templates: async (_params: Record<string, any>) =>
        this.getTemplates(),
      
      get_template: async (params: { template_id: string }) =>
        this.getTemplate(params.template_id),
      
      create_template: async (params: { 
        template_name: string; 
        category?: string; 
        duration?: number; 
        aspect_ratio?: string;
        style?: string;
        shots: Array<{ shot_time: string; content: string; transition: string; variables?: string[] }>;
        variable_desc?: Record<string, string>;
      }) => this.createTemplate(params),
      
      batch_generate: async (params: { 
        template_id: string; 
        data_rows: Array<Record<string, string>>;
        first_frame_url?: string;
      }) => this.batchGenerate(params),
      
      // ========== 脚本微调工具 ⭐ 新增（与 Seed 2.0 讨论后）==========
      
      modify_script: async (params: { 
        original_script: string;   // 当前完整脚本内容
        modification: string;     // 用户的修改要求
      }) => this.modifyScript(params.original_script, params.modification),
      
      // ========== 素材保存工具 ⭐ 新增（与 Seed 2.0 讨论后）==========
      
      save_material: async (params: { 
        material_type: 'video' | 'image' | 'text' | 'audio';
        material_url: string;
        material_tag?: string;
      }) => this.saveMaterial(params.material_type, params.material_url, params.material_tag),
      
      // ========== 素材管理工具 ⭐ 新增（任务1-3）==========
      
      delete_material: async (params: { material_id: string }) =>
        this.deleteMaterial(params.material_id),
      
      update_material: async (params: { 
        material_id: string;
        name?: string;
        category?: string;
        tags?: string[];
      }) => this.updateMaterial(params.material_id, params),
      
      get_materials: async (params: { 
        type?: 'video' | 'image' | 'audio' | 'text' | 'all';
        limit?: number;
        offset?: number;
        sort_by?: 'created_at' | 'file_name';
        sort_order?: 'asc' | 'desc';
      }) => this.getMaterials(params),
      
      // ========== 配文生成工具 ⭐ 新增（与 Seed 2.0 讨论后）==========
      
      generate_copywriting: async (params: { 
        product_name: string;
        content_requirement?: string;
        platform?: '抖音' | '小红书' | '微博';
        video_task_id?: string;
      }) => this.generateCopywriting(params.product_name, params.content_requirement, params.platform, params.video_task_id),
      
      // ========== 首帧图生成工具 ==========
      
      generate_first_frame: async (params: { 
        product_image_url: string;      // 商品图片 URL
        script_content: string;         // 脚本描述
        aspect_ratio?: string;          // 视频比例 9:16 或 16:9
        style?: string;                 // 风格描述
        reference_style?: string;       // 参考视频风格
      }) => this.generateFirstFrame(params),
      
      // ========== 协作记忆工具 ==========
      
      update_collaboration_memory: async (params: { 
        section: 'progress' | 'decisions' | 'issues' | 'todos' | 'notes';
        content: string;
        action?: 'append' | 'replace' | 'delete';
      }) => this.updateCollaborationMemory(params),
      
      get_collaboration_status: async (_params: Record<string, any>) =>
        this.getCollaborationStatus(),

      // ========== 会话管理工具 ⭐ 新增（任务4）==========
      
      get_session: async (_params: Record<string, any>) =>
        this.getCurrentSession(),
      
      clear_session: async (_params: Record<string, any>) =>
        this.clearCurrentSession(),

      // ========== 学习库工具（笔记本4号）==========
      
      get_learning_library: async (params?: { 
        page?: number; 
        pageSize?: number 
      }) => this.getLearningLibrary(params),
      
      search_learning_library: async (params: { 
        query: string; 
        limit?: number 
      }) => this.searchLearningLibrary(params),
      
      sync_to_library: async (params: { 
        video_url: string; 
        video_name?: string 
      }) => this.syncToLibrary(params),

      // ========== 记忆与进化工具（新增）==========

      saveUserMemory: async (params: {
        content: string;
        memory_type: 'general' | 'preference' | 'experience' | 'rule' | 'document';
        keywords: string[];
      }) => this.saveUserMemory(params),

      getUserMemories: async (params: {
        query: string;
        memory_type?: string;
        limit?: number;
      }) => this.getUserMemories(params),

      searchUserMemories: async (params: {
        keyword: string;
        memory_type?: string;
      }) => this.searchUserMemories(params),

      recordLearning: async (params: {
        record_type: 'correction' | 'success' | 'error' | 'improvement';
        content: string;
        original_content?: string;
        feedback?: string;
        score?: number;
        tags?: string[];
      }) => this.recordLearning(params),

      getLearningRecords: async (params: {
        query?: string;
        record_type?: string;
        limit?: number;
      }) => this.getLearningRecords(params),

      analyzeFile: async (params: {
        file_url: string;
        file_type: string;
        purpose?: string;
      }) => this.analyzeFile(params),

      // 联网搜索工具（需要在API层传入webSearchEnabled）
      webSearch: async (params: { query: string; count?: number }) => {
        // 条件调用：检查 webSearchEnabled 标志
        if (!this.webSearchEnabled) {
          return {
            success: false,
            error: '联网搜索功能未开启，请在界面右上角开启联网模式'
          };
        }
        return this.webSearch(params);
      }
    };
  }

  // ========== 脚本微调工具实现 ⭐ 新增（与 Seed 2.0 讨论后）==========

  /**
   * 工具17：脚本微调
   * 
   * 根据用户的要求修改现有脚本
   */
  private async modifyScript(
    originalScript: string,
    modification: string
  ): Promise<{
    success: boolean;
    data?: {
      modified_script: string;
    };
    error?: string;
  }> {
    try {
      // 调用 LLM 修改脚本
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const client = new LLMClient(new Config());
      
      const messages = [
        {
          role: 'system' as const,
          content: `你是一个专业的短视频脚本编辑。请根据用户的修改要求，对现有脚本进行微调。

要求：
1. 保持脚本的整体结构
2. 只修改用户指定的部分
3. 返回修改后的完整脚本
4. 所有用户可见文本必须是中文`
        },
        {
          role: 'user' as const,
          content: `## 原始脚本
${originalScript}

## 修改要求
${modification}

请返回修改后的完整脚本。`
        }
      ];
      
      // 使用 stream 方法获取响应
      let modifiedScript = originalScript;
      const response = await client.stream(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      for await (const chunk of response) {
        const content = (chunk as any).content || '';
        if (content) {
          modifiedScript += content;
        }
      }

      return {
        success: true,
        data: {
          modified_script: modifiedScript
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '脚本修改失败'
      };
    }
  }

  // ========== 素材保存工具实现 ⭐ 新增（与 Seed 2.0 讨论后）==========

  /**
   * 工具18：素材保存
   * 
   * 保存用户上传的素材到个人素材库
   */
  private async saveMaterial(
    materialType: 'video' | 'image' | 'text' | 'audio',
    materialUrl: string,
    materialTag?: string
  ): Promise<{
    success: boolean;
    data?: {
      material_id: string;
    };
    error?: string;
  }> {
    try {
      const materialId = `mat_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // 保存到数据库
      const { error } = await this.supabase
        .from('uploaded_files')
        .insert({
          file_id: materialId,
          file_name: materialTag || `素材_${Date.now()}`,
          file_type: materialType,
          file_url: materialUrl,
          tos_key: materialUrl, // 暂存 URL
          file_size: 0,
          created_by: this.getUserId()
        });

      if (error) {
        console.error('保存素材失败:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          material_id: materialId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '素材保存失败'
      };
    }
  }

  // ========== 素材管理工具 ⭐ 新增（任务1-3）==========

  /**
   * 任务1：删除素材
   * 
   * 从素材库中删除指定素材
   */
  private async deleteMaterial(materialId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // 先查询素材信息
      const { data: file, error: queryError } = await this.supabase
        .from('uploaded_files')
        .select('tos_key, file_name')
        .eq('file_id', materialId)
        .single();

      if (queryError || !file) {
        return { success: false, error: '素材不存在' };
      }

      // 删除 TOS 中的文件（如果存在 tos_key）
      if (file.tos_key) {
        try {
          // TOS 文件删除（可选，静默失败）
          console.log('TOS 文件待删除:', file.tos_key);
        } catch (tosError) {
          console.warn('TOS 文件删除失败（可能已不存在）:', tosError);
        }
      }

      // 删除数据库记录
      const { error: deleteError } = await this.supabase
        .from('uploaded_files')
        .delete()
        .eq('file_id', materialId);

      if (deleteError) {
        console.error('删除素材失败:', deleteError);
        return { success: false, error: deleteError.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '素材删除失败'
      };
    }
  }

  /**
   * 任务2：修改素材
   * 
   * 更新素材的名称、分类、标签等信息
   */
  private async updateMaterial(
    materialId: string,
    updates: {
      name?: string;
      category?: string;
      tags?: string[];
    }
  ): Promise<{
    success: boolean;
    data?: {
      material_id: string;
      file_name: string;
      file_type: string;
      file_url: string;
      category?: string;
      tags?: string[];
    };
    error?: string;
  }> {
    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (updates.name) {
        updateData.file_name = updates.name;
      }
      if (updates.category) {
        updateData.category = updates.category;
      }
      if (updates.tags) {
        updateData.tags = updates.tags;
      }

      const { data, error } = await this.supabase
        .from('uploaded_files')
        .update(updateData)
        .eq('file_id', materialId)
        .select('file_id, file_name, file_type, file_url, category, tags')
        .single();

      if (error) {
        console.error('更新素材失败:', error);
        return { success: false, error: (error as any).message || '更新失败' };
      }

      const d = data as any;
      return {
        success: true,
        data: {
          material_id: d?.file_id as string,
          file_name: d?.file_name as string,
          file_type: d?.file_type as string,
          file_url: d?.file_url as string,
          category: d?.category as string | undefined,
          tags: d?.tags as string[] | undefined
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '素材更新失败'
      };
    }
  }

  /**
   * 任务3：获取素材列表
   * 
   * 分页获取用户的素材列表
   */
  private async getMaterials(params: {
    type?: 'video' | 'image' | 'audio' | 'text' | 'all';
    limit?: number;
    offset?: number;
    sort_by?: 'created_at' | 'file_name';
    sort_order?: 'asc' | 'desc';
  }): Promise<{
    success: boolean;
    data?: {
      materials: Array<{
        material_id: string;
        file_name: string;
        file_type: string;
        file_url: string;
        category?: string;
        tags?: string[];
        created_at: string;
        file_size?: number;
      }>;
      total: number;
    };
    error?: string;
  }> {
    try {
      const {
        type = 'all',
        limit = 20,
        offset = 0,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = params;

      // 构建查询
      let query = this.supabase
        .from('uploaded_files')
        .select('file_id, file_name, file_type, file_url, category, tags, created_at, file_size', { count: 'exact' })
        .eq('created_by', this.getUserId());

      // 按类型筛选
      if (type !== 'all') {
        query = query.eq('file_type', type);
      }

      // 排序
      query = query.order(sort_by, { ascending: sort_order === 'asc' });

      // 分页
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('获取素材列表失败:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          materials: (data || []).map((f: any) => ({
            material_id: f.file_id as string,
            file_name: f.file_name as string,
            file_type: f.file_type as string,
            file_url: f.file_url as string,
            category: f.category as string | undefined,
            tags: f.tags as string[] | undefined,
            created_at: f.created_at as string,
            file_size: f.file_size as number | undefined
          })),
          total: (count as number) || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '素材列表获取失败'
      };
    }
  }

  // ========== 配文生成工具实现 ⭐ 新增（与 Seed 2.0 讨论后优化）==========

  /**
   * 工具19：配文生成
   * 
   * 为视频生成配套的文案（标题、正文、话题标签）
   * 根据 Seed 2.0 的建议优化：动态 LLM 生成 + 三种风格
   */
  private async generateCopywriting(
    productName: string,
    contentRequirement?: string,
    platform?: '抖音' | '小红书' | '微博',
    videoTaskId?: string,
    keySellingPoints?: string[],
    scriptHighlight?: string
  ): Promise<{
    success: boolean;
    data?: {
      copywriting_list: Array<{
        style_name: string;
        content: string;
        tags: string[];
      }>;
    };
    error?: string;
  }> {
    try {
      // 获取视频关联内容
      let videoContext = '';
      if (videoTaskId) {
        const { data } = await this.supabase
          .from('videos')
          .select('prompt')
          .eq('task_id', videoTaskId)
          .single();
        
        if (data) {
          videoContext = `\n匹配视频内容：${data.prompt}`;
        }
      }

      const platformName = platform || '抖音';
      const sellingPoints = keySellingPoints?.join('、') || '自动推导该品类用户最关心的卖点';
      const highlight = scriptHighlight || videoContext;

      // 构建提示词（根据 Seed 2.0 建议）
      const prompt = `你是专业的短视频平台配文写手，请为【${productName}】生成3条完全不同风格的${platformName}配文，要求：

1. 风格分别为：
   - 亲民种草款（像朋友分享，带口语化语气词）
   - 专业干货款（突出产品功能优势，给用户决策理由）
   - 互动引流款（结尾带提问/引导行动，引导评论点赞）

2. 必须融入以下信息：
   - 产品核心卖点：${sellingPoints}
   - 匹配视频内容：${highlight || '无需特别匹配视频内容'}

3. 字数控制在50-150字，符合${platformName}的内容调性，带3-5个合适的话题标签

4. 不要出现夸张虚假宣传、违规极限词

直接输出3条配文，每条开头标注对应的风格名，不要多余解释。`;

      // 调用 LLM 生成配文
      const { LLMClient, Config } = await import('coze-coding-dev-sdk');
      const client = new LLMClient(new Config());
      
      const messages = [{ role: 'user' as const, content: prompt }];
      
      let copywritingText = '';
      const response = await client.stream(messages, {
        model: 'doubao-seed-2-0-pro-260215',
        temperature: 0.7
      });
      
      for await (const chunk of response) {
        const content = (chunk as any).content || '';
        if (content) {
          copywritingText += content;
        }
      }

      // 解析 LLM 输出（简化处理，提取风格和内容）
      const options = this.parseCopywritingResponse(copywritingText, productName);

      return {
        success: true,
        data: {
          copywriting_list: options
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '配文生成失败'
      };
    }
  }

  /**
   * 解析配文响应
   */
  private parseCopywritingResponse(
    response: string,
    productName: string
  ): Array<{ style_name: string; content: string; tags: string[] }> {
    // 默认选项（如果解析失败）
    const defaultOptions = [
      {
        style_name: '亲民种草款',
        content: `${productName}真的太好用了！用了之后就离不开了～姐妹们冲！`,
        tags: [`#${productName}`, '#好物推荐', '#种草']
      },
      {
        style_name: '专业干货款',
        content: `${productName}核心卖点解析：1. 高品质材料 2. 专业工艺 3. 持久耐用。专业选择，值得信赖。`,
        tags: [`#${productName}`, '#测评', '#好物分享']
      },
      {
        style_name: '互动引流款',
        content: `${productName}用了这么久，你们觉得怎么样？评论区告诉我！`,
        tags: [`#${productName}`, '#互动', '#问答']
      }
    ];

    if (!response) return defaultOptions;

    // 尝试解析
    try {
      // 检查是否有 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.copywriting_list || defaultOptions;
      }

      // 按风格名分割
      const sections = response.split(/(?:亲民种草款|专业干货款|互动引流款)/);
      if (sections.length >= 4) {
        return [
          { style_name: '亲民种草款', content: sections[1]?.trim() || defaultOptions[0].content, tags: [`#${productName}`, '#种草'] },
          { style_name: '专业干货款', content: sections[2]?.trim() || defaultOptions[1].content, tags: [`#${productName}`, '#测评'] },
          { style_name: '互动引流款', content: sections[3]?.trim() || defaultOptions[2].content, tags: [`#${productName}`, '#互动'] }
        ];
      }
    } catch {
      // 解析失败，返回默认
    }

    return defaultOptions;
  }

  // ========== 协作记忆工具实现 ⭐ 新增 ==========

  /**
   * 工具15：更新协作记忆
   * 
   * 允许 Seed 2.0 Pro 更新我们的协作记忆文件
   * 确保工作进度不被丢失
   */
  private async updateCollaborationMemory(params: {
    section: 'progress' | 'decisions' | 'issues' | 'todos' | 'notes';
    content: string;
    action?: 'append' | 'replace' | 'delete';
  }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const fs = await import('fs/promises');
      const path = '/workspace/projects/WORK_MEMORY/seed2-memory.md';
      
      // 读取现有记忆
      let existingContent = '';
      try {
        existingContent = await fs.readFile(path, 'utf-8');
      } catch {
        // 文件不存在，创建新文件
      }

      // 根据 section 更新对应部分
      const timestamp = new Date().toISOString().split('T')[0];
      let newContent = existingContent;

      // 简单的时间戳标记
      const entry = `- [${timestamp}] ${params.content}`;

      switch (params.section) {
        case 'progress':
          // 查找 ## 当前工作进度 部分并追加
          if (existingContent.includes('#### 已完成')) {
            newContent = existingContent.replace(
              /(\n#### 已完成\n)/,
              `$1${entry}\n`
            );
          } else if (existingContent.includes('## 当前工作进度')) {
            newContent = existingContent.replace(
              /## 当前工作进度\n/,
              `## 当前工作进度\n\n#### 已完成\n${entry}\n`
            );
          }
          break;
          
        case 'decisions':
          if (existingContent.includes('### 重要决策记录')) {
            newContent = existingContent.replace(
              /(\n### 重要决策记录\n)/,
              `$1\n#### ${timestamp}\n${params.content}\n`
            );
          }
          break;
          
        case 'issues':
          if (existingContent.includes('#### 🔄 进行中')) {
            newContent = existingContent.replace(
              /(\n#### 🔄 进行中\n)/,
              `$1${entry}\n`
            );
          } else if (existingContent.includes('## 当前工作进度')) {
            newContent = existingContent.replace(
              /## 当前工作进度\n/,
              `## 当前工作进度\n\n#### 🔄 进行中\n${entry}\n`
            );
          }
          break;
          
        case 'todos':
          if (existingContent.includes('#### 📋 待办')) {
            newContent = existingContent.replace(
              /(\n#### 📋 待办\n)/,
              `$1- [ ] ${params.content}\n`
            );
          }
          break;
          
        case 'notes':
          // 追加到文件末尾
          newContent = existingContent + `\n\n## 协作笔记 (${timestamp})\n${params.content}`;
          break;
      }

      // 写入更新后的内容
      await fs.writeFile(path, newContent, 'utf-8');

      return {
        success: true,
        message: `已更新协作记忆: [${params.section}] ${params.content}`
      };
    } catch (error) {
      console.error('更新协作记忆失败:', error);
      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : '更新失败'
      };
    }
  }

  /**
   * 工具16：获取当前协作状态
   * 
   * 返回当前工作进度、待办事项、最近决策
   */
  private async getCollaborationStatus(): Promise<{
    success: boolean;
    data: {
      current_task: string;
      completed: string[];
      in_progress: string[];
      pending: string[];
      recent_decisions: string[];
    };
    error?: string;
  }> {
    try {
      const fs = await import('fs/promises');
      const path = '/workspace/projects/WORK_MEMORY/seed2-memory.md';
      
      let content = '';
      try {
        content = await fs.readFile(path, 'utf-8');
      } catch {
        return {
          success: true,
          data: {
            current_task: '未知',
            completed: [],
            in_progress: [],
            pending: [],
            recent_decisions: []
          }
        };
      }

      // 解析记忆文件
      const lines = content.split('\n');
      let currentSection = '';
      const completed: string[] = [];
      const inProgress: string[] = [];
      const pending: string[] = [];
      const decisions: string[] = [];

      for (const line of lines) {
        if (line.startsWith('#### 已完成')) currentSection = 'completed';
        else if (line.startsWith('#### 🔄')) currentSection = 'in_progress';
        else if (line.startsWith('#### 📋')) currentSection = 'pending';
        else if (line.startsWith('#### ')) currentSection = '';
        else if (line.startsWith('- [') && line.includes(']')) {
          const item = line.replace(/^- \[\d{4}-\d{2}-\d{2}\] /, '');
          if (currentSection === 'completed') completed.push(item);
          else if (currentSection === 'in_progress') inProgress.push(item);
          else if (currentSection === 'pending' && line.includes('[ ]')) {
            pending.push(item.replace('[ ] ', ''));
          }
        }
      }

      return {
        success: true,
        data: {
          current_task: inProgress[0] || '无',
          completed,
          in_progress: inProgress,
          pending,
          recent_decisions: decisions.slice(-3)
        }
      };
    } catch (error) {
      return {
        success: false,
        data: {
          current_task: '获取失败',
          completed: [],
          in_progress: [],
          pending: [],
          recent_decisions: []
        },
        error: error instanceof Error ? error.message : '获取失败'
      };
    }
  }

  // ========== 首帧图生成工具实现 ⭐ 新增 ==========

  /**
   * 工具14：生成首帧图
   * 
   * 根据脚本和商品图生成符合视频开头场景的首帧图
   * 支持图生图模式，保持商品特征
   */
  private async generateFirstFrame(params: {
    product_image_url: string;
    script_content: string;
    aspect_ratio?: string;
    style?: string;
    reference_style?: string;
  }): Promise<{
    success: boolean;
    data?: {
      image_url: string;
      image_id: string;
    };
    error?: string;
  }> {
    try {
      const result = await this.imageGenerationService.generateFirstFrame({
        productImageUrl: params.product_image_url,
        scriptContent: params.script_content,
        aspectRatio: params.aspect_ratio,
        style: params.style,
        referenceStyle: params.reference_style,
      });

      if (result.success && result.imageUrl) {
        return {
          success: true,
          data: {
            image_url: result.imageUrl,
            image_id: result.imageId || ''
          }
        };
      }

      return {
        success: false,
        error: result.error || '生成失败'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '首帧图生成失败'
      };
    }
  }

  // ========== 模板工具实现 ==========

  /**
   * 获取用户模板列表
   */
  private async getTemplates(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const result = await this.templateService.getUserTemplates(this.getUserId());
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取模板失败' };
    }
  }

  /**
   * 获取单个模板
   */
  private async getTemplate(templateId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const result = await this.templateService.getTemplate(templateId);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取模板失败' };
    }
  }

  /**
   * 创建模板
   */
  private async createTemplate(params: {
    template_name: string;
    category?: string;
    duration?: number;
    aspect_ratio?: string;
    style?: string;
    shots: Array<{ shot_time: string; content: string; transition: string; variables?: string[] }>;
    variable_desc?: Record<string, string>;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const result = await this.templateService.createTemplate({
        template_name: params.template_name,
        category: params.category || '',
        duration: params.duration || 8,
        aspect_ratio: params.aspect_ratio || '9:16',
        style: params.style || '默认',
        shots: params.shots.map(s => ({
          ...s,
          variables: s.variables || []
        })),
        variable_desc: params.variable_desc || {},
        created_by: this.getUserId()
      });
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '创建模板失败' };
    }
  }

  /**
   * 批量生成
   */
  private async batchGenerate(params: {
    template_id: string;
    data_rows: Array<Record<string, string>>;
    first_frame_url?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const templateResult = await this.templateService.getTemplate(params.template_id);
      if (!templateResult.success || !templateResult.data) {
        return { success: false, error: '模板不存在' };
      }

      const template = templateResult.data;
      const results: any[] = [];

      for (const row of params.data_rows) {
        const parseResult = this.templateService.parseTemplate(template, row);
        
        if (!parseResult.success) {
          results.push({
            success: false,
            error: parseResult.errors?.join(', ')
          });
          continue;
        }

        // 调用视频生成
        try {
          const videoResult = await this.seedance.textToVideo(parseResult.prompt, {
            model: 'doubao-seedance-2-0-260128' as any,
            duration: template.duration,
            ratio: template.aspect_ratio as any,
          });

          const taskId = (videoResult as any).id || (videoResult as any).task_id || '';
          
          results.push({
            success: true,
            taskId,
            prompt: parseResult.prompt
          });
        } catch (error) {
          results.push({
            success: false,
            error: error instanceof Error ? error.message : '提交失败'
          });
        }
      }

      // 更新使用次数
      await this.templateService.incrementUsage(params.template_id);

      return {
        success: true,
        data: {
          total: params.data_rows.length,
          results
        }
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '批量生成失败' };
    }
  }

  // ========== 会话管理工具实现 ⭐ 新增（任务4）==========

  /**
   * 任务4.1：获取当前会话 ID
   * 
   * 返回当前用户的会话 ID，如果不存在则创建新会话
   */
  private async getCurrentSession(): Promise<{
    success: boolean;
    data?: {
      session_id: string;
      messages?: any[];
    };
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      
      // 查询最近的活跃会话（24小时内）
      const { data: session, error } = await this.supabase
        .from('agent_sessions')
        .select('id, messages, updated_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (error && (error as any).code !== 'PGRST116') {
        console.error('获取会话失败:', error);
        return { success: false, error: (error as any).message || '获取失败' };
      }

      // 如果没有活跃会话，创建一个新会话
      if (!session) {
        const { data: newSession, error: createError } = await this.supabase
          .from('agent_sessions')
          .insert({
            user_id: userId,
            agent_type: 'creative_xiaohai',
            title: '新对话',
            status: 'active',
            message_count: 0
          })
          .select('id')
          .single();

        if (createError) {
          console.error('创建会话失败:', createError);
          return { success: false, error: (createError as any).message || '创建失败' };
        }

        return {
          success: true,
          data: {
            session_id: (newSession as any)?.id as string,
            messages: [] as any[]
          }
        };
      }

      return {
        success: true,
        data: {
          session_id: (session as any).id as string,
          messages: (session as any).messages as any[] || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '会话获取失败'
      };
    }
  }

  /**
   * 任务4.2：清除当前会话
   * 
   * 结束当前会话，创建新会话
   */
  private async clearCurrentSession(): Promise<{
    success: boolean;
    data?: {
      session_id: string;
    };
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      
      // 获取当前活跃会话
      const { data: currentSession } = await this.supabase
        .from('agent_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      // 如果有当前会话，标记为已结束
      if (currentSession) {
        await this.supabase
          .from('agent_sessions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSession.id);
      }

      // 创建新会话
      const { data: newSession, error } = await this.supabase
        .from('agent_sessions')
        .insert({
          user_id: userId,
          agent_type: 'creative_xiaohai',
          title: '新对话',
          status: 'active',
          message_count: 0
        })
        .select('id')
        .single();

      if (error) {
        console.error('创建新会话失败:', error);
        return { success: false, error: (error as any).message || '创建失败' };
      }

      return {
        success: true,
        data: {
          session_id: (newSession as any)?.id as string
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '会话清除失败'
      };
    }
  }

  // ========== 双笔记本系统：保存用户偏好（笔记本2号）==========

  /**
   * 任务22：保存用户偏好（新格式，带标签）
   * 
   * 用于双笔记本系统的笔记本2号
   * 参数：
   * - preference_type: aspect_ratio/duration/style/industry/product_tags/custom
   * - content: 偏好内容
   * - tags: 分类标签（可选）
   */
  private async saveCreativeUserPreference(
    params: {
      preference_type: 'aspect_ratio' | 'duration' | 'style' | 'industry' | 'product_tags' | 'custom';
      content: string;
      tags?: string[];
    }
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      const { preference_type, content, tags } = params;

      console.log(`📕 [笔记本2号] 保存用户偏好: ${preference_type} = ${content.substring(0, 50)}`);

      // 先删除同一类型的旧偏好，然后插入新的
      const { error: deleteError } = await this.supabase
        .from('creative_user_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('preference_type', preference_type);

      if (deleteError) {
        console.warn('📕 [笔记本2号] 删除旧偏好失败:', deleteError);
      }

      // 插入新偏好
      const { error: insertError } = await this.supabase
        .from('creative_user_preferences')
        .insert({
          user_id: userId,
          preference_type,
          content,
          tags: tags || null,
          last_updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('📕 [笔记本2号] 保存偏好失败:', insertError);
        return { success: false, error: insertError.message };
      }

      console.log('📕 [笔记本2号] 偏好保存成功');
      return { success: true };

    } catch (error) {
      console.error('📕 [笔记本2号] 保存偏好异常:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存失败'
      };
    }
  }

  // ========== 学习库工具（笔记本4号）==========

  /**
   * 任务23：获取用户学习库列表
   * 
   * 用于查询用户的学习库视频列表
   * 参数：
   * - page: 页码（默认1）
   * - pageSize: 每页数量（默认10）
   */
  async getLearningLibrary(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<{
    success: boolean;
    data?: {
      videos: Array<{
        id: string;
        video_name: string;
        video_url: string;
        video_type: string;
        video_style: string;
        summary: string;
        key_learnings: string[];
        created_at: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      const page = params?.page || 1;
      const pageSize = params?.pageSize || 10;
      const offset = (page - 1) * pageSize;

      const { data, error, count } = await this.supabase
        .from('learning_library')
        .select('id, video_name, video_url, video_type, video_style, summary, key_learnings, created_at', {
          count: 'exact'
        })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('获取学习库失败:', error);
        return { success: false, error: (error as any).message || '查询失败' };
      }

      return {
        success: true,
        data: {
          videos: data?.map((v: any) => ({
            id: v.id as string,
            video_name: v.video_name as string,
            video_url: v.video_url as string,
            video_type: (v.video_type as string) || '',
            video_style: (v.video_style as string) || '',
            summary: (v.summary as string) || '',
            key_learnings: (v.key_learnings as string[]) || [],
            created_at: v.created_at as string
          })) || [],
          total: (count as number) || 0,
          page,
          pageSize
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取学习库失败'
      };
    }
  }

  /**
   * 任务24：搜索学习库
   * 
   * 用于语义搜索学习库中的视频
   * 参数：
   * - query: 搜索关键词
   * - limit: 返回数量（默认5）
   */
  async searchLearningLibrary(params: {
    query: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      video_name: string;
      video_url: string;
      video_type: string;
      video_style: string;
      summary: string;
      key_learnings: string[];
      score?: number;
    }>;
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      const { query, limit = 5 } = params;

      // 先尝试关键词搜索
      const { data, error } = await this.supabase
        .from('learning_library')
        .select('id, video_name, video_url, video_type, video_style, summary, key_learnings')
        .eq('user_id', userId)
        .or(`video_name.ilike.%${query}%,video_style.ilike.%${query}%,summary.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        console.error('搜索学习库失败:', error);
        return { success: false, error: (error as any).message || '搜索失败' };
      }

      return {
        success: true,
        data: data?.map((v: any) => ({
          id: v.id as string,
          video_name: v.video_name as string,
          video_url: v.video_url as string,
          video_type: (v.video_type as string) || '',
          video_style: (v.video_style as string) || '',
          summary: (v.summary as string) || '',
          key_learnings: (v.key_learnings as string[]) || []
        })) || []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索学习库失败'
      };
    }
  }

  /**
   * 任务25：同步视频到学习库
   * 
   * 用于将视频同步到学习库（分析并保存）
   * 参数：
   * - video_url: 视频URL
   * - video_name: 视频名称（可选）
   */
  async syncToLibrary(params: {
    video_url: string;
    video_name?: string;
  }): Promise<{
    success: boolean;
    data?: {
      library_id: string;
      video_name: string;
      status: string;
    };
    error?: string;
  }> {
    try {
      const userId = this.getUserId();
      const { video_url, video_name } = params;

      // 检查是否已存在
      const { data: existing } = await this.supabase
        .from('learning_library')
        .select('id')
        .eq('user_id', userId)
        .eq('video_url', video_url)
        .single();

      if (existing) {
        const e = existing as any;
        return {
          success: true,
          data: {
            library_id: e.id as string,
            video_name: video_name || '已存在的视频',
            status: 'already_exists'
          }
        };
      }

      // 插入新记录
      const { data, error } = await this.supabase
        .from('learning_library')
        .insert({
          user_id: userId,
          video_name: video_name || '未命名视频',
          video_url: video_url,
          analysis_status: 'pending'
        })
        .select('id')
        .single();

      if (error) {
        console.error('同步到学习库失败:', error);
        return { success: false, error: (error as any).message || '同步失败' };
      }

      console.log('已同步视频到学习库:', (data as any)?.id);
      return {
        success: true,
        data: {
          library_id: (data as any)?.id as string,
          video_name: video_name || '未命名视频',
          status: 'synced'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '同步失败'
      };
    }
  }

  // ========== 记忆与进化工具实现 ==========

  private memoryService = new XiaohaiMemoryService();
  private evolutionService = new XiaohaiEvolutionService();

  /**
   * 工具26：保存用户记忆
   */
  async saveUserMemory(params: {
    content: string;
    memory_type: 'general' | 'preference' | 'experience' | 'rule' | 'document';
    keywords: string[];
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const userId = this.getUserId();
      const result = await this.memoryService.saveMemory(
        userId,
        params.content,
        params.memory_type,
        params.keywords
      );
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '保存记忆失败' };
    }
  }

  /**
   * 工具27：获取用户记忆
   */
  async getUserMemories(params: {
    query: string;
    memory_type?: string;
    limit?: number;
  }): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const userId = this.getUserId();
      const result = await this.memoryService.getMemories(
        userId,
        params.query,
        params.memory_type,
        params.limit || 10
      );
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取记忆失败' };
    }
  }

  /**
   * 工具28：搜索用户记忆
   */
  async searchUserMemories(params: {
    keyword: string;
    memory_type?: string;
  }): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const userId = this.getUserId();
      const result = await this.memoryService.searchMemories(
        userId,
        params.keyword,
        params.memory_type
      );
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '搜索记忆失败' };
    }
  }

  /**
   * 工具29：记录学习
   */
  async recordLearning(params: {
    record_type: 'correction' | 'success' | 'error' | 'improvement';
    content: string;
    original_content?: string;
    feedback?: string;
    score?: number;
    tags?: string[];
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const userId = this.getUserId();
      const result = await this.evolutionService.recordLearning(
        userId,
        params.record_type,
        params.content,
        {
          originalContent: params.original_content,
          feedback: params.feedback,
          score: params.score,
          tags: params.tags
        }
      );
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '记录学习失败' };
    }
  }

  /**
   * 工具30：获取学习记录
   */
  async getLearningRecords(params: {
    query?: string;
    record_type?: string;
    limit?: number;
  }): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const userId = this.getUserId();
      const result = await this.evolutionService.getLearningRecords(
        userId,
        params.query,
        params.record_type as any,
        params.limit || 10
      );
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '获取学习记录失败' };
    }
  }

  /**
   * 工具31：分析文件
   */
  async analyzeFile(params: {
    file_url: string;
    file_type: string;
    purpose?: string;
  }): Promise<{ success: boolean; data?: any; error?: string; message?: string }> {
    // 文件分析功能暂时返回占位信息
    // TODO: 后续实现完整的文件解析逻辑
    return {
      success: true,
      data: {
        file_url: params.file_url,
        file_type: params.file_type,
        purpose: params.purpose || 'general',
        message: '文件分析功能待实现'
      }
    };
  }
}

export default AgentToolsService;
