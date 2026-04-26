import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { SeedanceClient, Content, VideoRatio, SeedanceModel } from '@/lib/seedance-client';
import { VideoStorageService } from '@/lib/tos-storage';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 初始化 Seedance 客户端
const seedanceClient = new SeedanceClient();

/**
 * 视频生成 API (Seedance 2.0)
 * POST /api/video/generate
 * 
 * 请求体：
 * {
 *   prompt: string;              // 视频提示词
 *   taskType?: 'generate' | 'edit' | 'extend';  // 任务类型
 *   model?: SeedanceModel;       // 模型选择
 *   
 *   // 首尾帧
 *   firstFrame?: string;         // 首帧图片 URL
 *   lastFrame?: string;          // 尾帧图片 URL
 *   
 *   // 多模态参考
 *   referenceImages?: string[];  // 参考图片 URL 列表 (最多9张)
 *   realAssetId?: string;         // 真人演员素材 ID（将转为 asset:// 引用）
 *   referenceVideos?: string[];  // 参考视频 URL 列表 (最多3个)
 *   referenceAudios?: string[];  // 参考音频 URL 列表 (最多3个)
 *   
 *   // 视频参数
 *   ratio?: VideoRatio;          // 比例
 *   duration?: number;           // 时长（4-15秒）
 *   generateAudio?: boolean;     // 是否生成音频
 *   watermark?: boolean;         // 是否添加水印
 *   webSearch?: boolean;         // 是否启用联网搜索
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // 验证 token 并处理过期情况
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
    } catch (jwtError) {
      if (jwtError instanceof TokenExpiredError) {
        return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
      }
      if (jwtError instanceof JsonWebTokenError) {
        return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
      }
      throw jwtError;
    }
    
    const body = await request.json();
    const {
      prompt,
      taskType = 'generate',
      model = 'doubao-seedance-2-0-260128',
      firstFrame,
      lastFrame,
      referenceImages = [],
      realAssetId,
      referenceVideos = [],
      referenceAudios = [],
      ratio = '16:9',
      duration = 5,
      generateAudio = true,
      watermark = false,
      webSearch = false,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 });
    }

    // 验证参数
    if (duration < 4 || duration > 15) {
      return NextResponse.json({ error: '视频时长必须在4-15秒之间' }, { status: 400 });
    }

    if (referenceImages.length > 9) {
      return NextResponse.json({ error: '参考图片最多9张' }, { status: 400 });
    }

    const normalizedReferenceImages = [...referenceImages];
    if (realAssetId) {
      normalizedReferenceImages.push(`asset://${realAssetId}`);
    }

    if (referenceVideos.length > 3) {
      return NextResponse.json({ error: '参考视频最多3个' }, { status: 400 });
    }

    if (referenceAudios.length > 3) {
      return NextResponse.json({ error: '参考音频最多3个' }, { status: 400 });
    }

    // 创建视频任务记录
    const supabase = getSupabaseClient();
    const { data: videoTask, error: insertError } = await supabase
      .from('videos')
      .insert({
        user_id: decoded.userId,
        prompt,
        task_type: taskType,
        model,
        reference_images: normalizedReferenceImages.length > 0 ? normalizedReferenceImages : null,
        reference_videos: referenceVideos.length > 0 ? referenceVideos : null,
        reference_audios: referenceAudios.length > 0 ? referenceAudios : null,
        first_frame: firstFrame || null,
        last_frame: lastFrame || null,
        ratio,
        duration,
        generate_audio: generateAudio,
        watermark,
        web_search: webSearch,
        status: 'processing',
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`创建任务失败: ${insertError.message}`);
    }

    // 构建 Seedance 2.0 内容数组
    const content: Content[] = [];

    // 1. 首帧图片
    if (firstFrame) {
      content.push({
        type: 'image_url',
        image_url: { url: firstFrame },
        role: 'first_frame',
      });
    }

    // 2. 尾帧图片
    if (lastFrame) {
      content.push({
        type: 'image_url',
        image_url: { url: lastFrame },
        role: 'last_frame',
      });
    }

    // 3. 参考图片
    for (const url of normalizedReferenceImages) {
      if (url) {
        content.push({
          type: 'image_url',
          image_url: { url },
          role: 'reference_image',
        });
      }
    }

    // 4. 参考视频
    for (const url of referenceVideos) {
      if (url) {
        content.push({
          type: 'video_url',
          video_url: { url },
          role: 'reference_video',
        });
      }
    }

    // 5. 参考音频
    for (const url of referenceAudios) {
      if (url) {
        content.push({
          type: 'audio_url',
          audio_url: { url },
          role: 'reference_audio',
        });
      }
    }

    // 6. 文本提示词（放在最后）
    content.push({
      type: 'text',
      text: prompt,
    });

    // 调用 Seedance 2.0 API
    try {
      const taskResponse = await seedanceClient.createTask({
        model: model as SeedanceModel,
        content,
        generate_audio: generateAudio,
        ratio: ratio as VideoRatio,
        duration,
        watermark,
        tools: webSearch ? [{ type: 'web_search' }] : undefined,
      });

      // 更新任务ID
      await supabase
        .from('videos')
        .update({ task_id: taskResponse.id })
        .eq('id', videoTask!.id);

      // 返回任务信息，让前端轮询
      return NextResponse.json({
        success: true,
        taskId: videoTask!.id,
        seedanceTaskId: taskResponse.id,
        status: 'processing',
        message: '任务已提交，请轮询查询状态',
      });

    } catch (apiError) {
      // 更新任务状态为失败
      await supabase
        .from('videos')
        .update({
          status: 'failed',
          error_message: apiError instanceof Error ? apiError.message : 'API调用失败',
        })
        .eq('id', videoTask!.id);

      throw apiError;
    }

  } catch (error) {
    console.error('视频生成错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '视频生成失败' },
      { status: 500 }
    );
  }
}

/**
 * 查询视频任务
 * GET /api/video/generate?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    const supabase = getSupabaseClient();

    if (taskId) {
      // 查询单个任务
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', taskId)
        .eq('user_id', decoded.userId)
        .single();

      if (error) {
        return NextResponse.json({ error: '任务不存在' }, { status: 404 });
      }

      const video = data as any;

      // 如果任务还在处理中，尝试从 Seedance 获取最新状态
      if (video.status === 'processing' && video.task_id) {
        try {
          const seedanceTask = await seedanceClient.getTask(video.task_id);
          
          if (seedanceTask.status === 'succeeded' && seedanceTask.content?.video_url) {
            console.log(`[Video] 任务 ${video.id} 完成，开始存储到 TOS...`);
            
            // 获取 Token 用量（注意：API 可能只返回 total_tokens）
            const totalTokens = seedanceTask.usage?.total_tokens || 0;
            
            // 根据是否有视频输入决定价格
            // task_type 为 edit/extend 时有视频输入（28元/百万tokens），否则为纯生成（46元/百万tokens）
            const hasVideoInput = video.task_type === 'edit' || video.task_type === 'extend';
            const unitPrice = hasVideoInput ? 28 : 46; // 元/百万tokens
            
            // 计算真实成本
            const cost = totalTokens > 0 
              ? Math.round((totalTokens / 1_000_000) * unitPrice * 100) / 100
              : (video.duration || 5) * 0.1; // 如果没有 token 数据，使用估算
            
            console.log(`[Video] Token 用量: ${totalTokens}, 单价: ${unitPrice}元/百万tokens, 成本: ${cost}元`);
            
            // 存储视频到 TOS
            let tosKey: string | null = null;
            let lastFrameTosKey: string | null = null;
            
            try {
              // 上传视频到 TOS
              tosKey = await VideoStorageService.storeVideoFromUrl(
                decoded.userId,
                seedanceTask.content.video_url,
                {
                  taskId: video.task_id,
                  duration: video.duration,
                }
              );
              console.log(`[Video] 视频已存储到 TOS: ${tosKey}`);
              
              // 如果有尾帧图片，也存储到 TOS
              if (seedanceTask.content.last_frame_url) {
                try {
                  lastFrameTosKey = await VideoStorageService.storeVideoFromUrl(
                    decoded.userId,
                    seedanceTask.content.last_frame_url,
                    { taskId: `${video.task_id}_last_frame` }
                  );
                  console.log(`[Video] 尾帧已存储到 TOS: ${lastFrameTosKey}`);
                } catch (frameError) {
                  console.error('[Video] 尾帧存储失败:', frameError);
                  // 尾帧存储失败不影响主流程
                }
              }
            } catch (tosError) {
              console.error('[Video] TOS 存储失败，使用临时 URL:', tosError);
              // 如果 TOS 存储失败，仍然使用临时 URL
            }
            
            // 更新数据库
            await supabase
              .from('videos')
              .update({
                status: 'completed',
                result_url: seedanceTask.content.video_url,
                tos_key: tosKey,
                last_frame_url: seedanceTask.content.last_frame_url,
                last_frame_tos_key: lastFrameTosKey,
                cost,
                total_tokens: totalTokens,
              })
              .eq('id', video.id);

            // 记录账单
            await supabase.from('billing').insert({
              user_id: decoded.userId,
              video_id: video.id,
              amount: cost,
              token_amount: totalTokens,
              task_type: 'video_generation',
              description: `视频生成 - ${video.duration}秒 - ${video.ratio} - ${totalTokens.toLocaleString()} tokens`,
            });

            video.status = 'completed';
            video.result_url = seedanceTask.content.video_url;
            video.tos_key = tosKey;
            video.cost = cost;
          } else if (seedanceTask.status === 'failed') {
            await supabase
              .from('videos')
              .update({
                status: 'failed',
                error_message: seedanceTask.error?.message || '视频生成失败',
              })
              .eq('id', video.id);

            video.status = 'failed';
            video.error_message = seedanceTask.error?.message;
          }
        } catch (pollError) {
          console.error('轮询 Seedance 任务失败:', pollError);
        }
      }

      return NextResponse.json({ video: data });
    } else {
      // 查询用户所有任务
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', decoded.userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(`查询失败: ${error.message}`);
      }

      return NextResponse.json({ videos: data });
    }
  } catch (error) {
    console.error('查询视频任务错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
