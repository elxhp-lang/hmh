/**
 * 视频链接解析服务
 * 支持多平台视频链接解析：抖音、快手、视频号、B站、小红书等
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getYtDlpBinary } from './media-binaries';

const execFileAsync = promisify(execFile);

export type VideoPlatform = 
  | 'douyin' 
  | 'kuaishou' 
  | 'bilibili' 
  | 'xiaohongshu' 
  | 'weibo' 
  | 'weixin' 
  | 'shipinhao'
  | 'other';

export interface VideoLinkInfo {
  platform: VideoPlatform;
  videoId: string;
  title: string;
  description?: string;
  author?: string;
  authorId?: string;
  cover?: string;
  videoUrl?: string;
  duration?: number; // 秒
  likes?: number;
  comments?: number;
  shares?: number;
  originalUrl: string;
  tags?: string[];
  extra?: Record<string, unknown>;
}

export interface YtDlpExtractResult {
  videoUrl?: string;
  title?: string;
  duration?: number;
  uploader?: string;
  thumbnail?: string;
  extractor?: string;
}

// 平台配置
export const PLATFORM_CONFIG: Record<VideoPlatform, {
  name: string;
  icon: string;
  color: string;
  patterns: RegExp[];
}> = {
  douyin: {
    name: '抖音',
    icon: '🎵',
    color: '#000000',
    patterns: [
      /https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/,
      /https?:\/\/www\.douyin\.com\/video\/\d+/,
      /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+/,
    ],
  },
  kuaishou: {
    name: '快手',
    icon: '⚡',
    color: '#FF6600',
    patterns: [
      /https?:\/\/v\.kuaishou\.com\/[A-Za-z0-9]+/,
      /https?:\/\/www\.kuaishou\.com\/short-video\/[A-Za-z0-9]+/,
      /https?:\/\/kuaishou\.cn\/short-video\/[A-Za-z0-9]+/,
    ],
  },
  bilibili: {
    name: 'B站',
    icon: '📺',
    color: '#00A1D6',
    patterns: [
      /https?:\/\/www\.bilibili\.com\/video\/BV[A-Za-z0-9]+/,
      /https?:\/\/www\.bilibili\.com\/video\/av\d+/,
      /https?:\/\/b23\.tv\/[A-Za-z0-9]+/,
    ],
  },
  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    color: '#FF2442',
    patterns: [
      /https?:\/\/www\.xiaohongshu\.com\/discovery\/item\/[A-Za-z0-9]+/,
      /https?:\/\/www\.xiaohongshu\.com\/explore\/[A-Za-z0-9]+/,
      /https?:\/\/xhslink\.com\/[A-Za-z0-9]+/,
    ],
  },
  weibo: {
    name: '微博',
    icon: '🐦',
    color: '#E6162D',
    patterns: [
      /https?:\/\/weibo\.com\/\d+\/[A-Za-z0-9]+/,
      /https?:\/\/m\.weibo\.cn\/status\/\d+/,
      /https?:\/\/t\.cn\/[A-Za-z0-9]+/,
    ],
  },
  weixin: {
    name: '微信',
    icon: '💬',
    color: '#07C160',
    patterns: [
      /https?:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+/,
    ],
  },
  shipinhao: {
    name: '视频号',
    icon: '🎬',
    color: '#07C160',
    patterns: [
      /https?:\/\/finder\.video\.qq\.com\/\d+/,
      /https?:\/\/channels\.weixin\.qq\.com\/[A-Za-z0-9]+/,
    ],
  },
  other: {
    name: '其他',
    icon: '🎬',
    color: '#666666',
    patterns: [],
  },
};

/**
 * 视频链接解析服务类
 */
export class VideoLinkParser {
  /**
   * 检测链接所属平台
   */
  static detectPlatform(url: string): VideoPlatform {
    for (const [platform, config] of Object.entries(PLATFORM_CONFIG)) {
      if (config.patterns.some(pattern => pattern.test(url))) {
        return platform as VideoPlatform;
      }
    }
    return 'other';
  }

  /**
   * 解析视频链接
   */
  static async parse(url: string): Promise<VideoLinkInfo> {
    const platform = this.detectPlatform(url);
    
    switch (platform) {
      case 'douyin':
        return this.parseDouyin(url);
      case 'kuaishou':
        return this.parseKuaishou(url);
      case 'bilibili':
        return this.parseBilibili(url);
      case 'xiaohongshu':
        return this.parseXiaohongshu(url);
      case 'weibo':
        return this.parseWeibo(url);
      default:
        return this.parseGeneric(url);
    }
  }

  /**
   * 解析抖音链接
   */
  private static async parseDouyin(url: string): Promise<VideoLinkInfo> {
    try {
      // 获取重定向后的真实链接
      const redirectResponse = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });

      const finalUrl = redirectResponse.url;
      const videoIdMatch = finalUrl.match(/video\/(\d+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : '';

      if (!videoId) {
        return this.createFallbackInfo('douyin', url, '无法获取视频ID');
      }

      // 获取视频信息
      const apiResponse = await fetch(
        `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
            'Referer': 'https://www.douyin.com/',
          },
        }
      );

      if (!apiResponse.ok) {
        return this.createFallbackInfo('douyin', url, videoId);
      }

      const data = await apiResponse.json();
      const item = data.item_list?.[0];

      if (!item) {
        return this.createFallbackInfo('douyin', url, videoId);
      }

      const playUrl = item.video?.play_addr?.url_list?.[0];
      
      return {
        platform: 'douyin',
        videoId,
        title: item.desc || `抖音视频_${videoId}`,
        description: item.desc,
        author: item.author?.nickname,
        authorId: item.author?.unique_id,
        cover: item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0],
        videoUrl: playUrl ? playUrl.replace(/playwm/, 'play') : undefined,
        duration: Math.floor((item.video?.duration || 0) / 1000),
        likes: item.statistics?.digg_count,
        comments: item.statistics?.comment_count,
        shares: item.statistics?.share_count,
        originalUrl: url,
        tags: item.text_extra?.map((t: { hashtag_name?: string }) => t.hashtag_name).filter(Boolean),
      };
    } catch (error) {
      console.error('[视频解析] 抖音解析失败:', error);
      return this.createFallbackInfo('douyin', url);
    }
  }

  /**
   * 解析快手链接
   */
  private static async parseKuaishou(url: string): Promise<VideoLinkInfo> {
    try {
      // 快手链接解析逻辑
      const redirectResponse = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });

      const finalUrl = redirectResponse.url;
      const videoIdMatch = finalUrl.match(/short-video\/([A-Za-z0-9]+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : '';

      return {
        platform: 'kuaishou',
        videoId,
        title: `快手视频_${videoId}`,
        originalUrl: url,
        extra: { finalUrl },
      };
    } catch (error) {
      console.error('[视频解析] 快手解析失败:', error);
      return this.createFallbackInfo('kuaishou', url);
    }
  }

  /**
   * 解析B站链接
   */
  private static async parseBilibili(url: string): Promise<VideoLinkInfo> {
    try {
      // 提取BV号或av号
      const bvMatch = url.match(/BV([A-Za-z0-9]+)/);
      const avMatch = url.match(/av(\d+)/);
      const b23Match = url.match(/b23\.tv\/([A-Za-z0-9]+)/);
      
      let videoId = '';
      if (bvMatch) {
        videoId = `BV${bvMatch[1]}`;
      } else if (avMatch) {
        videoId = `av${avMatch[1]}`;
      } else if (b23Match) {
        // 短链接需要解析
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        const finalUrl = redirectResponse.url;
        const bvMatch2 = finalUrl.match(/BV([A-Za-z0-9]+)/);
        if (bvMatch2) {
          videoId = `BV${bvMatch2[1]}`;
        }
      }

      if (!videoId) {
        return this.createFallbackInfo('bilibili', url);
      }

      // B站 API 获取视频信息
      const apiUrl = videoId.startsWith('BV')
        ? `https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`
        : `https://api.bilibili.com/x/web-interface/view?aid=${videoId.replace('av', '')}`;

      const apiResponse = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com/',
        },
      });

      if (!apiResponse.ok) {
        return this.createFallbackInfo('bilibili', url, videoId);
      }

      const data = await apiResponse.json();
      
      if (data.code !== 0 || !data.data) {
        return this.createFallbackInfo('bilibili', url, videoId);
      }

      const item = data.data;
      
      return {
        platform: 'bilibili',
        videoId,
        title: item.title,
        description: item.desc,
        author: item.owner?.name,
        authorId: item.owner?.mid?.toString(),
        cover: item.pic,
        duration: item.duration,
        likes: item.stat?.like,
        comments: item.stat?.reply,
        shares: item.stat?.share,
        originalUrl: url,
        tags: item.tag?.split(','),
        extra: {
          view: item.stat?.view,
          danmaku: item.stat?.danmaku,
        },
      };
    } catch (error) {
      console.error('[视频解析] B站解析失败:', error);
      return this.createFallbackInfo('bilibili', url);
    }
  }

  /**
   * 解析小红书链接
   */
  private static async parseXiaohongshu(url: string): Promise<VideoLinkInfo> {
    try {
      // 提取笔记ID
      const noteMatch = url.match(/(?:item|explore)\/([A-Za-z0-9]+)/);
      const videoId = noteMatch ? noteMatch[1] : '';

      return {
        platform: 'xiaohongshu',
        videoId,
        title: `小红书笔记_${videoId}`,
        originalUrl: url,
      };
    } catch (error) {
      console.error('[视频解析] 小红书解析失败:', error);
      return this.createFallbackInfo('xiaohongshu', url);
    }
  }

  /**
   * 解析微博链接
   */
  private static async parseWeibo(url: string): Promise<VideoLinkInfo> {
    try {
      // 提取微博ID
      const statusMatch = url.match(/status\/(\d+)/);
      const videoId = statusMatch ? statusMatch[1] : '';

      return {
        platform: 'weibo',
        videoId,
        title: `微博视频_${videoId}`,
        originalUrl: url,
      };
    } catch (error) {
      console.error('[视频解析] 微博解析失败:', error);
      return this.createFallbackInfo('weibo', url);
    }
  }

  /**
   * 通用解析（未知平台）
   */
  private static parseGeneric(url: string): VideoLinkInfo {
    return {
      platform: 'other',
      videoId: '',
      title: url,
      originalUrl: url,
    };
  }

  /**
   * 创建降级信息
   */
  private static createFallbackInfo(
    platform: VideoPlatform,
    url: string,
    videoId?: string
  ): VideoLinkInfo {
    return {
      platform,
      videoId: videoId || '',
      title: `${PLATFORM_CONFIG[platform].name}视频${videoId ? `_${videoId}` : ''}`,
      originalUrl: url,
    };
  }
}

/**
 * 下载视频
 */
export async function downloadVideo(
  videoUrl: string,
  options?: {
    headers?: Record<string, string>;
    maxSize?: number; // 最大文件大小（字节）
  }
): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  const maxSize = options?.maxSize || 500 * 1024 * 1024; // 默认 500MB

  const response = await fetch(videoUrl, {
    headers: options?.headers || {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    },
  });

  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const contentLength = parseInt(response.headers.get('content-length') || '0');

  if (contentLength > maxSize) {
    throw new Error(`视频大小超过限制 (${(contentLength / 1024 / 1024).toFixed(1)}MB > ${(maxSize / 1024 / 1024).toFixed(0)}MB)`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    contentType,
    size: buffer.length,
  };
}

/**
 * 使用 yt-dlp 提取视频直链（兜底方案）
 * 依赖服务器已安装 yt-dlp 命令
 */
export async function extractVideoUrlWithYtDlp(url: string): Promise<YtDlpExtractResult | null> {
  try {
    const { stdout } = await execFileAsync(getYtDlpBinary(), [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--skip-download',
      url,
    ]);

    const payload = JSON.parse(String(stdout || '{}')) as {
      url?: string;
      title?: string;
      duration?: number;
      uploader?: string;
      thumbnail?: string;
      extractor?: string;
      requested_formats?: Array<{ url?: string }>;
      formats?: Array<{ url?: string; protocol?: string }>;
    };

    const directUrl =
      payload.url ||
      payload.requested_formats?.find((f) => typeof f.url === 'string')?.url ||
      payload.formats?.find((f) => typeof f.url === 'string' && f.protocol !== 'm3u8_native')?.url;

    if (!directUrl) {
      return null;
    }

    return {
      videoUrl: directUrl,
      title: payload.title,
      duration: payload.duration,
      uploader: payload.uploader,
      thumbnail: payload.thumbnail,
      extractor: payload.extractor,
    };
  } catch (error) {
    console.warn('[视频解析] yt-dlp 提取失败:', error);
    return null;
  }
}
