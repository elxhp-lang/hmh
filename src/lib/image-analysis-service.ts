/**
 * 图片分析服务
 * 
 * 使用 LLM 视觉能力分析商品图片
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';

// ========== 类型定义 ==========

export interface VisualFeatures {
  colors: string[];           // 主色调列表
  scene: string;             // 拍摄场景
  light_style: string;       // 光影风格
  angle: string;             // 展示角度
  packaging_style?: string;   // 包装风格
}

export interface KeySellingPoint {
  content: string;           // 卖点内容
  source: 'text_extract' | 'visual_infer';  // 来源
}

export interface ImageAnalysisResult {
  product_name: string;      // 产品名称
  category: string;           // 产品品类
  visual_features: VisualFeatures;
  is_contains_people: boolean;  // 是否含有人脸
  key_selling_points: KeySellingPoint[];  // 卖点
  text_content: string;       // 图片文字
  suggested_scenes: string[]; // 推荐场景
  confidence: {
    overall: number;
    product_name: number;
    category: number;
    selling_points: number;
  };
  source_image?: string;      // 来源图片
}

interface SellingPointRow {
  content?: string;
  source?: string;
}

export interface MultiImageAnalysisResult {
  aggregated: ImageAnalysisResult;  // 聚合结果
  individual: ImageAnalysisResult[];  // 单图结果
}

// ========== 通用分析 Prompt ==========

const BASE_PROMPT = `分析这张商品图片，提取以下信息，以 JSON 格式输出：

{
  "product_name": "产品名称（无法识别返回空字符串）",
  "category": "产品品类（尽量细分，如'美妆/面部精华'、'食品/饮料'、'数码/蓝牙耳机'）",
  "visual_features": {
    "colors": ["主色调列表，最多3个"],
    "scene": "拍摄场景（如'静物台'、'生活场景'、'户外自然'）",
    "light_style": "光影风格（如'柔光'、'硬光'、'自然光'、'暖光'）",
    "angle": "展示角度（如'正面平视'、'45度俯视'、'侧面特写'）",
    "packaging_style": "包装风格（如'简约ins风'、'国潮古风'、'科技感'、'轻奢风'）"
  },
  "is_contains_people": true或false，检测图片是否含有人脸
  "key_selling_points": [
    {
      "content": "卖点内容",
      "source": "text_extract表示从图片文字提取，visual_infer表示视觉推断"
    }
  ],
  "text_content": "图片上的文字内容（如果没有则返回空字符串）",
  "suggested_scenes": ["推荐视频场景1", "推荐视频场景2"]，
  "confidence": {
    "overall": 0.0-1.0的整体可信度，
    "product_name": 0.0-1.0的产品名称识别可信度，
    "category": 0.0-1.0的品类识别可信度，
    "selling_points": 0.0-1.0的卖点识别可信度
  }
}

要求：
- 严格按照 JSON 格式输出，不要添加额外解释
- 所有字段都需要返回
- 如果无法识别某项，返回空值或默认值
- is_contains_people 如果检测到任何人脸元素，返回 true`;

// ========== 品类专属 Prompt ==========

const CATEGORY_PROMPTS: Record<string, string> = {
  '美妆': `\n\n针对美妆品类，额外关注：
- 质地类型（精华液、乳霜、粉状、膏体等）
- 包装设计特点（泵头、按压式、滴管、软管等）
- 是否有特殊成分标识（如玻尿酸、烟酰胺等）
- 产品形态（单个、礼盒、组合装）`,

  '食品': `\n\n针对食品品类，额外关注：
- 食材类型和口味标注
- 食用场景（早餐、零食、正餐、聚会等）
- 包装上的促销信息或卖点
- 生产日期/保质期相关信息（不要写入卖点）`,

  '数码': `\n\n针对数码品类，额外关注：
- 产品具体形态（入耳式、头戴式、便携式等）
- 材质质感（金属、塑料、玻璃等）
- 接口类型和数量
- 科技感特征（屏幕、灯效、传感器等）`,

  '家居': `\n\n针对家居品类，额外关注：
- 材质类型（木质、金属、布艺、塑料等）
- 适用空间（客厅、卧室、厨房、浴室等）
- 风格特点（北欧、日式、现代、中式等）
- 尺寸感（小巧、适中、大件）`
};

// ========== 图片分析服务 ==========

export class ImageAnalysisService {
  /**
   * 分析单张图片
   */
  async analyzeImage(
    imageUrl: string,
    categoryHint?: string
  ): Promise<{
    success: boolean;
    data?: ImageAnalysisResult;
    error?: string;
  }> {
    try {
      const llmClient = new LLMClient(new Config());

      // 构建 Prompt
      let prompt = BASE_PROMPT;
      if (categoryHint) {
        // 根据品类添加专属 Prompt
        for (const [key, suffix] of Object.entries(CATEGORY_PROMPTS)) {
          if (categoryHint.includes(key)) {
            prompt += suffix;
            break;
          }
        }
      }

      // 构建包含图片的多模态消息
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: prompt },
            {
              type: 'image_url' as const,
              image_url: { url: imageUrl },
            },
          ],
        },
      ];

      // 使用 stream 方法
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.3,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      if (!fullResponse) {
        return { success: false, error: '分析失败，未返回结果' };
      }

      // 提取 JSON
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { success: false, error: '无法解析分析结果' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        data: {
          product_name: parsed.product_name || '',
          category: parsed.category || '',
          visual_features: {
            colors: parsed.visual_features?.colors || [],
            scene: parsed.visual_features?.scene || '',
            light_style: parsed.visual_features?.light_style || '',
            angle: parsed.visual_features?.angle || '',
            packaging_style: parsed.visual_features?.packaging_style || ''
          },
          is_contains_people: parsed.is_contains_people || false,
          key_selling_points: (parsed.key_selling_points || []).map((p: SellingPointRow) => ({
            content: p.content || '',
            source: p.source === 'text_extract' ? 'text_extract' : 'visual_infer'
          })),
          text_content: parsed.text_content || '',
          suggested_scenes: parsed.suggested_scenes || [],
          confidence: {
            overall: parsed.confidence?.overall || 0.5,
            product_name: parsed.confidence?.product_name || 0.5,
            category: parsed.confidence?.category || 0.5,
            selling_points: parsed.confidence?.selling_points || 0.5
          },
          source_image: imageUrl
        } as ImageAnalysisResult
      };

    } catch (error) {
      console.error('图片分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '分析失败'
      };
    }
  }

  /**
   * 分析多张图片并聚合结果
   */
  async analyzeMultipleImages(
    imageUrls: string[],
    categoryHint?: string
  ): Promise<{
    success: boolean;
    data?: MultiImageAnalysisResult;
    error?: string;
  }> {
    try {
      // 并行分析每张图片
      const results = await Promise.all(
        imageUrls.map(url => this.analyzeImage(url, categoryHint))
      );

      // 过滤成功的结果
      const successfulResults = results
        .filter(r => r.success && r.data)
        .map(r => r.data!);

      if (successfulResults.length === 0) {
        return { success: false, error: '所有图片分析均失败' };
      }

      // 聚合结果
      const aggregated = this.aggregateResults(successfulResults);

      return {
        success: true,
        data: {
          aggregated,
          individual: successfulResults
        }
      };

    } catch (error) {
      console.error('多图分析失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '多图分析失败'
      };
    }
  }

  /**
   * 聚合多张图片的分析结果
   */
  private aggregateResults(results: ImageAnalysisResult[]): ImageAnalysisResult {
    if (results.length === 1) {
      return results[0];
    }

    // 取可信度最高的产品名称
    const productNameResult = results.reduce((best, current) => 
      current.confidence.product_name > best.confidence.product_name ? current : best
    );

    // 取可信度最高的品类
    const categoryResult = results.reduce((best, current) => 
      current.confidence.category > best.confidence.category ? current : best
    );

    // 合并颜色（去重）
    const allColors = new Set<string>();
    results.forEach(r => r.visual_features.colors.forEach(c => allColors.add(c)));

    // 合并卖点
    const allSellingPoints = new Map<string, KeySellingPoint>();
    results.forEach(r => {
      r.key_selling_points.forEach(p => {
        if (!allSellingPoints.has(p.content)) {
          allSellingPoints.set(p.content, p);
        }
      });
    });

    // 检查是否含人脸
    const containsPeople = results.some(r => r.is_contains_people);

    // 合并推荐场景
    const allScenes = new Set<string>();
    results.forEach(r => r.suggested_scenes.forEach(s => allScenes.add(s)));

    // 合并文字内容
    const allTexts = results
      .map(r => r.text_content)
      .filter(t => t)
      .join('; ');

    return {
      product_name: productNameResult.product_name,
      category: categoryResult.category,
      visual_features: {
        colors: Array.from(allColors).slice(0, 3),
        scene: results[0].visual_features.scene,
        light_style: results[0].visual_features.light_style,
        angle: results[0].visual_features.angle,
        packaging_style: results[0].visual_features.packaging_style
      },
      is_contains_people: containsPeople,
      key_selling_points: Array.from(allSellingPoints.values()),
      text_content: allTexts,
      suggested_scenes: Array.from(allScenes),
      confidence: {
        overall: results.reduce((sum, r) => sum + r.confidence.overall, 0) / results.length,
        product_name: productNameResult.confidence.product_name,
        category: categoryResult.confidence.category,
        selling_points: results.reduce((sum, r) => sum + r.confidence.selling_points, 0) / results.length
      }
    };
  }

  /**
   * 从分析结果生成脚本推荐
   */
  generateScriptSuggestions(result: ImageAnalysisResult, count: number = 3): string[] {
    const suggestions: string[] = [];
    const features = result.visual_features;
    
    for (let i = 0; i < count; i++) {
      const style = i === 0 ? '产品特写展示' : i === 1 ? '场景融入展示' : '综合卖点展示';
      const scene = result.suggested_scenes[i % result.suggested_scenes.length] || features.scene;
      
      suggestions.push(
        `${style}风格：${features.light_style}光影，${features.angle}角度，` +
        `场景为${scene}，包装风格${features.packaging_style || '简约'}，` +
        `核心卖点：${result.key_selling_points.slice(0, 2).map(p => p.content).join('、') || '产品展示'}`
      );
    }

    return suggestions;
  }
}

export default ImageAnalysisService;
