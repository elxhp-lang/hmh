export type SSEEventType =
  | 'start'
  | 'content'
  | 'text'
  | 'tool_start'
  | 'tool_result'
  | 'video_analysis'
  | 'script_options'
  | 'task_submitted'
  | 'task'
  | 'task_done'
  | 'copywriting_options'
  | 'error'
  | 'done';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  data?: unknown;
  tool?: string;
  result?: unknown;
  params?: unknown;
}

export function parseSSEPayload(raw: string): SSEEvent | null {
  const dataStr = raw.trim();
  if (!dataStr || dataStr === '[DONE]') return null;
  const parsed = JSON.parse(dataStr) as Record<string, unknown>;
  const type = parsed.type as SSEEventType | undefined;

  if (!type) {
    if (typeof parsed.content === 'string') {
      return { type: 'content', content: parsed.content };
    }
    return null;
  }

  return {
    type,
    content: typeof parsed.content === 'string' ? parsed.content : undefined,
    data: parsed.data,
    tool: typeof parsed.tool === 'string' ? parsed.tool : undefined,
    result: parsed.result,
    params: parsed.params,
  };
}
