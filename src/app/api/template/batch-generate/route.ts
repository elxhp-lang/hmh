/**
 * 批量视频生成 API
 * 
 * POST /api/template/batch-generate
 * 使用模板批量生成视频
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScriptTemplateService } from '@/lib/script-template-service';
import { SeedanceClient } from '@/lib/seedance-client';
import type { VideoRatio } from '@/lib/seedance-client';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { TaskStateService } from '@/lib/server/task-state-service';
import { requireAuth } from '@/lib/server/api-kit';
import { v4 as uuidv4 } from 'uuid';

const templateService = new ScriptTemplateService();
const seedanceClient = new SeedanceClient();
const taskStateService = new TaskStateService();

// 最大批量数量限制
const MAX_BATCH_SIZE = 20;
function normalizeVideoRatio(value?: string): VideoRatio {
  const allowed: VideoRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive'];
  return allowed.includes(value as VideoRatio) ? (value as VideoRatio) : '9:16';
}

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
    const auth = requireAuth(request);
    if (auth.response || !auth.user) return auth.response;
    const userId = auth.user.userId;
    const supabase = getSupabaseClient();

    const body = await request.json();
    const { template_id, data_rows, first_frame_url, session_id, reference_video, reference_images, reference_audio } = body;

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
    const activeSessionId = typeof session_id === 'string' && session_id ? session_id : null;
    if (!activeSessionId) {
      return NextResponse.json({ error: '缺少 session_id' }, { status: 400 });
    }

    const parentTask = await taskStateService.ensureTask({
      userId,
      sessionId: activeSessionId,
      taskType: 'batch_generate',
      clientRequestId: typeof body?.client_request_id === 'string' ? body.client_request_id : `batch_${Date.now()}`,
      inputData: {
        template_id,
        total_rows: data_rows.length,
        first_frame_url: first_frame_url || null,
      },
    });

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
        const videoId = uuidv4();
        // 构建 Seedance content 数组，包含参考素材
        const content: Array<{ type: string; [key: string]: unknown }> = [];
        if (first_frame_url) {
          content.push({ type: 'image_url', image_url: { url: first_frame_url }, role: 'first_frame' });
        }
        if (Array.isArray(reference_images)) {
          for (const url of reference_images) {
            if (url) content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' });
          }
        }
        if (reference_video) {
          content.push({ type: 'video_url', video_url: { url: reference_video }, role: 'reference_video' });
        }
        if (reference_audio) {
          content.push({ type: 'audio_url', audio_url: { url: reference_audio }, role: 'reference_audio' });
        }
        content.push({ type: 'text', text: result.prompt });

        const videoResult = await seedanceClient.createTask({
          model: 'doubao-seedance-2-0-260128',
          content: content as never,
          duration: template.duration,
          ratio: normalizeVideoRatio(template.aspect_ratio),
        });

        // videoResult 是 CreateTaskResponse
        if (videoResult.id) {
          // 构建视频名称：模板名 + 序号 + 首变量值，确保批量生成时每个视频可辨识
          const templateName = template.template_name || '批量生成';
          const rowData = data_rows[rowIndex] as Record<string, string> | undefined;
          const firstVarValue = rowData ? Object.values(rowData)[0] || '' : '';
          const videoName = firstVarValue
            ? `${templateName} #${rowIndex + 1} - ${firstVarValue}`
            : `${templateName} #${rowIndex + 1}`;

          await supabase.from('videos').insert({
            id: videoId,
            task_id: videoResult.id,
            user_id: userId,
            session_id: activeSessionId,
            prompt: result.prompt,
            video_name: videoName,
            task_type: first_frame_url ? 'image_to_video' : 'text_to_video',
            status: 'processing',
            ratio: template.aspect_ratio,
            duration: template.duration,
            model: 'doubao-seedance-2-0-260128',
            tags: ['batch_generate', `template:${template_id}`],
          });
          await taskStateService.appendTaskItem({
            taskId: parentTask.id,
            userId,
            sessionId: activeSessionId,
            status: 'succeeded',
            inputData: {
              rowIndex,
              prompt: result.prompt,
              variables: data_rows[rowIndex] || {},
            },
            outputData: {
              seedance_task_id: videoResult.id,
              video_id: videoId,
            },
          });
          taskResults.push({
            rowIndex,
            success: true,
            taskId: videoResult.id,
            prompt: result.prompt
          });
          submittedCount++;
        } else {
          await taskStateService.appendTaskItem({
            taskId: parentTask.id,
            userId,
            sessionId: activeSessionId,
            status: 'failed',
            inputData: {
              rowIndex,
              prompt: result.prompt,
              variables: data_rows[rowIndex] || {},
            },
            errorMessage: '提交失败',
          });
          taskResults.push({
            rowIndex,
            success: false,
            error: '提交失败'
          });
        }
      } catch (error) {
        await taskStateService.appendTaskItem({
          taskId: parentTask.id,
          userId,
          sessionId: activeSessionId,
          status: 'failed',
          inputData: {
            rowIndex,
            prompt: result.prompt,
            variables: data_rows[rowIndex] || {},
          },
          errorMessage: error instanceof Error ? error.message : '提交失败',
        });
        taskResults.push({
          rowIndex,
          success: false,
          error: error instanceof Error ? error.message : '提交失败'
        });
      }
    }

    // 更新模板使用次数
    await templateService.incrementUsage(template_id);
    await taskStateService.aggregateTaskFromItems(parentTask.id);
    await taskStateService.appendEvent(parentTask.id, userId, activeSessionId, 'batch_generate_submitted', {
      total: data_rows.length,
      submitted: submittedCount,
    });

    // 返回结果
    return NextResponse.json({
      success: true,
      batch_summary: {
        total: data_rows.length,
        valid: tasks.length,
        submitted: submittedCount,
        failed: parseResult.errorCount + (taskResults.filter(r => !r.success).length - parseResult.errorCount)
      },
      worker_task_id: parentTask.id,
      results: taskResults
    });

  } catch (error) {
    console.error('批量生成失败:', error);
    return NextResponse.json({ error: '批量生成失败' }, { status: 500 });
  }
}
