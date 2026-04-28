/**
 * TOS 对象存储服务
 * 使用火山引擎官方 TOS SDK
 */

import * as TOS from '@volcengine/tos-sdk';

const BUCKET_NAME = process.env.TOS_BUCKET_NAME || 'hmhv';
const ENDPOINT = process.env.TOS_ENDPOINT || 'tos-cn-beijing.volces.com';

// TOS 客户端构造函数
interface TosModuleLike {
  default?: new (options: {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    endpoint: string;
  }) => TOS.TosClient;
  TosClient: new (options: {
    accessKeyId: string;
    accessKeySecret: string;
    region: string;
    endpoint: string;
  }) => TOS.TosClient;
}

type PutObjectAclCall = (params: {
  bucket: string;
  key: string;
  acl?: string;
  headers?: Record<string, string>;
}) => Promise<unknown>;

const TosClient = ((TOS as unknown as TosModuleLike).default || (TOS as unknown as TosModuleLike).TosClient);

// 延迟初始化 TOS 客户端
let tosClient: TOS.TosClient | null = null;

function getTosClient(): TOS.TosClient {
  if (!tosClient) {
    // 每次初始化时重新读取环境变量，确保配置是最新的
    const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID || '';
    const accessKeySecret = process.env.VOLCENGINE_SECRET_ACCESS_KEY || '';
    const region = process.env.TOS_REGION || process.env.VOLCENGINE_REGION || 'cn-beijing';

    console.log('[TOS] 初始化客户端配置:', {
      region,
      endpoint: ENDPOINT,
      hasCredentials: !!accessKeyId && !!accessKeySecret,
    });

    tosClient = new TosClient({
      accessKeyId,
      accessKeySecret,
      region,
      endpoint: ENDPOINT,
    });
    console.log('[TOS] 客户端初始化完成');
  }
  return tosClient as TOS.TosClient;
}

// 导出
export { getTosClient, BUCKET_NAME, ENDPOINT };

/**
 * 用户存储路径生成器
 */
export class UserStorage {
  private userId: string;
  private storagePath: string;

  constructor(userId: string, customPath?: string) {
    this.userId = userId;
    this.storagePath = customPath || `users/${userId}`;
  }

  getUserRoot(): string {
    return this.storagePath;
  }

  getUserId(): string {
    return this.userId;
  }

  getVideoPath(fileName: string): string {
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'mp4';
    return `${this.getUserRoot()}/videos/video_${timestamp}.${ext}`;
  }

  getImagePath(fileName: string): string {
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'jpg';
    return `${this.getUserRoot()}/images/img_${timestamp}.${ext}`;
  }

  getTempPath(fileName: string): string {
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'tmp';
    return `${this.getUserRoot()}/temp/temp_${timestamp}.${ext}`;
  }
}

/**
 * 视频存储服务
 */
export class VideoStorageService {
  /**
   * 从 URL 下载视频并存储到 TOS
   */
  static async storeVideoFromUrl(
    userId: string,
    videoUrl: string,
    options?: {
      taskId?: string;
      duration?: number;
      storagePath?: string;
    }
  ): Promise<string> {
    const userStorage = new UserStorage(userId, options?.storagePath);

    const fileName = options?.taskId
      ? `video_${options.taskId}.mp4`
      : `video_${Date.now()}.mp4`;
    const targetKey = userStorage.getVideoPath(fileName);

    console.log(`[TOS] 开始下载视频: ${videoUrl.substring(0, 50)}...`);
    console.log(`[TOS] 目标路径: ${targetKey}`);

    try {
      // 1. 下载视频内容
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error(`下载视频失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const fileContent = Buffer.from(arrayBuffer);

      console.log(`[TOS] 视频下载完成，大小: ${(fileContent.length / 1024 / 1024).toFixed(2)} MB`);

      // 2. 使用火山引擎 TOS SDK 上传
      const client = getTosClient();
      await client.putObject({
        bucket: BUCKET_NAME,
        key: targetKey,
        body: fileContent,
        contentType: 'video/mp4',
      });

      console.log(`[TOS] 视频存储成功，key: ${targetKey}`);
      return targetKey;
    } catch (error) {
      console.error('[TOS] 视频存储失败:', error);
      throw new Error(`视频存储失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 上传本地视频文件到 TOS
   */
  static async uploadVideo(
    userId: string,
    fileContent: Buffer,
    fileName: string,
    storagePath?: string
  ): Promise<string> {
    const userStorage = new UserStorage(userId, storagePath);
    const targetKey = userStorage.getVideoPath(fileName);

    console.log(`[TOS] 上传视频: ${targetKey}`);

    try {
      const client = getTosClient();
      await client.putObject({
        bucket: BUCKET_NAME,
        key: targetKey,
        body: fileContent,
        contentType: 'video/mp4',
      });

      console.log(`[TOS] 视频上传成功，key: ${targetKey}`);
      return targetKey;
    } catch (error) {
      console.error('[TOS] 视频上传失败:', error);
      throw new Error(`视频上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取视频签名 URL
   */
  static async getVideoUrl(key: string, expireTime: number = 3600): Promise<string> {
    if (!key) {
      throw new Error('存储 key 不能为空');
    }

    try {
      // 使用 TOS SDK 的 getPreSignedUrl 方法生成签名 URL
      const client = getTosClient();
      const signedUrl = client.getPreSignedUrl({
        bucket: BUCKET_NAME,
        key: key,
        method: 'GET',
        expires: expireTime,
      });

      return signedUrl;
    } catch (error) {
      console.error('[TOS] 生成签名 URL 失败:', error);
      throw new Error(`生成签名 URL 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 删除视频
   */
  static async deleteVideo(key: string): Promise<boolean> {
    try {
      const client = getTosClient();
      await client.deleteObject({
        bucket: BUCKET_NAME,
        key: key,
      });
      console.log(`[TOS] 视频删除成功: ${key}`);
      return true;
    } catch (error) {
      console.error('[TOS] 视频删除失败:', error);
      return false;
    }
  }

  /**
   * 检查视频是否存在
   */
  static async videoExists(key: string): Promise<boolean> {
    try {
      const client = getTosClient();
      await client.headObject({
        bucket: BUCKET_NAME,
        key: key,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出用户的所有视频
   */
  static async listUserVideos(userId: string, maxKeys: number = 100): Promise<string[]> {
    const userStorage = new UserStorage(userId);
    const prefix = `${userStorage.getUserRoot()}/videos/`;

    try {
      const client = getTosClient();
      const result = await client.listObjectsType2({
        bucket: BUCKET_NAME,
        prefix: prefix,
        maxKeys: maxKeys,
      });

      // TosResponse 包装了 data 属性
      return (result.data?.Contents || []).map((obj) => obj.Key).filter((key): key is string => !!key);
    } catch (error) {
      console.error('[TOS] 列出视频失败:', error);
      return [];
    }
  }

  /**
   * 获取公开可访问的 URL
   * 注意：需要先调用 setPublicRead 设置公开读取权限
   */
  static getPublicUrl(key: string): string {
    return `https://${BUCKET_NAME}.${ENDPOINT}/${key}`;
  }

  /**
   * 获取视频的公开可访问 URL（便捷方法）
   */
  static getVideoPublicUrl(key: string): string {
    return VideoStorageService.getPublicUrl(key);
  }

  /**
   * 设置对象为公开读取
   * 上传后调用此方法，使文件可以通过公开 URL 访问
   */
  static async setPublicRead(key: string): Promise<boolean> {
    try {
      const client = getTosClient();
      await (client.putObjectAcl as unknown as PutObjectAclCall)({
        bucket: BUCKET_NAME,
        key: key,
        acl: 'public-read',
      });
      console.log(`[TOS] 设置公开读取成功: ${key}`);
      return true;
    } catch (error) {
      console.error('[TOS] 设置公开读取失败:', error);
      // 尝试使用 headers 方式
      try {
        const client = getTosClient();
        await (client.putObjectAcl as unknown as PutObjectAclCall)({
          bucket: BUCKET_NAME,
          key: key,
          headers: {
            'x-tos-acl': 'public-read',
          },
        });
        console.log(`[TOS] 使用 headers 方式设置公开读取成功: ${key}`);
        return true;
      } catch (error2) {
        console.error('[TOS] headers 方式也失败:', error2);
        return false;
      }
    }
  }
}

/**
 * 学习库存储服务
 */
export class LearningLibraryStorage {
  /**
   * 获取预签名上传URL（用于前端直接上传大文件）
   */
  static async getPresignedUploadUrl(
    userId: string,
    fileName: string
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    // 生成文件 key：使用 users/{userId}/learning-videos/ 前缀（与确认API一致）
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'mp4';
    const fileKey = `users/${userId}/learning-videos/video_${timestamp}.${ext}`;

    console.log(`[TOS] 生成预签名上传URL: ${fileKey}`);

    try {
      // 使用 TOS SDK 生成预签名上传 URL
      const client = getTosClient();
      const uploadUrl = await client.getPreSignedUrl({
        bucket: BUCKET_NAME,
        key: fileKey,
        method: 'PUT', // 使用 PUT 方法上传
        expires: 3600, // 1小时有效
      });

      console.log(`[TOS] 预签名URL生成成功`);
      return { uploadUrl, fileKey };
    } catch (error) {
      console.error('[TOS] 生成预签名URL失败:', error);
      throw new Error(`生成上传地址失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 上传视频到学习库
   */
  static async uploadLearningVideo(
    userId: string,
    fileContent: Buffer,
    fileName: string,
    contentType: string = 'video/mp4'
  ): Promise<string> {
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'mp4';
    const targetKey = `users/${userId}/learning-videos/video_${timestamp}_${Math.random().toString(36).substring(7)}.${ext}`;

    console.log(`[TOS] 上传学习库视频: ${targetKey}`);

    try {
      const client = getTosClient();
      await client.putObject({
        bucket: BUCKET_NAME,
        key: targetKey,
        body: fileContent,
        contentType: contentType,
      });

      console.log(`[TOS] 学习库视频上传成功，key: ${targetKey}`);
      return targetKey;
    } catch (error) {
      console.error('[TOS] 学习库视频上传失败:', error);
      throw new Error(`学习库视频上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取学习库视频签名 URL
   */
  static async getLearningVideoUrl(key: string, expireTime: number = 24 * 3600): Promise<string> {
    return VideoStorageService.getVideoUrl(key, expireTime);
  }

  /**
   * 删除学习库视频
   */
  static async deleteLearningVideo(key: string): Promise<boolean> {
    return VideoStorageService.deleteVideo(key);
  }

  /**
   * 列出用户的学习库视频
   */
  static async listUserLearningVideos(userId: string, maxKeys: number = 100): Promise<string[]> {
    const prefix = `users/${userId}/learning-videos/`;

    try {
      const client = getTosClient();
      const result = await client.listObjectsType2({
        bucket: BUCKET_NAME,
        prefix: prefix,
        maxKeys: maxKeys,
      });

      return (result.data?.Contents || []).map((obj) => obj.Key).filter((key): key is string => !!key);
    } catch (error) {
      console.error('[TOS] 列出学习库视频失败:', error);
      return [];
    }
  }
}
