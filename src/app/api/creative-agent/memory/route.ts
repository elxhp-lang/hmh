import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fileParserService } from '@/lib/file-parser-service';
import { S3Storage } from 'coze-coding-dev-sdk';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface MemoryRow {
  id: string;
  title?: string;
  summary?: string;
  keywords?: string[];
  created_at?: string;
}

interface MemoryTypeStatRow {
  memory_type?: string;
}
function isMemoryRow(value: unknown): value is MemoryRow {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).id === 'string';
}

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

// 配置API路由
export const runtime = 'nodejs';
export const maxDuration = 120; // 2分钟超时
export const dynamic = 'force-dynamic';

/**
 * 长期记忆管理 API
 * 
 * POST /api/creative-agent/memory - 上传文件并学习
 * GET /api/creative-agent/memory - 获取记忆列表
 * DELETE /api/creative-agent/memory?id=xxx - 删除记忆
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

    const contentType = request.headers.get('content-type') || '';

    // 判断请求类型
    if (contentType.includes('multipart/form-data')) {
      // 文件上传学习
      return await handleFileLearning(request, decoded.userId);
    } else {
      // JSON 请求
      const body = await request.json();
      
      if (body.action === 'learn_text') {
        // 直接学习文本内容
        return await handleTextLearning(body, decoded.userId);
      } else if (body.action === 'search') {
        // 搜索记忆
        return await searchMemories(body, decoded.userId);
      } else if (body.action === 'get_relevant') {
        // 获取相关记忆（用于对话上下文）
        return await getRelevantMemories(body, decoded.userId);
      }
      
      return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }
  } catch (error) {
    console.error('记忆管理错误:', error);
    
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
 * 处理文件上传学习
 */
async function handleFileLearning(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const memoryType = formData.get('memoryType') as string || 'file_document';

  if (!file) {
    return NextResponse.json({ error: '未找到文件' }, { status: 400 });
  }

  // 检查文件类型是否支持
  if (!fileParserService.isSupportedFileType(file.name)) {
    return NextResponse.json({ 
      error: `不支持的文件类型。支持的类型：PDF、Word、Excel、TXT、Markdown、代码文件等` 
    }, { status: 400 });
  }

  // 验证文件大小（最大 20MB）
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: '文件大小超过限制（最大 20MB）' }, { status: 400 });
  }

  // 上传文件到对象存储
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `creative-memory/${userId}/${timestamp}_${randomStr}.${ext}`;

  const fileKey = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType: file.type || 'application/octet-stream',
  });

  const fileUrl = await storage.generatePresignedUrl({
    key: fileKey,
    expireTime: 30 * 24 * 60 * 60, // 30 天
  });

  // 解析文件内容
  const parsedDoc = await fileParserService.parseFile({
    url: fileUrl,
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // 存储到数据库
  const client = getSupabaseClient();
  const { data: memory, error: insertError } = await client
    .from('creative_memories')
    .insert({
      user_id: userId,
      memory_type: memoryType,
      title: parsedDoc.title,
      summary: parsedDoc.summary,
      content: parsedDoc.content,
      source_type: 'upload',
      source_file_name: file.name,
      keywords: parsedDoc.keywords,
      importance_score: calculateImportanceScore(parsedDoc),
    })
    .select()
    .single();

  if (insertError) {
    console.error('存储记忆失败:', insertError);
    return NextResponse.json({ error: '存储记忆失败' }, { status: 500 });
  }

  if (!memory) {
    return NextResponse.json({ error: '存储记忆失败：未返回数据' }, { status: 500 });
  }
  if (!isMemoryRow(memory)) {
    return NextResponse.json({ error: '存储记忆失败：数据异常' }, { status: 500 });
  }

  const memoryRow = memory;

  return NextResponse.json({
    success: true,
    memory: {
      id: memoryRow.id,
      title: memoryRow.title,
      summary: memoryRow.summary,
      keywords: memoryRow.keywords,
      fileType: parsedDoc.metadata.fileType,
      wordCount: parsedDoc.metadata.wordCount,
      createdAt: memoryRow.created_at,
    },
    message: `已学习文件「${file.name}」，提取了 ${parsedDoc.metadata.wordCount} 字内容`,
  });
}

/**
 * 处理文本学习
 */
async function handleTextLearning(body: {
  title?: string;
  content: string;
  memoryType?: string;
  keywords?: string[];
}, userId: string) {
  const { title, content, memoryType = 'conversation', keywords } = body;

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: '内容太短' }, { status: 400 });
  }

  // 提取关键词
  const extractedKeywords = keywords || await extractKeywordsSimple(content);

  // 生成摘要
  const summary = content.slice(0, 500) + (content.length > 500 ? '...' : '');

  // 存储到数据库
  const client = getSupabaseClient();
  const { data: memory, error } = await client
    .from('creative_memories')
    .insert({
      user_id: userId,
      memory_type: memoryType,
      title: title || '对话总结',
      summary,
      content,
      source_type: 'conversation',
      keywords: extractedKeywords,
      importance_score: 0.6,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '存储失败' }, { status: 500 });
  }

  if (!memory) {
    return NextResponse.json({ error: '存储失败：未返回数据' }, { status: 500 });
  }
  if (!isMemoryRow(memory)) {
    return NextResponse.json({ error: '存储失败：数据异常' }, { status: 500 });
  }

  const memoryRow = memory;

  return NextResponse.json({
    success: true,
    memory: {
      id: memoryRow.id,
      title: memoryRow.title,
      summary: memoryRow.summary,
      keywords: memoryRow.keywords,
    },
  });
}

/**
 * 搜索记忆
 */
async function searchMemories(body: {
  query: string;
  memoryType?: string;
  limit?: number;
}, userId: string) {
  const { query, memoryType, limit = 10 } = body;

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: '搜索词太短' }, { status: 400 });
  }

  const client = getSupabaseClient();
  
  // 构建搜索查询
  let queryBuilder = client
    .from('creative_memories')
    .select('id, title, summary, keywords, memory_type, importance_score, created_at, access_count')
    .eq('user_id', userId)
    .or(`title.ilike.%${query}%,summary.ilike.%${query}%,content.ilike.%${query}%`)
    .order('importance_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (memoryType) {
    queryBuilder = queryBuilder.eq('memory_type', memoryType);
  }

  const { data: memories, error } = await queryBuilder;

  if (error) {
    console.error('搜索记忆失败:', error);
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }

  return NextResponse.json({
    memories,
    total: memories?.length || 0,
  });
}

/**
 * 获取相关记忆（用于对话上下文）
 */
async function getRelevantMemories(body: {
  context: string;
  limit?: number;
}, userId: string) {
  const { context, limit = 5 } = body;

  if (!context) {
    return NextResponse.json({ memories: [] });
  }

  // 从上下文中提取关键词
  const keywords = await extractKeywordsSimple(context);
  
  const client = getSupabaseClient();
  
  // 使用关键词搜索
  const { data: memories, error } = await client
    .from('creative_memories')
    .select('id, title, summary, keywords, memory_type, importance_score')
    .eq('user_id', userId)
    .or(keywords.map(kw => `keywords.cs.{${kw}}`).join(','))
    .order('importance_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('获取相关记忆失败:', error);
    return NextResponse.json({ memories: [] });
  }

  return NextResponse.json({
    memories: memories || [],
  });
}

/**
 * 获取记忆列表
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
    const memoryType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const client = getSupabaseClient();

    let query = client
      .from('creative_memories')
      .select('id, title, summary, keywords, memory_type, source_type, source_file_name, importance_score, access_count, created_at')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (memoryType) {
      query = query.eq('memory_type', memoryType);
    }

    const { data: memories, error } = await query;

    if (error) {
      throw new Error(`查询失败: ${(error as Error).message}`);
    }

    // 按类型统计
    const { data: stats } = await client
      .from('creative_memories')
      .select('memory_type')
      .eq('user_id', decoded.userId);

    const typeStats: Record<string, number> = {};
    ((stats || []) as MemoryTypeStatRow[])?.forEach((m) => {
      const key = typeof m.memory_type === 'string' ? m.memory_type : 'unknown';
      typeStats[key] = (typeStats[key] || 0) + 1;
    });

    return NextResponse.json({
      memories,
      total: memories?.length || 0,
      stats: typeStats,
    });
  } catch (error) {
    console.error('获取记忆列表错误:', error);
    
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
 * 删除记忆
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
    const memoryId = searchParams.get('id');

    if (!memoryId) {
      return NextResponse.json({ error: '缺少记忆ID' }, { status: 400 });
    }

    const client = getSupabaseClient();
    
    // 验证记忆属于当前用户
    const { data: memory } = await client
      .from('creative_memories')
      .select('user_id')
      .eq('id', memoryId)
      .single();

    if (!memory || memory.user_id !== decoded.userId) {
      return NextResponse.json({ error: '记忆不存在或无权删除' }, { status: 404 });
    }

    // 删除记忆
    const { error } = await client
      .from('creative_memories')
      .delete()
      .eq('id', memoryId);

    if (error) {
      throw new Error(`删除失败: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除记忆错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}

/**
 * 计算重要性分数
 */
function calculateImportanceScore(doc: { content: string; keywords: string[] }): number {
  let score = 0.5;
  
  // 内容长度加分
  if (doc.content.length > 2000) score += 0.1;
  if (doc.content.length > 5000) score += 0.1;
  
  // 关键词数量加分
  if (doc.keywords.length > 3) score += 0.1;
  if (doc.keywords.length > 5) score += 0.1;
  
  // 限制最大值
  return Math.min(score, 0.9);
}

/**
 * 简单关键词提取
 */
async function extractKeywordsSimple(content: string): Promise<string[]> {
  const stopWords = new Set([
    '的', '了', '和', '是', '就', '都', '而', '及', '与', '着',
    '或', '一个', '没有', '这个', '那个', '之', '以', '为', '于',
    'it', 'the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with',
  ]);
  
  const words = content
    .replace(/[，。！？；：""''【】（）《》、\n\r\t]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !stopWords.has(word.toLowerCase()));
  
  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }
  
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}
