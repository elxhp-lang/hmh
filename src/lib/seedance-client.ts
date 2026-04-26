/**
 * Seedance 2.0 API 客户端
 * 直接调用火山引擎 HTTP API，支持多模态参考、视频编辑、视频延长
 * 
 * API 文档: https://www.volcengine.com/docs/82379/1520758
 */

// 内容类型定义
export type ContentRole = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageUrlContent {
  type: 'image_url';
  image_url: {
    url: string;
  };
  role?: ContentRole;
}

export interface VideoUrlContent {
  type: 'video_url';
  video_url: {
    url: string;
  };
  role?: 'reference_video';
}

export interface AudioUrlContent {
  type: 'audio_url';
  audio_url: {
    url: string;
  };
  role?: 'reference_audio';
}

export type Content = TextContent | ImageUrlContent | VideoUrlContent | AudioUrlContent;

// 视频比例
export type VideoRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive';

// 分辨率
export type VideoResolution = '480p' | '720p';

// 模型类型
export type SeedanceModel = 'doubao-seedance-2-0-260128' | 'doubao-seedance-2-0-fast-260128';

// 任务状态
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

// 工具类型
export interface Tool {
  type: 'web_search';
}

// 创建任务请求
export interface CreateTaskRequest {
  model: SeedanceModel;
  content: Content[];
  generate_audio?: boolean;
  ratio?: VideoRatio;
  duration?: number; // 4-15秒
  watermark?: boolean;
  seed?: number;
  camerafixed?: boolean;
  tools?: Tool[];
}

// 创建任务响应
export interface CreateTaskResponse {
  id: string;
  model: string;
  status: TaskStatus;
  created_at?: number;
  updated_at?: number;
  error?: {
    code: string;
    message: string;
  };
}

// 获取任务响应
export interface GetTaskResponse {
  id: string;
  model: string;
  status: TaskStatus;
  content?: {
    video_url?: string;
    last_frame_url?: string;
  };
  seed?: number;
  resolution?: VideoResolution;
  ratio?: VideoRatio;
  duration?: number;
  framespersecond?: number;
  usage?: {
    completion_tokens?: number;
    total_tokens?: number;
    tool_usage?: {
      web_search?: number;
    };
  };
  created_at?: number;
  updated_at?: number;
  error?: {
    code: string;
    message: string;
  };
}

// 客户端配置
export interface SeedanceClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Seedance 2.0 客户端
 */
export class SeedanceClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config?: SeedanceClientConfig) {
    this.apiKey = config?.apiKey || process.env.ARK_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3';
    this.timeout = config?.timeout || 900000; // 15分钟默认超时
  }

  /**
   * 创建视频生成任务
   */
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    console.log('[Seedance] 创建任务请求:', JSON.stringify(request).substring(0, 500));
    
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Seedance] 创建任务失败:', response.status, error);
      throw new Error(`创建任务失败: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('[Seedance] 创建任务响应:', JSON.stringify(result).substring(0, 1000));
    
    return result;
  }

  /**
   * 获取任务状态
   */
  async getTask(taskId: string): Promise<GetTaskResponse> {
    console.log(`[Seedance] getTask: 查询任务 ${taskId}`);
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Seedance] getTask 失败: ${response.status} - ${error}`);
      throw new Error(`获取任务失败: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`[Seedance] getTask: 任务 ${taskId} 状态 = ${result.status}`);
    return result;
  }

  /**
   * 轮询等待任务完成
   * @param taskId 任务ID
   * @param pollInterval 轮询间隔（毫秒），默认30秒
   * @param maxWaitTime 最大等待时间（毫秒），默认15分钟
   * @param onStatusChange 状态变化回调
   */
  async waitForTask(
    taskId: string,
    pollInterval: number = 30000,
    maxWaitTime: number = 900000,
    onStatusChange?: (status: TaskStatus, task: GetTaskResponse) => void
  ): Promise<GetTaskResponse> {
    const startTime = Date.now();
    console.log(`[Seedance] 开始轮询任务 ${taskId}`);

    while (Date.now() - startTime < maxWaitTime) {
      const task = await this.getTask(taskId);
      console.log(`[Seedance] 轮询任务 ${taskId}, 状态: ${task.status}`);
      
      if (onStatusChange) {
        onStatusChange(task.status, task);
      }

      if (task.status === 'succeeded') {
        console.log(`[Seedance] 任务 ${taskId} 成功完成`);
        return task;
      }

      if (task.status === 'failed' || task.status === 'cancelled') {
        console.error(`[Seedance] 任务 ${taskId} 失败:`, task.error);
        throw new Error(`任务${task.status}: ${task.error?.message || '未知错误'}`);
      }

      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.error(`[Seedance] 任务 ${taskId} 超时`);
    throw new Error('任务超时');
  }

  /**
   * 创建任务并等待完成
   */
  async generateVideo(
    request: CreateTaskRequest,
    onStatusChange?: (status: TaskStatus, task: GetTaskResponse) => void
  ): Promise<GetTaskResponse> {
    const createResponse = await this.createTask(request);
    return this.waitForTask(createResponse.id, 30000, this.timeout, onStatusChange);
  }

  // ========== 便捷方法 ==========

  /**
   * 文生视频
   */
  async textToVideo(
    prompt: string,
    options?: {
      model?: SeedanceModel;
      duration?: number;
      ratio?: VideoRatio;
      generateAudio?: boolean;
      watermark?: boolean;
      webSearch?: boolean;
    }
  ): Promise<GetTaskResponse> {
    const content: Content[] = [{ type: 'text', text: prompt }];
    
    const request: CreateTaskRequest = {
      model: options?.model || 'doubao-seedance-2-0-260128',
      content,
      duration: options?.duration || 5,
      ratio: options?.ratio || '16:9',
      generate_audio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    };

    if (options?.webSearch) {
      request.tools = [{ type: 'web_search' }];
    }

    return this.generateVideo(request);
  }

  /**
   * 图生视频 - 首帧
   */
  async imageToVideo(
    imageUrl: string,
    prompt: string,
    options?: {
      model?: SeedanceModel;
      duration?: number;
      ratio?: VideoRatio;
      generateAudio?: boolean;
      watermark?: boolean;
      lastFrameUrl?: string; // 尾帧图片
    }
  ): Promise<GetTaskResponse> {
    const content: Content[] = [];
    
    // 首帧图片
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
      role: 'first_frame',
    });
    
    // 尾帧图片（可选）
    if (options?.lastFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: options.lastFrameUrl },
        role: 'last_frame',
      });
    }
    
    // 文本提示词
    content.push({ type: 'text', text: prompt });

    const request: CreateTaskRequest = {
      model: options?.model || 'doubao-seedance-2-0-260128',
      content,
      duration: options?.duration || 5,
      ratio: options?.ratio || '16:9',
      generate_audio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    };

    return this.generateVideo(request);
  }

  /**
   * 多模态参考生成视频
   * 支持图片参考、视频参考、音频参考
   */
  async multiModalVideo(
    prompt: string,
    options?: {
      model?: SeedanceModel;
      duration?: number;
      ratio?: VideoRatio;
      generateAudio?: boolean;
      watermark?: boolean;
      referenceImages?: string[]; // 参考图片URL列表
      referenceVideos?: string[]; // 参考视频URL列表
      referenceAudios?: string[]; // 参考音频URL列表
      firstFrameUrl?: string; // 首帧图片
      lastFrameUrl?: string; // 尾帧图片
    }
  ): Promise<GetTaskResponse> {
    const content: Content[] = [];
    
    // 首帧图片
    if (options?.firstFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: options.firstFrameUrl },
        role: 'first_frame',
      });
    }
    
    // 尾帧图片
    if (options?.lastFrameUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: options.lastFrameUrl },
        role: 'last_frame',
      });
    }
    
    // 参考图片
    if (options?.referenceImages) {
      for (const url of options.referenceImages) {
        content.push({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image',
        });
      }
    }
    
    // 参考视频
    if (options?.referenceVideos) {
      for (const url of options.referenceVideos) {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: 'reference_video',
        });
      }
    }
    
    // 参考音频
    if (options?.referenceAudios) {
      for (const url of options.referenceAudios) {
        content.push({
          type: 'audio_url',
          audio_url: { url },
          role: 'reference_audio',
        });
      }
    }
    
    // 文本提示词
    content.push({ type: 'text', text: prompt });

    const request: CreateTaskRequest = {
      model: options?.model || 'doubao-seedance-2-0-260128',
      content,
      duration: options?.duration || 5,
      ratio: options?.ratio || '16:9',
      generate_audio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    };

    return this.generateVideo(request);
  }

  /**
   * 视频编辑
   * @param videoUrl 待编辑的视频URL
   * @param prompt 编辑指令
   */
  async editVideo(
    videoUrl: string,
    prompt: string,
    options?: {
      model?: SeedanceModel;
      duration?: number;
      ratio?: VideoRatio;
      generateAudio?: boolean;
      watermark?: boolean;
      referenceImages?: string[]; // 参考图片（用于替换等）
    }
  ): Promise<GetTaskResponse> {
    const content: Content[] = [];
    
    // 参考视频
    content.push({
      type: 'video_url',
      video_url: { url: videoUrl },
      role: 'reference_video',
    });
    
    // 参考图片
    if (options?.referenceImages) {
      for (const url of options.referenceImages) {
        content.push({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image',
        });
      }
    }
    
    // 编辑指令
    content.push({ type: 'text', text: prompt });

    const request: CreateTaskRequest = {
      model: options?.model || 'doubao-seedance-2-0-260128',
      content,
      duration: options?.duration || 5,
      ratio: options?.ratio || '16:9',
      generate_audio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    };

    return this.generateVideo(request);
  }

  /**
   * 视频延长
   * @param videoUrls 视频URL列表（1-3个）
   * @param prompt 延长指令
   */
  async extendVideo(
    videoUrls: string[],
    prompt: string,
    options?: {
      model?: SeedanceModel;
      duration?: number;
      ratio?: VideoRatio;
      generateAudio?: boolean;
      watermark?: boolean;
    }
  ): Promise<GetTaskResponse> {
    if (videoUrls.length === 0 || videoUrls.length > 3) {
      throw new Error('视频数量必须在1-3个之间');
    }

    const content: Content[] = [];
    
    // 参考视频
    for (const url of videoUrls) {
      content.push({
        type: 'video_url',
        video_url: { url },
        role: 'reference_video',
      });
    }
    
    // 延长指令
    content.push({ type: 'text', text: prompt });

    const request: CreateTaskRequest = {
      model: options?.model || 'doubao-seedance-2-0-260128',
      content,
      duration: options?.duration || 8,
      ratio: options?.ratio || '16:9',
      generate_audio: options?.generateAudio ?? true,
      watermark: options?.watermark ?? false,
    };

    return this.generateVideo(request);
  }
}

// 导出单例
export const seedanceClient = new SeedanceClient();
