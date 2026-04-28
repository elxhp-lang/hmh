/**
 * 记忆分层服务
 * 基于虾评Skill的记忆系统设计
 * 
 * 记忆分层：
 * 1. SESSION-STATE - 当前任务恢复层（保存中断后续接所需的最小真相）
 * 2. WORKING-BUFFER - 毛坯区（放临时判断、草稿和待蒸馏内容）
 * 3. LONG-TERM-MEMORY - 蒸馏后的长期记忆（保存稳定偏好、约定、决策）
 * 4. DAILY-NOTES - 每日笔记和原始过程记录
 * 
 * 核心原则：文件是唯一的真相源
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

// 记忆层级
export enum MemoryLayer {
  SESSION_STATE = 'session_state',     // 当前任务恢复
  WORKING_BUFFER = 'working_buffer',   // 毛坯区
  LONG_TERM_MEMORY = 'long_term',      // 长期记忆
  DAILY_NOTE = 'daily_note',           // 每日笔记
}

// 记忆条目状态
export enum MemoryStatus {
  DRAFT = 'draft',           // 草稿
  PENDING = 'pending',       // 待蒸馏
  DISTILLED = 'distilled',   // 已蒸馏
  ARCHIVED = 'archived',     // 已归档
}

// 记忆条目接口
export interface MemoryEntry {
  id?: string;
  userId: string;
  layer: MemoryLayer;
  status: MemoryStatus;
  title: string;
  content: string;
  summary?: string;
  keywords?: string[];
  importanceScore?: number;
  parentMemoryId?: string;  // 关联的父记忆
  sessionContext?: Record<string, unknown>;  // 会话上下文
  distilledFrom?: string[];  // 从哪些条目蒸馏而来
  createdAt?: Date;
  updatedAt?: Date;
}

// 会话状态接口
export interface SessionState {
  currentTask?: string;
  completed: string[];
  blockers: string[];
  nextSteps: string[];
  recoveryInfo?: string;
}

interface DbErrorLike {
  message?: string;
}

interface IdRow {
  id: string;
}

function isIdRow(value: unknown): value is IdRow {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).id === 'string';
}

/**
 * 记忆分层服务类
 */
export class MemoryLayerService {
  private headers: Record<string, string>;

  constructor(headers?: Record<string, string>) {
    this.headers = headers || {};
  }

  // ==================== 会话状态管理 ====================

  /**
   * 保存当前会话状态
   */
  async saveSessionState(userId: string, state: SessionState): Promise<void> {
    const client = getSupabaseClient();
    
    // 查找现有会话状态
    const { data: existing } = await client
      .from('agent_memories')
      .select('id')
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.SESSION_STATE)
      .eq('status', MemoryStatus.DRAFT)
      .single();

    const content = JSON.stringify(state, null, 2);
    const title = `会话状态 - ${new Date().toLocaleDateString()}`;

    if (existing) {
      await client
        .from('agent_memories')
        .update({
          content,
          title,
          session_context: state,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await client
        .from('agent_memories')
        .insert({
          user_id: userId,
          layer: MemoryLayer.SESSION_STATE,
          status: MemoryStatus.DRAFT,
          title,
          content,
          session_context: state,
          importance_score: 0.9,
        });
    }
  }

  /**
   * 恢复会话状态
   */
  async restoreSessionState(userId: string): Promise<SessionState | null> {
    const client = getSupabaseClient();
    
    const { data: memory } = await client
      .from('agent_memories')
      .select('session_context, updated_at')
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.SESSION_STATE)
      .order('updated_at', { ascending: false })
      .single();

    if (memory?.session_context) {
      return memory.session_context as SessionState;
    }

    return null;
  }

  // ==================== 工作缓冲区管理 ====================

  /**
   * 添加到工作缓冲区
   */
  async addToWorkingBuffer(params: {
    userId: string;
    title: string;
    content: string;
    keywords?: string[];
  }): Promise<string> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_memories')
      .insert({
        user_id: params.userId,
        layer: MemoryLayer.WORKING_BUFFER,
        status: MemoryStatus.DRAFT,
        title: params.title,
        content: params.content,
        keywords: params.keywords,
        importance_score: 0.5,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`添加到工作缓冲区失败: ${(error as DbErrorLike).message || '未知错误'}`);
    }
    if (!data) {
      throw new Error('添加到工作缓冲区失败：未返回数据');
    }

    if (!isIdRow(data)) {
      throw new Error('添加到工作缓冲区失败：返回数据缺少ID');
    }
    return data.id;
  }

  /**
   * 获取工作缓冲区内容
   */
  async getWorkingBuffer(userId: string, limit: number = 10): Promise<MemoryEntry[]> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.WORKING_BUFFER)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []) as unknown as MemoryEntry[];
  }

  // ==================== 长期记忆管理 ====================

  /**
   * 蒸馏工作缓冲区到长期记忆
   */
  async distillToLongTermMemory(params: {
    userId: string;
    bufferIds?: string[];  // 指定要蒸馏的条目，不指定则处理所有待蒸馏条目
  }): Promise<string[]> {
    const client = getSupabaseClient();
    
    // 获取待蒸馏的内容
    let query = client
      .from('agent_memories')
      .select('*')
      .eq('user_id', params.userId)
      .eq('layer', MemoryLayer.WORKING_BUFFER)
      .eq('status', MemoryStatus.PENDING);

    if (params.bufferIds && params.bufferIds.length > 0) {
      query = query.in('id', params.bufferIds);
    }

    const { data: bufferItems } = await query;

    if (!bufferItems || bufferItems.length === 0) {
      return [];
    }

    const distilledIds: string[] = [];

    // 批量蒸馏
    for (const item of bufferItems as Array<Record<string, unknown>>) {
      try {
        // 使用 LLM 蒸馏内容
        const distilledContent = await this.distillContent(item.content as string, item.title as string);

        // 创建长期记忆
        const { data: longTermMemory, error: insertError } = await client
          .from('agent_memories')
          .insert({
            user_id: params.userId,
            layer: MemoryLayer.LONG_TERM_MEMORY,
            status: MemoryStatus.DISTILLED,
            title: distilledContent.title,
            content: distilledContent.content,
            summary: distilledContent.summary,
            keywords: distilledContent.keywords,
            importance_score: 0.8,
            distilled_from: [item.id],
          })
          .select('id')
          .single();

        if (!insertError && longTermMemory) {
          // 标记原条目为已蒸馏
          await client
            .from('agent_memories')
            .update({
              status: MemoryStatus.DISTILLED,
              parent_memory_id: isIdRow(longTermMemory) ? longTermMemory.id : undefined,
            })
            .eq('id', item.id as string);

          if (isIdRow(longTermMemory)) {
            distilledIds.push(longTermMemory.id);
          }
        }
      } catch (e) {
        console.error(`蒸馏失败 [${item.id}]:`, e);
      }
    }

    return distilledIds;
  }

  /**
   * 蒸馏内容
   */
  private async distillContent(content: string, title: string): Promise<{
    title: string;
    content: string;
    summary: string;
    keywords: string[];
  }> {
    const llmClient = new LLMClient(new Config(), this.headers);

    const systemPrompt = `你是一位知识蒸馏专家。你的任务是将原始笔记提炼成稳定、持久的知识。

蒸馏原则：
1. 提取核心事实和决策
2. 移除临时性、过程性的内容
3. 保留可复用的知识和模式
4. 使用简洁、准确的语言

请返回 JSON 格式的蒸馏结果。`;

    const userPrompt = `请蒸馏以下内容：

标题：${title}
内容：
${content}

返回 JSON 格式：
{
  "title": "蒸馏后的标题",
  "content": "蒸馏后的内容",
  "summary": "一句话摘要",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`;

    try {
      let fullResponse = '';
      for await (const chunk of llmClient.stream([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { model: 'doubao-seed-1-8-251228', temperature: 0.3 })) {
        if (chunk.content) {
          fullResponse += chunk.content.toString();
        }
      }

      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('蒸馏内容失败:', e);
    }

    // 返回原始内容
    return {
      title,
      content,
      summary: content.slice(0, 100),
      keywords: [],
    };
  }

  /**
   * 获取长期记忆
   */
  async getLongTermMemories(userId: string, limit: number = 20): Promise<MemoryEntry[]> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.LONG_TERM_MEMORY)
      .order('importance_score', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []) as unknown as MemoryEntry[];
  }

  // ==================== 每日笔记管理 ====================

  /**
   * 创建每日笔记
   */
  async createDailyNote(params: {
    userId: string;
    content: string;
    tags?: string[];
  }): Promise<string> {
    const client = getSupabaseClient();
    
    const today = new Date().toISOString().split('T')[0];
    const title = `每日笔记 - ${today}`;

    // 检查今天是否已有笔记
    const { data: existing } = await client
      .from('agent_memories')
      .select('id, content')
      .eq('user_id', params.userId)
      .eq('layer', MemoryLayer.DAILY_NOTE)
      .eq('title', title)
      .single();

    if (existing) {
      // 追加到现有笔记
      const existingAny = existing as Record<string, unknown>;
      const newContent = (existingAny.content as string) + '\n\n---\n\n' + params.content;
      await client
        .from('agent_memories')
        .update({ content: newContent })
        .eq('id', existingAny.id);
      return existingAny.id as string;
    }

    // 创建新笔记
    const { data, error } = await client
      .from('agent_memories')
      .insert({
        user_id: params.userId,
        layer: MemoryLayer.DAILY_NOTE,
        status: MemoryStatus.DRAFT,
        title,
        content: params.content,
        keywords: params.tags,
        importance_score: 0.6,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`创建每日笔记失败: ${error.message}`);
    }

    return ((data as Partial<IdRow> | null)?.id as string) || '';
  }

  /**
   * 获取每日笔记
   */
  async getDailyNotes(userId: string, limit: number = 7): Promise<MemoryEntry[]> {
    const client = getSupabaseClient();
    
    const { data, error } = await client
      .from('agent_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.DAILY_NOTE)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []) as unknown as MemoryEntry[];
  }

  // ==================== 记忆检索 ====================

  /**
   * 检索相关记忆（按层级优先级）
   */
  async retrieveRelevantMemories(params: {
    userId: string;
    query: string;
    limit?: number;
  }): Promise<MemoryEntry[]> {
    const client = getSupabaseClient();
    const { userId, query, limit = 5 } = params;

    // 提取关键词
    const keywords = query
      .replace(/[，。！？；：""''【】（）《》、\n\r\t]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .slice(0, 5);

    if (keywords.length === 0) {
      return [];
    }

    // 按优先级检索：SESSION-STATE → WORKING-BUFFER → LONG-TERM → DAILY-NOTES
    const { data, error } = await client
      .from('agent_memories')
      .select('*')
      .eq('user_id', userId)
      .or(keywords.map(kw => 
        `title.ilike.%${kw}%,content.ilike.%${kw}%,summary.ilike.%${kw}%`
      ).join(','))
      .order('importance_score', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }

    return (data || []) as unknown as MemoryEntry[];
  }

  // ==================== 记忆清理 ====================

  /**
   * 清理过期的会话状态和工作缓冲区
   */
  async cleanupExpiredMemories(userId: string, daysToKeep: number = 7): Promise<void> {
    const client = getSupabaseClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // 清理过期的会话状态
    await client
      .from('agent_memories')
      .delete()
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.SESSION_STATE)
      .lt('updated_at', cutoffDate.toISOString());

    // 清理已蒸馏的工作缓冲区
    await client
      .from('agent_memories')
      .delete()
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.WORKING_BUFFER)
      .eq('status', MemoryStatus.DISTILLED);

    // 清理过期的每日笔记（保留最近30天）
    const notesCutoff = new Date();
    notesCutoff.setDate(notesCutoff.getDate() - 30);
    await client
      .from('agent_memories')
      .delete()
      .eq('user_id', userId)
      .eq('layer', MemoryLayer.DAILY_NOTE)
      .lt('created_at', notesCutoff.toISOString());
  }
}

// 导出工厂函数
export function createMemoryLayerService(headers?: Record<string, string>): MemoryLayerService {
  return new MemoryLayerService(headers);
}
