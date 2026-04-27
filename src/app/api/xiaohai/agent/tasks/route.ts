import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getBearerToken, ok } from '@/lib/server/api-kit';

type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

function normalizeStatus(value: string | null): TaskStatus | null {
  if (!value) return null;
  const status = value.trim().toLowerCase();
  if (status === 'queued' || status === 'running' || status === 'succeeded' || status === 'failed' || status === 'cancelled') {
    return status;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return ok(false, null, '未授权', 401);

    const payload = verifyToken(token);
    if (!payload?.user_id) return ok(false, null, '令牌无效', 401);

    const userId = payload.user_id;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const status = normalizeStatus(searchParams.get('status'));
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200);

    const supabase = getSupabaseClient();

    // 自动收敛“卡住的运行中任务”：超过 15 分钟未结束则标记失败，便于前端恢复/重试
    const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase
      .from('worker_tasks')
      .update({
        status: 'failed',
        progress: 100,
        completed_at: new Date().toISOString(),
        error_message: '任务状态超时，已自动转为可重试',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'running')
      .lt('started_at', staleAt)
      .is('completed_at', null);

    let query = supabase
      .from('worker_tasks')
      .select('id,user_id,session_id,task_type,status,progress,priority,error_message,retry_count,max_retries,queued_at,started_at,completed_at,created_at,updated_at,input_data,output_data')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      return ok(false, null, `加载任务失败: ${error.message}`, 500);
    }

    return ok(true, { tasks: data || [] }, '任务列表加载成功');
  } catch (error) {
    return ok(false, null, `获取任务失败: ${error instanceof Error ? error.message : '未知错误'}`, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return ok(false, null, '未授权', 401);

    const payload = verifyToken(token);
    if (!payload?.user_id) return ok(false, null, '令牌无效', 401);

    const userId = payload.user_id;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const taskId = String(body?.taskId || '').trim();
    if (!action || !taskId) return ok(false, null, '缺少 action 或 taskId', 400);

    const supabase = getSupabaseClient();

    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('worker_tasks')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: '用户取消任务',
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .in('status', ['queued', 'running'])
        .select('id,status,completed_at,error_message')
        .single();
      if (error || !data) return ok(false, null, `取消任务失败: ${error?.message || '任务不存在'}`, 400);
      return ok(true, { task: data }, '任务已取消');
    }

    if (action === 'retry') {
      const { data, error } = await supabase
        .from('worker_tasks')
        .update({
          status: 'queued',
          progress: 0,
          queued_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
          error_message: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .eq('user_id', userId)
        .in('status', ['failed', 'cancelled'])
        .select('id,status,queued_at,retry_count')
        .single();
      if (error || !data) return ok(false, null, `重试任务失败: ${error?.message || '任务不存在或状态不允许重试'}`, 400);
      return ok(true, { task: data }, '任务已重新排队');
    }

    return ok(false, null, '不支持的 action', 400);
  } catch (error) {
    return ok(false, null, `操作任务失败: ${error instanceof Error ? error.message : '未知错误'}`, 500);
  }
}
