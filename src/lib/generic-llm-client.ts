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
      stream: true,
    }),
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
  });

  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json() as Record<string, unknown>;
  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
  return (msg?.content as string) || '';
}
