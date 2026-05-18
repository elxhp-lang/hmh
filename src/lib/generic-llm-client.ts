/**
 * 通用 OpenAI 兼容流客户端
 * 替代 Coze SDK LLMClient，支持任意 OpenAI 兼容的 API
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStreamConfig {
  model: string;
  temperature?: number;
  max_tokens?: number;
}

/** OpenAI 兼容 SSE 流 */
export async function* openAIStream(
  apiUrl: string,
  apiKey: string,
  messages: LLMMessage[],
  config: LLMStreamConfig
): AsyncGenerator<{ content: string }> {
  // Step 1.2a: 流式请求 2 分钟超时，防止远程 LLM 无响应时无限挂起占用线程
  const response = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 4096,
      stream: true,                             // 流式逐 token 返回，需较长超时
    }),
    signal: AbortSignal.timeout(120000),        // 2 分钟超时
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`OpenAI API error ${response.status} at ${apiUrl}: ${err.slice(0, 200)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (content) yield { content };
      } catch {
        // 跳过无法解析的行
      }
    }
  }
}

/** 同步调用（非流式，用于子Agent） */
export async function openAIChat(
  apiUrl: string,
  apiKey: string,
  messages: LLMMessage[],
  config: LLMStreamConfig
): Promise<string> {
  // Step 1.2a: 同步请求 1 分钟超时，完整响应一次返回不应过长
  const response = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 4096,
    }),
    signal: AbortSignal.timeout(60000),         // 1 分钟超时
  });

  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json() as Record<string, unknown>;
  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  return (msg?.content as string) || '';
}
