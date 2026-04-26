/**
 * 财务助手 API - 纯 Agent 模式
 * 
 * 支持 Function Calling 的财务助手对话接口
 * 基于 Seed 2.0 模型，通过工具调用实现财务功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk';
import { financeToolsList } from '@/lib/finance-tools-v2';
import { FinanceToolExecutor } from '@/lib/finance-tool-executor';
import { getSupabaseClient } from '@/storage/database/supabase-client';

const encoder = new TextEncoder();
const MAX_ITERATIONS = 10;

// ========== 工具名映射（处理模型可能的命名变体）==========

const TOOL_NAME_MAP: Record<string, string> = {
  // 余额查询
  'get_account_balance': 'get_balance',
  'query_balance': 'get_balance',
  'check_balance': 'get_balance',
  'balance': 'get_balance',
  // 账单概览
  'get_bill_summary': 'get_bill_overview',
  'bill_overview': 'get_bill_overview',
  'query_bill': 'get_bill_overview',
  // 账单明细
  'get_bill_items': 'get_bill_details',
  'bill_details': 'get_bill_details',
  'query_bill_detail': 'get_bill_details',
  // 代金券
  'list_coupons': 'get_coupons',
  'query_coupons': 'get_coupons',
  'coupons': 'get_coupons',
  // 资源包
  'list_resource_packages': 'get_resource_packages',
  'query_resource_packages': 'get_resource_packages',
  'resource_packages': 'get_resource_packages',
  // 费用趋势
  'analyze_cost_trends': 'analyze_cost_trend',
  'cost_trend': 'analyze_cost_trend',
  'query_cost_trend': 'analyze_cost_trend',
  // 视频成本估算
  'estimate_cost': 'estimate_video_cost',
  'calculate_cost': 'estimate_video_cost',
  // 财务报告
  'create_report': 'generate_finance_report',
  'financial_report': 'generate_finance_report',
  'report': 'generate_finance_report',
  // 记忆
  'save_memory': 'save_finance_memory',
  'store_memory': 'save_finance_memory',
  'get_memory': 'get_finance_memory',
  'search_memory': 'search_finance_memory',
  // 定时任务
  'create_task': 'create_scheduled_task',
  'add_task': 'create_scheduled_task',
  'get_tasks': 'get_scheduled_tasks',
  'list_tasks': 'get_scheduled_tasks',
  'delete_task': 'delete_scheduled_task',
  'remove_task': 'delete_scheduled_task',
  // 预算
  'set_budget': 'set_budget_alert',
  'create_budget': 'set_budget_alert',
  'get_budget': 'get_budget_status',
  'budget_status': 'get_budget_status',
};

// ========== 系统提示词 ==========

const FINANCE_AGENT_SYSTEM_PROMPT = `你是财务小助手，专门帮助用户管理视频生成服务的成本和账户。

## 你的能力（使用工具）
1. get_balance - 查询账户余额和可用额度
2. get_bill_overview - 按产品类型汇总费用
3. get_bill_details - 查询详细账单明细
4. get_coupons - 查询代金券
5. get_resource_packages - 查询资源包
6. analyze_cost_trend - 分析费用趋势
7. estimate_video_cost - 估算视频生成成本
8. generate_finance_report - 生成财务报告
9. save_finance_memory - 保存财务记忆
10. get_finance_memory - 读取财务记忆
11. search_finance_memory - 搜索财务记忆
12. create_scheduled_task - 创建定时任务
13. get_scheduled_tasks - 查询定时任务
14. delete_scheduled_task - 删除定时任务
15. set_budget_alert - 设置预算提醒
16. get_budget_status - 获取预算状态
17. web_search - 联网搜索最新信息（需用户开启联网模式）

## 联网搜索说明
- 联网功能需要用户在界面右上角开启
- 如果联网未开启，当用户询问需要最新信息的问题时，提示用户开启联网模式
- AI 会自主判断是否需要使用联网搜索（如询问最新政策、市场行情、行业动态等）

## 响应风格
- 专业、简洁、数据驱动
- 主动发现异常并提醒
- 回答有数据依据

## 工具调用规则
1. 当需要查询数据时，使用工具获取实时数据
2. 只调用一个工具，等待结果后再决定下一步
3. 工具返回结果后，用自然语言向用户解释
4. 如果工具执行失败，告诉用户并建议其他方式

## 重要
- 金额单位是元
- 每次只调用一个工具
- 不要重复调用相同的工具`;

// ========== 辅助函数：清理输出文本（去除叠字等）==========

function cleanOutputText(text: string): string {
  if (!text) return text;
  
  // 去除开头和结尾的空白
  let cleaned = text.trim();
  
  // 去除连续重复的字符（2个及以上）
  cleaned = cleaned.replace(/(.)\1{2,}/g, '$1$1');
  
  // 去除重复的词语（如 "查询查询" -> "查询"）
  cleaned = cleaned.replace(/(\S+)\1{2,}/g, '$1');
  
  return cleaned;
}

// ========== 辅助函数：解析工具调用 ==========

interface ParsedToolCall {
  name: string;
  params: Record<string, unknown>;
}

function parseToolCalls(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  
  if (!text) return results;
  
  // 格式1: <|FunctionCallBegin|>...<|FunctionCallEnd|>
  const pattern1 = /<\|FunctionCallBegin\|>\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*<\|FunctionCallEnd\|>/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item.name) {
            const toolName = TOOL_NAME_MAP[item.name.toLowerCase()] || item.name;
            results.push({ name: toolName, params: item.parameters || item.params || {} });
          }
        });
      } else if (parsed.name) {
        const toolName = TOOL_NAME_MAP[parsed.name.toLowerCase()] || parsed.name;
        results.push({ name: toolName, params: parsed.parameters || parsed.params || {} });
      }
    } catch {}
  }
  
  // 格式2: JSON 代码块 ```...```
  if (results.length === 0) {
    const pattern2 = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    while ((match = pattern2.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name) {
          const toolName = TOOL_NAME_MAP[parsed.name.toLowerCase()] || parsed.name;
          results.push({ name: toolName, params: parsed.parameters || parsed.params || {} });
        }
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.name) {
              const toolName = TOOL_NAME_MAP[item.name.toLowerCase()] || item.name;
              results.push({ name: toolName, params: item.parameters || item.params || {} });
            }
          });
        }
      } catch {}
    }
  }
  
  // 格式3: 直接 JSON 对象
  if (results.length === 0) {
    const pattern3 = /\{[\s\S]*"name"\s*:\s*"([^"]+)"[\s\S]*\}/g;
    while ((match = pattern3.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        if (parsed.name) {
          const toolName = TOOL_NAME_MAP[parsed.name.toLowerCase()] || parsed.name;
          results.push({ name: toolName, params: parsed.parameters || parsed.params || {} });
        }
      } catch {}
    }
  }
  
  // 格式4: OpenAI 格式 tool_calls
  if (results.length === 0) {
    const pattern4 = /"tool_calls"\s*:\s*\[([\s\S]*?)\]/g;
    while ((match = pattern4.exec(text)) !== null) {
      try {
        const arr = JSON.parse('[' + match[1] + ']');
        arr.forEach((tc: any) => {
          const name = tc.function?.name || tc.name;
          const args = tc.function?.arguments || tc.arguments || {};
          const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
          if (name) {
            const toolName = TOOL_NAME_MAP[name.toLowerCase()] || name;
            results.push({ name: toolName, params: parsedArgs });
          }
        });
      } catch {}
    }
  }
  
  return results;
}

// ========== 对话历史（内存）==========
const conversationHistory: Map<string, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map();

// ========== 保存对话消息到数据库（财务助手专用表）==========

async function saveConversationMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    // 保存到财务助手专用表，与创意小海隔离
    await supabase.from('finance_conversation_messages').insert({
      user_id: userId,
      role: role,
      content: content
    });
  } catch (error) {
    console.error('保存财务助手对话消息失败:', error);
  }
}

// ========== API 导出 ==========

export async function GET() {
  return NextResponse.json({
    tools: financeToolsList,
    systemPrompt: FINANCE_AGENT_SYSTEM_PROMPT,
  });
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const userId = user.userId;

  try {
    const { message, conversationId, webSearchEnabled = false } = await request.json();
    const convId = conversationId || userId;

    let finalMessage = message;

    // 获取或创建对话历史
    if (!conversationHistory.has(convId)) {
      conversationHistory.set(convId, []);
    }
    const history = conversationHistory.get(convId)!;

    // 添加用户消息
    history.push({ role: 'user', content: finalMessage });

    // 保存到数据库
    await saveConversationMessage(userId, 'user', message);

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 发送开始信号
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start' })}\n\n`));

          // 构建消息
          const messages: Message[] = [
            { role: 'system', content: FINANCE_AGENT_SYSTEM_PROMPT },
            ...history.slice(-20),
          ];

          // 创建工具执行器（webSearchEnabled 传递给工具层，由AI自主决定是否使用联网搜索）
          const toolExecutor = new FinanceToolExecutor(userId, webSearchEnabled);

          let iterations = 0;
          let assistantMessage = '';
          let lastTextOutput = ''; // 用于去重

          while (iterations < MAX_ITERATIONS) {
            iterations++;

            // 调用 LLM（降低温度减少叠字问题）
            const client = new LLMClient(new Config());
            const response = await client.stream(messages, {
              model: 'doubao-seed-2-0-pro-260215',
              temperature: 0.3, // 降低温度
            });

            let chunkContent = '';
            for await (const chunk of response) {
              if (chunk.content) {
                chunkContent += chunk.content;
              }
            }

            if (!chunkContent.trim()) {
              console.log('[Finance Agent] LLM 返回为空');
              break;
            }

            // 清理输出
            const cleanedContent = cleanOutputText(chunkContent);
            
            // 发送内容（去重）
            if (cleanedContent !== lastTextOutput) {
              const newText = cleanedContent.slice(lastTextOutput.length);
              if (newText) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'content', content: newText })}\n\n`)
                );
                lastTextOutput = cleanedContent;
              }
            }
            
            assistantMessage = cleanedContent;
            messages.push({ role: 'assistant', content: chunkContent }); // 保留原始内容用于工具解析

            // 解析工具调用
            const toolCalls = parseToolCalls(chunkContent);

            if (toolCalls.length === 0) {
              // 没有工具调用，回复结束
              break;
            }

            // 执行工具
            const toolCall = toolCalls[0];
            console.log(`[Finance Agent] 执行工具: ${toolCall.name}`);

            const toolResult = await toolExecutor.execute(toolCall.name, toolCall.params);
            
            // 检查工具执行是否成功
            if (toolResult && typeof toolResult === 'object' && 'success' in toolResult && !(toolResult as any).success) {
              // 工具执行失败，发送错误信息
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  type: 'tool_error', 
                  name: toolCall.name, 
                  error: (toolResult as any).error || '工具执行失败' 
                })}\n\n`)
              );
            } else {
              // 发送工具执行结果
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tool', name: toolCall.name, result: toolResult })}\n\n`)
              );
            }

            // 将工具结果添加到消息
            const toolResultMessage = `\n\n[TOOL_RESULT:${toolCall.name}]${JSON.stringify(toolResult)}`;
            messages.push({ role: 'user', content: toolResultMessage });
          }

          // 保存助手回复
          history.push({ role: 'assistant', content: assistantMessage });
          await saveConversationMessage(userId, 'assistant', assistantMessage);

          // 发送完成信号
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'done', content: assistantMessage })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('[Finance Agent] Stream error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: '处理请求失败' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Finance Agent] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}

// 清理对话历史
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId') || user.userId;

  conversationHistory.delete(conversationId);

  return NextResponse.json({ success: true });
}
