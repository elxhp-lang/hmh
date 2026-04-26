/**
 * 批量视频生成 API
 * 
 * POST /api/template/batch-generate
 * 使用模板批量生成视频
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ScriptTemplateService } from '@/lib/script-template-service';
import { SeedanceClient } from '@/lib/seedance-client';

const templateService = new ScriptTemplateService();
const seedanceClient = new SeedanceClient();

// 最大批量数量限制
const MAX_BATCH_SIZE = 20;

interface TaskResult {
  rowIndex: number;
  success: boolean;
  taskId?: string;
  prompt?: string;
  error?: string;
}

/**
 * POST /api/template/batch-generate
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const body = await request.json();
    const { template_id, data_rows, first_frame_url } = body;

    if (!template_id || !data_rows || !Array.isArray(data_rows)) {
      return NextResponse.json({ error: '参数错误' }, { status: 400 });
    }

    // 检查批量数量限制
    if (data_rows.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ 
        error: `单次批量数量不能超过 ${MAX_BATCH_SIZE} 个` 
      }, { status: 400 });
    }

    // 获取模板
    const templateResult = await templateService.getTemplate(template_id);
    if (!templateResult.success || !templateResult.data) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const template = templateResult.data;

    // 解析模板并批量生成
    const parseResult = templateService.parseTemplateBatch(template, data_rows);

    // 构造批量任务
    const tasks: Array<{ prompt: string; variables: Record<string, string> }> = [];
    
    parseResult.results.forEach((result, index) => {
      if (result.success) {
        tasks.push({
          prompt: result.prompt,
          variables: data_rows[index]
        });
      }
    });

    // 提交批量任务
    const taskResults: TaskResult[] = [];
    let submittedCount = 0;

    for (let i = 0; i < parseResult.results.length; i++) {
      const result = parseResult.results[i];
      const rowIndex = i;

      if (!result.success) {
        taskResults.push({
          rowIndex,
          success: false,
          error: result.errors?.join(', ') || '变量解析失败'
        });
        continue;
      }

      try {
        // 调用 Seedance 生成视频
        let videoResult;
        if (first_frame_url) {
          // 有首帧图：使用图生视频
          videoResult = await seedanceClient.imageToVideo(first_frame_url, result.prompt, {
            model: 'doubao-seedance-2-0-260128',
            duration: template.duration,
            ratio: template.aspect_ratio as any,
          });
        } else {
          // 无首帧图：使用文生视频
          videoResult = await seedanceClient.textToVideo(result.prompt, {
            model: 'doubao-seedance-2-0-260128',
            duration: template.duration,
            ratio: template.aspect_ratio as any,
          });
        }

        // videoResult 是 GetTaskResponse
        if (videoResult.id) {
          taskResults.push({
            rowIndex,
            success: true,
            taskId: videoResult.id,
            prompt: result.prompt
          });
          submittedCount++;
        } else {
          taskResults.push({
            rowIndex,
            success: false,
            error: '提交失败'
          });
        }
      } catch (error) {
        taskResults.push({
          rowIndex,
          success: false,
          error: error instanceof Error ? error.message : '提交失败'
        });
      }
    }

    // 更新模板使用次数
    await templateService.incrementUsage(template_id);

    // 返回结果
    return NextResponse.json({
      success: true,
      batch_summary: {
        total: data_rows.length,
        valid: tasks.length,
        submitted: submittedCount,
        failed: parseResult.errorCount + (taskResults.filter(r => !r.success).length - parseResult.errorCount)
      },
      results: taskResults
    });

  } catch (error) {
    console.error('批量生成失败:', error);
    return NextResponse.json({ error: '批量生成失败' }, { status: 500 });
  }
}
