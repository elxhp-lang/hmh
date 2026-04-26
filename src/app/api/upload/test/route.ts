import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

// 初始化对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 测试文件上传 API（不需要认证）
 * POST /api/upload/test
 *
 * 请求体：
 * FormData {
 *   file: File;
 * }
 *
 * 返回：
 * {
 *   key: string;  // 文件在对象存储中的key
 *   url: string;  // 签名URL
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    // 验证文件类型
    const fileType = file.type.startsWith('image/') ? 'image' : 'video';
    const allowedTypes = ['image', 'video'];
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 });
    }

    // 验证文件大小（视频 500MB，图片 50MB）
    const maxSize = fileType === 'video' ? 500 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `文件大小超过限制（${fileType === 'video' ? '500MB' : '50MB'}）` },
        { status: 400 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `test/uploads/${fileType}/${timestamp}_${randomStr}.${ext}`;

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

    return NextResponse.json({
      success: true,
      key: fileKey,
      url: fileUrl,
      fileName: file.name,
      fileType,
    });
  } catch (error) {
    console.error('上传错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}
