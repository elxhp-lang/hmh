/**
 * 创意小海专用上传 API
 * 
 * 功能：为创意小海提供文件上传能力
 * 
 * 特点：
 * 1. 返回预签名上传 URL
 * 2. 前端直接上传到 TOS（绕过 CORS + Serverless 限制）
 * 3. 上传后设置公开读取权限
 * 
 * 流程：
 * 1. 前端请求预签名上传 URL
 * 2. 前端直接 PUT 到 TOS
 * 3. 前端通知后端上传完成
 * 4. 后端设置公开读取权限
 * 
 * POST /api/creative-agent/upload
 *   - 返回预签名上传 URL
 * 
 * GET /api/creative-agent/upload?key=xxx
 *   - 设置公开读取权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME, ENDPOINT } from '@/lib/tos-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 允许的文件类型
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_TYPES = [...ALLOWED_VIDEO_TYPES, ...ALLOWED_IMAGE_TYPES];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileType = 'video', contentType } = body;

    if (!fileName) {
      return NextResponse.json({ error: '文件名不能为空' }, { status: 400 });
    }

    // 验证文件类型
    const mimeType = contentType || (fileType === 'video' ? 'video/mp4' : 'image/jpeg');
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const extension = fileName.split('.').pop() || (fileType === 'video' ? 'mp4' : 'jpg');
    const key = `users/creative-agent/${fileType}s/${fileType}_${timestamp}.${extension}`;

    console.log(`[创意小海上传] 生成预签名 URL: key=${key}, contentType=${mimeType}`);

    // 生成预签名上传 URL（PUT 方法，有效期 1 小时）
    const client = getTosClient();
    const uploadUrl = client.getPreSignedUrl({
      bucket: BUCKET_NAME,
      key,
      method: 'PUT',
      expires: 3600,
    });

    console.log(`[创意小海上传] 预签名 URL 生成成功`);

    return NextResponse.json({
      success: true,
      key,
      uploadUrl,
      message: '请使用 uploadUrl 直接上传到 TOS，上传完成后调用 GET /api/creative-agent/upload?key=xxx 设置公开权限',
    });

  } catch (error) {
    console.error('[创意小海上传] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取上传地址失败' },
      { status: 500 }
    );
  }
}

// 设置文件公开读取权限
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
    }

    console.log(`[创意小海权限] 设置公开读取: key=${key}`);

    const client = getTosClient();
    await client.putObjectAcl({
      bucket: BUCKET_NAME,
      key,
      acl: 'public-read' as unknown as undefined,
    });

    // 返回公开访问 URL
    const publicUrl = `https://${BUCKET_NAME}.${ENDPOINT}/${key}`;

    console.log(`[创意小海权限] 设置成功: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      publicUrl,
      message: '文件已设置为公开访问',
    });

  } catch (error) {
    console.error('[创意小海权限] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '设置权限失败' },
      { status: 500 }
    );
  }
}
