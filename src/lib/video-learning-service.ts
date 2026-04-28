/**
 * 视频学习服务（增强版）
 * 使用视觉模型直接分析视频内容，提取创作知识
 * 
 * 核心能力：
 * 1. 视频内容理解 - 使用视觉模型直接分析视频
 * 2. 风格识别 - 识别视频的拍摄风格和剪辑风格
 * 3. 创作知识提取 - 提取可学习的创作技巧
 * 4. 向量嵌入 - 生成视频向量用于语义搜索
 */

import { 
  LLMClient, 
  Config, 
  EmbeddingClient,
  KnowledgeClient,
  DataSourceType,
  type KnowledgeDocument,
} from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VideoStorageService } from './tos-storage';

// 知识库表名
const KNOWLEDGE_TABLE = 'hmhv_video_learning';

export interface VideoAnalysisResult {
  videoStyle: string;
  videoTheme: string;
  summary: string;
  sceneAnalysis: {
    scenes: string[];
    transitions: string[];
    pacing: string;
  };
  cameraAnalysis: {
    movements: string[];
    angles: string[];
    techniques: string[];
  };
  colorAnalysis: {
    dominantColors: string[];
    colorMood: string;
    lightingStyle: string;
  };
  keyLearnings: string[];
  styleKeywords: string[];
  promptReferences: string[];
  // 视频类型分析
  videoType?: string;
  targetAudience?: string;
  emotionalTone?: string;
  // 商品/人物分析
  mainSubjects?: string[];
  productShowcase?: string[];
  // 创作建议
  creationSuggestions?: string[];
  videoEmbedding?: number[];
}

interface LearningSummaryRow {
  video_style?: string;
  video_theme?: string;
}

interface LearningReferenceRow {
  video_name?: string;
  video_style?: string;
  summary?: string;
  similarity?: number;
}

export class VideoLearningService {
  private embeddingClient: EmbeddingClient;
  private knowledgeClient: KnowledgeClient;
  private headers: Record<string, string>;

  constructor(headers?: Record<string, string>) {
    const config = new Config();
    this.headers = headers || {};
    
    this.embeddingClient = new EmbeddingClient(config, this.headers);
    this.knowledgeClient = new KnowledgeClient(config, this.headers);
  }

  /**
   * 分析视频并提取创作知识（使用视觉模型直接分析视频）
   * 支持两种输入方式：
   * 1. 直接传入 URL（公开可访问的 URL）
   * 2. 传入 tos_key，后端自动下载并使用本地文件
   */
  async analyzeVideo(
    videoUrlOrKey: string,
    videoName: string,
    headers?: Record<string, string>
  ): Promise<VideoAnalysisResult> {
    if (headers) {
      this.headers = headers;
    }
    
    console.log(`[视频学习] 开始分析视频: ${videoName}`);
    console.log(`[视频学习] 原始输入: ${videoUrlOrKey}`);
    
    // 判断输入是 tos_key 还是 URL
    const isTosKey = !videoUrlOrKey.startsWith('http');
    let videoUrl = videoUrlOrKey;
    let localFilePath: string | null = null;
    
    // 如果是 tos_key，优先尝试使用公开 URL
    if (isTosKey) {
      // 生成公开可访问的 URL
      const publicUrl = VideoStorageService.getPublicUrl(videoUrlOrKey);
      console.log(`[视频学习] 生成公开 URL: ${publicUrl}`);
      
      // 优先尝试使用公开 URL 进行分析
      try {
        console.log(`[视频学习] 尝试使用公开 URL 进行视觉分析...`);
        const testResult = await this.analyzeVideoWithVision(publicUrl, videoName);
        
        // 如果成功，返回结果
        if (testResult.videoType && testResult.videoType !== '待分析') {
          console.log(`[视频学习] 公开 URL 分析成功！`);
          return testResult;
        }
      } catch (error) {
        console.log(`[视频学习] 公开 URL 分析失败，尝试下载方式: ${error instanceof Error ? error.message : '未知错误'}`);
      }
      
      // 如果公开 URL 失败，降级到下载方式
      console.log(`[视频学习] 开始下载到临时文件...`);
      try {
        localFilePath = await this.downloadTosFile(videoUrlOrKey, videoName);
        videoUrl = localFilePath;
        console.log(`[视频学习] 下载完成，本地路径: ${localFilePath}`);
      } catch (error) {
        console.error(`[视频学习] TOS 文件下载失败:`, error);
        return this.getFallbackAnalysis(videoName, `TOS 文件下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } else {
      // 已经是 URL，直接使用
      console.log(`[视频学习] 使用外部 URL 进行分析: ${videoUrl}`);
    }
    
    try {
      // 1. 使用视觉模型直接分析视频内容
      const videoAnalysis = await this.analyzeVideoWithVision(videoUrl, videoName);
      
      // 2. 生成视频嵌入（用于语义搜索）
      let videoEmbedding: number[] | undefined;
      try {
        videoEmbedding = await this.embeddingClient.embedVideo(videoUrl);
        console.log(`[视频学习] 视频嵌入生成成功`);
      } catch (e) {
        console.warn('[视频学习] 视频嵌入生成失败:', e);
      }
      
      return {
        ...videoAnalysis,
        videoEmbedding,
      };
    } finally {
      // 清理临时文件
      if (localFilePath) {
        this.cleanupTempFile(localFilePath);
      }
    }
  }
  
  /**
   * 下载 TOS 文件到临时目录
   */
  private async downloadTosFile(tosKey: string, _videoName: string): Promise<string> {
    void _videoName;
    console.log(`[视频学习] 正在下载 TOS 文件: ${tosKey}`);
    
    // 生成签名 URL
    const signedUrl = await VideoStorageService.getVideoUrl(tosKey, 3600);
    
    // 下载文件
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    // 保存到临时目录
    const tempDir = os.tmpdir();
    const ext = path.extname(tosKey) || '.mp4';
    const tempFileName = `video_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    fs.writeFileSync(tempFilePath, Buffer.from(buffer));
    console.log(`[视频学习] 文件已保存到: ${tempFilePath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    
    return tempFilePath;
  }
  
  /**
   * 清理临时文件
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[视频学习] 已清理临时文件: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[视频学习] 清理临时文件失败: ${error}`);
    }
  }

  /**
   * 使用视觉模型直接分析视频内容
   */
  private async analyzeVideoWithVision(
    videoUrl: string,
    videoName: string
  ): Promise<VideoAnalysisResult> {
    const llmClient = new LLMClient(new Config(), this.headers);
    
    // 第一轮分析：全面理解视频内容
    const comprehensivePrompt = `你是一位资深的短视频创作专家和视频分析师。请仔细观看这个视频，进行全面深入的分析。

## 分析维度

### 1. 视频类型与定位
- 这是什么类型的视频？（如：产品展示、故事剧情、Vlog、教学教程、宣传片、情感故事等）
- 目标受众是谁？
- 视频的核心目的是什么？

### 2. 画面与场景
- 视频中有哪些主要场景？
- 场景是如何转换的？
- 整体的画面节奏如何？

### 3. 镜头语言
- 使用了哪些镜头运动方式？（推、拉、摇、移、跟、环绕等）
- 拍摄角度有什么特点？
- 有什么特别的拍摄技巧？

### 4. 视觉风格
- 主色调是什么？
- 光影风格如何？（自然光、人工光、逆光、柔光等）
- 整体视觉氛围是什么？

### 5. 内容元素
- 视频中出现的主要人物、物品、商品有哪些？
- 有没有特别的视觉重点？
- 人物/商品的展示方式有什么特点？

### 6. 创作技巧
- 有哪些值得学习的创作技巧？
- 视频的亮点是什么？
- 如何借鉴这个视频的风格？

请用中文详细分析，返回以下JSON格式：
{
  "videoType": "视频类型",
  "videoStyle": "整体风格描述",
  "videoTheme": "视频主题/核心内容",
  "targetAudience": "目标受众",
  "emotionalTone": "情感基调",
  "summary": "视频内容摘要（50-100字）",
  "mainSubjects": ["主体1", "主体2"],
  "productShowcase": ["商品展示要点1", "商品展示要点2"],
  "sceneAnalysis": {
    "scenes": ["场景1描述", "场景2描述"],
    "transitions": ["转场方式1", "转场方式2"],
    "pacing": "节奏描述"
  },
  "cameraAnalysis": {
    "movements": ["镜头运动1", "镜头运动2"],
    "angles": ["拍摄角度1", "拍摄角度2"],
    "techniques": ["拍摄技巧1", "拍摄技巧2"]
  },
  "colorAnalysis": {
    "dominantColors": ["颜色1", "颜色2"],
    "colorMood": "色彩情绪",
    "lightingStyle": "光影风格"
  },
  "keyLearnings": ["可学习点1", "可学习点2", "可学习点3"],
  "styleKeywords": ["风格关键词1", "风格关键词2", "风格关键词3"],
  "creationSuggestions": ["创作建议1", "创作建议2"],
  "promptReferences": ["英文提示词1用于生成类似视频", "英文提示词2"]
}`;

    try {
      // 构建包含视频的多模态消息
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: comprehensivePrompt },
            {
              type: 'video_url' as const,
              video_url: {
                url: videoUrl,
                fps: 1, // 每秒提取1帧，平衡精度和速度
              },
            },
          ],
        },
      ];

      console.log(`[视频学习] 开始视觉分析...`);
      
      // 使用支持视频理解的模型
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-1-6-vision-250815', // 视觉模型，支持视频理解
        temperature: 0.3, // 较低温度确保分析稳定
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      console.log(`[视频学习] 视觉分析完成，响应长度: ${fullResponse.length}`);

      // 解析JSON响应
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log(`[视频学习] 分析成功，视频类型: ${result.videoType}, 风格: ${result.videoStyle}`);
        return result;
      }

      throw new Error('无法解析分析结果');
    } catch (error) {
      console.error('[视频学习] 视觉分析失败:', error);
      
      // 返回基础分析结果
      return this.getFallbackAnalysis(videoName, error);
    }
  }

  /**
   * 获取备用的分析结果
   */
  private getFallbackAnalysis(videoName: string, error: unknown): VideoAnalysisResult {
    console.log(`[视频学习] 使用备用分析结果`);
    
    return {
      videoType: '待分析',
      videoStyle: '通用风格',
      videoTheme: videoName,
      summary: `视频「${videoName}」已添加到学习库。分析过程中遇到问题：${error instanceof Error ? error.message : '未知错误'}。您可以手动补充视频信息。`,
      targetAudience: '通用受众',
      emotionalTone: '中性',
      mainSubjects: [],
      productShowcase: [],
      sceneAnalysis: {
        scenes: [],
        transitions: [],
        pacing: '中等节奏',
      },
      cameraAnalysis: {
        movements: [],
        angles: [],
        techniques: [],
      },
      colorAnalysis: {
        dominantColors: [],
        colorMood: '中性',
        lightingStyle: '自然光',
      },
      keyLearnings: ['视频已上传，可以参考其内容进行创作'],
      styleKeywords: ['参考视频'],
      creationSuggestions: ['可以参考这个视频的风格进行创作'],
      promptReferences: [],
    };
  }

  /**
   * 将分析结果存储到数据库
   */
  async saveAnalysisResult(
    learningId: string,
    result: VideoAnalysisResult
  ): Promise<void> {
    const client = getSupabaseClient();
    
    // 获取视频URL用于知识库导入
    const { data: learningData } = await client
      .from('learning_library')
      .select('user_id, video_url, video_name')
      .eq('id', learningId)
      .single();
    
    // 更新学习库记录
    const { error } = await client
      .from('learning_library')
      .update({
        analysis_status: 'completed',
        analysis_progress: 100,
        video_style: result.videoStyle,
        video_theme: result.videoTheme,
        summary: result.summary,
        scene_analysis: result.sceneAnalysis,
        camera_analysis: result.cameraAnalysis,
        color_analysis: result.colorAnalysis,
        key_learnings: result.keyLearnings,
        style_keywords: result.styleKeywords,
        prompt_references: result.promptReferences,
        analyzed_at: new Date().toISOString(),
        // 新增字段
        video_embedding: result.videoEmbedding ? JSON.stringify(result.videoEmbedding) : null,
      })
      .eq('id', learningId);

    if (error) {
      throw new Error(`保存分析结果失败: ${error.message}`);
    }
    
    console.log(`[视频学习] 分析结果已保存到数据库`);
    
    // 同步导入到知识库，实现语义搜索
    if (learningData?.user_id) {
      try {
        const knowledgeContent = `
视频名称: ${result.videoTheme || learningData.video_name}
类型: ${result.videoType || '未知'}
风格: ${result.videoStyle}
主题: ${result.summary}
目标受众: ${result.targetAudience || '通用'}
情感基调: ${result.emotionalTone || '中性'}
场景: ${result.sceneAnalysis?.scenes?.join('、') || '未知'}
镜头技巧: ${result.cameraAnalysis?.techniques?.join('、') || '未知'}
色彩: ${result.colorAnalysis?.dominantColors?.join('、') || '未知'}
学习要点: ${result.keyLearnings?.join('\n- ') || '无'}
风格关键词: ${result.styleKeywords?.join('、') || '无'}
创作建议: ${result.creationSuggestions?.join('\n- ') || '无'}
        `.trim();
        
        const documents: KnowledgeDocument[] = [
          {
            source: DataSourceType.TEXT,
            raw_data: knowledgeContent,
          },
        ];
        
        await this.knowledgeClient.addDocuments(
          documents,
          KNOWLEDGE_TABLE,
          { 
            separator: '\n\n',
            max_tokens: 500,
          }
        );
        
        console.log(`[视频学习] 已同步到知识库`);
      } catch (e) {
        console.warn('[视频学习] 知识库同步失败:', e);
      }
    }
  }

  /**
   * 获取学习库摘要
   */
  async getLearningSummary(userId: string): Promise<{
    totalVideos: number;
    styleDistribution: Record<string, number>;
    recentTopics: string[];
  }> {
    const client = getSupabaseClient();
    
    const { data: learnings, error } = await client
      .from('learning_library')
      .select('video_style, video_theme, created_at')
      .eq('user_id', userId)
      .eq('analysis_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !learnings) {
      return { totalVideos: 0, styleDistribution: {}, recentTopics: [] };
    }

    const styleDistribution: Record<string, number> = {};
    const recentTopics: string[] = [];

    for (const learning of learnings as LearningSummaryRow[]) {
      if (learning.video_style) {
        const key = learning.video_style as string;
        styleDistribution[key] = (styleDistribution[key] || 0) + 1;
      }
      if (learning.video_theme) {
        recentTopics.push(learning.video_theme as string);
      }
    }

    return {
      totalVideos: learnings.length,
      styleDistribution,
      recentTopics: recentTopics.slice(0, 10),
    };
  }

  /**
   * 获取相关参考视频
   */
  async getRelevantReferences(userId: string, query: string, limit: number = 5): Promise<Array<{
    videoName: string;
    style: string;
    summary: string;
    score: number;
  }>> {
    const client = getSupabaseClient();
    
    // 使用关键词搜索
    const keywords = query
      .replace(/[，。！？；：""''【】（）《》、\n\r\t]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .slice(0, 5);

    if (keywords.length === 0) {
      return [];
    }

    const { data: learnings, error } = await client
      .from('learning_library')
      .select('id, video_name, video_style, summary, style_keywords')
      .eq('user_id', userId)
      .eq('analysis_status', 'completed')
      .or(keywords.map(kw => 
        `video_style.ilike.%${kw}%,video_theme.ilike.%${kw}%,summary.ilike.%${kw}%,style_keywords.cs.{${kw}}`
      ).join(','))
      .limit(limit);

    if (error || !learnings) {
      return [];
    }

    return (learnings as LearningReferenceRow[]).map((learning, index) => ({
      videoName: (learning.video_name as string) || '未知',
      style: (learning.video_style as string) || '未知',
      summary: (learning.summary as string) || '',
      score: 1 - index * 0.1, // 简单的相关性评分
    }));
  }

  /**
   * 语义搜索（使用向量嵌入）
   */
  async semanticSearch(userId: string, query: string, limit: number = 5): Promise<Array<{
    videoName: string;
    style: string;
    summary: string;
    score: number;
  }>> {
    const client = getSupabaseClient();
    
    try {
      // 生成查询嵌入
      const queryEmbedding = await this.embeddingClient.embedText(query);
      
      // 使用向量相似度搜索
      const { data: learnings, error } = await client
        .rpc('match_learning_videos', {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.5,
          match_count: limit,
          p_user_id: userId,
        });

      if (error || !learnings) {
        console.warn('[视频学习] 向量搜索失败，回退到关键词搜索');
        return this.getRelevantReferences(userId, query, limit);
      }

      return (learnings as LearningReferenceRow[]).map((learning) => ({
        videoName: (learning.video_name as string) || '未知',
        style: (learning.video_style as string) || '未知',
        summary: (learning.summary as string) || '',
        score: (learning.similarity as number) || 0,
      }));
    } catch (e) {
      console.warn('[视频学习] 语义搜索失败:', e);
      return this.getRelevantReferences(userId, query, limit);
    }
  }
}

// 导出工厂函数
export function createVideoLearningService(headers?: Record<string, string>): VideoLearningService {
  return new VideoLearningService(headers);
}

// 导出默认实例
export const videoLearningService = new VideoLearningService();
