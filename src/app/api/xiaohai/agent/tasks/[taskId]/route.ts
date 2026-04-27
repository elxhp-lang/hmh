import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';

function isRenderableMediaUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const blockedHosts = new Set([
      'seedance-public.oss-cn-beijing.aliyuncs.com',
    ]);
    return !blockedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const auth = requireAuth(request);
    if (auth.response || !auth.user) return auth.response;
    const userId = auth.user.userId;
    const taskId = params.taskId;
    if (!taskId) return fail('缺少 taskId', 400);

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

    if (!task) return fail('任务不存在', 404);

    // 兜底：当 task_outputs 尚未写入时，从 worker_task_items 的 output_data 合成回放内容
    let normalizedOutputs = outputs || [];
    if ((!normalizedOutputs || normalizedOutputs.length === 0) && Array.isArray(items) && items.length > 0) {
      normalizedOutputs = items
        .map((item) => {
          const raw = (item as { output_data?: unknown; created_at?: string; id?: string }).output_data;
          if (!raw || typeof raw !== 'object') return null;
          const data = raw as Record<string, unknown>;
          const result = (data.result && typeof data.result === 'object') ? (data.result as Record<string, unknown>) : data;
          const imageCandidates = [
            typeof result.image_url === 'string' ? result.image_url : null,
            typeof result.preview_image_url === 'string' ? result.preview_image_url : null,
            typeof result.public_image_url === 'string' ? result.public_image_url : null,
          ];
          const videoCandidates = [
            typeof result.public_video_url === 'string' ? result.public_video_url : null,
            typeof result.video_url === 'string' ? result.video_url : null,
            typeof result.preview_video_url === 'string' ? result.preview_video_url : null,
          ];
          const imageUrl = imageCandidates.find((u) => isRenderableMediaUrl(u)) || null;
          const videoUrl = videoCandidates.find((u) => isRenderableMediaUrl(u)) || null;
          const parts: Array<Record<string, unknown>> = [];
          if (imageUrl) parts.push({ type: 'image', url: imageUrl, alt: '任务预览图' });
          if (videoUrl) parts.push({ type: 'video', url: videoUrl });
          if (!parts.length) return null;
          return {
            id: `synth_${String((item as { id?: string }).id || Date.now())}`,
            message_id: null,
            output_type: 'assistant_message',
            text_content: imageUrl
              ? '任务已生成预览图，可继续对话让我帮你优化。'
              : '任务已生成视频结果，可继续对话让我帮你优化。',
            parts,
            created_at: (item as { created_at?: string }).created_at || new Date().toISOString(),
          };
        })
        .filter((x): x is { id: string; message_id: null; output_type: string; text_content: string; parts: Array<Record<string, unknown>>; created_at: string } => !!x);
    }

    return ok({
      data: {
        task,
        events: events || [],
        outputs: normalizedOutputs || [],
        items: items || [],
      },
      message: '任务详情加载成功',
    });
  } catch (error) {
    return fail(`获取任务详情失败: ${error instanceof Error ? error.message : '未知错误'}`, 500);
  }
}
