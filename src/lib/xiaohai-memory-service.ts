/**
 * 创意小海记忆服务
 * 
 * 核心功能：
 * 1. 保存/获取/搜索用户记忆
 * 2. 按关键词相关性排序
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'

// ========== 类型定义 ==========

export type MemoryType = 'general' | 'preference' | 'experience' | 'rule' | 'document'
export type MemorySource = 'user' | 'feedback' | 'error' | 'document'

export interface MemoryRecord {
  id: string
  user_id: string
  content: string
  memory_type: MemoryType
  keywords: string[]
  source: MemorySource
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ========== 记忆服务 ==========

export class XiaohaiMemoryService {
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  private isMemoryRecord(value: unknown): value is MemoryRecord {
    if (!value || typeof value !== 'object') return false
    const row = value as Record<string, unknown>
    return typeof row.id === 'string' && typeof row.content === 'string'
  }

  /**
   * 保存记忆
   */
  async saveMemory(
    userId: string,
    content: string,
    memoryType: MemoryType,
    keywords: string[],
    options: { source?: MemorySource; metadata?: Record<string, unknown> } = {}
  ): Promise<{ success: boolean; data?: MemoryRecord; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('xiaohai_user_memories')
        .insert({
          user_id: userId,
          content,
          memory_type: memoryType,
          keywords,
          source: options.source || 'user',
          metadata: options.metadata || {}
        })
        .select()
        .single()

      if (error) throw error

      console.log(`[记忆服务] 保存记忆成功: ${this.isMemoryRecord(data) ? data.id : 'unknown'}, type=${memoryType}`)

      if (!data) {
        throw new Error('保存记忆失败：未返回数据')
      }

      return { success: true, data: data as unknown as MemoryRecord }
    } catch (error) {
      console.error('[记忆服务] 保存记忆失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '保存失败' }
    }
  }

  /**
   * 获取记忆（按关键词相关性排序）
   */
  async getMemories(
    userId: string,
    query: string,
    memoryType?: string,
    limit: number = 10
  ): Promise<{ success: boolean; data?: MemoryRecord[]; error?: string }> {
    try {
      const queryKeywords = extractKeywords(query)

      // 构建查询
      let dbQuery = this.supabase
        .from('xiaohai_user_memories')
        .select('*')
        .eq('user_id', userId)
        .limit(50)

      if (memoryType && memoryType !== 'all') {
        dbQuery = dbQuery.eq('memory_type', memoryType)
      }

      const { data, error } = await dbQuery
      if (error) throw error

      // 按关键词命中数排序
      const rawRecords = (data || []) as unknown[]
      const records = rawRecords.filter((item) => this.isMemoryRecord(item))
      const scored: Array<MemoryRecord & { relevanceScore: number }> = records.map((item) => {
        const hits = (item.keywords || []).filter((k: string) =>
          queryKeywords.some(qk => 
            k.toLowerCase().includes(qk.toLowerCase()) ||
            qk.toLowerCase().includes(k.toLowerCase())
          )
        ).length || 0

        return { ...item, relevanceScore: hits }
      })

      // 按关键词命中数排序，然后返回所有（没有命中也返回最近的）
      const result = scored
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit)
        .map((item) => {
          const { relevanceScore, ...record } = item
          void relevanceScore
          return record as MemoryRecord
        })

      console.log(`[记忆服务] 获取记忆: query="${query}", found=${result.length}`)

      return { success: true, data: result }
    } catch (error) {
      console.error('[记忆服务] 获取记忆失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '查询失败' }
    }
  }

  /**
   * 搜索记忆
   */
  async searchMemories(
    userId: string,
    keyword: string,
    memoryType?: string
  ): Promise<{ success: boolean; data?: MemoryRecord[]; error?: string }> {
    try {
      let dbQuery = this.supabase
        .from('xiaohai_user_memories')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', keyword)

      if (memoryType) {
        dbQuery = dbQuery.eq('memory_type', memoryType)
      }

      const { data, error } = await dbQuery
      if (error) throw error

      console.log(`[记忆服务] 搜索记忆: keyword="${keyword}", found=${(data || []).length}`)

      return { success: true, data: (data || []) as unknown as MemoryRecord[] }
    } catch (error) {
      console.error('[记忆服务] 搜索记忆失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' }
    }
  }

  /**
   * 从反馈学习
   */
  async learnFromFeedback(
    userId: string,
    originalResponse: string,
    userFeedback: string,
    isCorrection: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const keywords = extractKeywords(userFeedback)
      
      const content = isCorrection
        ? `用户纠正: ${userFeedback} | 原回答: ${originalResponse}`
        : `用户补充: ${userFeedback} | 原回答: ${originalResponse}`

      await this.saveMemory(userId, content, 'experience', keywords, { source: 'feedback' })

      console.log(`[记忆服务] 反馈学习: isCorrection=${isCorrection}`)

      return { success: true }
    } catch (error) {
      console.error('[记忆服务] 反馈学习失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '学习失败' }
    }
  }

  /**
   * 删除记忆
   */
  async deleteMemory(
    memoryId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('xiaohai_user_memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', userId)

      if (error) throw error

      console.log(`[记忆服务] 删除记忆: ${memoryId}`)

      return { success: true }
    } catch (error) {
      console.error('[记忆服务] 删除记忆失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '删除失败' }
    }
  }
}

// ========== 工具函数 ==========

function extractKeywords(text: string): string[] {
  const stopWords = ['的', '是', '在', '了', '和', '与', '或', '不', '要', '会', '能', '可以', '我', '你', '他', '她', '它', '这', '那', '一个', '什么', '怎么', '为什么']
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.includes(word))
}
