import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoStorageService } from '@/lib/tos-storage';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 获取视频签名 URL
 * GET /api/video/url?videoId=xxx
 * 
 * 参数：
 * - videoId: 视频 ID
 * - expireTime: 过期时间（秒），默认 1 小时
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // 验证 token 并处理过期情况
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch (jwtError) {
      if (jwtError instanceof TokenExpiredError) {
        return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
      }
      if (jwtError instanceof JsonWebTokenError) {
        return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
      }
      throw jwtError;
    }

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    // 默认 24 小时有效期
    const expireTime = parseInt(searchParams.get('expireTime') || '86400', 10);

    if (!videoId) {
      return NextResponse.json({ error: '缺少 videoId 参数' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 查询视频记录
    const { data: video, error } = await supabase
      .from('videos')
      .select('id, user_id, tos_key, public_video_url, result_url, status')
      .eq('id', videoId)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: '视频不存在' }, { status: 404 });
    }

    // 权限检查：只能访问自己的视频（管理员可以访问所有）
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    const isAdmin = user?.role === 'super_admin' || user?.role === 'finance';
    if (video.user_id !== decoded.userId && !isAdmin) {
      return NextResponse.json({ error: '无权访问此视频' }, { status: 403 });
    }

    // 生成签名 URL
    let videoUrl: string;
    const videoAny = video as any;

    if (videoAny.public_video_url) {
      console.log(`[Video URL] 使用公开 URL: ${(videoAny.public_video_url as string).substring(0, 50)}...`);
      videoUrl = videoAny.public_video_url as string;
    } else if (videoAny.tos_key) {
      // 优先使用 TOS 存储
      console.log(`[Video URL] 使用 TOS 存储: ${videoAny.tos_key}`);
      videoUrl = await VideoStorageService.getVideoUrl(videoAny.tos_key as string, expireTime);
    } else if (videoAny.result_url) {
      // 兜底：使用临时 URL
      console.log(`[Video URL] 使用临时 URL: ${(videoAny.result_url as string).substring(0, 50)}...`);
      videoUrl = videoAny.result_url as string;
    } else {
      return NextResponse.json({ error: '视频 URL 不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      url: videoUrl,
      expireTime,
      source: videoAny.public_video_url ? 'public' : (videoAny.tos_key ? 'tos' : 'temp'),
    });
  } catch (error) {
    console.error('获取视频 URL 失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取视频 URL 失败' },
      { status: 500 }
    );
  }
}
