import { useAuth } from '@/contexts/AuthContext';
import { parseSSEPayload, SSEEvent, SSEEventType } from '@/lib/agent-sse';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

// ========== 全局 401 拦截：Token过期自动登出 ==========
let onAuthExpiredHandler: (() => void) | null = null;

/** 注册Token过期回调（由AuthProvider调用） */
export function registerAuthExpiredHandler(handler: () => void): void {
  onAuthExpiredHandler = handler;
}

/** 触发Token过期处理：清localStorage + 跳登录页 */
function handleAuthExpired(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('haimeng_token');
  localStorage.removeItem('haimeng_user');
  onAuthExpiredHandler?.();
  // 兜底：如果回调未注册（SSR/初始化时序问题），直接跳转
  if (!onAuthExpiredHandler && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/** 检查响应：401时自动登出，返回已读取的body供后续使用 */
async function interceptAuthResponse(response: Response): Promise<{ body: unknown; handled: boolean }> {
  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    const msg = typeof (body as Record<string, unknown>).error === 'string' ? (body as Record<string, unknown>).error as string : '';
    if (msg.includes('expired') || msg.includes('过期') || msg.includes('无效') || msg.includes('invalid') || msg.includes('Token')) {
      // 先尝试刷新Token
      let refreshed = false;
      try {
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem('haimeng_token') : null;
        if (currentToken) {
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` } });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.token) {
              localStorage.setItem('haimeng_token', refreshData.token);
              refreshed = true;
            }
          }
        }
      } catch { /* 刷新失败，继续登出 */ }
      if (!refreshed) {
        handleAuthExpired();
      }
      return { body, handled: !!refreshed ? false : true };
    }
    return { body, handled: false };
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    return { body, handled: false };
  }
  return { body: null, handled: false };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  isFormData?: boolean;  // 是否为 FormData，不设置 Content-Type
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token, isFormData } = options;

  const url = `${API_BASE}${endpoint}`;
  const finalHeaders: Record<string, string> = isFormData ? { ...headers } : {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: isFormData ? body as FormData : (body ? JSON.stringify(body) : undefined),
  });

  const { body: preReadBody, handled: authExpired } = await interceptAuthResponse(response);
  if (authExpired) throw new ApiError('Token已过期，请重新登录', 401);

  const data = preReadBody ?? (await response.json());

  if (!response.ok) {
    throw new ApiError(typeof data === 'object' && data && 'error' in data ? (data as Record<string, unknown>).error as string : '请求失败', response.status, data);
  }

  return data as T;
}

// 文件上传
export async function uploadFile(
  endpoint: string,
  formData: FormData,
  token: string
): Promise<unknown> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const { body: preReadBody, handled: authExpired } = await interceptAuthResponse(response);
  if (authExpired) throw new ApiError('Token已过期，请重新登录', 401);

  const data = preReadBody ?? (await response.json());

  if (!response.ok) {
    throw new ApiError(typeof data === 'object' && data && 'error' in data ? (data as Record<string, unknown>).error as string : '上传失败', response.status, data);
  }

  return data;
}

// 流式请求
export async function streamRequest(
  endpoint: string,
  body: unknown,
  token: string,
  onChunk: (content: string) => void,
  onDone?: (responseData?: Record<string, unknown>) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const { body: preReadBody, handled: authExpired } = await interceptAuthResponse(response);
    if (authExpired) throw new ApiError('Token已过期，请重新登录', 401);
    if (!response.ok) {
      const data = preReadBody;
      throw new ApiError(typeof data === 'object' && data && 'error' in data ? (data as Record<string, unknown>).error as string : '请求失败', response.status, data);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              onDone?.(data);
            } else if (data.content) {
              onChunk(data.content);
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('未知错误'));
  }
}

// React Hook for API calls
export function useApi() {
  const { token, logout } = useAuth();

  const request = async <T>(endpoint: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
    try {
      return await apiRequest<T>(endpoint, { ...options, token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
      }
      throw error;
    }
  };

  return { request, token };
}

// Agent SSE 流式请求 - 支持事件类型
export async function streamAgentRequest(
  endpoint: string,
  body: unknown,
  token: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    const { body: preReadBody, handled: authExpired } = await interceptAuthResponse(response);
    if (authExpired) throw new ApiError('Token已过期，请重新登录', 401);
    if (!response.ok) {
      const data = preReadBody;
      throw new ApiError(typeof data === 'object' && data && 'error' in data ? (data as Record<string, unknown>).error as string : '请求失败', response.status, data);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (signal?.aborted) {
        throw new Error('请求已取消');
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          
          try {
            const event = parseSSEPayload(dataStr);
            if (event) onEvent(event);
          } catch {
            // 忽略解析错误，继续处理下一行
          }
        }
      }
    }
    
    // 发送 done 事件
    onEvent({ type: 'done' });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('未知错误');
    if (signal?.aborted) {
      onError?.(new Error('请求已取消'));
      return;
    }
    onError?.(err);
    throw err;
  }
}

export { ApiError };
export type { SSEEvent, SSEEventType };
