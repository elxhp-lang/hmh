import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getBearerToken, ok } from '@/lib/server/api-kit';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const token = getBearerToken(request);
    if (!token) return ok(false, null, '未授权', 401);

    const payload = verifyToken(token);
    if (!payload?.user_id) return ok(false, null, '令牌无效', 401);

    const userId = payload.user_id;
    const taskId = params.taskId;
    if (!taskId) return ok(false, null, '缺少 taskId', 400);

    const supabase = getSupabaseClient();
    const [{ data: task }, { data: events }, { data: outputs }, { data: items }] = await Promise.all([
      supabase
        .from('worker_tasks')
        .select('id,user_id,session_id,task_type,status,progress,error_message,retry_count,max_retries,queued_at,started_at,completed_at,created_at,updated_at,input_data,output_data')
        .eq('id', taskId)
        .eq('user_id', userId)
        .single(),
      supabase
        .from('task_events')
        .select('id,event_type,event_data,created_at')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(500),
      supabase
        .from('task_outputs')
        .select('id,message_id,output_type,text_content,parts,created_at')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('worker_task_items')
        .select('id,item_index,status,progress,input_data,output_data,error_message,created_at,updated_at')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('item_index', { ascending: true })
        .limit(500),
    ]);

    if (!task) return ok(false, null, '任务不存在', 404);
    return ok(true, {
      task,
      events: events || [],
      outputs: outputs || [],
      items: items || [],
    }, '任务详情加载成功');
  } catch (error) {
    return ok(false, null, `获取任务详情失败: ${error instanceof Error ? error.message : '未知错误'}`, 500);
  }
}
