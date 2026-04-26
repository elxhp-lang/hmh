import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SeedanceClient, VideoRatio, SeedanceModel } from '@/lib/seedance-client';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const seedanceClient = new SeedanceClient();

/**
 * 视频延长 API (Seedance 2.0)
 * POST /api/video/extend
 * 
 * 支持的功能：
 * - 向前延长视频
 * - 向后延长视频
 * - 多视频串联（最多3个）
 * 
 * 请求体：
 * {
 *   videoUrls: string[];        // 视频 URL 列表（1-3个）
 *   prompt: string;             // 延长指令
 *   model?: SeedanceModel;
 *   ratio?: VideoRatio;
 *   duration?: number;
 *   generateAudio?: boolean;
 *   watermark?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
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
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
    } catch (jwtError) {
      if (jwtError instanceof TokenExpiredError) {
        return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
      }
      if (jwtError instanceof JsonWebTokenError) {
        return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
      }
      throw jwtError;
    }
    
    const body = await request.json();
    const {
      videoUrls,
      prompt,
      model = 'doubao-seedance-2-0-260128',
      ratio = '16:9',
      duration = 8,
      generateAudio = true,
      watermark = false,
    } = body;

    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: '视频 URL 列表不能为空' }, { status: 400 });
    }

    if (videoUrls.length > 3) {
      return NextResponse.json({ error: '最多支持3个视频' }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: '延长指令不能为空' }, { status: 400 });
    }

    // 创建视频任务记录
    const supabase = getSupabaseClient();
    const { data: videoTask, error: insertError } = await supabase
      .from('videos')
      .insert({
        user_id: decoded.userId,
        prompt,
        task_type: 'extend',
        model,
        reference_videos: videoUrls,
        ratio,
        duration,
        generate_audio: generateAudio,
        watermark,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`创建任务失败: ${insertError.message}`);
    }

    // 调用 Seedance 2.0 延长视频
    try {
      const taskResponse = await seedanceClient.extendVideo(videoUrls, prompt, {
        model: model as SeedanceModel,
        duration,
        ratio: ratio as VideoRatio,
        generateAudio,
        watermark,
      });

      // 更新任务ID
      await supabase
        .from('videos')
        .update({ task_id: taskResponse.id })
        .eq('id', videoTask!.id);

      return NextResponse.json({
        success: true,
        taskId: videoTask!.id,
        seedanceTaskId: taskResponse.id,
        status: 'processing',
        message: '延长任务已提交，请轮询查询状态',
      });

    } catch (apiError) {
      // 更新任务状态为失败
      await supabase
        .from('videos')
        .update({
          status: 'failed',
          error_message: apiError instanceof Error ? apiError.message : 'API调用失败',
        })
        .eq('id', videoTask!.id);

      throw apiError;
    }

  } catch (error) {
    console.error('视频延长错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频延长失败' },
      { status: 500 }
    );
  }
}
