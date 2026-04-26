import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 文件上传 API
 * POST /api/upload
 * 
 * 支持：
 * 1. 直接文件上传（multipart/form-data）
 * 2. 抖音视频链接解析
 * 
 * 请求体（文件上传）：
 * FormData {
 *   file: File;
 *   type: 'image' | 'video' | 'audio';
 * }
 * 
 * 请求体（抖音链接）：
 * {
 *   douyinUrl: string;
 *   type: 'video';
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };

    const contentType = request.headers.get('content-type') || '';

    // 判断是文件上传还是 JSON 请求
    if (contentType.includes('multipart/form-data')) {
      // 文件上传
      return await handleFileUpload(request, decoded.userId);
    } else {
      // JSON 请求（抖音链接等）
      const body = await request.json();
      
      if (body.douyinUrl) {
        return await handleDouyinUrl(body.douyinUrl, decoded.userId);
      }
      
      return NextResponse.json({ error: '不支持的请求类型' }, { status: 400 });
    }
  } catch (error) {
    console.error('上传错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}

/**
 * 处理文件上传
 */
async function handleFileUpload(request: NextRequest, userId: string) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const fileType = formData.get('type') as string || 'image';

  if (!file) {
    return NextResponse.json({ error: '未找到文件' }, { status: 400 });
  }

  // 验证文件类型
  const allowedTypes = ['image', 'video', 'audio'];
  if (!allowedTypes.includes(fileType)) {
    return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
  }

  // 验证文件大小
  const maxSize = fileType === 'video' ? 500 * 1024 * 1024 : 50 * 1024 * 1024; // 视频 500MB，其他 50MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: `文件大小超过限制（${fileType === 'video' ? '500MB' : '50MB'}）` }, { status: 400 });
  }

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 生成文件名
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  const ext = file.name.split('.').pop() || 'bin';
  const fileName = `uploads/${fileType}/${timestamp}_${randomStr}.${ext}`;

  // 上传到对象存储
  const fileKey = await storage.uploadFile({
    fileContent: buffer,
    fileName,
    contentType: file.type,
  });

  // 生成访问 URL（有效期 30 天）
  const fileUrl = await storage.generatePresignedUrl({
    key: fileKey,
    expireTime: 30 * 24 * 60 * 60, // 30 天
  });

  // 记录到数据库
  const client = getSupabaseClient();
  const { data: uploadedFile, error: insertError } = await client
    .from('uploaded_files')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      file_url: fileUrl,
      source: 'upload',
    })
    .select()
    .single();

  if (insertError) {
    console.error('记录文件失败:', insertError);
  }

  return NextResponse.json({
    success: true,
    file: {
      id: uploadedFile?.id,
      name: file.name,
      type: fileType,
      size: file.size,
      url: fileUrl,
      key: fileKey,
    },
  });
}

/**
 * 处理抖音链接解析
 */
async function handleDouyinUrl(url: string, userId: string) {
  // 验证抖音链接格式
  if (!url.includes('douyin.com') && !url.includes('iesdouyin.com')) {
    return NextResponse.json({ error: '无效的抖音链接' }, { status: 400 });
  }

  try {
    // 获取抖音视频信息
    // 注意：这里需要实际调用抖音 API 或使用第三方服务
    // 由于抖音 API 限制，这里提供一个基础实现
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    
    // 简单的视频 URL 提取（实际项目中需要更完善的解析逻辑）
    const videoUrlMatch = html.match(/playAddr:\s*\[(.*?)\]/);
    let videoUrl = null;
    
    if (videoUrlMatch) {
      const urlMatch = videoUrlMatch[1].match(/src:\s*["'](.*?)["']/);
      if (urlMatch) {
        videoUrl = urlMatch[1].replace(/\\u002F/g, '/');
      }
    }

    if (!videoUrl) {
      return NextResponse.json({ error: '无法解析抖音视频，请稍后重试' }, { status: 400 });
    }

    // 下载视频并上传到对象存储
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

    const timestamp = Date.now();
    const fileName = `uploads/douyin/${timestamp}.mp4`;

    const fileKey = await storage.uploadFile({
      fileContent: videoBuffer,
      fileName,
      contentType: 'video/mp4',
    });

    const fileUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 30 * 24 * 60 * 60,
    });

    // 记录到数据库
    const client = getSupabaseClient();
    const { data: uploadedFile } = await client
      .from('uploaded_files')
      .insert({
        user_id: userId,
        file_name: `douyin_${timestamp}.mp4`,
        file_type: 'video',
        file_size: videoBuffer.length,
        file_url: fileUrl,
        source: 'douyin',
        source_url: url,
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      file: {
        id: uploadedFile?.id,
        name: `抖音视频_${timestamp}`,
        type: 'video',
        size: videoBuffer.length,
        url: fileUrl,
        key: fileKey,
        originalUrl: url,
      },
    });
  } catch (error) {
    console.error('抖音视频解析失败:', error);
    return NextResponse.json({ error: '抖音视频解析失败，请确认链接有效' }, { status: 500 });
  }
}

/**
 * 查询上传文件列表
 * GET /api/upload?type=video&limit=20
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
    const fileType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');

    const client = getSupabaseClient();

    let query = client
      .from('uploaded_files')
      .select('*')
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    return NextResponse.json({ files: data });
  } catch (error) {
    console.error('查询文件错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
