/**
 * 模型配置文件
 * 定义系统中使用的所有AI模型及其用途
 */

// ========== 模型类型 ==========

export interface ModelInfo {
  id: string;                  // 模型ID
  name: string;                // 显示名称
  provider: string;            // 提供商
  description: string;         // 描述
  capabilities: string[];      // 能力
  isDefault?: boolean;         // 是否默认
  speed?: 'fast' | 'standard' | 'slow';  // 速度
  quality?: 'standard' | 'high' | 'ultra'; // 质量
}

// ========== 模型定义 ==========

export const MODELS = {
  // ===== 大语言模型（大师/专家级） =====
  
  /** 多模态对话模型 - 大师版本（用于教学示范） */
  'doubao-seed-1-8-251228-master': {
    id: 'doubao-seed-1-8-251228',
    name: '豆包 Seed 1.8',
    provider: '字节跳动',
    description: '多模态智能体优化模型，支持工具调用和多轮对话。作为大师模型提供高质量示范输出',
    capabilities: ['对话理解', '脚本创作', '创意生成', '工具调用', '深度推理'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** 多模态对话模型 - 智能体版本（学习中） */
  'doubao-seed-1-8-251228-agent': {
    id: 'doubao-seed-1-8-251228',
    name: '创意小海智能体',
    provider: '字节跳动',
    description: '正在学习中的智能体，会观察大师模型的输出并逐步提升能力',
    capabilities: ['对话理解', '脚本创作', '创意生成', '持续学习'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** 视觉模型 - 大师版本 */
  'doubao-seed-1-6-vision-250815-master': {
    id: 'doubao-seed-1-6-vision-250815',
    name: '豆包视觉模型',
    provider: '字节跳动',
    description: '视觉理解模型，支持图片和视频内容分析。作为大师模型提供专业分析示范',
    capabilities: ['图片理解', '视频分析', '场景识别', '风格提取', '专业分析'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** 视觉模型 - 智能体版本 */
  'doubao-seed-1-6-vision-250815-agent': {
    id: 'doubao-seed-1-6-vision-250815',
    name: '视频分析智能体',
    provider: '字节跳动',
    description: '正在学习中的视觉分析智能体，会观察大师分析并逐步提升理解能力',
    capabilities: ['图片理解', '视频分析', '场景识别', '持续学习'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** 轻量级模型 - 用于简单任务 */
  'doubao-seed-1-6-lite-251015': {
    id: 'doubao-seed-1-6-lite-251015',
    name: '豆包 Seed Lite',
    provider: '字节跳动',
    description: '轻量级模型，适合快速响应的简单任务',
    capabilities: ['简单对话', '快速响应'],
    isDefault: false,
    speed: 'fast',
    quality: 'standard',
  } as ModelInfo,
  
  /** 深度推理模型 */
  'doubao-seed-2-0-pro-260215': {
    id: 'doubao-seed-2-0-pro-260215',
    name: '豆包 Seed 2.0 Pro',
    provider: '字节跳动',
    description: '旗舰模型，适合复杂推理和多步骤规划',
    capabilities: ['深度推理', '复杂规划', '多步骤任务'],
    isDefault: false,
    speed: 'slow',
    quality: 'ultra',
  } as ModelInfo,
  
  // ===== 图片生成 =====
  
  /** 图片生成服务 - 大师版本 */
  'image-generation-master': {
    id: 'image-generation',
    name: 'AI 图片生成',
    provider: '字节跳动',
    description: '高质量图片生成服务，支持2K/4K分辨率。专业级图像生成能力',
    capabilities: ['文生图', '图生图', '风格转换', '高分辨率'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** 图片生成服务 - 智能体版本 */
  'image-generation-agent': {
    id: 'image-generation',
    name: '图片生成智能体',
    provider: '字节跳动',
    description: '正在学习中的图片生成智能体，会根据用户反馈持续优化生成效果',
    capabilities: ['文生图', '图生图', '风格转换', '持续学习'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  // ===== 视频生成模型（工具型，不支持双层系统） =====
  
  /** Seedance 2.0 标准版 */
  'doubao-seedance-2-0-260128': {
    id: 'doubao-seedance-2-0-260128',
    name: 'Seedance 2.0',
    provider: '字节跳动',
    description: '视频生成模型标准版，支持文生视频、图生视频、视频延长。直接调用API，无学习过程',
    capabilities: ['文生视频', '图生视频', '视频延长', '视频编辑'],
    isDefault: true,
    speed: 'standard',
    quality: 'high',
  } as ModelInfo,
  
  /** Seedance 2.0 快速版 */
  'doubao-seedance-2-0-fast-260128': {
    id: 'doubao-seedance-2-0-fast-260128',
    name: 'Seedance 2.0 Fast',
    provider: '字节跳动',
    description: '视频生成模型快速版，生成速度更快。直接调用API',
    capabilities: ['文生视频', '图生视频', '快速生成'],
    isDefault: false,
    speed: 'fast',
    quality: 'standard',
  } as ModelInfo,
  
} as const;

// ========== 任务类型与模型映射 ==========

export interface TaskModelMapping {
  taskName: string;           // 任务名称
  taskType: string;           // 任务类型
  models: {
    master: ModelInfo;        // 大模型（大师）
    agent?: ModelInfo;        // 智能体使用的模型
  };
  description: string;        // 任务描述
  supportsDualLayer: boolean; // 是否支持双层能力系统
}

export const TASK_MODEL_MAPPINGS: TaskModelMapping[] = [
  {
    taskName: '脚本创作',
    taskType: 'script_generation',
    models: {
      master: MODELS['doubao-seed-1-8-251228-master'],
      agent: MODELS['doubao-seed-1-8-251228-agent'],
    },
    description: '根据用户需求创作视频分镜脚本',
    supportsDualLayer: true,
  },
  {
    taskName: '视频分析',
    taskType: 'video_analysis',
    models: {
      master: MODELS['doubao-seed-1-6-vision-250815-master'],
      agent: MODELS['doubao-seed-1-6-vision-250815-agent'],
    },
    description: '分析视频内容、风格、镜头语言',
    supportsDualLayer: true,
  },
  {
    taskName: 'Prompt优化',
    taskType: 'prompt_optimization',
    models: {
      master: MODELS['doubao-seed-1-8-251228-master'],
      agent: MODELS['doubao-seed-1-8-251228-agent'],
    },
    description: '将中文描述转换为英文视频生成提示词',
    supportsDualLayer: true,
  },
  {
    taskName: '首帧图片生成',
    taskType: 'first_frame_generation',
    models: {
      master: MODELS['image-generation-master'],
      agent: MODELS['image-generation-agent'],
    },
    description: '生成视频首帧参考图片',
    supportsDualLayer: true,
  },
  {
    taskName: '创意建议',
    taskType: 'creative_suggestion',
    models: {
      master: MODELS['doubao-seed-1-8-251228-master'],
      agent: MODELS['doubao-seed-1-8-251228-agent'],
    },
    description: '提供视频创意和风格建议',
    supportsDualLayer: true,
  },
  {
    taskName: '视频生成',
    taskType: 'video_generation',
    models: {
      master: MODELS['doubao-seedance-2-0-260128'],
    },
    description: '根据文本或图片生成视频（直接调用API，无学习过程）',
    supportsDualLayer: false,
  },
  {
    taskName: '视频延长',
    taskType: 'video_extension',
    models: {
      master: MODELS['doubao-seedance-2-0-260128'],
    },
    description: '将短视频延长为长视频（直接调用API）',
    supportsDualLayer: false,
  },
];

// ========== 辅助函数 ==========

/**
 * 获取任务的模型信息
 */
export function getTaskModelInfo(taskType: string): TaskModelMapping | undefined {
  return TASK_MODEL_MAPPINGS.find(t => t.taskType === taskType);
}

/**
 * 获取模型信息
 */
export function getModelInfo(modelId: string): ModelInfo | undefined {
  return MODELS[modelId as keyof typeof MODELS];
}

/**
 * 获取所有支持双层系统的任务
 */
export function getDualLayerTasks(): TaskModelMapping[] {
  return TASK_MODEL_MAPPINGS.filter(t => t.supportsDualLayer);
}

/**
 * 获取所有视频生成相关任务
 */
export function getVideoGenerationTasks(): TaskModelMapping[] {
  return TASK_MODEL_MAPPINGS.filter(t => !t.supportsDualLayer);
}

/**
 * 格式化模型信息为显示文本
 */
export function formatModelDisplay(model: ModelInfo): string {
  const speedText = {
    fast: '快速',
    standard: '标准',
    slow: '深度',
  }[model.speed || 'standard'];
  
  const qualityText = {
    standard: '标准',
    high: '高清',
    ultra: '超清',
  }[model.quality || 'standard'];
  
  return `${model.name} (${speedText} · ${qualityText})`;
}
