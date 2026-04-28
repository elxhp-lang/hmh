import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoStorageService } from '@/lib/tos-storage';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function isStablePublicUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('http')) return false;
  return !url.includes('X-Tos-Algorithm=') && !url.includes('X-Amz-Algorithm=');
}

/**
 * 视频历史记录 API
 * GET /api/video/history
 */
export async function GET(request: NextRequest) {
  try {
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
    const limit = parseInt(searchParams.get('limit') || '20');

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('videos')
      .select('id, task_id, task_type, status, prompt, public_video_url, result_url, tos_key, audio_url, cover_url, ratio, duration, model, created_at')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 为每个视频生成签名 URL（24小时有效期）
    const videosWithUrl = await Promise.all(
      (data || []).map(async (video: any) => {
        let videoUrl = video.public_video_url || video.result_url;

        // 如果有 TOS key，生成签名 URL
        if (video.tos_key && video.status === 'completed') {
          try {
            videoUrl = video.public_video_url || VideoStorageService.getVideoPublicUrl(video.tos_key as string);
            if (!video.public_video_url) {
              await client
                .from('videos')
                .update({
                  public_video_url: videoUrl,
                  result_url: isStablePublicUrl(video.result_url) ? video.result_url : videoUrl,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', video.id);
            }
          } catch (e) {
            console.error(`生成签名 URL 失败: ${video.id}`, e);
            // 失败时使用原始 URL
          }
        }

        return {
          ...video,
          video_url: videoUrl,
        };
      })
    );

    return NextResponse.json({ videos: videosWithUrl });
  } catch (error) {
    console.error('查询视频历史错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除视频历史记录
 * DELETE /api/video/history?ids=id1,id2
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
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
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json({ error: '缺少 ids 参数' }, { status: 400 });
    }

    const ids = idsParam.split(',').filter(Boolean);
    
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids 参数不能为空' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 删除属于该用户的视频记录（RLS 会进一步确保安全）
    const { error } = await client
      .from('videos')
      .delete()
      .eq('user_id', decoded.userId)
      .in('id', ids);

    if (error) {
      throw new Error(`删除失败: ${error.message}`);
    }

    console.log(`[视频删除] 用户 ${decoded.userId} 删除了 ${ids.length} 条记录`);

    return NextResponse.json({ 
      success: true, 
      deleted: ids.length 
    });
  } catch (error) {
    console.error('删除视频历史错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
