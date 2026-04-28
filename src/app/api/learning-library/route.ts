import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LearningLibraryStorage, VideoStorageService } from '@/lib/tos-storage';
import { videoLearningService } from '@/lib/video-learning-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import jwt from 'jsonwebtoken';
import { VideoLinkParser, PLATFORM_CONFIG } from '@/lib/video-link-parser';
import Busboy from 'busboy';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface LearningRow {
  id: string;
  user_id?: string;
  video_key?: string;
  analysis_status?: string;
  video_url?: string;
  video_name?: string;
  video_style?: string;
  summary?: string;
  key_learnings?: string[];
}

interface LearningStatusStatRow {
  analysis_status?: string;
}

function isLearningRow(value: unknown): value is LearningRow {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).id === 'string';
}

// 配置API路由以支持大文件上传和长时间处理
export const runtime = 'nodejs';
export const maxDuration = 300; // 5分钟超时
export const dynamic = 'force-dynamic';

/**
 * 学习库 API
 * 
 * POST /api/learning-library - 上传视频到学习库（文件或视频链接）
 * GET /api/learning-library - 获取学习库列表
 * POST /api/learning-library?action=analyze - 分析指定视频
 * DELETE /api/learning-library?id=xxx - 删除学习记录
 * 
 * 支持的上传方式：
 * 1. multipart/form-data: 上传视频文件（使用流式处理支持大文件）
 * 2. JSON: { videoUrl: "..." } 解析并下载视频（支持抖音、快手、B站、小红书等）
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
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const contentType = request.headers.get('content-type') || '';

    // 判断请求类型
    if (contentType.includes('multipart/form-data')) {
      // 文件上传 - 使用流式处理
      return await handleVideoUploadStreaming(request, decoded.userId, customHeaders);
    } else {
      // JSON 请求
      const body = await request.json();
      
      // 视频链接上传（支持多平台）
      if (body.videoUrl) {
        return await handleVideoLinkUpload(body.videoUrl, decoded.userId, customHeaders);
      }
      
      // 兼容旧版抖音链接参数
      if (body.douyinUrl) {
        return await handleVideoLinkUpload(body.douyinUrl, decoded.userId, customHeaders);
      }
      
      if (body.action === 'analyze') {
        // 分析指定视频
        return await handleAnalyzeVideo(body.id, decoded.userId, customHeaders);
      } else if (body.action === 'get_summary') {
        // 获取学习库摘要
        return await handleGetSummary(decoded.userId);
      } else if (body.action === 'get_references') {
        // 获取相关参考
        return await handleGetReferences(body, decoded.userId);
      }
      
      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('学习库操作错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '操作失败' },
      { status: 500 }
    );
  }
}

/**
 * 流式处理视频文件上传（支持大文件）
 */
async function handleVideoUploadStreaming(
  request: NextRequest, 
  userId: string,
  headers: Record<string, string>
): Promise<NextResponse> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let fileName = 'video.mp4';
    let fileType = 'video/mp4';
    let fileSize = 0;

    console.log('[学习库] 开始流式上传处理');

    // 使用busboy解析multipart数据
    const busboy = Busboy({
      headers: {
        'content-type': request.headers.get('content-type') || '',
      },
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB限制
      },
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      fileName = filename || 'video.mp4';
      fileType = mimeType || 'video/mp4';

      console.log(`[学习库] 接收文件: ${fileName}, 类型: ${fileType}`);

      file.on('data', (chunk) => {
        chunks.push(chunk);
        fileSize += chunk.length;
      });

      file.on('limit', () => {
        console.error('[学习库] 文件超过大小限制');
        busboy.destroy();
        resolve(NextResponse.json({ error: '视频大小超过限制（最大 500MB）' }, { status: 400 }));
      });
    });

    busboy.on('finish', async () => {
      try {
        console.log(`[学习库] 文件接收完成: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // 验证文件类型
        if (!fileType.startsWith('video/')) {
          resolve(NextResponse.json({ error: '只支持视频文件' }, { status: 400 }));
          return;
        }

        // 合并所有chunk
        const buffer = Buffer.concat(chunks);

        // 上传到 TOS 学习库目录
        const fileKey = await LearningLibraryStorage.uploadLearningVideo(
          userId,
          buffer,
          fileName,
          fileType
        );

        // 优先使用永久公开 URL，失败时降级签名 URL
        const fileUrl = await VideoStorageService.setPublicRead(fileKey)
          .then(async (success: boolean) => {
            if (success) return VideoStorageService.getVideoPublicUrl(fileKey);
            return await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60);
          })
          .catch(async () => await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60));

        // 创建学习记录
        const client = getSupabaseClient();
        const { data: learning, error: insertError } = await client
          .from('learning_library')
          .insert({
            user_id: userId,
            video_name: fileName,
            video_key: fileKey,
            video_url: fileUrl,
            video_size: fileSize,
            analysis_status: 'pending',
          })
          .select()
          .single();

        if (insertError) {
          console.error('创建学习记录失败:', insertError);
          resolve(NextResponse.json({ error: '创建学习记录失败' }, { status: 500 }));
          return;
        }

        if (!learning) {
          resolve(NextResponse.json({ error: '创建学习记录失败' }, { status: 500 }));
          return;
        }

        if (!isLearningRow(learning)) {
          resolve(NextResponse.json({ error: '学习记录数据异常' }, { status: 500 }));
          return;
        }
        const learningRow = learning;

        // 异步启动分析
        setTimeout(() => {
          startVideoAnalysis(learningRow.id, fileUrl, fileName, headers);
        }, 1000);

        console.log(`[学习库] 上传成功，学习记录ID: ${learningRow.id}`);

        resolve(NextResponse.json({
          success: true,
          learning: {
            id: learningRow.id,
            name: fileName,
            size: fileSize,
            status: 'pending',
            message: '视频已上传，正在分析中...',
          },
        }));
      } catch (error) {
        console.error('[学习库] 上传处理错误:', error);
        resolve(NextResponse.json(
          { error: error instanceof Error ? error.message : '上传失败' },
          { status: 500 }
        ));
      }
    });

    busboy.on('error', (error) => {
      console.error('[学习库] Busboy解析错误:', error);
      resolve(NextResponse.json({ error: '文件解析失败' }, { status: 400 }));
    });

    // 将请求体传输给busboy
    const reader = request.body?.getReader();
    if (reader) {
      const pump = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          busboy.end();
          return;
        }
        busboy.write(value);
        return pump();
      };
      pump().catch((error) => {
        console.error('[学习库] 流读取错误:', error);
        resolve(NextResponse.json({ error: '读取上传数据失败' }, { status: 500 }));
      });
    } else {
      resolve(NextResponse.json({ error: '无法读取请求体' }, { status: 400 }));
    }
  });
}

/**
 * 处理视频链接上传（支持多平台）
 */
async function handleVideoLinkUpload(
  url: string,
  userId: string,
  headers: Record<string, string>
) {
  console.log(`[学习库] 开始解析视频链接: ${url}`);

  try {
    // 检测平台
    const platform = VideoLinkParser.detectPlatform(url);
    const platformName = PLATFORM_CONFIG[platform]?.name || '未知平台';
    
    console.log(`[学习库] 检测到平台: ${platformName}`);

    // 解析视频信息
    const videoInfo = await VideoLinkParser.parse(url);
    
    console.log(`[学习库] 解析结果:`, {
      platform: videoInfo.platform,
      videoId: videoInfo.videoId,
      title: videoInfo.title,
      author: videoInfo.author,
      hasVideoUrl: !!videoInfo.videoUrl,
    });

    // 如果有视频URL，下载视频
    if (videoInfo.videoUrl) {
      console.log(`[学习库] 开始下载视频...`);
      
      const { buffer, size } = await fetch(videoInfo.videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
          'Referer': url,
        },
      }).then(async res => {
        if (!res.ok) {
          throw new Error(`视频下载失败: ${res.status}`);
        }
        const arrayBuffer = await res.arrayBuffer();
        return {
          buffer: Buffer.from(arrayBuffer),
          size: arrayBuffer.byteLength,
        };
      });

      console.log(`[学习库] 视频下载完成，大小: ${(size / 1024 / 1024).toFixed(2)} MB`);

      // 上传到 TOS 学习库
      const fileName = `${videoInfo.platform}_${videoInfo.videoId}.mp4`;
      const fileKey = await LearningLibraryStorage.uploadLearningVideo(
        userId,
        buffer,
        fileName,
        'video/mp4'
      );

      // 优先使用永久公开 URL，失败时降级签名 URL
      const storedUrl = await VideoStorageService.setPublicRead(fileKey)
        .then(async (success: boolean) => {
          if (success) return VideoStorageService.getVideoPublicUrl(fileKey);
          return await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60);
        })
        .catch(async () => await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60));

      // 创建学习记录
      const client = getSupabaseClient();
      const { data: learning, error: insertError } = await client
        .from('learning_library')
        .insert({
          user_id: userId,
          video_name: videoInfo.title,
          video_key: fileKey,
          video_url: storedUrl,
          video_size: size,
          video_duration: videoInfo.duration,
          analysis_status: 'pending',
          // 存储来源元数据
          scene_analysis: {
            source: videoInfo.platform,
            sourceName: platformName,
            author: videoInfo.author,
            authorId: videoInfo.authorId,
            videoId: videoInfo.videoId,
            originalUrl: url,
            cover: videoInfo.cover,
            likes: videoInfo.likes,
            comments: videoInfo.comments,
            shares: videoInfo.shares,
            tags: videoInfo.tags,
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('创建学习记录失败:', insertError);
        return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
      }

      if (!learning) {
        return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
      }

      if (!isLearningRow(learning)) {
        return NextResponse.json({ error: '学习记录数据异常' }, { status: 500 });
      }
      const learningRow = learning;

      // 异步启动分析
      setTimeout(() => {
        startVideoAnalysis(learningRow.id, storedUrl, videoInfo.title, headers);
      }, 1000);

      return NextResponse.json({
        success: true,
        learning: {
          id: learningRow.id,
          name: videoInfo.title,
          size,
          duration: videoInfo.duration,
          author: videoInfo.author,
          platform: videoInfo.platform,
          platformName,
          status: 'pending',
          message: `${platformName}视频已添加到学习库，正在分析中...`,
        },
      });
    } else {
      // 无法获取视频URL，返回解析结果让用户手动上传
      return NextResponse.json({
        success: false,
        needManual: true,
        message: `已识别为${platformName}视频，但无法自动下载。请手动下载后上传文件。`,
        videoInfo: {
          platform: videoInfo.platform,
          platformName,
          title: videoInfo.title,
          author: videoInfo.author,
          originalUrl: url,
        },
      });
    }

  } catch (error) {
    console.error('[学习库] 视频链接处理失败:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : '视频处理失败',
    }, { status: 500 });
  }
}

/**
 * 处理视频分析
 */
async function handleAnalyzeVideo(
  learningId: string,
  userId: string,
  headers: Record<string, string>
) {
  const client = getSupabaseClient();
  
  // 获取学习记录
  const { data: learning, error } = await client
    .from('learning_library')
    .select('*')
    .eq('id', learningId)
    .eq('user_id', userId)
    .single();

  if (error || !learning) {
    return NextResponse.json({ error: '学习记录不存在' }, { status: 404 });
  }

  if (!isLearningRow(learning)) {
    return NextResponse.json({ error: '学习记录数据异常' }, { status: 500 });
  }
  const learningRow = learning;
  if (learningRow.analysis_status === 'processing') {
    return NextResponse.json({ error: '视频正在分析中' }, { status: 400 });
  }

  if (learningRow.analysis_status === 'completed') {
    return NextResponse.json({ 
      message: '视频已分析完成',
      result: {
        style: learningRow.video_style,
        summary: learningRow.summary,
        keyLearnings: learningRow.key_learnings,
      }
    });
  }

  // 启动分析
  await client
    .from('learning_library')
    .update({ analysis_status: 'processing', analysis_progress: 0 })
    .eq('id', learningId);

  // 异步执行分析
  startVideoAnalysis(learningId, String(learningRow.video_url || ''), String(learningRow.video_name || ''), headers);

  return NextResponse.json({
    success: true,
    message: '开始分析视频',
    learningId,
  });
}

/**
 * 异步执行视频分析
 */
async function startVideoAnalysis(
  learningId: string,
  videoUrl: string,
  videoName: string,
  headers: Record<string, string>
) {
  const client = getSupabaseClient();
  
  try {
    // 更新进度
    await client
      .from('learning_library')
      .update({ analysis_progress: 10 })
      .eq('id', learningId);

    // 执行分析
    const result = await videoLearningService.analyzeVideo(videoUrl, videoName, headers);

    // 更新进度
    await client
      .from('learning_library')
      .update({ analysis_progress: 80 })
      .eq('id', learningId);

    // 保存结果
    await videoLearningService.saveAnalysisResult(learningId, result);

    // 同时保存到长期记忆
    const { data: learningData } = await client
      .from('learning_library')
      .select('user_id')
      .eq('id', learningId)
      .single();

    if (learningData?.user_id) {
      await client
        .from('creative_memories')
        .insert({
          user_id: learningData.user_id,
          memory_type: 'video_reference',
          title: `视频学习: ${videoName}`,
          summary: result.summary,
          content: JSON.stringify({
            style: result.videoStyle,
            theme: result.videoTheme,
            sceneAnalysis: result.sceneAnalysis,
            cameraAnalysis: result.cameraAnalysis,
            keyLearnings: result.keyLearnings,
          }),
          source_type: 'learning_library',
          keywords: result.styleKeywords,
          importance_score: 0.7,
        });
    }

  } catch (error) {
    console.error('视频分析失败:', error);
    
    await client
      .from('learning_library')
      .update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : '分析失败',
      })
      .eq('id', learningId);
  }
}

/**
 * 获取学习库摘要
 */
async function handleGetSummary(userId: string) {
  const summary = await videoLearningService.getLearningSummary(userId);
  
  return NextResponse.json({ summary });
}

/**
 * 获取相关参考
 */
async function handleGetReferences(body: { query: string }, userId: string) {
  const { query } = body;
  
  if (!query) {
    return NextResponse.json({ references: [] });
  }

  const references = await videoLearningService.getRelevantReferences(userId, query);
  
  return NextResponse.json({ references });
}

/**
 * 获取学习库列表
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
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');

    const client = getSupabaseClient();

    let query = client
      .from('learning_library')
      .select('*', { count: 'exact' })
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('analysis_status', status);
    }

    const { data: learnings, error } = await query;

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 统计分析状态
    const { data: stats } = await client
      .from('learning_library')
      .select('analysis_status')
      .eq('user_id', decoded.userId);

    const statusStats: Record<string, number> = {};
    ((stats || []) as LearningStatusStatRow[]).forEach((l) => {
      const key = typeof l.analysis_status === 'string' ? l.analysis_status : 'unknown';
      statusStats[key] = (statusStats[key] || 0) + 1;
    });

    return NextResponse.json({
      learnings,
      total: learnings?.length || 0,
      stats: statusStats,
    });
  } catch (error) {
    console.error('获取学习库列表错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除学习记录
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const { searchParams } = new URL(request.url);
    const learningId = searchParams.get('id');

    if (!learningId) {
      return NextResponse.json({ error: '缺少学习记录ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 获取学习记录
    const { data: learning } = await client
      .from('learning_library')
      .select('user_id, video_key')
      .eq('id', learningId)
      .single();

    const learningRow = (learning || null) as LearningRow | null;
    if (!learningRow || learningRow.user_id !== decoded.userId) {
      return NextResponse.json({ error: '记录不存在或无权删除' }, { status: 404 });
    }

    // 删除 TOS 文件
    const videoKey = learningRow.video_key;
    if (videoKey) {
      try {
        await LearningLibraryStorage.deleteLearningVideo(videoKey as string);
      } catch {
        // 忽略删除错误
      }
    }

    // 删除数据库记录
    const { error } = await client
      .from('learning_library')
      .delete()
      .eq('id', learningId);

    if (error) {
      throw new Error(`删除失败: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除学习记录错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
