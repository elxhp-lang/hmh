/**
 * 多视角图片整合服务
 * 将多个视角的商品图片拼接成单一图片，并添加标注
 * 用于Seedance 2.0理解商品的多视角外观
 */

import sharp from 'sharp';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';

// ========== 类型定义 ==========

/** 单个图片信息 */
export interface ImageInfo {
  url: string;
  viewName: string;
  key?: string;
}

/** 拼接布局 */
export type LayoutType = 'grid' | 'horizontal' | 'vertical';

/** 整合结果 */
export interface IntegrationResult {
  url: string; // 整合后的图片URL
  key: string; // TOS存储key
  width: number;
  height: number;
  viewLabels: string[];
  viewDescriptions: string[];
}

/** 整合选项 */
export interface IntegrationOptions {
  maxImages?: number; // 最多整合几张图，默认4张
  layout?: LayoutType; // 布局方式，默认grid
  imageSize?: number; // 单个图片尺寸，默认512
  padding?: number; // 图片间距，默认10
  backgroundColor?: string; // 背景颜色，默认白色
  labelBackgroundColor?: string; // 标签背景色
  labelTextColor?: string; // 标签文字颜色
  labelFontSize?: number; // 标签字体大小
}

// ========== 默认配置 ==========

const DEFAULT_OPTIONS: Required<IntegrationOptions> = {
  maxImages: 4,
  layout: 'grid',
  imageSize: 512,
  padding: 10,
  backgroundColor: '#ffffff',
  labelBackgroundColor: 'rgba(0, 0, 0, 0.7)',
  labelTextColor: '#ffffff',
  labelFontSize: 24,
};

// ========== 服务类 ==========

class ImageIntegrationService {
  /**
   * 整合多视角图片
   */
  async integrateImages(
    images: ImageInfo[],
    userId: string,
    productId: string,
    options?: IntegrationOptions
  ): Promise<IntegrationResult | null> {
    if (!images || images.length === 0) {
      return null;
    }

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const selectedImages = images.slice(0, opts.maxImages);

    if (selectedImages.length === 0) {
      return null;
    }

    // 如果只有一张图，添加标注后返回
    if (selectedImages.length === 1) {
      return await this.processSingleImage(selectedImages[0], userId, productId, opts);
    }

    // 下载所有图片
    const imageBuffers = await this.downloadImages(selectedImages);

    // 计算布局
    const layout = this.calculateLayout(selectedImages.length, opts);

    // 创建拼接图片
    const compositeBuffer = await this.createCompositeImage(
      imageBuffers,
      layout,
      selectedImages.map(img => img.viewName),
      opts
    );

    // 上传到TOS
    const key = `users/${userId}/products/${productId}/integrated_${Date.now()}.jpg`;
    await this.uploadToTos(key, compositeBuffer);

    // 生成签名URL
    const url = this.generateSignedUrl(key);

    // 生成视角描述
    const viewDescriptions = this.generateViewDescriptions(
      selectedImages,
      layout,
      opts
    );

    return {
      url,
      key,
      width: layout.totalWidth,
      height: layout.totalHeight,
      viewLabels: selectedImages.map(img => img.viewName),
      viewDescriptions,
    };
  }

  /**
   * 处理单张图片（添加标注）
   */
  private async processSingleImage(
    image: ImageInfo,
    userId: string,
    productId: string,
    opts: Required<IntegrationOptions>
  ): Promise<IntegrationResult> {
    // 下载图片
    const response = await fetch(image.url);
    const buffer = Buffer.from(await response.arrayBuffer());

    // 添加视角标签
    const labeledBuffer = await this.addLabelToImage(
      buffer,
      image.viewName,
      opts
    );

    // 上传到TOS
    const key = `users/${userId}/products/${productId}/integrated_${Date.now()}.jpg`;
    await this.uploadToTos(key, labeledBuffer);

    const url = this.generateSignedUrl(key);

    return {
      url,
      key,
      width: opts.imageSize,
      height: opts.imageSize,
      viewLabels: [image.viewName],
      viewDescriptions: [`${image.viewName}视角`],
    };
  }

  /**
   * 下载所有图片
   */
  private async downloadImages(images: ImageInfo[]): Promise<Buffer[]> {
    const buffers: Buffer[] = [];

    for (const image of images) {
      try {
        const response = await fetch(image.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        buffers.push(buffer);
      } catch (error) {
        console.error(`下载图片失败: ${image.url}`, error);
        // 创建占位图片
        buffers.push(await this.createPlaceholderImage(image.viewName));
      }
    }

    return buffers;
  }

  /**
   * 创建占位图片
   */
  private async createPlaceholderImage(label: string): Promise<Buffer> {
    return await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .composite([
        {
          input: Buffer.from(`
            <svg width="512" height="512">
              <rect width="512" height="512" fill="#f0f0f0"/>
              <text x="256" y="256" text-anchor="middle" font-size="24" fill="#999">${label}</text>
            </svg>
          `),
          top: 0,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();
  }

  /**
   * 计算布局
   */
  private calculateLayout(
    imageCount: number,
    opts: Required<IntegrationOptions>
  ): {
    cols: number;
    rows: number;
    totalWidth: number;
    totalHeight: number;
    positions: Array<{ x: number; y: number }>;
  } {
    const { layout, imageSize, padding } = opts;
    const totalPadding = padding * 2;

    if (layout === 'horizontal') {
      return {
        cols: imageCount,
        rows: 1,
        totalWidth: imageSize * imageCount + padding * (imageCount + 1),
        totalHeight: imageSize + totalPadding,
        positions: Array.from({ length: imageCount }, (_, i) => ({
          x: padding + i * (imageSize + padding),
          y: padding,
        })),
      };
    }

    if (layout === 'vertical') {
      return {
        cols: 1,
        rows: imageCount,
        totalWidth: imageSize + totalPadding,
        totalHeight: imageSize * imageCount + padding * (imageCount + 1),
        positions: Array.from({ length: imageCount }, (_, i) => ({
          x: padding,
          y: padding + i * (imageSize + padding),
        })),
      };
    }

    // grid布局
    const cols = Math.ceil(Math.sqrt(imageCount));
    const rows = Math.ceil(imageCount / cols);

    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < imageCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: padding + col * (imageSize + padding),
        y: padding + row * (imageSize + padding),
      });
    }

    return {
      cols,
      rows,
      totalWidth: cols * imageSize + padding * (cols + 1),
      totalHeight: rows * imageSize + padding * (rows + 1),
      positions,
    };
  }

  /**
   * 创建拼接图片
   */
  private async createCompositeImage(
    imageBuffers: Buffer[],
    layout: {
      cols: number;
      rows: number;
      totalWidth: number;
      totalHeight: number;
      positions: Array<{ x: number; y: number }>;
    },
    viewNames: string[],
    opts: Required<IntegrationOptions>
  ): Promise<Buffer> {
    // 创建空白画布
    const canvas = sharp({
      create: {
        width: layout.totalWidth,
        height: layout.totalHeight,
        channels: 3,
        background: opts.backgroundColor,
      },
    });

    // 处理每张图片：调整大小并添加标签
    const processedImages = await Promise.all(
      imageBuffers.map(async (buffer, index) => {
        // 调整图片大小
        let processed = sharp(buffer)
          .resize(opts.imageSize, opts.imageSize, {
            fit: 'cover',
            position: 'center',
          });

        // 添加视角标签
        const labelSvg = this.createLabelSvg(viewNames[index], opts);
        processed = processed.composite([
          {
            input: Buffer.from(labelSvg),
            top: opts.imageSize - 40,
            left: 0,
          },
        ]);

        const processedBuffer = await processed.jpeg().toBuffer();

        return {
          buffer: processedBuffer,
          position: layout.positions[index],
        };
      })
    );

    // 组合所有图片
    const compositeOperations = processedImages.map(img => ({
      input: img.buffer,
      top: img.position.y,
      left: img.position.x,
    }));

    return await canvas.composite(compositeOperations).jpeg().toBuffer();
  }

  /**
   * 创建标签SVG
   */
  private createLabelSvg(
    label: string,
    opts: Required<IntegrationOptions>
  ): string {
    const width = opts.imageSize;
    const height = 40;
    const fontSize = opts.labelFontSize;

    return `
      <svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${opts.labelBackgroundColor}"/>
        <text 
          x="${width / 2}" 
          y="${height / 2 + fontSize / 3}" 
          text-anchor="middle" 
          font-size="${fontSize}" 
          font-family="Arial, sans-serif"
          fill="${opts.labelTextColor}"
        >${label}</text>
      </svg>
    `;
  }

  /**
   * 为单张图片添加标签
   */
  private async addLabelToImage(
    imageBuffer: Buffer,
    label: string,
    opts: Required<IntegrationOptions>
  ): Promise<Buffer> {
    const resized = await sharp(imageBuffer)
      .resize(opts.imageSize, opts.imageSize, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg()
      .toBuffer();

    const labelSvg = this.createLabelSvg(label, opts);

    return await sharp(resized)
      .composite([
        {
          input: Buffer.from(labelSvg),
          top: opts.imageSize - 40,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();
  }

  /**
   * 生成视角描述
   */
  private generateViewDescriptions(
    images: ImageInfo[],
    layout: { totalWidth: number; totalHeight: number; positions: Array<{ x: number; y: number }> },
    opts: Required<IntegrationOptions>
  ): string[] {
    return images.map((img, index) => {
      const pos = layout.positions[index];
      const positionDesc = this.getPositionDescription(
        pos,
        layout.totalWidth,
        layout.totalHeight,
        opts.imageSize
      );
      return `${img.viewName}视角位于图片的${positionDesc}`;
    });
  }

  /**
   * 获取位置描述
   */
  private getPositionDescription(
    pos: { x: number; y: number },
    totalWidth: number,
    totalHeight: number,
    imageSize: number
  ): string {
    const centerX = pos.x + imageSize / 2;
    const centerY = pos.y + imageSize / 2;

    const horizontal =
      centerX < totalWidth / 3
        ? '左侧'
        : centerX > (totalWidth * 2) / 3
          ? '右侧'
          : '中间';
    const vertical =
      centerY < totalHeight / 3
        ? '上部'
        : centerY > (totalHeight * 2) / 3
          ? '下部'
          : '中部';

    if (horizontal === '中间' && vertical === '中部') {
      return '中央';
    }

    return `${vertical}${horizontal}`;
  }

  /**
   * 上传到TOS
   */
  private async uploadToTos(key: string, buffer: Buffer): Promise<void> {
    const tosClient = getTosClient();

    await tosClient.putObject({
      bucket: BUCKET_NAME,
      key,
      body: buffer,
      contentType: 'image/jpeg',
    });
  }

  /**
   * 生成签名URL
   */
  private generateSignedUrl(key: string): string {
    const tosClient = getTosClient();

    return tosClient.getPreSignedUrl({
      bucket: BUCKET_NAME,
      key,
      expires: 7 * 24 * 60 * 60, // 7天
    });
  }
}

// ========== 导出 ==========

export const imageIntegrationService = new ImageIntegrationService();
export { ImageIntegrationService };
