import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { createDualLayerService, type TaskType } from '@/lib/dual-layer-service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 双层能力系统 - 对比模式API
 * 
 * POST /api/agent/compare
 * 
 * 请求体:
 * - action: 'execute' | 'record_choice'
 * - taskType: 'script_generation' | 'video_analysis' | 'prompt_optimization' | 'creative_suggestion'
 * - userInput: 用户输入
 * - style?: 风格要求
 * - productInfo?: 商品信息
 * 
 * 记录选择:
 * - action: 'record_choice'
 * - recordId: 记录ID
 * - choice: 'master' | 'agent' | 'both' | 'neither'
 */

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };

    const body = await request.json();
    const { action } = body;

    // 获取请求头（用于SDK调用）
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'authorization') {
        headers[key] = value;
      }
    });

    const service = createDualLayerService(headers);

    if (action === 'record_choice') {
      // 记录用户选择
      return await handleRecordChoice(service, body, decoded.userId);
    } else {
      // 执行任务
      return await handleExecute(service, body, decoded.userId);
    }

  } catch (error) {
    console.error('[对比模式API] 错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

/**
 * 执行任务
 */
async function handleExecute(
  service: ReturnType<typeof createDualLayerService>,
  body: {
    taskType: string;
    userInput: string;
    style?: string;
    productInfo?: string;
  },
  userId: string
) {
  const { taskType, userInput, style, productInfo } = body;

  if (!taskType || !userInput) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  // 任务类型映射
  const taskTypeMap: Record<string, TaskType> = {
    script_generation: { type: 'script_generation', name: '脚本创作', description: '创作视频分镜脚本' },
    video_analysis: { type: 'video_analysis', name: '视频分析', description: '分析视频内容' },
    prompt_optimization: { type: 'prompt_optimization', name: 'Prompt优化', description: '优化视频生成提示词' },
    creative_suggestion: { type: 'creative_suggestion', name: '创意建议', description: '提供创意建议' },
  };

  const task = taskTypeMap[taskType];
  if (!task) {
    return NextResponse.json({ error: '不支持的任务类型' }, { status: 400 });
  }

  console.log(`[对比模式API] 执行任务: ${taskType}, 用户: ${userId}`);

  // 执行任务
  const result = await service.executeTask(userId, task, userInput, { style, productInfo });

  // 根据模式返回不同结果
  if (result.mode === 'compare') {
    // 对比模式：返回两个版本
    const compareResult = result.result as {
      masterOutput: unknown;
      masterContext: unknown;
      agentOutput: unknown;
      agentContext: unknown;
    };
    return NextResponse.json({
      mode: 'compare',
      profile: result.profile,
      master: {
        output: compareResult.masterOutput,
        context: compareResult.masterContext,
      },
      agent: {
        output: compareResult.agentOutput,
        context: compareResult.agentContext,
      },
      message: '请选择更好的版本，帮助智能体学习成长',
    });
  } else if (result.mode === 'learning') {
    // 学习模式：只返回大模型输出
    return NextResponse.json({
      mode: 'learning',
      profile: result.profile,
      master: {
        output: result.result,
        context: '标准输出（学习中）',
      },
      message: '智能体正在学习阶段，观察大师的输出',
    });
  } else {
    // 独立模式：只返回智能体输出
    return NextResponse.json({
      mode: 'independent',
      profile: result.profile,
      agent: {
        output: result.result,
        context: '智能体独立输出',
      },
      message: '智能体已成长，可以独立完成任务',
    });
  }
}

/**
 * 记录用户选择
 */
async function handleRecordChoice(
  service: ReturnType<typeof createDualLayerService>,
  body: {
    recordId: string;
    choice: 'master' | 'agent' | 'both' | 'neither';
    taskType: string;
    masterOutput?: string;
    agentOutput?: string;
  },
  userId: string
) {
  const { recordId, choice, taskType, masterOutput, agentOutput } = body;

  if (!choice || !taskType) {
    return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
  }

  console.log(`[对比模式API] 记录选择: ${choice}, 任务: ${taskType}`);

  const result = await service.recordUserChoice(
    userId,
    recordId || `choice_${Date.now()}`,
    choice,
    taskType,
    masterOutput || '',
    agentOutput || ''
  );

  return NextResponse.json({
    success: true,
    newProfile: result.newProfile,
    message: choice === 'agent' 
      ? '智能体进步了！继续加油！' 
      : choice === 'master' 
        ? '智能体会继续学习大师的输出' 
        : '感谢反馈，智能体会继续努力',
  });
}

/**
 * 获取能力档案
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (key.toLowerCase().startsWith('x-') || key.toLowerCase() === 'authorization') {
        headers[key] = value;
      }
    });

    const service = createDualLayerService(headers);
    const profile = await service.getAbilityProfile(decoded.userId);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[对比模式API] 获取档案错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}
