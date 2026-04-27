import { getSupabaseClient } from '@/storage/database/supabase-client';
import { MessagePart } from '@/lib/agent-sse';

type WorkerTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'partial_succeeded';

const ALLOWED_TRANSITIONS: Record<WorkerTaskStatus, WorkerTaskStatus[]> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['succeeded', 'failed', 'cancelled', 'partial_succeeded'],
  partial_succeeded: ['running', 'succeeded', 'failed', 'cancelled'],
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

  async appendTaskItem(params: {
    taskId: string;
    userId: string;
    sessionId: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    inputData?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
    errorMessage?: string | null;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: latest } = await supabase
      .from('worker_task_items')
      .select('item_index')
      .eq('task_id', params.taskId)
      .order('item_index', { ascending: false })
      .limit(1)
      .single();
    const nextIndex = typeof latest?.item_index === 'number' ? latest.item_index + 1 : 0;
    await supabase.from('worker_task_items').insert({
      task_id: params.taskId,
      user_id: params.userId,
      session_id: params.sessionId,
      item_index: nextIndex,
      status: params.status || 'queued',
      progress: params.status === 'succeeded' ? 100 : 0,
      input_data: params.inputData || {},
      output_data: params.outputData || {},
      error_message: params.errorMessage || null,
      started_at: params.status === 'queued' ? null : new Date().toISOString(),
      completed_at: params.status === 'succeeded' || params.status === 'failed' || params.status === 'cancelled'
        ? new Date().toISOString()
        : null,
    });
  }

  async updateTaskItem(
    itemId: string,
    patch: {
      status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
      progress?: number;
      outputData?: Record<string, unknown>;
      errorMessage?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
    }
  ): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from('worker_task_items')
      .update({
        status: patch.status,
        progress: patch.progress,
        output_data: patch.outputData,
        error_message: patch.errorMessage,
        started_at: patch.startedAt,
        completed_at: patch.completedAt,
      })
      .eq('id', itemId);
  }

  async aggregateTaskFromItems(taskId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { data: items } = await supabase
      .from('worker_task_items')
      .select('status')
      .eq('task_id', taskId);
    const list = items || [];
    if (!list.length) return;
    const total = list.length;
    const succeeded = list.filter((x: any) => x.status === 'succeeded').length;
    const failed = list.filter((x: any) => x.status === 'failed').length;
    const running = list.filter((x: any) => x.status === 'running').length;
    const queued = list.filter((x: any) => x.status === 'queued').length;
    const progress = Math.max(1, Math.min(100, Math.round((succeeded / total) * 100)));

    if (running > 0 || queued > 0) {
      await this.transitionTask(taskId, 'running', {
        progress,
        output_data: { total, succeeded, failed, queued, running },
      });
      return;
    }
    if (failed > 0 && succeeded > 0) {
      await this.transitionTask(taskId, 'partial_succeeded', {
        progress: 100,
        output_data: { total, succeeded, failed, queued, running },
      });
      return;
    }
    if (failed > 0 && succeeded === 0) {
      await this.transitionTask(taskId, 'failed', {
        progress: 100,
        output_data: { total, succeeded, failed, queued, running },
      });
      return;
    }
    await this.transitionTask(taskId, 'succeeded', {
      progress: 100,
      output_data: { total, succeeded, failed, queued, running },
    });
  }
}
