/**
 * 创意小海工具定义 V3
 * 
 * 基于 Seed 2.0 Function Calling 的简化架构
 * 
 * 核心思路：
 * 1. 使用标准 Function Calling 格式
 * 2. 工具定义简洁，参数清晰
 * 3. 执行逻辑与定义分离
 */

import { VideoLearningService } from './video-learning-service';
import { ScriptGeneratorService, type RegenerateScriptRequest } from './script-generator-service';
import { SeedanceClient, type CreateTaskRequest } from './seedance-client';
import { XiaohaiMemoryService, type MemoryType } from './xiaohai-memory-service';
import { XiaohaiEvolutionService, type RecordType } from './xiaohai-evolution-service';

// ========== 类型定义 ==========

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: {
    type: string;
  };
  default?: string | number | boolean;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
}

// ========== 工具定义（Function Calling 格式）==========

/**
 * 工具1：分析视频
 * 
 * 分析用户上传的参考视频，提取风格、场景、镜头语言等关键特征
 */
export const analyzeVideoTool: ToolDefinition = {
  name: 'analyze_video',
  description: '分析视频内容，提取风格、场景、镜头语言、节奏等关键特征。用于学习优秀视频的创作手法。',
  parameters: {
    type: 'object',
    properties: {
      video_url: {
        type: 'string',
        description: '待分析视频的URL地址（支持抖音、快手、B站等平台链接）'
      },
      video_name: {
        type: 'string',
        description: '视频名称（可选，用于标识）'
      }
    },
    required: ['video_url']
  }
};

/**
 * 工具2：生成脚本
 * 
 * 根据用户需求和参考素材生成视频分镜脚本
 */
export const generateScriptTool: ToolDefinition = {
  name: 'generate_script',
  description: '根据用户需求和参考素材生成专业的视频分镜脚本。每个脚本包含画面描述、镜头语言、时长等。',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: '产品名称或视频主题'
      },
      style: {
        type: 'string',
        description: '视频风格偏好，如：现代简约、科技感、复古、温馨等'
      },
      duration: {
        type: 'number',
        description: '视频时长（秒），默认8秒'
      },
      reference: {
        type: 'string',
        description: '参考信息（可选），可以是分析结果或用户指定的参考'
      }
    },
    required: ['product_name']
  }
};

/**
 * 工具3：重新生成脚本
 * 
 * 根据用户反馈调整并重新生成脚本
 */
export const regenerateScriptTool: ToolDefinition = {
  name: 'regenerate_script',
  description: '根据用户反馈重新生成脚本，支持调整风格、时长、内容等。',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: '产品名称或视频主题'
      },
      feedback: {
        type: 'string',
        description: '用户反馈，说明需要调整的内容'
      },
      style: {
        type: 'string',
        description: '新的视频风格偏好'
      },
      duration: {
        type: 'number',
        description: '新的视频时长（秒）'
      }
    },
    required: ['product_name', 'feedback']
  }
};

/**
 * 工具4：生成视频
 * 
 * 调用 Seedance 2.0 生成视频
 */
export const generateVideoTool: ToolDefinition = {
  name: 'generate_video',
  description: '调用 Seedance 2.0 生成视频。根据脚本内容生成高质量视频。',
  parameters: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: '视频脚本内容，描述视频的画面、动作、风格等'
      },
      first_frame_url: {
        type: 'string',
        description: '首帧图片URL（可选），用于图生视频'
      },
      duration: {
        type: 'number',
        description: '视频时长（秒），可选'
      }
    },
    required: ['script']
  }
};

/**
 * 工具5：查询商品参考
 * 
 * 从商品图库查询相关商品的参考图片
 */
export const getProductReferenceTool: ToolDefinition = {
  name: 'get_product_reference',
  description: '从商品图库查询相关商品的参考图片，用于视频创作参考。',
  parameters: {
    type: 'object',
    properties: {
      product_name: {
        type: 'string',
        description: '商品名称'
      }
    },
    required: ['product_name']
  }
};

/**
 * 工具6：获取用户偏好
 * 
 * 获取用户的历史偏好设置，用于个性化创作
 */
export const getUserPreferencesTool: ToolDefinition = {
  name: 'get_user_preferences',
  description: '获取用户的历史创作偏好，包括常用风格、时长等设置。',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  }
};

/**
 * 工具7：保存用户偏好
 * 
 * 保存用户的创作偏好设置
 */
export const saveUserPreferencesTool: ToolDefinition = {
  name: 'save_user_preferences',
  description: '保存用户的创作偏好设置，用于下次创作参考。',
  parameters: {
    type: 'object',
    properties: {
      style: {
        type: 'string',
        description: '偏好的视频风格'
      },
      duration: {
        type: 'number',
        description: '偏好的视频时长（秒）'
      }
    },
    required: ['style']
  }
};

// ========== 记忆与进化工具（新增）==========

/**
 * 工具8：保存用户记忆
 * 
 * 保存用户的重要信息到长期记忆
 */
export const saveUserMemoryTool: ToolDefinition = {
  name: 'saveUserMemory',
  description: '保存用户的重要信息到长期记忆，如用户偏好、工作习惯、创作风格等。LLM自主判断是否保存。',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: '要保存的记忆内容，完整描述用户信息'
      },
      memory_type: {
        type: 'string',
        enum: ['general', 'preference', 'experience', 'rule', 'document'],
        description: '记忆类型：general通用/preference偏好/experience经验/rule规则/document文档'
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: '关键词数组，用于后续检索'
      }
    },
    required: ['content', 'memory_type', 'keywords']
  }
};

/**
 * 工具9：获取用户记忆
 * 
 * 获取用户历史记忆，按相关性排序
 */
export const getUserMemoriesTool: ToolDefinition = {
  name: 'getUserMemories',
  description: '获取用户历史记忆，用于了解用户偏好、工作习惯等。自动按相关性排序。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '当前对话主题或问题，用于匹配相关记忆'
      },
      memory_type: {
        type: 'string',
        enum: ['all', 'general', 'preference', 'experience', 'rule', 'document'],
        description: '记忆类型过滤，默认all'
      },
      limit: {
        type: 'integer',
        description: '返回数量，默认10'
      }
    },
    required: ['query']
  }
};

/**
 * 工具10：搜索用户记忆
 * 
 * 搜索用户的特定记忆
 */
export const searchUserMemoriesTool: ToolDefinition = {
  name: 'searchUserMemories',
  description: '搜索用户的特定记忆，支持关键词精确匹配。',
  parameters: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词'
      },
      memory_type: {
        type: 'string',
        enum: ['general', 'preference', 'experience', 'rule', 'document'],
        description: '记忆类型过滤'
      }
    },
    required: ['keyword']
  }
};

/**
 * 工具11：记录学习
 * 
 * 从用户反馈中学习，记录纠正和成功经验
 */
export const recordLearningTool: ToolDefinition = {
  name: 'recordLearning',
  description: '记录学习内容，包括用户纠正、成功经验、错误教训等。用于智能体持续进化。',
  parameters: {
    type: 'object',
    properties: {
      record_type: {
        type: 'string',
        enum: ['correction', 'success', 'error', 'improvement'],
        description: '记录类型：correction纠正/success成功/error错误/improvement自我优化'
      },
      content: {
        type: 'string',
        description: '学习内容摘要'
      },
      original_content: {
        type: 'string',
        description: '原始内容（被纠正的回复或失败的操作）'
      },
      feedback: {
        type: 'string',
        description: '用户反馈内容'
      },
      score: {
        type: 'integer',
        description: '评分（1-5），用于调整置信度'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: '标签数组'
      }
    },
    required: ['record_type', 'content']
  }
};

/**
 * 工具12：获取学习记录
 * 
 * 获取历史学习记录
 */
export const getLearningRecordsTool: ToolDefinition = {
  name: 'getLearningRecords',
  description: '获取历史学习记录，包括纠正、成功、错误等。用于理解用户偏好和避免重复犯错。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '查询主题（可选）'
      },
      record_type: {
        type: 'string',
        enum: ['correction', 'success', 'error', 'improvement'],
        description: '记录类型过滤'
      },
      limit: {
        type: 'integer',
        description: '返回数量，默认10'
      }
    },
    required: []
  }
};

/**
 * 工具13：分析文件
 * 
 * 分析用户上传的文件内容
 */
export const analyzeFileTool: ToolDefinition = {
  name: 'analyzeFile',
  description: '分析用户上传的文件（PDF、Word、Excel、TXT等），提取关键信息供后续创作参考。',
  parameters: {
    type: 'object',
    properties: {
      file_url: {
        type: 'string',
        description: '文件URL地址'
      },
      file_type: {
        type: 'string',
        enum: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'md', 'image'],
        description: '文件类型'
      },
      purpose: {
        type: 'string',
        description: '分析目的（可选），如"提取创作素材"、"学习写作风格"等'
      }
    },
    required: ['file_url', 'file_type']
  }
};

/**
 * 工具：联网搜索
 * 
 * 联网搜索信息，返回搜索结果供分析和使用
 */
export const webSearchTool: ToolDefinition = {
  name: 'webSearch',
  description: '联网搜索最新信息。当需要获取实时数据、验证事实、了解最新资讯时使用。注意：需要用户开启联网模式后才能使用。',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词或问题'
      },
      count: {
        type: 'integer',
        description: '返回结果数量，默认5条',
        default: 5
      }
    },
    required: ['query']
  }
};

// ========== 工具列表（导出）==========

export const xiaohaiToolsV3: Record<string, ToolDefinition> = {
  analyze_video: analyzeVideoTool,
  generate_script: generateScriptTool,
  regenerate_script: regenerateScriptTool,
  generate_video: generateVideoTool,
  get_product_reference: getProductReferenceTool,
  get_user_preferences: getUserPreferencesTool,
  save_user_preferences: saveUserPreferencesTool,
  // 新增记忆与进化工具
  saveUserMemory: saveUserMemoryTool,
  getUserMemories: getUserMemoriesTool,
  searchUserMemories: searchUserMemoriesTool,
  recordLearning: recordLearningTool,
  getLearningRecords: getLearningRecordsTool,
  analyzeFile: analyzeFileTool,
  webSearch: webSearchTool
};

// ========== 工具执行函数 ==========

/**
 * 工具执行器 V3
 * 
 * 简化版：工具定义和执行分离，更清晰的架构
 */
export class ToolExecutorV3 {
  private headers?: Record<string, string>;
  private userId: string | null = null;

  constructor(headers?: Record<string, string>) {
    this.headers = headers;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string | null) {
    this.userId = userId;
  }

  /**
   * 执行工具
   */
  async execute(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    console.log(`🔧 [V3工具执行] ${toolName}`, params);

    try {
      switch (toolName) {
        // 原有工具
        case 'analyze_video':
          return await this.analyzeVideo(params as { video_url: string; video_name?: string });
        case 'generate_script':
          return await this.generateScript(params as {
            product_name: string;
            style?: string;
            duration?: number;
            reference?: string;
          });
        case 'regenerate_script':
          return await this.regenerateScript(params as {
            product_name: string;
            feedback: string;
            style?: string;
            duration?: number;
          });
        case 'generate_video':
          return await this.generateVideo(params as {
            script: string;
            first_frame_url?: string;
            duration?: number;
          });
        case 'get_product_reference':
          return await this.getProductReference(params as { product_name: string });
        case 'get_user_preferences':
          return await this.getUserPreferences();
        case 'save_user_preferences':
          return await this.saveUserPreferences(params as { style?: string; duration?: number });
        // 新增记忆与进化工具
        case 'saveUserMemory':
          return await this.saveUserMemory(params as { content: string; memory_type: string; keywords: string[] });
        case 'getUserMemories':
          return await this.getUserMemories(params as { query: string; memory_type?: string; limit?: number });
        case 'searchUserMemories':
          return await this.searchUserMemories(params as { keyword: string; memory_type?: string });
        case 'recordLearning':
          return await this.recordLearning(params as {
            record_type: string;
            content: string;
            original_content?: string;
            feedback?: string;
            score?: number;
            tags?: string[];
          });
        case 'getLearningRecords':
          return await this.getLearningRecords(params as { query?: string; record_type?: string; limit?: number });
        case 'analyzeFile':
          return await this.analyzeFile(params as { file_url: string; file_type: string; purpose?: string });
        case 'webSearch':
          return await this.webSearch(params as { query: string; count?: number });
        default:
          return { success: false, error: `未知工具：${toolName}` };
      }
    } catch (error) {
      console.error(`❌ [V3工具执行失败] ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具执行失败'
      };
    }
  }

  /**
   * 分析视频
   */
  private async analyzeVideo(params: { video_url: string; video_name?: string }) {
    const service = new VideoLearningService(this.headers);
    const result = await service.analyzeVideo(params.video_url, params.video_name || '分析视频', this.headers);
    return {
      success: true,
      data: result,
      message: '视频分析完成'
    };
  }

  /**
   * 生成脚本
   */
  private async generateScript(params: {
    product_name: string;
    style?: string;
    duration?: number;
    reference?: string;
  }) {
    const service = new ScriptGeneratorService(this.headers ? new Headers() : undefined);
    const scripts = await service.generate({
      productName: params.product_name,
      style: params.style || '现代简约',
      duration: params.duration || 8,
      reference: params.reference || ''
    });
    return {
      success: true,
      data: scripts,
      message: `生成 ${scripts.length} 个脚本`
    };
  }

  /**
   * 重新生成脚本
   */
  private async regenerateScript(params: {
    product_name: string;
    feedback: string;
    style?: string;
    duration?: number;
  }) {
    const service = new ScriptGeneratorService(this.headers ? new Headers() : undefined);
    const regeneratePayload: RegenerateScriptRequest = {
      productName: params.product_name,
      feedback: params.feedback,
      adjustment: params.style || '保持原风格',
      previousScripts: [],
    };
    const scripts = await service.regenerate(regeneratePayload);
    return {
      success: true,
      data: scripts,
      message: `根据反馈重新生成 ${scripts.length} 个脚本`
    };
  }

  /**
   * 生成视频
   */
  private async generateVideo(params: {
    script: string;
    first_frame_url?: string;
    duration?: number;
  }) {
    const client = new SeedanceClient();
    const taskPayload: CreateTaskRequest = {
      model: 'doubao-seedance-2-0-260128',
      content: [{ type: 'text', text: params.script }],
      duration: params.duration
    };
    const task = await client.createTask(taskPayload);
    return {
      success: true,
      data: {
        task_id: task.id,
        status: task.status
      },
      message: '视频生成任务已创建'
    };
  }

  /**
   * 查询商品参考
   */
  private async getProductReference(params: { product_name: string }) {
    // TODO: 实现商品图库查询
    return {
      success: true,
      data: {
        product_name: params.product_name,
        images: []
      },
      message: '商品参考查询'
    };
  }

  /**
   * 获取用户偏好
   */
  private async getUserPreferences() {
    // TODO: 实现用户偏好查询
    return {
      success: true,
      data: {
        style: '现代简约',
        duration: 8
      },
      message: '用户偏好'
    };
  }

  /**
   * 保存用户偏好
   */
  private async saveUserPreferences(_params: { style?: string; duration?: number }) {
    void _params;
    // TODO: 实现用户偏好保存
    return {
      success: true,
      message: '偏好已保存'
    };
  }

  // ========== 新增记忆与进化工具实现 ==========

  /**
   * 保存用户记忆
   */
  private async saveUserMemory(params: {
    content: string;
    memory_type: string;
    keywords: string[];
  }) {
    if (!this.userId) {
      return { success: false, error: '用户未登录' };
    }

    const service = new XiaohaiMemoryService();
    const result = await service.saveMemory(
      this.userId,
      params.content,
      params.memory_type as MemoryType,
      params.keywords
    );

    return result;
  }

  /**
   * 获取用户记忆
   */
  private async getUserMemories(params: {
    query: string;
    memory_type?: string;
    limit?: number;
  }) {
    if (!this.userId) {
      return { success: false, error: '用户未登录' };
    }

    const service = new XiaohaiMemoryService();
    const result = await service.getMemories(
      this.userId,
      params.query,
      params.memory_type,
      params.limit || 10
    );

    return result;
  }

  /**
   * 搜索用户记忆
   */
  private async searchUserMemories(params: {
    keyword: string;
    memory_type?: string;
  }) {
    if (!this.userId) {
      return { success: false, error: '用户未登录' };
    }

    const service = new XiaohaiMemoryService();
    const result = await service.searchMemories(
      this.userId,
      params.keyword,
      params.memory_type
    );

    return result;
  }

  /**
   * 记录学习
   */
  private async recordLearning(params: {
    record_type: string;
    content: string;
    original_content?: string;
    feedback?: string;
    score?: number;
    tags?: string[];
  }) {
    if (!this.userId) {
      return { success: false, error: '用户未登录' };
    }

    const service = new XiaohaiEvolutionService();
    const result = await service.recordLearning(
      this.userId,
      params.record_type as RecordType,
      params.content,
      {
        originalContent: params.original_content,
        feedback: params.feedback,
        score: params.score,
        tags: params.tags
      }
    );

    return result;
  }

  /**
   * 获取学习记录
   */
  private async getLearningRecords(params: {
    query?: string;
    record_type?: string;
    limit?: number;
  }) {
    const service = new XiaohaiEvolutionService();
    const result = await service.getLearningRecords(
      this.userId,
      params.query,
      params.record_type as RecordType,
      params.limit || 10
    );

    return result;
  }

  /**
   * 分析文件
   */
  private async analyzeFile(params: {
    file_url: string;
    file_type: string;
    purpose?: string;
  }) {
    // 文件分析功能暂时返回占位信息
    // TODO: 后续实现完整的文件解析逻辑
    return {
      success: true,
      data: {
        file_url: params.file_url,
        file_type: params.file_type,
        purpose: params.purpose || 'general',
        message: '文件分析功能待实现'
      },
      message: '文件分析功能正在开发中'
    };
  }

  /**
   * 联网搜索
   */
  private async webSearch(params: { query: string; count?: number }) {
    const { query, count = 5 } = params;

    try {
      const response = await fetch('/api/search/web', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, count })
      });

      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          data: {
            query: data.query,
            count: data.results?.length || 0,
            results: data.results,
            summary: data.summary
          },
          message: `联网搜索完成，获取到 ${data.results?.length || 0} 条结果`
        };
      } else {
        return {
          success: false,
          error: data.error || '搜索失败'
        };
      }
    } catch (error) {
      console.error('[工具执行] 联网搜索失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '联网搜索失败'
      };
    }
  }
}

// ========== 工具注册（用于 LLM Function Calling）==========

/**
 * 获取所有工具定义（用于 LLM 的 function calling）
 */
export function getToolsForLLM(): unknown[] {
  return [
    // 原有工具
    {
      type: 'function',
      function: {
        name: 'analyze_video',
        description: analyzeVideoTool.description,
        parameters: analyzeVideoTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'generate_script',
        description: generateScriptTool.description,
        parameters: generateScriptTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'regenerate_script',
        description: regenerateScriptTool.description,
        parameters: regenerateScriptTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'generate_video',
        description: generateVideoTool.description,
        parameters: generateVideoTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_product_reference',
        description: getProductReferenceTool.description,
        parameters: getProductReferenceTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_user_preferences',
        description: getUserPreferencesTool.description,
        parameters: getUserPreferencesTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'save_user_preferences',
        description: saveUserPreferencesTool.description,
        parameters: saveUserPreferencesTool.parameters
      }
    },
    // 新增记忆与进化工具
    {
      type: 'function',
      function: {
        name: 'saveUserMemory',
        description: saveUserMemoryTool.description,
        parameters: saveUserMemoryTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'getUserMemories',
        description: getUserMemoriesTool.description,
        parameters: getUserMemoriesTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'searchUserMemories',
        description: searchUserMemoriesTool.description,
        parameters: searchUserMemoriesTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'recordLearning',
        description: recordLearningTool.description,
        parameters: recordLearningTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'getLearningRecords',
        description: getLearningRecordsTool.description,
        parameters: getLearningRecordsTool.parameters
      }
    },
    {
      type: 'function',
      function: {
        name: 'analyzeFile',
        description: analyzeFileTool.description,
        parameters: analyzeFileTool.parameters
      }
    },
    // 联网搜索工具
    {
      type: 'function',
      function: {
        name: 'webSearch',
        description: webSearchTool.description,
        parameters: webSearchTool.parameters
      }
    }
  ];
}
