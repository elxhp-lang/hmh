import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 抖音链接解析 API
 * POST /api/douyin/parse
 * 
 * 功能：
 * 1. 解析抖音分享链接
 * 2. 提取视频信息（标题、封面、视频URL）
 * 3. 可选：下载视频首帧用于图生视频
 * 
 * 请求体：
 * {
 *   url: string;           // 抖音分享链接
 *   extractFrame?: boolean; // 是否提取首帧
 * }
 * 
 * 响应：
 * {
 *   videoId: string;
 *   title: string;
 *   cover: string;
 *   videoUrl?: string;
 *   frameUrl?: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET);

    const body = await request.json();
    const { url, extractFrame = false } = body;

    if (!url) {
      return NextResponse.json({ error: '请提供抖音链接' }, { status: 400 });
    }

    // 验证链接格式
    const douyinPatterns = [
      /https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/,
      /https?:\/\/www\.douyin\.com\/video\/\d+/,
      /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+/,
    ];

    const isValidDouyinUrl = douyinPatterns.some(pattern => pattern.test(url));
    if (!isValidDouyinUrl) {
      return NextResponse.json({ error: '无效的抖音链接格式' }, { status: 400 });
    }

    // 尝试解析抖音链接
    // 注意：实际生产环境需要使用专业的解析服务
    try {
      // 步骤1：获取重定向后的真实链接
      const redirectResponse = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });

      const finalUrl = redirectResponse.url;
      
      // 从 URL 中提取视频 ID
      const videoIdMatch = finalUrl.match(/video\/(\d+)/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;

      if (!videoId) {
        return NextResponse.json({ 
          error: '无法解析视频ID，请确认链接是否正确',
          suggestion: '请使用抖音APP分享功能获取正确的链接'
        }, { status: 400 });
      }

      // 步骤2：获取视频详细信息
      // 注意：这里使用简化的方式，实际生产环境需要调用抖音 API 或使用解析服务
      const apiResponse = await fetch(`https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': 'https://www.douyin.com/',
        },
      });

      if (!apiResponse.ok) {
        // 如果 API 调用失败，返回基本信息
        return NextResponse.json({
          success: true,
          videoId,
          message: '解析成功，但无法获取详细信息',
          suggestion: '您可以手动描述视频内容，使用智能体进行分析',
          originalUrl: url,
        });
      }

      const data = await apiResponse.json();
      const item = data.item_list?.[0];

      if (!item) {
        return NextResponse.json({
          success: true,
          videoId,
          message: '解析成功，但视频可能已被删除或设为私密',
          originalUrl: url,
        });
      }

      // 提取视频信息
      const result: {
        success: boolean;
        videoId: string;
        title: string;
        cover: string;
        author: string;
        authorId: string;
        likes: number;
        comments: number;
        shares: number;
        duration: number;
        originalUrl: string;
        videoUrl?: string;
        frameUrl?: string;
      } = {
        success: true,
        videoId,
        title: item.desc || '',
        cover: item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0] || '',
        author: item.author?.nickname || '',
        authorId: item.author?.unique_id || '',
        likes: item.statistics?.digg_count || 0,
        comments: item.statistics?.comment_count || 0,
        shares: item.statistics?.share_count || 0,
        duration: item.video?.duration || 0,
        originalUrl: url,
      };

      // 获取视频下载地址（无水印）
      const playUrl = item.video?.play_addr?.url_list?.[0];
      if (playUrl) {
        // 替换为无水印版本
        result.videoUrl = playUrl.replace(/playwm/, 'play');
      }

      // 如果需要提取首帧
      if (extractFrame && result.cover) {
        result.frameUrl = result.cover;
      }

      return NextResponse.json(result);

    } catch (parseError) {
      console.error('解析抖音链接失败:', parseError);
      
      return NextResponse.json({
        success: false,
        error: '解析失败，请稍后重试',
        suggestion: '您可以手动描述视频内容，使用智能体进行分析',
        originalUrl: url,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('抖音解析错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解析失败' },
      { status: 500 }
    );
  }
}
