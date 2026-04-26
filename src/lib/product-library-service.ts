/**
 * 商品图库服务
 * 管理用户上传的商品图片，支持多视角上传和图片整合
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';

// ========== 类型定义 ==========

/** 商品图片信息 */
export interface ProductImage {
  view_name: string; // 视角名称：正面、侧面、背面、俯视、细节等
  key: string; // TOS存储key
  url: string; // 签名URL
  uploaded_at: string;
}

/** 商品信息 */
export interface Product {
  id: string;
  user_id: string;
  product_name: string;
  product_description?: string;
  category?: string;
  tags: string[];
  images: ProductImage[];
  primary_image_index: number;
  usage_count: number;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

/** 创建商品参数 */
export interface CreateProductParams {
  product_name: string;
  product_description?: string;
  category?: string;
  tags?: string[];
}

/** 上传图片参数 */
export interface UploadImageParams {
  productId: string;
  viewName: string;
  fileContent: Buffer;
  fileName: string;
  contentType: string;
}

/** 整合后的商品图片 */
export interface IntegratedProductImage {
  url: string; // 整合后的图片URL
  width: number;
  height: number;
  viewLabels: string[]; // 各视角标注
}

// ========== 存储路径管理 ==========

/** 商品图库存储路径生成器 */
class ProductStoragePath {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /** 商品图库根目录 */
  getProductRoot(): string {
    return `users/${this.userId}/products`;
  }

  /** 单个商品目录 */
  getProductDir(productId: string): string {
    return `${this.getProductRoot()}/${productId}`;
  }

  /** 商品图片路径 */
  getProductImagePath(productId: string, fileName: string): string {
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'jpg';
    return `${this.getProductDir(productId)}/images/${timestamp}_${fileName}`;
  }

  /** 整合后的图片路径 */
  getIntegratedImagePath(productId: string): string {
    return `${this.getProductDir(productId)}/integrated_${Date.now()}.jpg`;
  }
}

// ========== 服务类 ==========

class ProductLibraryService {
  /**
   * 创建商品
   */
  async createProduct(
    userId: string,
    params: CreateProductParams
  ): Promise<Product> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('product_library')
      .insert({
        user_id: userId,
        product_name: params.product_name,
        product_description: params.product_description,
        category: params.category,
        tags: params.tags || [],
        images: [],
        primary_image_index: 0,
        usage_count: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`创建商品失败: ${error.message}`);
    }

    return data as unknown as Product;
  }

  /**
   * 上传商品图片
   */
  async uploadProductImage(
    userId: string,
    params: UploadImageParams
  ): Promise<ProductImage> {
    const client = getSupabaseClient();
    const tosClient = getTosClient();
    const storagePath = new ProductStoragePath(userId);

    // 获取商品信息
    const { data: product, error: fetchError } = await client
      .from('product_library')
      .select('*')
      .eq('id', params.productId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !product) {
      throw new Error('商品不存在');
    }

    // 上传图片到TOS
    const key = storagePath.getProductImagePath(params.productId, params.fileName);
    await tosClient.putObject({
      bucket: BUCKET_NAME,
      key,
      body: params.fileContent,
      contentType: params.contentType,
    });

    // 生成签名URL（有效期7天）
    const signedUrl = tosClient.getPreSignedUrl({
      bucket: BUCKET_NAME,
      key,
      expires: 7 * 24 * 60 * 60, // 7天
    });

    // 添加图片到商品
    const newImage: ProductImage = {
      view_name: params.viewName,
      key,
      url: signedUrl,
      uploaded_at: new Date().toISOString(),
    };

    const images = [...(product.images as ProductImage[]), newImage];

    await client
      .from('product_library')
      .update({
        images,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.productId);

    return newImage;
  }

  /**
   * 获取用户的商品列表
   */
  async getProducts(
    userId: string,
    options?: {
      category?: string;
      search?: string;
      limit?: number;
    }
  ): Promise<Product[]> {
    const client = getSupabaseClient();

    let query = client
      .from('product_library')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    if (options?.search) {
      query = query.ilike('product_name', `%${options.search}%`);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`获取商品列表失败: ${error.message}`);
    }

    // 刷新图片URL
    const products = (data as unknown as Product[]).map(p => this.refreshImageUrls(p));

    return products;
  }

  /**
   * 根据名称查找商品
   */
  async findProductByName(userId: string, productName: string): Promise<Product | null> {
    const client = getSupabaseClient();

    // 支持模糊匹配
    const { data, error } = await client
      .from('product_library')
      .select('*')
      .eq('user_id', userId)
      .ilike('product_name', `%${productName}%`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.refreshImageUrls(data as unknown as Product);
  }

  /**
   * 根据ID获取商品
   */
  async getProduct(userId: string, productId: string): Promise<Product | null> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('product_library')
      .select('*')
      .eq('id', productId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return this.refreshImageUrls(data as unknown as Product);
  }

  /**
   * 更新商品信息
   */
  async updateProduct(
    userId: string,
    productId: string,
    updates: Partial<Pick<Product, 'product_name' | 'product_description' | 'category' | 'tags' | 'primary_image_index'>>
  ): Promise<Product> {
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('product_library')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新商品失败: ${error.message}`);
    }

    return this.refreshImageUrls(data as unknown as Product);
  }

  /**
   * 删除商品图片
   */
  async deleteProductImage(
    userId: string,
    productId: string,
    imageKey: string
  ): Promise<void> {
    const client = getSupabaseClient();
    const tosClient = getTosClient();

    // 获取商品
    const product = await this.getProduct(userId, productId);
    if (!product) {
      throw new Error('商品不存在');
    }

    // 删除TOS中的图片
    try {
      await tosClient.deleteObject({
        bucket: BUCKET_NAME,
        key: imageKey,
      });
    } catch (error) {
      console.warn('删除TOS图片失败:', error);
    }

    // 更新商品图片列表
    const images = product.images.filter(img => img.key !== imageKey);
    await client
      .from('product_library')
      .update({
        images,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);
  }

  /**
   * 删除商品
   */
  async deleteProduct(userId: string, productId: string): Promise<void> {
    const client = getSupabaseClient();
    const tosClient = getTosClient();

    // 获取商品
    const product = await this.getProduct(userId, productId);
    if (!product) {
      return;
    }

    // 删除TOS中的所有图片
    for (const image of product.images) {
      try {
        await tosClient.deleteObject({
          bucket: BUCKET_NAME,
          key: image.key,
        });
      } catch (error) {
        console.warn('删除TOS图片失败:', error);
      }
    }

    // 删除商品记录
    await client
      .from('product_library')
      .delete()
      .eq('id', productId)
      .eq('user_id', userId);
  }

  /**
   * 记录商品使用
   */
  async recordUsage(userId: string, productId: string): Promise<void> {
    const client = getSupabaseClient();

    await client.rpc('increment_product_usage', { product_id: productId });
  }

  /**
   * 整合多视角商品图片
   * 将多个视角的图片拼接成一张图，并添加标注
   */
  async integrateProductImages(
    userId: string,
    productId: string,
    options?: {
      maxImages?: number; // 最多整合几张图，默认4张
      layout?: 'grid' | 'horizontal' | 'vertical'; // 布局方式
    }
  ): Promise<IntegratedProductImage | null> {
    const product = await this.getProduct(userId, productId);
    if (!product || product.images.length === 0) {
      return null;
    }

    const maxImages = options?.maxImages || 4;
    const layout = options?.layout || 'grid';

    // 选择要整合的图片
    const selectedImages = product.images.slice(0, maxImages);
    if (selectedImages.length === 0) {
      return null;
    }

    // 如果只有一张图，直接返回
    if (selectedImages.length === 1) {
      return {
        url: selectedImages[0].url,
        width: 1024,
        height: 1024,
        viewLabels: [selectedImages[0].view_name],
      };
    }

    // 计算拼接布局
    const { width, height, positions } = this.calculateLayout(
      selectedImages.length,
      layout
    );

    // 构建整合描述（用于提示Seedance理解各视角）
    const viewDescriptions = selectedImages.map((img, index) => {
      const pos = positions[index];
      return `${img.view_name}视角位于图片的${this.getPositionDescription(pos, width, height)}`;
    });

    // 返回整合信息（实际拼接由前端或专门的图片处理服务完成）
    // 这里返回第一张图作为参考，并附带拼接信息
    return {
      url: selectedImages[0].url, // 实际应用中需要拼接处理
      width,
      height,
      viewLabels: selectedImages.map(img => img.view_name),
      // 拼接描述，用于生成Seedance提示词
      integrationInfo: {
        layout,
        positions,
        viewDescriptions,
        originalImages: selectedImages.map(img => ({
          url: img.url,
          viewName: img.view_name,
        })),
      },
    } as IntegratedProductImage & { integrationInfo: unknown };
  }

  /**
   * 为Seedance生成商品参考提示词
   */
  async generateProductPrompt(
    userId: string,
    productName: string
  ): Promise<{
    found: boolean;
    product?: Product;
    referencePrompt?: string;
    imageUrls?: string[];
  }> {
    const product = await this.findProductByName(userId, productName);

    if (!product) {
      return { found: false };
    }

    // 更新使用计数
    await this.recordUsage(userId, product.id);

    // 构建参考提示词
    const imageUrls = product.images.map(img => img.url);
    const viewLabels = product.images.map(img => img.view_name);

    let referencePrompt = `商品: ${product.product_name}`;
    if (product.product_description) {
      referencePrompt += `。${product.product_description}`;
    }
    if (viewLabels.length > 0) {
      referencePrompt += `。商品外观包含: ${viewLabels.join('、')}等视角`;
    }

    return {
      found: true,
      product,
      referencePrompt,
      imageUrls,
    };
  }

  // ========== 私有方法 ==========

  /**
   * 刷新图片URL
   */
  private refreshImageUrls(product: Product): Product {
    const tosClient = getTosClient();

    const refreshedImages = product.images.map(img => ({
      ...img,
      url: tosClient.getPreSignedUrl({
        bucket: BUCKET_NAME,
        key: img.key,
        expires: 7 * 24 * 60 * 60, // 7天
      }),
    }));

    return {
      ...product,
      images: refreshedImages,
    };
  }

  /**
   * 计算拼接布局
   */
  private calculateLayout(
    imageCount: number,
    layout: 'grid' | 'horizontal' | 'vertical'
  ): {
    width: number;
    height: number;
    positions: Array<{ x: number; y: number; w: number; h: number }>;
  } {
    const singleSize = 512;

    if (layout === 'horizontal') {
      return {
        width: singleSize * imageCount,
        height: singleSize,
        positions: Array.from({ length: imageCount }, (_, i) => ({
          x: i * singleSize,
          y: 0,
          w: singleSize,
          h: singleSize,
        })),
      };
    }

    if (layout === 'vertical') {
      return {
        width: singleSize,
        height: singleSize * imageCount,
        positions: Array.from({ length: imageCount }, (_, i) => ({
          x: 0,
          y: i * singleSize,
          w: singleSize,
          h: singleSize,
        })),
      };
    }

    // grid布局
    const cols = Math.ceil(Math.sqrt(imageCount));
    const rows = Math.ceil(imageCount / cols);

    const positions: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (let i = 0; i < imageCount; i++) {
      positions.push({
        x: (i % cols) * singleSize,
        y: Math.floor(i / cols) * singleSize,
        w: singleSize,
        h: singleSize,
      });
    }

    return {
      width: cols * singleSize,
      height: rows * singleSize,
      positions,
    };
  }

  /**
   * 获取位置描述
   */
  private getPositionDescription(
    pos: { x: number; y: number },
    totalWidth: number,
    totalHeight: number
  ): string {
    const horizontal = pos.x < totalWidth / 2 ? '左侧' : pos.x > totalWidth / 2 ? '右侧' : '中间';
    const vertical = pos.y < totalHeight / 2 ? '上部' : pos.y > totalHeight / 2 ? '下部' : '中间';

    if (horizontal === '中间' && vertical === '中间') {
      return '中央';
    }

    return `${vertical}${horizontal}`;
  }
}

// ========== 导出 ==========

export const productLibraryService = new ProductLibraryService();
export { ProductLibraryService };
