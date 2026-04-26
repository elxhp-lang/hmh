import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SeedanceClient, VideoRatio, SeedanceModel } from '@/lib/seedance-client';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const seedanceClient = new SeedanceClient();

/**
 * 视频编辑 API (Seedance 2.0)
 * POST /api/video/edit
 * 
 * 支持的功能：
 * - 替换视频主体
 * - 增删改元素
 * - 局部画面重绘
 * 
 * 请求体：
 * {
 *   videoUrl: string;          // 待编辑的视频 URL
 *   prompt: string;            // 编辑指令
 *   referenceImages?: string[]; // 参考图片（用于替换等）
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
      videoUrl,
      prompt,
      referenceImages = [],
      model = 'doubao-seedance-2-0-260128',
      ratio = '16:9',
      duration = 5,
      generateAudio = true,
      watermark = false,
    } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: '视频 URL 不能为空' }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: '编辑指令不能为空' }, { status: 400 });
    }

    // 创建视频任务记录
    const supabase = getSupabaseClient();
    const { data: videoTask, error: insertError } = await supabase
      .from('videos')
      .insert({
        user_id: decoded.userId,
        prompt,
        task_type: 'edit',
        model,
        reference_videos: [videoUrl],
        reference_images: referenceImages.length > 0 ? referenceImages : null,
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

    // 调用 Seedance 2.0 编辑视频
    try {
      const taskResponse = await seedanceClient.editVideo(videoUrl!, prompt, {
        model: model as SeedanceModel,
        duration,
        ratio: ratio as VideoRatio,
        generateAudio,
        watermark,
        referenceImages,
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
        message: '编辑任务已提交，请轮询查询状态',
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
    console.error('视频编辑错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频编辑失败' },
      { status: 500 }
    );
  }
}
