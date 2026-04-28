/**
 * 商品视频工作流服务
 * 专注于商品相关视频创作：人物口播、剧情种草、直播引流
 * 集成商品图库，自动识别商品并生成参考提示词
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { productLibraryService, Product } from '@/lib/product-library-service';
import { imageIntegrationService } from '@/lib/image-integration-service';

// ========== 类型定义 ==========

/** 商品视频类型 */
export type ProductVideoType = 
  | 'person_talking'    // 人物口播
  | 'story_planting'    // 剧情种草
  | 'live_promotion';   // 直播引流

/** 商品参考信息 */
export interface ProductReference {
  found: boolean;
  product?: Product;
  productName?: string;
  integratedImage?: {
    url: string;
    width: number;
    height: number;
    viewLabels: string[];
  };
  referencePrompt?: string;
  imageUrls?: string[];
}

/** 视频风格配置 */
export interface VideoStyleConfig {
  type: ProductVideoType;
  name: string;
  description: string;
  promptTemplate: string;
  sceneRequirements: string[];
  recommendedDuration: number; // 推荐时长（秒）
}

// ========== 风格配置 ==========

const VIDEO_STYLE_CONFIGS: Record<ProductVideoType, VideoStyleConfig> = {
  person_talking: {
    type: 'person_talking',
    name: '人物口播',
    description: '专业主播或达人面对面介绍商品，强调真实感和信任感',
    promptTemplate: `专业口播视频，{product_info}。
画面特点：
- 正面或轻微斜角拍摄，中景或近景
- 主播着装得体，表情自然亲切
- 背景简洁专业，突出商品
- 光线明亮柔和，肤色自然
- 商品在画面中清晰可见

拍摄要求：
{camera_requirements}

商品外观参考：
{product_reference}`,
    sceneRequirements: [
      '主播正面或3/4角度',
      '商品位于画面中央或前景',
      '背景干净或有品牌元素',
      '光线充足，避免阴影',
    ],
    recommendedDuration: 15,
  },

  story_planting: {
    type: 'story_planting',
    name: '剧情种草',
    description: '通过生活化剧情自然融入商品，增强代入感和购买欲望',
    promptTemplate: `生活化剧情短视频，{product_info}。
剧情设置：
- 场景真实自然，贴近目标用户生活
- 人物互动自然流畅，有情感张力
- 商品出现时机恰到好处，不生硬
- 问题-解决-效果的完整闭环

画面风格：
- 自然光或温暖色调
- 运镜流畅，有生活感
- 特写与中景交替

商品外观参考：
{product_reference}`,
    sceneRequirements: [
      '生活化场景（家居、办公、户外等）',
      '人物使用商品的自然动作',
      '产品细节特写',
      '情感表达的近景镜头',
    ],
    recommendedDuration: 20,
  },

  live_promotion: {
    type: 'live_promotion',
    name: '直播引流',
    description: '直播间的商品展示和推荐片段，强调紧迫感和优惠信息',
    promptTemplate: `直播推广视频，{product_info}。
直播氛围：
- 明亮的直播间布光
- 主播热情有感染力
- 商品展示清晰，多角度呈现
- 弹幕、倒计时等元素增强紧迫感

画面要求：
- 产品特写清晰
- 价格、优惠信息可见
- 引导下单的视觉元素

商品外观参考：
{product_reference}`,
    sceneRequirements: [
      '直播间场景',
      '商品多角度展示',
      '价格/优惠信息呈现',
      '主播互动画面',
    ],
    recommendedDuration: 10,
  },
};

// ========== 服务类 ==========

class ProductVideoWorkflowService {
  private headers: Record<string, string>;

  constructor(headers: Record<string, string> = {}) {
    this.headers = headers;
  }

  /**
   * 从用户输入中识别商品名称
   * 使用LLM提取可能的商品关键词
   */
  async extractProductKeywords(userInput: string): Promise<string[]> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一个商品识别助手。从用户的描述中提取可能的商品名称或关键词。
规则：
1. 只返回商品名称或关键词，不要解释
2. 多个商品用逗号分隔
3. 如果没有识别到商品，返回空字符串
4. 优先提取具体的商品名称，而不是类别`;

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ]);

      const keywords = response.content?.trim() || '';
      if (!keywords) {
        return [];
      }

      return keywords.split(/[,，]/).map((k: string) => k.trim()).filter(Boolean);
    } catch (error) {
      console.error('提取商品关键词失败:', error);
      return [];
    }
  }

  /**
   * 查找商品并生成参考信息
   */
  async findProductReference(
    userId: string,
    productName: string
  ): Promise<ProductReference> {
    try {
      // 查找商品
      const product = await productLibraryService.findProductByName(userId, productName);

      if (!product) {
        return { found: false, productName };
      }

      // 整合多视角图片
      const integratedImage = await imageIntegrationService.integrateImages(
        product.images.map(img => ({
          url: img.url,
          viewName: img.view_name,
          key: img.key,
        })),
        userId,
        product.id
      );

      // 生成参考提示词
      const viewLabels = product.images.map(img => img.view_name);
      let referencePrompt = `商品: ${product.product_name}`;

      if (product.product_description) {
        referencePrompt += `。${product.product_description}`;
      }

      if (viewLabels.length > 0) {
        referencePrompt += `。商品外观包含: ${viewLabels.join('、')}等视角`;
      }

      // 记录使用
      await productLibraryService.recordUsage(userId, product.id);

      return {
        found: true,
        product,
        productName: product.product_name,
        integratedImage: integratedImage || undefined,
        referencePrompt,
        imageUrls: product.images.map(img => img.url),
      };
    } catch (error) {
      console.error('查找商品参考失败:', error);
      return { found: false, productName };
    }
  }

  /**
   * 批量识别用户输入中的商品
   */
  async identifyProducts(
    userId: string,
    userInput: string
  ): Promise<ProductReference[]> {
    // 提取商品关键词
    const keywords = await this.extractProductKeywords(userInput);

    if (keywords.length === 0) {
      return [];
    }

    // 查找所有商品
    const references: ProductReference[] = [];
    for (const keyword of keywords) {
      const ref = await this.findProductReference(userId, keyword);
      references.push(ref);
    }

    return references;
  }

  /**
   * 生成商品视频提示词
   */
  async generateProductVideoPrompt(
    userId: string,
    userInput: string,
    videoType: ProductVideoType
  ): Promise<{
    prompt: string;
    productReferences: ProductReference[];
    styleConfig: VideoStyleConfig;
  }> {
    // 识别商品
    const productReferences = await this.identifyProducts(userId, userInput);

    // 获取风格配置
    const styleConfig = VIDEO_STYLE_CONFIGS[videoType];

    // 构建商品信息
    const productInfoParts: string[] = [];
    const productRefParts: string[] = [];

    for (const ref of productReferences) {
      if (ref.found && ref.product) {
        productInfoParts.push(ref.product.product_name);
        if (ref.product.product_description) {
          productInfoParts.push(ref.product.product_description);
        }
        if (ref.referencePrompt) {
          productRefParts.push(ref.referencePrompt);
        }
        if (ref.imageUrls && ref.imageUrls.length > 0) {
          productRefParts.push(`商品图片: ${ref.imageUrls.length}张多视角图片可用`);
        }
      } else if (ref.productName) {
        productInfoParts.push(`"${ref.productName}"(未在商品库中找到)`);
      }
    }

    const productInfo = productInfoParts.join('，') || '商品信息待补充';
    const productReference = productRefParts.join('\n') || '请在商品图库中上传商品图片';

    // 生成提示词
    const prompt = styleConfig.promptTemplate
      .replace('{product_info}', productInfo)
      .replace('{product_reference}', productReference)
      .replace('{camera_requirements}', styleConfig.sceneRequirements.join('\n'));

    return {
      prompt,
      productReferences,
      styleConfig,
    };
  }

  /**
   * 获取可用的视频风格
   */
  getAvailableStyles(): VideoStyleConfig[] {
    return Object.values(VIDEO_STYLE_CONFIGS);
  }

  /**
   * 推荐视频风格
   * 根据商品类型和用户需求推荐最合适的风格
   */
  async recommendStyle(
    userInput: string,
    productCategory?: string
  ): Promise<ProductVideoType> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一个视频创作顾问。根据用户需求推荐最适合的视频风格。
可选风格：
1. person_talking - 人物口播：适合详细介绍商品功能、专业测评
2. story_planting - 剧情种草：适合生活化场景、情感营销
3. live_promotion - 直播引流：适合促销活动、限时优惠

返回格式：只返回风格类型（person_talking/story_planting/live_promotion），不要解释`;

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `用户需求: ${userInput}\n商品类别: ${productCategory || '未知'}` },
      ]);

      const recommendation = response.content?.trim() || '';

      if (['person_talking', 'story_planting', 'live_promotion'].includes(recommendation)) {
        return recommendation as ProductVideoType;
      }

      return 'story_planting'; // 默认推荐
    } catch (error) {
      console.error('推荐风格失败:', error);
      return 'story_planting';
    }
  }

  /**
   * 生成分镜脚本（针对商品视频优化）
   */
  async generateProductStoryboard(
    userId: string,
    userInput: string,
    videoType: ProductVideoType
  ): Promise<{
    storyboards: Array<{
      sequence: number;
      duration: number;
      sceneDescription: string;
      cameraMovement: string;
      prompt: string;
      productVisible: boolean;
    }>;
    productReferences: ProductReference[];
    totalDuration: number;
  }> {
    // 获取商品参考
    const { prompt, productReferences } = await this.generateProductVideoPrompt(
      userId,
      userInput,
      videoType
    );

    const styleConfig = VIDEO_STYLE_CONFIGS[videoType];

    // 使用LLM生成分镜
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一个专业的视频分镜师。根据商品信息和视频风格，生成详细的分镜脚本。
每个分镜包含：
1. sequence: 序号
2. duration: 时长（秒）
3. sceneDescription: 场景描述
4. cameraMovement: 运镜方式
5. prompt: Seedance提示词（详细的视觉描述）
6. productVisible: 商品是否在画面中可见

返回JSON格式：
{
  "storyboards": [...]
}`;

    try {
      const response = await llmClient.invoke([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `视频风格: ${styleConfig.name}\n商品信息: ${prompt}\n推荐总时长: ${styleConfig.recommendedDuration}秒`,
        },
      ]);

      const content = response.content || '';

      // 解析JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const totalDuration = parsed.storyboards.reduce(
          (sum: number, s: { duration: number }) => sum + s.duration,
          0
        );

        return {
          storyboards: parsed.storyboards,
          productReferences,
          totalDuration,
        };
      }
    } catch (error) {
      console.error('生成分镜脚本失败:', error);
    }

    // 返回默认分镜
    return {
      storyboards: [
        {
          sequence: 1,
          duration: styleConfig.recommendedDuration,
          sceneDescription: `${styleConfig.name}风格商品展示`,
          cameraMovement: '推镜头',
          prompt,
          productVisible: true,
        },
      ],
      productReferences,
      totalDuration: styleConfig.recommendedDuration,
    };
  }
}

// ========== 导出 ==========

export const productVideoWorkflowService = new ProductVideoWorkflowService();
export { ProductVideoWorkflowService };
