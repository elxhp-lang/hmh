/**
 * 脚本模板服务
 * 
 * 实现模板的创建、保存、解析、变量替换
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ========== 类型定义 ==========

export interface TemplateShot {
  shot_time: string;         // "0-2s"
  content: string;           // 镜头内容描述
  transition: string;        // 转场方式
  variables: string[];       // 变量列表，如 ["{{产品名}}", "{{卖点1}}"]
  first_frame_tag?: string;  // 首帧标签，后续可关联图片分析
}

export interface ScriptTemplate {
  template_id: string;
  template_name: string;
  category: string;           // 适用品类
  duration: number;           // 时长（秒）
  aspect_ratio: string;       // 比例，默认 "9:16"
  style: string;             // 风格
  shots: TemplateShot[];      // 镜头列表
  variable_desc?: Record<string, string>; // 变量说明
  created_by: string;         // 创建者 user_id
  usage_count: number;        // 使用次数
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VariableRow {
  [key: string]: string;      // 变量名 -> 值
}

export interface TemplateParseResult {
  success: boolean;
  prompt: string;             // 替换后的 prompt
  errors?: string[];          // 错误信息
  missingVariables?: string[]; // 缺失的必填变量
}

export interface BatchGenerateRequest {
  template_id: string;
  data_rows: VariableRow[];
  user_id: string;
}

// ========== 模板服务 ==========

export class ScriptTemplateService {
  // 延迟初始化，避免构建时检查环境变量
  private _supabase: ReturnType<typeof getSupabaseClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      this._supabase = getSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * 创建新模板
   */
  async createTemplate(template: Omit<ScriptTemplate, 'template_id' | 'usage_count' | 'created_at' | 'updated_at'>): Promise<{
    success: boolean;
    data?: ScriptTemplate;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('script_templates')
        .insert({
          ...template,
          usage_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('创建模板失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: this.mapToTemplate(data) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败'
      };
    }
  }

  /**
   * 获取用户的所有模板
   */
  async getUserTemplates(userId: string): Promise<{
    success: boolean;
    data?: ScriptTemplate[];
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('script_templates')
        .select('*')
        .eq('created_by', userId)
        .order('usage_count', { ascending: false });

      if (error) {
        console.error('获取模板列表失败:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: (data || []).map((item: any) => this.mapToTemplate(item as any))
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }

  /**
   * 获取单个模板
   */
  async getTemplate(templateId: string): Promise<{
    success: boolean;
    data?: ScriptTemplate;
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('script_templates')
        .select('*')
        .eq('template_id', templateId)
        .single();

      if (error) {
        console.error('获取模板失败:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: this.mapToTemplate(data) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '查询失败'
      };
    }
  }

  /**
   * 更新模板使用次数
   */
  async incrementUsage(templateId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('script_templates')
        .update({
          usage_count: this.supabase.rpc('increment', { row_id: templateId }),
          last_used_at: new Date().toISOString()
        })
        .eq('template_id', templateId);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(templateId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { error } = await this.supabase
        .from('script_templates')
        .delete()
        .eq('template_id', templateId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      };
    }
  }

  /**
   * 解析模板并替换变量
   */
  parseTemplate(template: ScriptTemplate, variables: VariableRow): TemplateParseResult {
    const errors: string[] = [];
    const missingVariables: string[] = [];

    // 收集所有变量
    const allVariables = new Set<string>();
    template.shots.forEach(shot => {
      shot.variables.forEach(v => allVariables.add(v));
    });

    // 检查必填变量
    allVariables.forEach(variable => {
      if (!variables[variable] && !variable.includes('?')) {
        // 可选变量以 ? 结尾
        missingVariables.push(variable);
      }
    });

    if (missingVariables.length > 0) {
      return {
        success: false,
        prompt: '',
        missingVariables,
        errors: [`缺少必填变量: ${missingVariables.join(', ')}`]
      };
    }

    // 替换变量
    const promptContent = template.shots.map(shot => {
      let content = shot.content;
      shot.variables.forEach(variable => {
        const value = variables[variable] || '';
        content = content.replace(new RegExp(variable.replace(/[{}]/g, ''), 'g'), value);
      });
      return `[${shot.shot_time}] ${content} (转场: ${shot.transition})`;
    }).join('\n');

    // 构造完整 prompt
    const prompt = `风格: ${template.style}
时长: ${template.duration}秒
比例: ${template.aspect_ratio}
镜头脚本:
${promptContent}`;

    return { success: true, prompt, errors };
  }

  /**
   * 批量解析模板
   */
  parseTemplateBatch(template: ScriptTemplate, dataRows: VariableRow[]): {
    success: boolean;
    results: TemplateParseResult[];
    validCount: number;
    errorCount: number;
  } {
    const results = dataRows.map(row => this.parseTemplate(template, row));
    
    return {
      success: true,
      results,
      validCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    };
  }

  /**
   * 保存历史脚本为模板
   */
  async saveFromHistory(
    userId: string,
    scriptContent: string,
    templateName: string,
    category: string,
    style: string = '默认'
  ): Promise<{
    success: boolean;
    data?: ScriptTemplate;
    error?: string;
  }> {
    // 简单的脚本解析：将脚本内容解析为镜头
    const shots: TemplateShot[] = [];
    const lines = scriptContent.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      const match = line.match(/\[(\d+-\d+s?)\]\s*(.+)/);
      if (match) {
        shots.push({
          shot_time: match[1],
          content: match[2],
          transition: '默认',
          variables: []
        });
      }
    });

    if (shots.length === 0) {
      return { success: false, error: '无法解析脚本内容' };
    }

    return this.createTemplate({
      template_name: templateName,
      category,
      duration: 8,
      aspect_ratio: '9:16',
      style,
      shots,
      created_by: userId
    });
  }

  /**
   * 映射数据库数据到模板对象
   */
  private mapToTemplate(data: any): ScriptTemplate {
    return {
      template_id: data.template_id || data.id,
      template_name: data.template_name,
      category: data.category,
      duration: data.duration,
      aspect_ratio: data.aspect_ratio || '9:16',
      style: data.style,
      shots: data.shots || [],
      variable_desc: data.variable_desc,
      created_by: data.created_by,
      usage_count: data.usage_count || 0,
      last_used_at: data.last_used_at,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }
}

export default ScriptTemplateService;
