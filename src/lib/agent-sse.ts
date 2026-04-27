export type SSEEventType =
  | 'start'
  | 'content'
  | 'text'
  | 'message_part'
  | 'tool_start'
  | 'tool_result'
  | 'video_analysis'
  | 'script_options'
  | 'task_submitted'
  | 'task'
  | 'task_done'
  | 'copywriting_options'
  | 'memory_candidate'
  | 'memory_saved'
  | 'error'
  | 'done';

export type MessagePart =
  | { type: 'text'; text: string; format?: 'plain' | 'markdown' }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string; poster?: string }
  | { type: 'card'; cardType: string; data: Record<string, unknown> };

export interface ToolExecutionResult {
  success?: boolean;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  data?: unknown;
  part?: MessagePart;
  tool?: string;
  result?: ToolExecutionResult;
  params?: unknown;
}

function normalizeMessagePart(input: unknown): MessagePart | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const part = input as Record<string, unknown>;
  const type = part.type;
  if (type === 'text' && typeof part.text === 'string') {
    return { type: 'text', text: part.text, format: part.format === 'markdown' ? 'markdown' : 'plain' };
  }
  if (type === 'table' && Array.isArray(part.columns) && Array.isArray(part.rows)) {
    return {
      type: 'table',
      title: typeof part.title === 'string' ? part.title : undefined,
      columns: part.columns.filter((item): item is string => typeof item === 'string'),
      rows: part.rows
        .filter((row): row is unknown[] => Array.isArray(row))
        .map((row) => row.map((cell) => (typeof cell === 'string' ? cell : String(cell ?? '')))),
    };
  }
  if (type === 'image' && typeof part.url === 'string') {
    return { type: 'image', url: part.url, alt: typeof part.alt === 'string' ? part.alt : undefined };
  }
  if (type === 'video' && typeof part.url === 'string') {
    return { type: 'video', url: part.url, poster: typeof part.poster === 'string' ? part.poster : undefined };
  }
  if (type === 'card' && typeof part.cardType === 'string' && part.data && typeof part.data === 'object') {
    return { type: 'card', cardType: part.cardType, data: part.data as Record<string, unknown> };
  }
  return undefined;
}

export function normalizeToolExecutionResult(result: unknown): ToolExecutionResult {
  if (result && typeof result === 'object') {
    return result as ToolExecutionResult;
  }
  return {
    success: false,
    error: typeof result === 'string' ? result : '工具返回了非结构化结果',
    data: result,
  };
}

export function getToolResultData(result: ToolExecutionResult | undefined): unknown {
  return result?.data;
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
    part: normalizeMessagePart(parsed.part),
    tool: typeof parsed.tool === 'string' ? parsed.tool : undefined,
    result: type === 'tool_result' ? normalizeToolExecutionResult(parsed.result) : undefined,
    params: parsed.params,
  };
}
