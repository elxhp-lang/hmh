/**
 * 用户画像服务
 * 异步复盘对话，提取用户行为统计，让创意小海越用越懂用户
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ConversationMessage {
  role: string;
  content: string;
}

interface ToolCallRecord {
  tool: string;
  params?: Record<string, unknown>;
  success?: boolean;
}

interface ReviewInput {
  messages: ConversationMessage[];
  toolCalls: ToolCallRecord[];
  sessionDuration?: number;
}

interface ProfileStats {
  tools_usage: Record<string, number>;
  style_keywords: string[];
  preferred_ratio: string | null;
  avg_duration: number | null;
  tone_keywords: string[];
  failure_count: number;
  behavior_summary: string;
}

const REVIEW_SYSTEM_PROMPT = `你是一个用户行为分析器。分析以下对话和工具调用记录，提取用户的行为统计。

返回严格JSON（不要markdown包裹，不要注释）：
{
  "tools_usage": {"工具名": 调用次数},
  "style_keywords": ["偏好风格1", "偏好风格2"],
  "preferred_ratio": "9:16 或 16:9 或 null",
  "avg_duration": 8.5 或 null,
  "tone_keywords": ["色调关键词"],
  "failure_count": 0,
  "behavior_summary": "一句话总结用户行为特征"
}

规则：
- tools_usage 统计调用了哪些工具及各几次
- style_keywords 从用户的选择和对话中提取风格关键词（如"现代简约""科技感"），最多5个
- preferred_ratio 如果对话中用户选择或生成了视频比例，记录最常用的；否则 null
- avg_duration 统计视频生成时长选择的平均值，没有则 null
- tone_keywords 从对话中提取色调偏好（如"暖色调""冷色调"），最多3个
- failure_count 统计工具调用失败的次数
- behavior_summary 用中文一句话概括用户本次的行为模式`;

export class UserProfileService {
  private supabase = getSupabaseClient();

  /** 复盘指定会话，更新用户画像 */
  async reviewSession(userId: string, sessionId: string): Promise<void> {
    try {
      // 1. 获取会话消息
      const { data: messages } = await this.supabase
        .from('agent_conversation_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (!messages || messages.length === 0) return;

      // 2. 从消息中提取工具调用记录
      const toolCalls: ToolCallRecord[] = [];
      for (const msg of messages) {
        if (msg.role === 'user' && typeof msg.content === 'string') {
          const match = msg.content.match(/\[工具调用结果\]\n工具: (\w+)\n结果: (.+)/);
          if (match) {
            const toolName = match[1];
            let success = true;
            try {
              const result = JSON.parse(match[2]);
              success = result.success !== false && !result.error;
            } catch { /* ignore */ }
            toolCalls.push({ tool: toolName, success });
          }
        }
      }

      // 3. 加载已有画像（用于合并）
      const { data: existingProfile } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // 4. 构建复盘输入
      const reviewInput: ReviewInput = {
        messages: messages.map(m => ({ role: String(m.role || ''), content: typeof m.content === 'string' ? m.content.slice(0, 500) : '' })),
        toolCalls,
      };

      // 5. LLM复盘分析
      const stats = await this.analyze(reviewInput);

      // 6. 合并新旧画像
      const merged = this.mergeProfiles(existingProfile, stats, sessionId);

      // 7. 写入/更新画像
      if (existingProfile) {
        await this.supabase
          .from('user_profiles')
          .update(merged)
          .eq('user_id', userId);
      } else {
        await this.supabase
          .from('user_profiles')
          .insert({ user_id: userId, ...merged });
      }

      // 8. 标记会话已复盘
      await this.supabase
        .from('agent_sessions')
        .update({ reviewed_at: new Date().toISOString() })
        .eq('id', sessionId);

      console.log(`[UserProfile] 会话 ${sessionId} 复盘完成`);
    } catch (error) {
      console.error('[UserProfile] 复盘失败:', error instanceof Error ? error.message : error);
    }
  }

  /** 调用 LLM 分析对话 */
  private async analyze(input: ReviewInput): Promise<ProfileStats> {
    const { LLMClient, Config } = await import('coze-coding-dev-sdk');
    const client = new LLMClient(new Config());
    const messages = [
      { role: 'system' as const, content: REVIEW_SYSTEM_PROMPT },
      { role: 'user' as const, content: JSON.stringify(input, null, 2) },
    ];

    let text = '';
    const response = await client.stream(messages, {
      model: 'doubao-seed-2-0-pro-260215',
      temperature: 0.1,
    });

    for await (const chunk of response) {
      const content = (chunk as { content?: unknown }).content;
      if (typeof content === 'string') text += content;
    }

    // 清理 LLM 可能包裹的 markdown 代码块
    const json = text.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    return JSON.parse(json) as ProfileStats;
  }

  /** 合并新旧画像：新数据加权平均 */
  private mergeProfiles(
    existing: Record<string, unknown> | null,
    stats: ProfileStats,
    sessionId: string
  ): Record<string, unknown> {
    const oldCount = (existing?.total_conversations as number) || 0;
    const newCount = oldCount + 1;
    const weight = 1 / newCount; // 指数衰减权重

    // tools_usage 累计
    const mergedTools: Record<string, number> = {};
    const oldTools = (existing?.tools_usage as Record<string, number>) || {};
    for (const key of new Set([...Object.keys(oldTools), ...Object.keys(stats.tools_usage)])) {
      mergedTools[key] = (oldTools[key] || 0) + (stats.tools_usage[key] || 0);
    }

    // avg_duration 加权平均
    let mergedDuration: number | null = null;
    if (existing?.avg_duration != null || stats.avg_duration != null) {
      const oldDur = (existing?.avg_duration as number) || 0;
      const newDur = stats.avg_duration || 0;
      mergedDuration = oldDur * (1 - weight) + newDur * weight;
    }

    // style_keywords 合并（保留旧的高频关键词，追加新的）
    const oldStyles = (existing?.style_keywords as string[]) || [];
    const mergedStyles = [...new Set([...stats.style_keywords, ...oldStyles])].slice(0, 10);

    // tone_keywords 合并
    const oldTones = (existing?.tone_keywords as string[]) || [];
    const mergedTones = [...new Set([...stats.tone_keywords, ...oldTones])].slice(0, 6);

    return {
      tools_usage: mergedTools,
      style_keywords: mergedStyles,
      preferred_ratio: stats.preferred_ratio || (existing?.preferred_ratio as string) || null,
      avg_duration: mergedDuration,
      tone_keywords: mergedTones,
      failure_count: ((existing?.failure_count as number) || 0) + stats.failure_count,
      total_conversations: newCount,
      behavior_summary: stats.behavior_summary,
      last_reviewed_session_id: sessionId,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /** 获取用户画像摘要（用于注入系统提示词） */
  async getProfileSummary(userId: string): Promise<string | null> {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('style_keywords, preferred_ratio, avg_duration, tone_keywords, behavior_summary, total_conversations, tools_usage')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data || !data.total_conversations || Number(data.total_conversations) < 2) return null;

    const parts: string[] = [];
    const styles = data.style_keywords as string[] | null;
    const tones = data.tone_keywords as string[] | null;
    const toolsUsage = data.tools_usage as Record<string, number> | null;

    if (styles && styles.length > 0) parts.push(`偏好风格：${styles.slice(0, 5).join('、')}`);
    if (tones && tones.length > 0) parts.push(`偏好色调：${tones.slice(0, 3).join('、')}`);
    if (data.preferred_ratio) parts.push(`常用视频比例：${data.preferred_ratio}`);
    if (data.avg_duration != null) parts.push(`平均视频时长：${Number(data.avg_duration).toFixed(1)}秒`);
    if (toolsUsage) {
      const topTools = Object.entries(toolsUsage)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name]) => name);
      if (topTools.length > 0) parts.push(`常用工具：${topTools.join('、')}`);
    }
    if (data.behavior_summary) parts.push(`行为特征：${data.behavior_summary}`);

    return parts.length > 0
      ? `[用户画像] 基于${data.total_conversations}次对话的统计：${parts.join('；')}。请参考这些信息来个性化你的回复。`
      : null;
  }
}
