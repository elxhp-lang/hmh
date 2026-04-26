/**
 * 脚本生成服务 ⭐ 优化版
 * 专门用于生成适配 Seedance 2.0 的视频脚本
 * 
 * 核心能力：
 * 1. 生成中文分镜脚本（用户可读）
 * 2. 生成英文提示词（Seedance 2.0 需要）
 * 3. 支持 reference_video 参数（同风格生成）
 */

import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 脚本接口 ⭐ 增强版
 */
export interface Script {
  id: string;
  content: string;       // 中文分镜脚本
  title: string;
  duration: number;       // 秒
  style: string;
  // ⭐ 新增：Seedance 2.0 专用字段
  prompt?: string;       // 英文提示词（用于 Seedance 生成）
  multimodal_params?: {
    first_frame_url?: string;
    reference_video?: string;
    reference_audio?: string;
  };
}

/**
 * 视频分析结果（用于生成参考风格的脚本）
 */
export interface VideoAnalysisForScript {
  videoStyle: string;
  styleKeywords: string[];
  cameraMovements: string[];
  transitions: string[];
  pacing: string;
  colorMood: string;
  lightingStyle: string;
}

/**
 * 重新生成请求
 */
export interface RegenerateScriptRequest {
  productName: string;
  feedback: string;
  adjustment: string;
  previousScripts: Script[];
}

/**
 * 脚本生成请求 ⭐ 增强版
 */
export interface GenerateScriptRequest {
  productName: string;
  style?: string;
  duration?: number;
  reference?: string;
  // ⭐ 新增：视频分析结果（用于同风格生成）
  videoAnalysis?: VideoAnalysisForScript;
  // ⭐ 新增：首帧图片
  firstFrameUrl?: string;
}

/**
 * 脚本生成服务类 ⭐ 优化版
 */
export class ScriptGeneratorService {
  private llmClient: LLMClient;

  constructor(headers?: Headers) {
    const config = new Config();
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : {};
    this.llmClient = new LLMClient(config, customHeaders);
  }

  /**
   * 生成3个不同风格的脚本 ⭐ 增强版
   * 包含中文分镜 + 英文提示词
   */
  async generate(request: GenerateScriptRequest): Promise<Script[]> {
    const { productName, style = '现代简约', duration = 8, reference = '', videoAnalysis, firstFrameUrl } = request;

    const prompt = this.buildGeneratePrompt(productName, style, duration, reference, videoAnalysis);

    const response = await this.llmClient.invoke([
      { role: 'system', content: SCRIPT_GENERATOR_SYSTEM_PROMPT_V2 },
      { role: 'user', content: prompt }
    ]);

    const content = response.content.toString().trim();
    return this.parseScripts(content, { videoAnalysis, firstFrameUrl });
  }

  /**
   * 根据用户反馈重新生成脚本
   */
  async regenerate(request: RegenerateScriptRequest): Promise<Script[]> {
    const { productName, feedback, adjustment, previousScripts } = request;

    const prompt = this.buildRegeneratePrompt(productName, feedback, adjustment, previousScripts);

    const response = await this.llmClient.invoke([
      { role: 'system', content: SCRIPT_GENERATOR_SYSTEM_PROMPT_V2 },
      { role: 'user', content: prompt }
    ]);

    const content = response.content.toString().trim();
    return this.parseScripts(content, {});
  }

  /**
   * 构建生成脚本提示词 ⭐ 增强版
   */
  private buildGeneratePrompt(
    productName: string,
    style: string,
    duration: number,
    reference: string,
    videoAnalysis?: VideoAnalysisForScript
  ): string {
    const hasVideoAnalysis = videoAnalysis && Object.keys(videoAnalysis).length > 0;
    
    return `
请为"${productName}"生成3个不同风格的短视频脚本。

## 产品信息
- 产品名称：${productName}
- 视频风格：${style}
- 视频时长：${duration}秒
- 参考素材：${reference || '无'}

${hasVideoAnalysis ? `
## ⭐ 参考视频风格（必须严格遵循）
这是用户提供的参考视频分析结果，生成脚本时必须遵循这些风格特征：

- **整体风格**: ${videoAnalysis.videoStyle}
- **风格关键词**: ${videoAnalysis.styleKeywords?.join(', ') || '无'}
- **镜头运动**: ${videoAnalysis.cameraMovements?.join(', ') || '无'}
- **转场方式**: ${videoAnalysis.transitions?.join(', ') || '无'}
- **节奏**: ${videoAnalysis.pacing}
- **色调**: ${videoAnalysis.colorMood}
- **光影**: ${videoAnalysis.lightingStyle}

**重要**：生成的脚本必须体现上述风格特征，让最终生成的视频与参考视频风格一致。
` : ''}

## 脚本要求
1. 每个脚本${duration}秒左右
2. 包含画面描述、人物动作、口播文字
3. 突出产品卖点
4. 风格各异，给用户更多选择
${hasVideoAnalysis ? '5. **必须遵循参考视频的风格特征**' : ''}

## 响应格式
请以JSON格式返回3个脚本：
\`\`\`json
[
  {
    "id": "1",
    "content": "中文分镜脚本描述（包含画面、动作、口播等）...",
    "title": "风格1标题",
    "duration": ${duration},
    "style": "风格描述",
    "prompt": "**英文提示词**（用于Seedance 2.0生成，必须是英文，100-200词，详细描述画面、动作、风格、氛围等，与参考视频风格保持一致）"
  },
  {
    "id": "2",
    "content": "中文分镜脚本描述...",
    "title": "风格2标题",
    "duration": ${duration},
    "style": "风格描述",
    "prompt": "**English prompt for Seedance 2.0 (must be in English, 100-200 words)**"
  },
  {
    "id": "3",
    "content": "中文分镜脚本描述...",
    "title": "风格3标题",
    "duration": ${duration},
    "style": "风格描述",
    "prompt": "**English prompt for Seedance 2.0 (must be in English, 100-200 words)**"
  }
]
\`\`\`

## ⭐ 英文提示词编写规范（必须遵守）
1. **语言**：必须是英文，中文会被拒绝
2. **长度**：100-200词
3. **内容**：详细描述画面、动作、风格、氛围
4. **风格**：与参考视频风格保持一致
5. **禁止**：描述真人人脸（Seedance 2.0 不支持）
6. **格式**：使用现在时，描述正在进行的状态
`;
  }

  /**
   * 构建重新生成脚本提示词
   */
  private buildRegeneratePrompt(
    productName: string,
    feedback: string,
    adjustment: string,
    previousScripts: Script[]
  ): string {
    const previousSummary = previousScripts
      .map(s => `- ${s.title}: ${s.content.substring(0, 100)}...`)
      .join('\n');

    return `
用户对之前的脚本不满意，请根据反馈重新生成3个脚本。

## 产品信息
- 产品名称：${productName}

## 用户反馈
- 原始反馈：${feedback}
- 调整方向：${adjustment}

## 之前的脚本
${previousSummary}

## 新脚本要求
1. 根据用户反馈进行针对性调整
2. 保持3个不同风格
3. 每个脚本8秒左右
4. 突出产品卖点

## 响应格式
请以JSON格式返回3个脚本：
\`\`\`json
[
  {
    "id": "1",
    "content": "完整的脚本内容...",
    "title": "风格1标题",
    "duration": 8,
    "style": "风格描述"
  },
  {
    "id": "2",
    "content": "完整的脚本内容...",
    "title": "风格2标题",
    "duration": 8,
    "style": "风格描述"
  },
  {
    "id": "3",
    "content": "完整的脚本内容...",
    "title": "风格3标题",
    "duration": 8,
    "style": "风格描述"
  }
]
\`\`\`
`;
  }

  /**
   * 解析脚本 ⭐ 增强版
   */
  private parseScripts(
    content: string, 
    context: { videoAnalysis?: VideoAnalysisForScript; firstFrameUrl?: string }
  ): Script[] {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      const scripts = JSON.parse(jsonString) as Script[];
      
      // 增强每个脚本：添加多模态参数
      return scripts.map(script => ({
        ...script,
        multimodal_params: {
          first_frame_url: context.firstFrameUrl,
          reference_video: context.videoAnalysis ? 'USE_ANALYSIS_RESULT' : undefined,
        }
      }));
    } catch (error) {
      console.error('[脚本生成器] 解析失败:', error);
      // 返回默认脚本
      return [
        {
          id: '1',
          content: '产品展示：开场特写 → 产品细节展示 → 使用场景 → 结尾LOGO',
          title: '经典风格',
          duration: 8,
          style: '标准展示',
          prompt: 'A product showcase video featuring elegant close-up shots of the product, transitioning to detailed views of key features, followed by lifestyle application scenarios. Cinematic lighting with soft side illumination, warm color tones, slow smooth camera movements including gentle push-ins and subtle pans. The pacing is moderate with smooth cross-fade transitions.',
        },
        {
          id: '2',
          content: '快速切换：产品快速展示 → 多角度特写 → 动态结尾',
          title: '快节奏风格',
          duration: 8,
          style: '动感活力',
          prompt: 'Fast-paced dynamic product video with quick cuts between multiple angles and perspectives. energetic mood with vibrant colors and dramatic lighting. Rapid camera movements including swift zooms and quick pans. Modern editing style with hard cuts and dynamic transitions. Youthful and energetic atmosphere.',
        },
        {
          id: '3',
          content: '故事叙述：问题出现 → 产品解决方案 → 满意结尾',
          title: '故事风格',
          duration: 8,
          style: '情感共鸣',
          prompt: 'Narrative-driven product video with storytelling arc. Opens with relatable scenario, transitions to product solution, ends with satisfying emotional payoff. Cinematic composition with balanced framing, soft natural lighting, warm color grading. Smooth dolly movements and gentle rack focus. Emotional and warm tone throughout.',
        }
      ];
    }
  }
}

/**
 * 脚本生成器系统提示词 ⭐ 增强版
 */
const SCRIPT_GENERATOR_SYSTEM_PROMPT_V2 = `
你是专业的短视频脚本生成专家，擅长创作吸引人的产品视频脚本。

## 你的专长
1. 深刻理解短视频创作规律
2. 能够捕捉产品核心卖点
3. 擅长创作不同风格的脚本
4. **精通 Seedance 2.0 视频生成模型，能够生成适配的英文提示词**

## ⭐ Seedance 2.0 提示词编写规范
1. **语言**：必须是英文（Seedance 只接受英文）
2. **长度**：100-200词
3. **内容**：详细描述画面、动作、风格、氛围
4. **风格**：与用户提供的参考视频风格保持一致
5. **禁止**：描述真人人脸（Seedance 2.0 不支持）
6. **格式**：使用现在时，描述正在进行的状态

## 提示词模板
\`\`\`
[主体] + [动作] + [场景] + [风格] + [镜头] + [光线] + [色调] + [节奏]

示例：
A sleek cosmetic product displayed on a minimalist white surface, rotating gently to show all angles. 
Soft studio lighting with subtle reflections on the glossy packaging. 
Clean modern aesthetic with pastel color accents. 
Smooth camera movement circling the product in a slow elegant orbit. 
Close-up macro shots reveal premium texture details. 
Calm relaxing atmosphere with gentle transitions between scenes.
\`\`\`

## 输出要求
- 始终返回3个不同风格的脚本
- 每个脚本包含：中文分镜（用户可读）+ 英文提示词（用于生成）
- 中文分镜要详细，包含画面、动作、口播
- 英文提示词要专业，符合 Seedance 2.0 的要求
`;

// 导出单例
export const scriptGeneratorService = new ScriptGeneratorService();
