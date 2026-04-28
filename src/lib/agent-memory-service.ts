/**
 * 智能体记忆服务
 * 提供智能体的长期记忆和自我学习能力
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// 记忆类型
export type MemoryType = 'preference' | 'fact' | 'skill' | 'experience';

// 智能体类型
export type AgentType = 'permission' | 'finance' | 'material' | 'creative';

// 记忆项
export interface MemoryItem {
  id: string;
  agent_type: AgentType;
  user_id: string | null;
  memory_type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  importance: number;
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface MemoryIdRow {
  id?: string;
}

// 记忆创建参数
export interface CreateMemoryParams {
  agent_type: AgentType;
  user_id?: string;
  memory_type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  importance?: number;
  expires_at?: string;
}

// 记忆查询参数
export interface QueryMemoriesParams {
  agent_type: AgentType;
  user_id?: string;
  memory_type?: MemoryType;
  key_prefix?: string;
  min_importance?: number;
  limit?: number;
}

class AgentMemoryService {
  /**
   * 创建或更新记忆
   */
  async upsertMemory(params: CreateMemoryParams): Promise<MemoryItem | null> {
    try {
      const client = getSupabaseClient();

      // 检查是否已存在相同 key 的记忆
      let query = client
        .from('agent_memories')
        .select('*')
        .eq('agent_type', params.agent_type)
        .eq('key', params.key);

      if (params.user_id) {
        query = query.eq('user_id', params.user_id);
      } else {
        query = query.is('user_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      const now = new Date().toISOString();
      const importance = params.importance ?? 5;

      if (existing) {
        // 更新现有记忆
        const { data, error } = await client
          .from('agent_memories')
          .update({
            value: params.value,
            importance,
            updated_at: now,
            expires_at: params.expires_at ?? null,
          })
          .eq('id', existing.id)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Failed to update memory:', error);
          return null;
        }
        return data as MemoryItem | null;
      } else {
        // 创建新记忆
        const { data, error } = await client
          .from('agent_memories')
          .insert({
            agent_type: params.agent_type,
            user_id: params.user_id ?? null,
            memory_type: params.memory_type,
            key: params.key,
            value: params.value,
            importance,
            expires_at: params.expires_at ?? null,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error('Failed to create memory:', error);
          return null;
        }
        return data as MemoryItem | null;
      }
    } catch (error) {
      console.error('Failed to upsert memory:', error);
      return null;
    }
  }

  /**
   * 查询记忆
   */
  async queryMemories(params: QueryMemoriesParams): Promise<MemoryItem[]> {
    try {
      const client = getSupabaseClient();
      let query = client
        .from('agent_memories')
        .select('*')
        .eq('agent_type', params.agent_type);

      if (params.user_id) {
        query = query.eq('user_id', params.user_id);
      } else {
        query = query.is('user_id', null);
      }

      if (params.memory_type) {
        query = query.eq('memory_type', params.memory_type);
      }

      if (params.key_prefix) {
        query = query.ilike('key', `${params.key_prefix}%`);
      }

      if (params.min_importance) {
        query = query.gte('importance', params.min_importance);
      }

      // 排除已过期的记忆
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      // 按重要性排序
      query = query.order('importance', { ascending: false });

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to query memories:', error);
        return [];
      }

      // 更新访问计数
      if (data && data.length > 0) {
        const memoryIds = data.map((m) => (m as MemoryIdRow).id as string);
        await this.updateAccessCount(memoryIds);
      }

      return (data as unknown as MemoryItem[]) ?? [];
    } catch (error) {
      console.error('Failed to query memories:', error);
      return [];
    }
  }

  /**
   * 获取单个记忆
   */
  async getMemory(agentType: AgentType, key: string, userId?: string): Promise<MemoryItem | null> {
    try {
      const client = getSupabaseClient();
      let query = client
        .from('agent_memories')
        .select('*')
        .eq('agent_type', agentType)
        .eq('key', key);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Failed to get memory:', error);
        return null;
      }

      // 更新访问计数
      if (data) {
        await this.updateAccessCount([(data as MemoryIdRow).id as string]);
      }

      return data as unknown as MemoryItem | null;
    } catch (error) {
      console.error('Failed to get memory:', error);
      return null;
    }
  }

  /**
   * 删除记忆
   */
  async deleteMemory(agentType: AgentType, key: string, userId?: string): Promise<boolean> {
    try {
      const client = getSupabaseClient();
      let query = client
        .from('agent_memories')
        .delete()
        .eq('agent_type', agentType)
        .eq('key', key);

      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.is('user_id', null);
      }

      const { error } = await query;

      if (error) {
        console.error('Failed to delete memory:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to delete memory:', error);
      return false;
    }
  }

  /**
   * 更新访问计数
   */
  private async updateAccessCount(memoryIds: string[]): Promise<void> {
    try {
      const client = getSupabaseClient();
      const now = new Date().toISOString();

      for (const id of memoryIds) {
        await client
          .from('agent_memories')
          .update({
            access_count: client.rpc('increment_access_count', { memory_id: id }),
            last_accessed_at: now,
          })
          .eq('id', id);
      }
    } catch (error) {
      // 静默失败 - 访问计数更新失败不影响主流程
      console.warn('Failed to update access count:', error);
    }
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpiredMemories(): Promise<number> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('agent_memories')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('Failed to cleanup expired memories:', error);
        return 0;
      }

      return data?.length ?? 0;
    } catch (error) {
      console.error('Failed to cleanup expired memories:', error);
      return 0;
    }
  }

  /**
   * 批量导入记忆
   */
  async batchImport(
    agentType: AgentType,
    memories: Array<{
      key: string;
      value: Record<string, unknown>;
      memory_type: MemoryType;
      importance?: number;
    }>,
    userId?: string
  ): Promise<number> {
    try {
      const client = getSupabaseClient();
      const records = memories.map(m => ({
        agent_type: agentType,
        user_id: userId ?? null,
        memory_type: m.memory_type,
        key: m.key,
        value: m.value,
        importance: m.importance ?? 5,
      }));

      const { data, error } = await client
        .from('agent_memories')
        .insert(records)
        .select('id');

      if (error) {
        console.error('Failed to batch import memories:', error);
        return 0;
      }

      return data?.length ?? 0;
    } catch (error) {
      console.error('Failed to batch import memories:', error);
      return 0;
    }
  }

  /**
   * 记录用户偏好
   */
  async recordPreference(
    agentType: AgentType,
    userId: string,
    key: string,
    value: string
  ): Promise<boolean> {
    try {
      const result = await this.upsertMemory({
        agent_type: agentType,
        user_id: userId,
        memory_type: 'preference',
        key: `preference:${key}`,
        value: { value, recorded_at: new Date().toISOString() },
        importance: 7,
      });
      return result !== null;
    } catch (error) {
      console.error('Failed to record preference:', error);
      return false;
    }
  }

  /**
   * 记录事实
   */
  async recordFact(
    agentType: AgentType,
    userId: string,
    key: string,
    value: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const result = await this.upsertMemory({
        agent_type: agentType,
        user_id: userId,
        memory_type: 'fact',
        key: `fact:${key}`,
        value,
        importance: 6,
      });
      return result !== null;
    } catch (error) {
      console.error('Failed to record fact:', error);
      return false;
    }
  }

  /**
   * 获取用于 LLM 的记忆上下文
   */
  async getContextForLLM(
    agentType: AgentType,
    userId: string,
    _currentMessage?: string
  ): Promise<string> {
    void _currentMessage;
    try {
      // 获取用户偏好和重要记忆
      const memories = await this.queryMemories({
        agent_type: agentType,
        user_id: userId,
        limit: 10,
      });

      if (memories.length === 0) {
        return '';
      }

      const parts: string[] = [];

      // 按类型分组
      const preferences = memories.filter(m => m.memory_type === 'preference');
      const facts = memories.filter(m => m.memory_type === 'fact');
      const skills = memories.filter(m => m.memory_type === 'skill');
      const experiences = memories.filter(m => m.memory_type === 'experience');

      if (preferences.length > 0) {
        parts.push('用户偏好：');
        preferences.forEach(p => {
          const value = p.value.value as string || JSON.stringify(p.value);
          parts.push(`- ${p.key.replace('preference:', '')}: ${value}`);
        });
      }

      if (facts.length > 0) {
        parts.push('\n用户信息：');
        facts.forEach(f => {
          parts.push(`- ${f.key.replace('fact:', '')}: ${JSON.stringify(f.value)}`);
        });
      }

      if (skills.length > 0) {
        parts.push('\n用户技能：');
        skills.forEach(s => {
          parts.push(`- ${s.key}: ${JSON.stringify(s.value)}`);
        });
      }

      if (experiences.length > 0) {
        parts.push('\n用户经验：');
        experiences.forEach(e => {
          parts.push(`- ${e.key}: ${JSON.stringify(e.value)}`);
        });
      }

      return parts.join('\n');
    } catch (error) {
      console.error('Failed to get memory context:', error);
      return '';
    }
  }
}

export const agentMemoryService = new AgentMemoryService();
