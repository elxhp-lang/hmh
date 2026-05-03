/**
 * 视频生成回调通知 API
 * 
 * 接收轮询服务的回调信号，通知创意小海视频生成完成
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { video_id, status, public_video_url, error_reason, user_id, video_name } = body;

    console.log('[VideoCallback] 收到回调:', { video_id, status, user_id });

    if (!video_id || !status) {
      return NextResponse.json({ error: '缺少必要参数: video_id 和 status' }, { status: 400 });
    }

    // 写入通知表，前端通知中心可轮询到
    if (user_id) {
      const client = getSupabaseClient();
      const isCompleted = status === 'completed' || status === 'succeeded';
      await client.from('user_notifications').insert({
        user_id,
        notification_type: isCompleted ? 'video_completed' : 'video_failed',
        title: isCompleted ? '视频生成完成' : '视频生成失败',
        content: isCompleted
          ? `您的视频${video_name ? `「${video_name}」` : ''}已生成完成，可前往素材中心查看。`
          : `视频生成失败：${error_reason || '未知原因'}`,
        related_video_id: video_id,
        related_video_name: video_name || null,
        related_video_url: public_video_url || null,
      });
      console.log('[VideoCallback] 通知已写入');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[VideoCallback] 处理回调失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理回调失败' },
      { status: 500 }
    );
  }
}
