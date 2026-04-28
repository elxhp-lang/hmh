/**
 * 创意小海进化服务
 * 
 * 核心功能：
 * 1. 记录学习（反馈、错误、成功）
 * 2. 知识沉淀
 */

import { getSupabaseClient } from '@/storage/database/supabase-client'

// ========== 类型定义 ==========

export interface LearningRecord {
  id: string
  user_id?: string
  record_type: 'correction' | 'success' | 'error' | 'improvement'
  content: string
  original_content?: string
  feedback?: string
  score?: number
  tags: string[]
  source: 'user_feedback' | 'task_result' | 'self_review'
  status: 'active' | 'applied' | 'archived'
  created_at: string
}

export type RecordType = LearningRecord['record_type']
export type LearningSource = LearningRecord['source']

// ========== 进化服务 ==========

export class XiaohaiEvolutionService {
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  private isLearningRecord(value: unknown): value is LearningRecord {
    if (!value || typeof value !== 'object') return false
    const row = value as Record<string, unknown>
    return typeof row.id === 'string' && typeof row.content === 'string'
  }

  /**
   * 记录学习
   */
  async recordLearning(
    userId: string | null,
    recordType: RecordType,
    content: string,
    options: {
      originalContent?: string
      feedback?: string
      score?: number
      tags?: string[]
      source?: LearningSource
    } = {}
  ): Promise<{ success: boolean; data?: LearningRecord; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('xiaohai_learning_records')
        .insert({
          user_id: userId,
          record_type: recordType,
          content,
          original_content: options.originalContent,
          feedback: options.feedback,
          score: options.score,
          tags: options.tags || [],
          source: options.source || 'user_feedback',
          status: 'active'
        })
        .select()
        .single()

      if (error) throw error

      console.log(`[进化服务] 记录学习成功: ${recordType}`, { id: this.isLearningRecord(data) ? data.id : 'unknown', userId })

      return { success: true, data: data as unknown as LearningRecord | undefined }
    } catch (error) {
      console.error('[进化服务] 记录学习失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '记录失败' }
    }
  }

  /**
   * 获取学习记录
   */
  async getLearningRecords(
    userId: string | null,
    query?: string,
    recordType?: RecordType,
    limit: number = 10
  ): Promise<{ success: boolean; data?: LearningRecord[]; error?: string }> {
    try {
      let dbQuery = this.supabase
        .from('xiaohai_learning_records')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(limit * 2)

      if (userId) {
        dbQuery = dbQuery.eq('user_id', userId)
      }

      if (recordType) {
        dbQuery = dbQuery.eq('record_type', recordType)
      }

      const { data, error } = await dbQuery
      if (error) throw error

      // 按关键词匹配排序
      if (query) {
        const queryKeywords = extractKeywords(query)
        const rawRecords = (data || []) as unknown[]
        const records = rawRecords.filter((item) => this.isLearningRecord(item))
        const scored: Array<LearningRecord & { relevanceScore: number }> = records.map((item) => ({
          ...item,
          relevanceScore: (item.tags || []).filter((tag: string) =>
            queryKeywords.some(qk => tag.toLowerCase().includes(qk.toLowerCase()))
          ).length || 0
        }))

        return {
          success: true,
          data: scored
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit)
            .map((item) => {
              const { relevanceScore, ...record } = item
              void relevanceScore
              return record as LearningRecord
            })
        }
      }

      return { success: true, data: (data || []) as unknown as LearningRecord[] }
    } catch (error) {
      console.error('[进化服务] 获取学习记录失败:', error)
      return { success: false, error: error instanceof Error ? error.message : '查询失败' }
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
