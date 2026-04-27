/**
 * 创意小海 Agent API - 唯一入口
 * 
 * Seed 2.0 Pro 的 Agent 模式入口
 * 所有业务功能都通过这个入口，由 Seed 2.0 统一管理和执行
 * 
 * POST /api/xiaohai/agent/chat
 * 
 * 响应格式：
 * - type: "text" | "video_analysis" | "script_options" | "task" | "done" | "error"
 * - content: 文本描述
 * - data: 结构化数据
 */

import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk';
import { AgentToolsService } from '@/lib/agent-tools-service';
import { getXiaohaiSystemPromptV3 } from '@/lib/xiaohai-system-prompt-v3';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createSSEWriter, getBearerToken, ok } from '@/lib/server/api-kit';
import { normalizeToolExecutionResult } from '@/lib/agent-sse';

const client = new LLMClient(new Config());
const toolsService = new AgentToolsService();

// ========== 内存限流器：防止 API 滥用 ==========
// 方案 B：传统服务器环境（单实例部署）
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 分钟窗口
const RATE_LIMIT_MAX = 15;           // 每分钟最多 15 次请求

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  
  // 保留最近 1 分钟内的请求时间戳
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recent.length >= RATE_LIMIT_MAX) {
    // 计算最早请求还需要多久过期
    const oldestTimestamp = recent[0];
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW - (now - oldestTimestamp)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

// ========== 双笔记本系统：辅助函数 ==========

async function saveConversationMessage(
  userId: string,
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('agent_conversation_messages').insert({
      user_id: userId,
      session_id: sessionId,
      role: role,
      content: content
    });
    const now = new Date().toISOString();
    const { data: session } = await supabase
      .from('agent_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();
    const nextCount = (session?.message_count || 0) + 1;
    await supabase
      .from('agent_sessions')
      .update({
        last_message_at: now,
        message_count: nextCount,
      })
      .eq('id', sessionId)
      .eq('user_id', userId);
    console.log(`💾 [笔记本1号] 已保存 ${role} 消息`);
  } catch (error) {
    console.error('❌ [笔记本1号] 保存消息失败:', error);
  }
}

async function createCreativeSession(userId: string) {
  const supabase = getSupabaseClient();
  const { data: created, error } = await supabase
    .from('agent_sessions')
    .insert({
      user_id: userId,
      agent_type: 'creative',
      title: `创意会话 ${new Date().toLocaleString('zh-CN')}`,
      status: 'active',
      message_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select('id,user_id,agent_type,status,title,message_count,last_message_at,created_at')
    .single();
  if (error || !created) {
    throw new Error(`创建会话失败: ${error?.message || '未知错误'}`);
  }
  return created as any;
}

async function ensureCreativeSession(userId: string, preferredSessionId?: string | null) {
  const supabase = getSupabaseClient();
  if (preferredSessionId) {
    const { data: existing } = await supabase
      .from('agent_sessions')
      .select('id,user_id,agent_type,status,title,message_count')
      .eq('id', preferredSessionId)
      .eq('user_id', userId)
      .eq('agent_type', 'creative')
      .single();
    if (existing) return existing as any;
  }
  return createCreativeSession(userId);
}

// ========== 动态系统提示词 ==========

async function getAgentSystemPrompt(): Promise<string> {
  try {
    // 使用 V3 系统提示词（包含 Seedance 2.0 最佳实践）
    return getXiaohaiSystemPromptV3();
  } catch {
    // 备用简化提示词
    return `你是创意小海，AI视频创作助手。核心能力：短视频创作、视频分析、创意建议。请自由发挥，自然对话。`;
  }
}

const MAX_ITERATIONS = 15;
const MAX_TOOL_STRING_LEN = 2000;
const HIGH_RISK_TOOLS = new Set(['delete_material', 'clear_session', 'update_material']);
const TOOL_REQUIRED_FIELDS: Record<string, string[]> = {
  submit_video_task: ['prompt'],
  generate_script: ['product_name'],
  analyze_video: ['video_url'],
  webSearch: ['query'],
};

interface ExtractedScriptOption {
  id: string;
  title: string;
  description: string;
  content: string;
}

interface MemoryCandidate {
  id: string;
  memoryType: 'general' | 'preference' | 'rule' | 'experience' | 'document';
  content: string;
  question: string;
  keywords: string[];
}

function sanitizeToolParams(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      out[key] = value.slice(0, MAX_TOOL_STRING_LEN);
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 20);
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeToolParams(value);
    } else {
      out[key] = value;
    }
  }
  return out as Record<string, any>;
}

function validateToolCall(toolName: string, params: Record<string, any>): string | null {
  if (HIGH_RISK_TOOLS.has(toolName) && !params?.confirmed_by_user) {
    return `工具 ${toolName} 需要用户确认，请先征得用户同意并传入 confirmed_by_user=true`;
  }
  const requiredFields = TOOL_REQUIRED_FIELDS[toolName];
  if (!requiredFields) return null;
  for (const field of requiredFields) {
    if (!params?.[field] || (typeof params[field] === 'string' && !params[field].trim())) {
      return `工具 ${toolName} 缺少必要参数: ${field}`;
    }
  }
  return null;
}

function extractMemoryCandidate(userMessageContent: string): MemoryCandidate | null {
  const message = userMessageContent.trim();
  if (!message || message.length < 6) return null;
  const preferencePattern = /(我喜欢|我常用|以后默认|请记住|记一下|不要再|一直用)/;
  if (!preferencePattern.test(message)) return null;
  const memoryType: MemoryCandidate['memoryType'] = /(不要|禁用|必须|务必)/.test(message)
    ? 'rule'
    : 'preference';
  const keywords = message
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 8);

  return {
    id: `mem_${Date.now()}`,
    memoryType,
    content: message.slice(0, 300),
    question: '这条偏好/规则要帮你记住，后续默认沿用吗？',
    keywords,
  };
}

function splitScriptSections(content: string): string[] {
  const normalized = content.trim();
  if (!normalized) return [];

  const sectionRegex = /(?:^|\n)(?:方案[一二三四五六七八九十0-9]+|脚本[一二三四五六七八九十0-9]+|版本[一二三四五六七八九十0-9]+|选项[一二三四五六七八九十0-9]+)\s*[:：]/g;
  const matches = [...normalized.matchAll(sectionRegex)];

  if (matches.length < 2) {
    return [normalized];
  }

  const sections: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const section = normalized.slice(start, end).trim();
    if (section) sections.push(section);
  }
  return sections.length > 0 ? sections : [normalized];
}

function tryExtractScriptOptions(content: string): ExtractedScriptOption[] | null {
  const text = content.trim();
  if (!text) return null;

  const hasScriptSignal =
    /脚本|分镜|镜头|旁白|口播|场景|时长|画面|文案/.test(text) &&
    text.length >= 80;

  if (!hasScriptSignal) {
    return null;
  }

  const sections = splitScriptSections(text).slice(0, 5);
  const options = sections.map((section, idx) => {
    const firstLine = section.split('\n').find(line => line.trim())?.trim() || `脚本方案 ${idx + 1}`;
    return {
      id: `script_text_${idx + 1}`,
      title: firstLine.length > 40 ? `脚本方案 ${idx + 1}` : firstLine,
      description: `基于模型文本输出自动识别的脚本方案 ${idx + 1}`,
      content: section,
    };
  });

  return options.length > 0 ? options : null;
}

/**
 * POST /api/xiaohai/agent/chat
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const token = getBearerToken(request);
    let userId: string | null = null;

    if (token) {
      const user = await verifyToken(token);
      if (user) {
        userId = user.userId;
      }
    }

    // 1.5 限流检查：防止 API 滥用
    if (userId) {
      const rateLimitResult = checkRateLimit(userId);
      if (!rateLimitResult.allowed) {
        console.log(`⛔ [限流] 用户 ${userId} 请求过于频繁，${rateLimitResult.retryAfterSeconds}秒后重试`);
        return new Response(
          JSON.stringify({
            error: '请求过于频繁，请稍后再试',
            retryAfterSeconds: rateLimitResult.retryAfterSeconds
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': rateLimitResult.retryAfterSeconds.toString()
            }
          }
        );
      }
    }

    toolsService.setUserId(userId);

    // 2. 解析请求
    const body = await request.json();
    const { message, attachments, webSearchEnabled = false, history = [], sessionId } = body;

    // 设置联网搜索开关
    toolsService.setWebSearchEnabled(webSearchEnabled);

    console.log('🤖 [Agent] 用户消息:', message?.substring(0, 100));
    console.log('📎 [Agent] 附件:', attachments?.length || 0);
    console.log('🔍 [Agent] 联网搜索:', webSearchEnabled ? '开启' : '关闭');

    // 会话确保（断点重续核心）
    const session = userId ? await ensureCreativeSession(userId, sessionId || null) : null;
    toolsService.setSessionId(session?.id || null);

    // ========== 双笔记本系统：加载记忆 ==========
    const supabase = getSupabaseClient();
    let conversationHistory: any[] = [];
    let userPreferences: any[] = [];

    if (userId) {
      // 📔 笔记本1号：对话历史（最近24小时）
      const { data: historyData } = await supabase
        .from('agent_conversation_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', session?.id)
        .order('created_at', { ascending: true }); // 正序（最早→最近），用于前端显示

      conversationHistory = historyData || [];
      console.log(`📔 [笔记本1号] 加载 ${conversationHistory.length} 条对话历史`);

      // 📕 笔记本2号：用户偏好（永久保存）
      const { data: preferencesData } = await supabase
        .from('creative_user_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('last_updated_at', { ascending: false });

      userPreferences = preferencesData || [];
      console.log(`📕 [笔记本2号] 加载 ${userPreferences.length} 条用户偏好`);
    }

    // ========== 构建系统提示词（包含双笔记本）==========
    const baseSystemPrompt = await getAgentSystemPrompt();
    let finalSystemPrompt = baseSystemPrompt;

    // 添加笔记本2号的用户偏好
    if (userPreferences.length > 0) {
      const preferenceText = userPreferences.map(p => {
        let text = `- ${p.preference_type}: ${p.content}`;
        if (p.tags && Array.isArray(p.tags) && p.tags.length > 0) {
          text += ` [${p.tags.join(', ')}]`;
        }
        return text;
      }).join('\n');

      finalSystemPrompt += `\n\n📕 用户偏好：\n${preferenceText}`;
    }

    // 3. 构建用户消息
    let userMessageContent = message || '';
    
    if (attachments && attachments.length > 0) {
      const attachmentDescs = attachments.map((a: any) => {
        switch (a.type) {
          case 'video':
            return `[视频: ${a.name}]\nURL: ${a.url}`;
          case 'image':
            return `[图片: ${a.name}]\nURL: ${a.url}`;
          case 'link':
            return `[链接: ${a.url}]`;
          default:
            return `[附件: ${a.name || a.url}]`;
        }
      });
      
      userMessageContent += `\n\n--- 用户上传的素材 ---\n${attachmentDescs.join('\n')}`;
    }

    // 4. 获取工具（webSearchEnabled 参数传递给工具层，由AI自主决定是否使用联网搜索）
    const tools = toolsService.getAllTools(webSearchEnabled);

    // 5. 构建消息列表
    const messages: Message[] = [{ role: 'system', content: finalSystemPrompt }];
    
    // ========== 笔记本1号：对话历史（倒序给AI）==========
    // AI看到的是倒序（最近的在最上面）
    const normalizedClientHistory = Array.isArray(history)
      ? history
          .filter((item: any) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
          .slice(-20)
      : [];

    if (normalizedClientHistory.length > 0) {
      for (const msg of normalizedClientHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
      console.log(`📔 [笔记本1号] 使用前端会话历史 ${normalizedClientHistory.length} 条`);
    } else if (conversationHistory.length > 0) {
      const reversedHistory = [...conversationHistory].reverse(); // 倒序
      for (const msg of reversedHistory) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: msg.content });
        }
      }
      console.log(`📔 [笔记本1号] 倒序添加 ${reversedHistory.length} 条历史消息给AI`);
    }
    
    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessageContent });

    // ========== 对话日志记录 ==========
    const conversationLog = {
      timestamp: new Date().toISOString(),
      userId,
      userMessage: userMessageContent.substring(0, 500),
      attachments: attachments?.length || 0
    };
    console.log('📝 [Agent] 对话开始:', JSON.stringify(conversationLog));

    // ========== 笔记本1号：保存用户消息 ==========
    if (userId) {
      await saveConversationMessage(userId, session!.id, 'user', userMessageContent);
    }

    // 7. 创建流式响应
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = createSSEWriter(controller, encoder);
        try {
          // 发送开始信号
          sendEvent({ type: 'start', data: { sessionId: session?.id || null } });

          let iterations = 0;

          while (iterations < MAX_ITERATIONS) {
            iterations++;
            console.log(`🔄 [Agent] 第 ${iterations} 次迭代`);

            // 调用 LLM
            let assistantMessage = '';
            
            const response = await client.stream(messages, {
              model: 'doubao-seed-2-0-pro-260215',
              temperature: 0.7,
            });

            for await (const chunk of response) {
              const content = chunk.content || '';
              if (content) {
                assistantMessage += content;
              }
            }

            if (!assistantMessage.trim()) {
              console.log('⚠️ [Agent] LLM 返回为空');
              controller.close(); // 🔧 修复：必须关闭流
              break;
            }

            // ========== 笔记本1号：保存AI回复 ==========
            if (userId) {
              await saveConversationMessage(userId, session!.id, 'assistant', assistantMessage);
            }

            // ========== LLM 响应日志 ==========
            console.log('📤 [Agent] LLM 原始响应:', assistantMessage.substring(0, 1500));

            // 添加助手消息
            messages.push({ role: 'assistant', content: assistantMessage });

            // 解析响应
            let parsed = null;
            try {
              // 尝试提取 JSON - 支持多种格式
              const toolCallMatch = assistantMessage.match(/<\|FunctionCallBegin\|>\s*(\[[\s\S]*?\])\s*<\|FunctionCallEnd\|>/);
              if (toolCallMatch) {
                parsed = { type: 'tool_call', tools: JSON.parse(toolCallMatch[1]) };
              }
              
              if (!parsed) {
                const jsonMatch = assistantMessage.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                                assistantMessage.match(/{[\s\S]*}/);
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                }
              }
            } catch (parseError) {
              console.log('⚠️ [Agent] JSON 解析失败:', parseError instanceof Error ? parseError.message : '未知错误');
              console.log('📄 [Agent] 尝试解析的内容:', assistantMessage.substring(0, 500));
            }

            if (!parsed) {
              // 纯文本回复
              sendEvent({ type: 'text', content: assistantMessage });
              const memoryCandidate = extractMemoryCandidate(userMessageContent);
              if (memoryCandidate) {
                sendEvent({ type: 'memory_candidate', data: memoryCandidate });
              }

              const extractedScripts = tryExtractScriptOptions(assistantMessage);
              if (extractedScripts) {
                sendEvent({
                  type: 'script_options',
                  content: '识别到脚本内容，已结构化展示',
                  data: extractedScripts,
                  source: 'text_extractor'
                });
              }
              controller.close(); // 🔧 修复：必须关闭流，前端才能收到 done 事件
              break;
            }

            // 检查是否是工具调用（支持多种格式）
            const toolCalls: Array<{name: string; params: Record<string, any>; thought?: string}> = [];
            
            // 格式1: {type: 'tool_call', tool: 'xxx', params: {...}}
            if (parsed.type === 'tool_call' && parsed.tool) {
              toolCalls.push({ name: parsed.tool, params: parsed.params || {}, thought: parsed.thought });
            }
            
            // 格式2: {type: 'tool_call', tools: [{name: 'xxx', parameters: {...}}]}
            // 注意：模型返回的参数键是 "parameters" 而不是 "params"
            if (parsed.type === 'tool_call' && parsed.tools && Array.isArray(parsed.tools)) {
              for (const tool of parsed.tools) {
                toolCalls.push({ 
                  name: tool.name, 
                  params: tool.parameters || tool.params || {},
                  thought: tool.thought 
                });
              }
            }

            // 格式3: OpenAI 格式 {tool_calls: [{type: 'function', function: {name: 'xxx', arguments: '...'}}]}
            if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
              for (const tc of parsed.tool_calls) {
                let params = {};
                if (tc.function?.arguments) {
                  try {
                    params = typeof tc.function.arguments === 'string' 
                      ? JSON.parse(tc.function.arguments) 
                      : tc.function.arguments;
                  } catch {
                    params = {};
                  }
                }
                toolCalls.push({ 
                  name: tc.function?.name || tc.name,
                  params: params,
                  thought: tc.thought || ''
                });
              }
            }
            
            if (toolCalls.length > 0) {
              // 处理第一个工具调用
              const toolCall = toolCalls[0];
              const toolName = toolCall.name;
              const toolParams = sanitizeToolParams(toolCall.params);
              const thought = toolCall.thought || '';

              console.log(`🛠️ [Agent] 调用工具: ${toolName}`);
              console.log(`📦 [Agent] 参数:`, toolParams);

              // 发送工具调用开始
              sendEvent({ type: 'tool_start', tool: toolName, params: toolParams });

              // 检查工具是否存在
              if (!(toolName in tools)) {
                const errorResult = { error: `未知工具: ${toolName}` };
                sendEvent({ type: 'tool_result', tool: toolName, result: normalizeToolExecutionResult(errorResult) });
                
                messages.push({
                  role: 'user',
                  content: `[工具调用结果]\n工具: ${toolName}\n结果: ${JSON.stringify(errorResult)}`
                });
                continue;
              }

              const guardrailError = validateToolCall(toolName, toolParams);
              if (guardrailError) {
                const errorResult = { success: false, error: guardrailError, data: null };
                sendEvent({ type: 'tool_result', tool: toolName, result: normalizeToolExecutionResult(errorResult) });
                messages.push({
                  role: 'user',
                  content: `[工具调用结果]\n工具: ${toolName}\n结果: ${JSON.stringify(errorResult)}`
                });
                continue;
              }

              // 执行工具
              try {
                const result = await (tools as any)[toolName](toolParams);
                console.log(`✅ [Agent] 工具执行成功`);
                
                // 根据工具类型，添加上下文信息
                let contextAddition = '';
                
                // 如果是脚本生成，添加脚本生成上下文
                if (toolName === 'generate_script' && result.success && result.data) {
                  contextAddition = `\n\n脚本已生成，请展示给用户选择。`;
                }

                // 发送结果
                sendEvent({ type: 'tool_result', tool: toolName, result: normalizeToolExecutionResult(result) });

                // 添加反馈
                messages.push({
                  role: 'user',
                  content: `[工具调用结果]\n工具: ${toolName}\n结果: ${JSON.stringify(result)}${contextAddition}`
                });
              } catch (toolError) {
                const errorResult = { error: toolError instanceof Error ? toolError.message : '工具执行失败' };
                sendEvent({ type: 'tool_result', tool: toolName, result: normalizeToolExecutionResult(errorResult) });
                
                messages.push({
                  role: 'user',
                  content: `[工具调用结果]\n工具: ${toolName}\n结果: ${JSON.stringify(errorResult)}`
                });
              }
              
              continue;
            }

            // 结构化响应（video_analysis, script_options, task 等）
            if (['video_analysis', 'script_options', 'task_submitted', 'task_done', 'error'].includes(parsed.type)) {
              sendEvent(parsed);
              
              // 如果是 done 或 error，结束对话
              if (parsed.type === 'task_done' || parsed.type === 'error') {
                controller.close(); // 🔧 修复：必须关闭流
                break;
              }
              continue;
            }

            // 纯文本回复
            if (parsed.type === 'text' || parsed.content) {
              sendEvent({ type: 'text', content: parsed.content || assistantMessage });
              
              // 检查是否应该结束
              if (iterations >= 3 && parsed.type === 'text') {
                controller.close(); // 🔧 修复：必须关闭流
                break;
              }
              continue;
            }

            // 未知格式，发送原始文本
            sendEvent({ type: 'text', content: assistantMessage });
            controller.close(); // 🔧 修复：必须关闭流
            break;
          }

          // 🔧 修复：删除此处的 done 发送，由前端 SSE 解析器在流结束时自动发送
          // if (!doneSent) {
          //   doneSent = true;
          //   controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          //   controller.close();
          // }
          
        } catch (error) {
          console.error('❌ [Agent] 错误:', error);
          sendEvent({ type: 'error', content: error instanceof Error ? error.message : '发生错误' });
        }
        
        // 🔧 修复：确保流在循环结束后关闭
        try {
          controller.close();
        } catch (e) {
          // 流可能已经关闭，忽略错误
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ [Agent] API 错误:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}

/**
 * GET /api/xiaohai/agent/chat
 * 获取用户对话历史（正序，用于前端显示）
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    let userId: string | null = null;

    if (token) {
      const user = await verifyToken(token);
      if (user) {
        userId = user.userId;
      }
    }

    if (!userId) {
      return Response.json({ 
        success: false, 
        error: '未登录' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const listSessions = searchParams.get('listSessions') === '1';
    const createSession = searchParams.get('createSession') === '1';
    const sessionId = searchParams.get('sessionId');

    const supabase = getSupabaseClient();

    if (createSession) {
      const session = await createCreativeSession(userId);
      return ok({ data: { session } });
    }

    if (listSessions) {
      const { data: sessions } = await supabase
        .from('agent_sessions')
        .select('id,title,status,message_count,last_message_at,created_at')
        .eq('user_id', userId)
        .eq('agent_type', 'creative')
        .order('last_message_at', { ascending: false })
        .limit(50);
      return ok({ data: { sessions: sessions || [] } });
    }

    // 2. 查询对话历史（按 session 严格匹配）
    if (!sessionId) {
      return ok({
        data: {
          conversationHistory: [],
          userPreferences: [],
          sessionId: null,
        }
      });
    }

    let historyQuery = supabase
      .from('agent_conversation_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    const { data: historyData } = await historyQuery;

    // 3. 查询用户偏好
    const { data: preferencesData } = await supabase
      .from('creative_user_preferences')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated_at', { ascending: false });

    console.log(`📔 [API] 返回 ${historyData?.length || 0} 条历史消息给前端`);

    return ok({
      data: {
        conversationHistory: historyData || [],
        userPreferences: preferencesData || [],
        sessionId: sessionId || null,
      }
    });

  } catch (error) {
    console.error('❌ [GET History] API 错误:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '服务器错误' 
    }, { status: 500 });
  }
}
