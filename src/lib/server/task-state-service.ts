import { getSupabaseClient } from '@/storage/database/supabase-client';
import { MessagePart } from '@/lib/agent-sse';

type WorkerTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'partial_succeeded';

const ALLOWED_TRANSITIONS: Record<WorkerTaskStatus, WorkerTaskStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['succeeded', 'failed', 'cancelled', 'partial_succeeded'],
  partial_succeeded: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: ['queued'],
  cancelled: ['queued'],
};

interface EnsureTaskInput {
  userId: string;
  sessionId: string;
  taskType: string;
  clientRequestId?: string | null;
  inputData?: Record<string, unknown>;
}

export class TaskStateService {
  async ensureTask(input: EnsureTaskInput): Promise<{ id: string; status: WorkerTaskStatus; reused: boolean }> {
    const supabase = getSupabaseClient();
    if (input.clientRequestId) {
      const { data: existing } = await supabase
        .from('worker_tasks')
        .select('id,status')
        .eq('user_id', input.userId)
        .eq('client_request_id', input.clientRequestId)
        .single();
      if (existing?.id && existing?.status) {
        return { id: String(existing.id), status: existing.status as WorkerTaskStatus, reused: true };
      }
    }

    const { data, error } = await supabase
      .from('worker_tasks')
      .insert({
        user_id: input.userId,
        session_id: input.sessionId,
        task_type: input.taskType,
        client_request_id: input.clientRequestId || null,
        status: 'running',
        progress: 3,
        input_data: input.inputData || {},
        queued_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .select('id,status')
      .single();
    if (error || !data?.id || !data?.status) {
      throw new Error(`创建任务失败: ${error?.message || 'unknown'}`);
    }
    return { id: String(data.id), status: data.status as WorkerTaskStatus, reused: false };
  }

  async transitionTask(taskId: string, nextStatus: WorkerTaskStatus, patch: Record<string, unknown> = {}): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: current } = await supabase.from('worker_tasks').select('status').eq('id', taskId).single();
    const currentStatus = (current?.status || 'queued') as WorkerTaskStatus;
    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(nextStatus) && currentStatus !== nextStatus) {
      throw new Error(`非法状态跃迁: ${currentStatus} -> ${nextStatus}`);
    }
    await supabase
      .from('worker_tasks')
      .update({
        ...patch,
        status: nextStatus,
      })
      .eq('id', taskId);
  }

  async appendEvent(taskId: string, userId: string, sessionId: string, eventType: string, eventData: Record<string, unknown> = {}): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('task_events').insert({
      task_id: taskId,
      user_id: userId,
      session_id: sessionId,
      event_type: eventType,
      event_data: eventData,
    });
  }

  async saveOutput(taskId: string, userId: string, sessionId: string, messageId: string | null, textContent: string, parts: MessagePart[]): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase.from('task_outputs').insert({
      task_id: taskId,
      user_id: userId,
      session_id: sessionId,
      message_id: messageId,
      output_type: 'assistant_message',
      text_content: textContent,
      parts: parts || [],
    });
  }
}
