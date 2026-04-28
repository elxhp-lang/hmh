/**
 * 双笔记本系统：清理 24 小时前的对话历史
 * 
 * POST /api/cleanup/conversation-history
 * 
 * 用于定时任务调用，每小时执行一次
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST() {
  try {
    console.log('🧹 [清理任务] 开始执行...');

    const supabase = getSupabaseClient();
    
    // 计算 24 小时前的时间
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    console.log(`🧹 [清理任务] 清理 ${cutoffTime.toISOString()} 之前的记录`);

    // 执行删除
    const { count, error } = await supabase
      .from('agent_conversation_messages')
      .delete()
      .lt('created_at', cutoffTime.toISOString())
      .select('count'); // 获取删除的记录数

    if (error) {
      console.error('🧹 [清理任务] 删除失败:', error);
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    const deletedCount = count || 0;
    console.log(`🧹 [清理任务] 成功删除 ${deletedCount} 条记录`);

    return Response.json({
      success: true,
      data: {
        deleted_count: deletedCount,
        cutoff_time: cutoffTime.toISOString()
      }
    });

  } catch (error) {
    console.error('🧹 [清理任务] 异常:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '清理失败'
    }, { status: 500 });
  }
}

/**
 * GET /api/cleanup/conversation-history
 * 
 * 查询当前有多少 24 小时前的记录待清理
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { count, error } = await supabase
      .from('agent_conversation_messages')
      .select('count', { count: 'exact' })
      .lt('created_at', cutoffTime.toISOString());

    if (error) {
      return Response.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: {
        pending_count: count || 0,
        cutoff_time: cutoffTime.toISOString()
      }
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    }, { status: 500 });
  }
}