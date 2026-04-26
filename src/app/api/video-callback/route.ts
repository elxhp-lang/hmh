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
    const { video_id, status, public_video_url, error_reason } = body;

    console.log('[VideoCallback] 收到回调:', { video_id, status, public_video_url, error_reason });

    // 验证必要参数
    if (!video_id || !status) {
      return NextResponse.json(
        { error: '缺少必要参数: video_id 和 status' },
        { status: 400 }
      );
    }

    // 这里可以通过以下方式通知创意小海：
    // 1. 写入一个通知表，创意小海轮询查询
    // 2. 使用 WebSocket 实时推送
    // 3. 其他机制

    // 暂时只记录日志，后续可以扩展
    const supabase = getSupabaseClient();

    // 可以在这里添加通知逻辑
    // 例如：写入 notifications 表

    console.log('[VideoCallback] 回调处理完成');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[VideoCallback] 处理回调失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '处理回调失败' },
      { status: 500 }
    );
  }
}
