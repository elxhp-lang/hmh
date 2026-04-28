/**
 * 智能体学习服务
 * 整合知识库、向量嵌入、视频帧分析，实现真正的学习能力
 * 
 * 核心能力：
 * 1. 知识库管理 - 文档导入、语义搜索
 * 2. 向量嵌入 - 文本/图片/视频向量化
 * 3. 视频分析 - 关键帧提取、视觉内容分析
 * 4. 记忆检索 - 语义搜索替代关键词匹配
 */

import {
  KnowledgeClient,
  EmbeddingClient,
  FrameExtractorClient,
  Config,
  DataSourceType,
  type KnowledgeDocument,
  type ChunkConfig,
} from 'coze-coding-dev-sdk';
import { LLMClient } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// 知识库表名
const KNOWLEDGE_TABLE = 'hmhv_creative_knowledge';

// 嵌入向量维度
const EMBEDDING_DIMENSIONS = 1024;

/**
 * 学习内容类型
 */
export enum LearningContentType {
  DOCUMENT = 'document',       // 文档（PDF、Word、TXT等）
  CONVERSATION = 'conversation', // 对话总结
  VIDEO_REFERENCE = 'video_reference', // 视频学习
  IMAGE_REFERENCE = 'image_reference', // 图片参考
  URL_CONTENT = 'url_content', // 网页内容
}

/**
 * 学习条目
 */
export interface LearningEntry {
  id?: string;
  userId: string;
  type: LearningContentType;
  title: string;
  content: string;
  summary: string;
  keywords: string[];
  embedding?: number[];
  metadata?: Record<string, unknown>;
  sourceUrl?: string;
  sourceFileName?: string;
  importanceScore?: number;
  createdAt?: Date;
}

/**
 * 视频分析结果（增强版）
 */
export interface EnhancedVideoAnalysis {
  // 基本信息
  videoUrl: string;
  videoName: string;
  duration?: number;
  
  // 帧分析
  frames: Array<{
    url: string;
    timestampMs: number;
    description?: string;
    embedding?: number[];
  }>;
  
  // 视觉内容分析
  visualAnalysis: {
    dominantColors: string[];
    scenes: string[];
    objects: string[];
    mood: string;
    style: string;
  };
  
  // 创作知识
  creativeKnowledge: {
    styleKeywords: string[];
    promptReferences: string[];
    keyLearnings: string[];
    cameraTechniques: string[];
    editingTechniques: string[];
  };
  
  // 向量嵌入
  videoEmbedding?: number[];
  frameEmbeddings?: number[][];
}

/**
 * 语义搜索结果
 */
export interface SemanticSearchResult {
  id: string;
  title: string;
  summary: string;
  content: string;
  score: number;
  type: LearningContentType;
  keywords: string[];
  sourceFileName?: string;
  createdAt: string;
}

interface DbErrorLike {
  message?: string;
}

interface MemoryRowLike {
  id?: string;
  embedding?: string;
  memory_type?: string;
  title?: string;
  summary?: string;
  content?: string;
  keywords?: string[];
  source_file_name?: string;
  created_at?: string;
}

/**
 * 智能体学习服务类
 */
export class AgentLearningService {
  private knowledgeClient: KnowledgeClient;
  private embeddingClient: EmbeddingClient;
  private frameExtractorClient: FrameExtractorClient;
  private headers: Record<string, string>;

  constructor(headers?: Record<string, string>) {
    const config = new Config();
    this.headers = headers || {};
    
    this.knowledgeClient = new KnowledgeClient(config, this.headers);
    this.embeddingClient = new EmbeddingClient(config, this.headers);
    this.frameExtractorClient = new FrameExtractorClient(config, this.headers);
  }

  // ==================== 知识库管理 ====================

  /**
   * 导入文档到知识库
   */
  async importDocument(params: {
    content: string;
    title?: string;
    sourceUrl?: string;
    sourceFileName?: string;
    userId: string;
    type: LearningContentType;
  }): Promise<{ success: boolean; docId?: string; error?: string }> {
    try {
      const { content, title, sourceUrl, sourceFileName, userId, type } = params;

      // 1. 生成摘要和关键词
      const { summary, keywords } = await this.extractSummaryAndKeywords(content);

      // 2. 生成向量嵌入
      const embedding = await this.embeddingClient.embedText(summary, {
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // 3. 导入到知识库
      const documents: KnowledgeDocument[] = [
        {
          source: DataSourceType.TEXT,
          raw_data: content,
        },
      ];

      const chunkConfig: ChunkConfig = {
        separator: '\n\n',
        max_tokens: 2000,
        remove_extra_spaces: true,
      };

      const response = await this.knowledgeClient.addDocuments(
        documents,
        KNOWLEDGE_TABLE,
        chunkConfig
      );

      // 4. 存储到数据库
      const client = getSupabaseClient();
      const { data: memory, error: insertError } = await client
        .from('creative_memories')
        .insert({
          user_id: userId,
          memory_type: type,
          title: title || `学习内容 ${new Date().toLocaleDateString()}`,
          summary,
          content,
          source_type: sourceUrl ? 'url' : 'upload',
          source_file_name: sourceFileName,
          keywords,
          embedding: JSON.stringify(embedding),
          knowledge_doc_id: response.doc_ids?.[0],
          importance_score: this.calculateImportanceScore(content, keywords),
        })
        .select()
        .single();

      if (insertError) {
        console.error('存储记忆失败:', insertError);
        return { success: false, error: (insertError as DbErrorLike).message || '存储失败' };
      }

      return { success: true, docId: (memory as MemoryRowLike)?.id };
    } catch (error) {
      console.error('导入文档失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }

  /**
   * 语义搜索
   */
  async semanticSearch(params: {
    query: string;
    userId: string;
    limit?: number;
    minScore?: number;
    types?: LearningContentType[];
  }): Promise<SemanticSearchResult[]> {
    const { query, userId, limit = 5, minScore = 0.6, types } = params;

    try {
      // 1. 生成查询向量
      const queryEmbedding = await this.embeddingClient.embedText(query, {
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // 2. 使用知识库语义搜索
      const knowledgeResults = await this.knowledgeClient.search(
        query,
        [KNOWLEDGE_TABLE],
        limit * 2, // 多取一些结果
        minScore
      );

      // 3. 同时搜索数据库中的记忆
      const client = getSupabaseClient();
      
      // 使用向量相似度搜索（如果数据库支持）
      // 否则退化为关键词搜索
      const { data: memories, error } = await client
        .from('creative_memories')
        .select('*')
        .eq('user_id', userId)
        .order('importance_score', { ascending: false })
        .limit(limit * 2);

      if (error) {
        console.error('搜索记忆失败:', error);
      }

      // 4. 合并和排序结果
      const results: SemanticSearchResult[] = [];

      // 添加知识库结果
      if (knowledgeResults.code === 0 && knowledgeResults.chunks) {
        for (const chunk of knowledgeResults.chunks) {
          if (chunk.score >= minScore) {
            results.push({
              id: chunk.doc_id || '',
              title: chunk.content.slice(0, 50) + '...',
              summary: chunk.content.slice(0, 200),
              content: chunk.content,
              score: chunk.score,
              type: LearningContentType.DOCUMENT,
              keywords: [],
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // 添加数据库结果（计算相似度）
      if (memories && memories.length > 0) {
        for (const memory of memories as MemoryRowLike[]) {
          const m = memory;
          if (m.embedding) {
            try {
              const memoryEmbedding = JSON.parse(m.embedding as string);
              const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
              
              if (similarity >= minScore) {
                // 过滤类型
                if (types && types.length > 0 && !types.includes(m.memory_type as LearningContentType)) {
                  continue;
                }
                
                results.push({
                  id: m.id as string,
                  title: m.title as string,
                  summary: (m.summary as string) || '',
                  content: m.content as string,
                  score: similarity,
                  type: m.memory_type as LearningContentType,
                  keywords: (m.keywords as string[]) || [],
                  sourceFileName: m.source_file_name as string | undefined,
                  createdAt: m.created_at as string,
                });
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 5. 按相似度排序并返回
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);
    } catch (error) {
      console.error('语义搜索失败:', error);
      return [];
    }
  }

  // ==================== 视频分析 ====================

  /**
   * 分析视频（增强版）
   */
  async analyzeVideo(params: {
    videoUrl: string;
    videoName: string;
    userId?: string;
    extractFrameCount?: number;
  }): Promise<EnhancedVideoAnalysis> {
    const { videoUrl, videoName, userId, extractFrameCount = 10 } = params;

    // 1. 提取视频关键帧
    const frameResponse = await this.frameExtractorClient.extractByCount(
      videoUrl,
      extractFrameCount
    );

    const frames: EnhancedVideoAnalysis['frames'] = [];
    const frameEmbeddings: number[][] = [];

    // 2. 分析每一帧
    if (frameResponse.data?.chunks) {
      for (const frame of frameResponse.data.chunks) {
        frames.push({
          url: frame.screenshot,
          timestampMs: frame.timestamp_ms,
        });

        // 生成帧的图像嵌入
        try {
          const frameEmbedding = await this.embeddingClient.embedImage(frame.screenshot);
          frameEmbeddings.push(frameEmbedding);
        } catch (e) {
          console.warn('帧嵌入生成失败:', e);
        }
      }
    }

    // 3. 生成视频整体嵌入
    let videoEmbedding: number[] | undefined;
    try {
      videoEmbedding = await this.embeddingClient.embedVideo(videoUrl);
    } catch (e) {
      console.warn('视频嵌入生成失败:', e);
    }

    // 4. 使用 LLM 分析视觉内容
    const visualAnalysis = await this.analyzeVisualContent(frames.map(f => f.url));

    // 5. 提取创作知识
    const creativeKnowledge = await this.extractCreativeKnowledge(
      videoName,
      frames.map(f => ({ url: f.url, timestampMs: f.timestampMs })),
      visualAnalysis
    );

    // 6. 如果提供了用户ID，存储到知识库
    if (userId) {
      await this.importDocument({
        content: JSON.stringify({
          videoName,
          visualAnalysis,
          creativeKnowledge,
          frameCount: frames.length,
        }),
        title: `视频学习: ${videoName}`,
        userId,
        type: LearningContentType.VIDEO_REFERENCE,
        sourceUrl: videoUrl,
      });
    }

    return {
      videoUrl,
      videoName,
      frames,
      visualAnalysis,
      creativeKnowledge,
      videoEmbedding,
      frameEmbeddings: frameEmbeddings.length > 0 ? frameEmbeddings : undefined,
    };
  }

  /**
   * 分析视觉内容
   */
  private async analyzeVisualContent(imageUrls: string[]): Promise<EnhancedVideoAnalysis['visualAnalysis']> {
    if (imageUrls.length === 0) {
      return {
        dominantColors: [],
        scenes: [],
        objects: [],
        mood: '未知',
        style: '未知',
      };
    }

    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一位专业的视觉分析专家。请分析提供的图片，提取以下信息：
1. 主色调（2-3个）
2. 场景描述（如：室内、户外、城市、自然等）
3. 主要物体/元素
4. 整体氛围/情绪
5. 视觉风格

请以 JSON 格式返回结果。`;

    const userPrompt = `请分析这些图片：${imageUrls.slice(0, 5).join('\n')}

返回 JSON 格式：
{
  "dominantColors": ["颜色1", "颜色2"],
  "scenes": ["场景1", "场景2"],
  "objects": ["物体1", "物体2"],
  "mood": "氛围描述",
  "style": "风格描述"
}`;

    try {
      let fullResponse = '';
      for await (const chunk of llmClient.stream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { model: 'doubao-seed-1-8-251228', temperature: 0.3 })) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('视觉分析失败:', e);
    }

    return {
      dominantColors: [],
      scenes: [],
      objects: [],
      mood: '未知',
      style: '未知',
    };
  }

  /**
   * 提取创作知识
   */
  private async extractCreativeKnowledge(
    videoName: string,
    frames: Array<{ url: string; timestampMs: number }>,
    visualAnalysis: EnhancedVideoAnalysis['visualAnalysis']
  ): Promise<EnhancedVideoAnalysis['creativeKnowledge']> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一位专业的视频创作专家。基于视频的视觉分析结果，提取对创作有帮助的知识。
包括：
1. 风格关键词 - 用于描述视频风格的标签
2. 提示词参考 - 可以用于生成类似视频的英文提示词
3. 关键学习点 - 视频中值得学习的创作技巧
4. 镜头技巧 - 镜头运用方式
5. 剪辑技巧 - 剪辑手法

请以 JSON 格式返回结果。`;

    const userPrompt = `视频名称：${videoName}
视觉分析：${JSON.stringify(visualAnalysis, null, 2)}
帧数：${frames.length}

请提取创作知识，返回 JSON 格式：
{
  "styleKeywords": ["关键词1", "关键词2", "关键词3"],
  "promptReferences": ["英文提示词1", "英文提示词2"],
  "keyLearnings": ["学习点1", "学习点2", "学习点3"],
  "cameraTechniques": ["镜头技巧1", "镜头技巧2"],
  "editingTechniques": ["剪辑技巧1", "剪辑技巧2"]
}`;

    try {
      let fullResponse = '';
      for await (const chunk of llmClient.stream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { model: 'doubao-seed-1-8-251228', temperature: 0.5 })) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('创作知识提取失败:', e);
    }

    return {
      styleKeywords: [],
      promptReferences: [],
      keyLearnings: [],
      cameraTechniques: [],
      editingTechniques: [],
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 提取摘要和关键词
   */
  private async extractSummaryAndKeywords(content: string): Promise<{
    summary: string;
    keywords: string[];
  }> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一位文本分析专家。请分析给定的文本，提取：
1. 简洁的摘要（100字以内）
2. 关键词（5-8个）

请以 JSON 格式返回结果。`;

    const userPrompt = `请分析以下文本：
${content.slice(0, 3000)}

返回 JSON 格式：
{
  "summary": "摘要内容",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`;

    try {
      let fullResponse = '';
      for await (const chunk of llmClient.stream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { model: 'doubao-seed-1-8-251228', temperature: 0.3 })) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          summary: result.summary || content.slice(0, 200),
          keywords: result.keywords || [],
        };
      }
    } catch (e) {
      console.warn('摘要提取失败:', e);
    }

    return {
      summary: content.slice(0, 200),
      keywords: [],
    };
  }

  /**
   * 计算重要性分数
   */
  private calculateImportanceScore(content: string, keywords: string[]): number {
    let score = 0.5;
    
    // 内容长度加分
    if (content.length > 1000) score += 0.1;
    if (content.length > 3000) score += 0.1;
    if (content.length > 5000) score += 0.1;
    
    // 关键词数量加分
    if (keywords.length > 3) score += 0.1;
    if (keywords.length > 5) score += 0.1;
    
    return Math.min(score, 0.95);
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  // ==================== 记忆管理 ====================

  /**
   * 获取用户的学习上下文
   */
  async getLearningContext(userId: string, query: string): Promise<string> {
    const results = await this.semanticSearch({
      query,
      userId,
      limit: 5,
      minScore: 0.5,
    });

    if (results.length === 0) {
      return '';
    }

    const contextParts = results.map((r, i) => {
      const typeLabel = {
        [LearningContentType.DOCUMENT]: '文档学习',
        [LearningContentType.CONVERSATION]: '对话总结',
        [LearningContentType.VIDEO_REFERENCE]: '视频学习',
        [LearningContentType.IMAGE_REFERENCE]: '图片参考',
        [LearningContentType.URL_CONTENT]: '网页内容',
      }[r.type] || '学习内容';

      return `${i + 1}. [${typeLabel}] ${r.title}\n   摘要: ${r.summary.slice(0, 150)}...\n   相似度: ${(r.score * 100).toFixed(0)}%`;
    });

    return `\n## 用户学习库中的相关知识\n${contextParts.join('\n\n')}\n\n请参考以上知识回答用户的问题。`;
  }

  /**
   * 获取推荐的视频风格
   */
  async getRecommendedStyles(userId: string, topic: string): Promise<string[]> {
    const results = await this.semanticSearch({
      query: topic,
      userId,
      limit: 3,
      minScore: 0.5,
      types: [LearningContentType.VIDEO_REFERENCE],
    });

    const styles: string[] = [];
    for (const result of results) {
      try {
        const content = JSON.parse(result.content);
        if (content.creativeKnowledge?.styleKeywords) {
          styles.push(...content.creativeKnowledge.styleKeywords);
        }
      } catch {
        // 忽略解析错误
      }
    }

    return [...new Set(styles)].slice(0, 10);
  }
}

// 导出单例工厂
export function createAgentLearningService(headers?: Record<string, string>): AgentLearningService {
  return new AgentLearningService(headers);
}
