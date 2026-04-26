/**
 * 图片生成服务
 * 使用豆包 SeeDream 模型生成高质量图片
 * 
 * 核心能力：
 * 1. 文生图 (text-to-image)
 * 2. 图生图 (image-to-image) - 用于首帧图生成
 * 3. 支持 2K/4K 尺寸
 */

import { ImageGenerationClient, Config } from 'coze-coding-dev-sdk';
import { LearningLibraryStorage } from './tos-storage';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface GenerateFirstFrameRequest {
  productImageUrl: string;    // 商品图片 URL
  scriptContent: string;      // 脚本描述（用于生成首帧场景）
  aspectRatio?: string;      // 视频比例 9:16 或 16:9
  style?: string;            // 风格描述
  referenceStyle?: string;   // 参考视频风格
}

export interface GenerateFirstFrameResult {
  success: boolean;
  imageUrl?: string;
  imageId?: string;
  key?: string;
  error?: string;
}

export class ImageGenerationService {
  private client: ImageGenerationClient;
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;

  constructor() {
    const config = new Config();
    this.client = new ImageGenerationClient(config);
  }

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * 生成首帧图 ⭐ 核心功能
   * 
   * 根据商品图和脚本描述，生成符合视频开头场景的首帧图
   * 支持图生图模式，让生成的首帧图保持商品特征
   */
  async generateFirstFrame(request: GenerateFirstFrameRequest): Promise<GenerateFirstFrameResult> {
    try {
      const { productImageUrl, scriptContent, aspectRatio = '9:16', style, referenceStyle } = request;

      console.log('[首帧图生成] 开始生成:', {
        productImageUrl,
        scriptContent: scriptContent.substring(0, 100),
        aspectRatio
      });

      // 构建提示词
      const prompt = this.buildFirstFramePrompt(scriptContent, style, referenceStyle);

      // 确定尺寸
      const size = aspectRatio === '9:16' ? '2K' : '2K';

      // 调用图片生成 API（图生图模式）
      const response = await this.client.generate({
        prompt,
        size,
        image: productImageUrl,  // 参考商品图
        watermark: false,
      });

      // 获取结果
      const helper = this.client.getResponseHelper(response);

      if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
        console.error('[首帧图生成] 生成失败:', helper);
        return {
          success: false,
          error: helper.errorMessages?.[0] || '生成失败'
        };
      }

      const imageUrl = helper.imageUrls[0];
      console.log('[首帧图生成] 生成成功:', imageUrl);

      // 下载图片并上传到 TOS
      const localPath = await this.downloadImage(imageUrl);
      const tosKey = await this.uploadToTOS(localPath, `first_frame_${Date.now()}.png`);
      const signedUrl = await LearningLibraryStorage.getLearningVideoUrl(tosKey);

      // 保存到数据库
      const imageId = await this.saveToDatabase(tosKey, signedUrl, prompt);

      return {
        success: true,
        imageUrl: signedUrl,
        imageId,
        key: tosKey
      };

    } catch (error) {
      console.error('[首帧图生成] 错误:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }

  /**
   * 构建首帧图提示词
   */
  private buildFirstFramePrompt(
    scriptContent: string,
    style?: string,
    referenceStyle?: string
  ): string {
    // 提取脚本中的场景描述
    const sceneMatch = scriptContent.match(/【.*?】(.+?)(?=【|口播|$)/g);
    const scenes = sceneMatch?.map(s => s.replace(/【.*?】/, '').trim()).join(', ') || scriptContent;

    // 构建提示词
    let prompt = `First frame of a product video: ${scenes}`;

    if (style) {
      prompt += `. Style: ${style}`;
    }

    if (referenceStyle) {
      prompt += `. Reference style: ${referenceStyle}`;
    }

    // 添加 Seedance 友好的描述
    prompt += `. High quality product photography, soft lighting, clean background, professional commercial style.`;

    // 禁止元素
    prompt += ` . No text, no logos, no watermarks, no realistic human faces.`;

    return prompt;
  }

  /**
   * 下载图片到本地
   */
  private async downloadImage(url: string): Promise<string> {
    const path = `/tmp/first_frame_${Date.now()}.png`;
    
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    
    const fs = await import('fs/promises');
    await fs.writeFile(path, Buffer.from(buffer));
    
    return path;
  }

  /**
   * 上传到 TOS
   */
  private async uploadToTOS(localPath: string, fileName: string): Promise<string> {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(localPath);
    
    // 使用学习库存储
    const key = await LearningLibraryStorage.uploadLearningVideo(
      'system', // 系统文件
      buffer,
      fileName,
      'image/png'
    );
    
    // 清理本地文件
    await fs.unlink(localPath).catch(() => {});
    
    return key;
  }

  /**
   * 保存到数据库
   */
  private async saveToDatabase(key: string, url: string, prompt: string): Promise<string> {
    const imageId = `img_${Date.now()}`;

    // 保存到 uploaded_files 表
    const { error } = await this.supabase
      .from('uploaded_files')
      .insert({
        file_id: imageId,
        file_name: `首帧图_${Date.now()}`,
        file_type: 'image',
        file_url: url,
        tos_key: key,
        file_size: 0,
        created_by: 'system'
      });

    if (error) {
      console.warn('[首帧图保存] 数据库保存失败:', error);
    }

    return imageId;
  }

  /**
   * 通用图片生成
   */
  async generateImage(
    prompt: string,
    options?: {
      size?: '2K' | '4K';
      image?: string;  // 参考图
      style?: string;
    }
  ): Promise<{
    success: boolean;
    imageUrl?: string;
    error?: string;
  }> {
    try {
      const response = await this.client.generate({
        prompt,
        size: options?.size || '2K',
        image: options?.image,
        watermark: false,
      });

      const helper = this.client.getResponseHelper(response);

      if (!helper.success || !helper.imageUrls) {
        return {
          success: false,
          error: helper.errorMessages?.[0] || '生成失败'
        };
      }

      return {
        success: true,
        imageUrl: helper.imageUrls[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '生成失败'
      };
    }
  }
}

// 导出单例
export const imageGenerationService = new ImageGenerationService();

/**
 * 创建图片生成服务实例（向后兼容）
 */
export function createImageGenerationService(_headers?: Record<string, string>): ImageGenerationService {
  return new ImageGenerationService();
}

/**
 * 生成故事板参考图（向后兼容）
 */
export async function generateImage(
  prompt: string,
  options?: { size?: string }
): Promise<Array<{ url: string }>> {
  const service = new ImageGenerationService();
  const result = await service.generateImage(prompt, {
    size: options?.size as '2K' | '4K' || '2K',
  });
  
  if (result.success && result.imageUrl) {
    return [{ url: result.imageUrl }];
  }
  
  return [];
}
