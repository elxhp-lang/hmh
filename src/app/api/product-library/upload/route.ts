/**
 * 商品图片上传 API
 * 支持多视角图片上传到TOS
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { productLibraryService } from '@/lib/product-library-service';

/**
 * POST /api/product-library/upload
 * 上传商品图片
 * FormData:
 * - productId: 商品ID
 * - viewName: 视角名称（正面、侧面、背面等）
 * - file: 图片文件
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '无效的访问令牌' }, { status: 401 });
    }

    const formData = await request.formData();
    const productId = formData.get('productId') as string;
    const viewName = formData.get('viewName') as string;
    const file = formData.get('file') as File;

    if (!productId || !viewName || !file) {
      return NextResponse.json(
        { error: '缺少必要参数: productId, viewName, file' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的图片格式，仅支持 JPG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // 验证文件大小（最大10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '图片大小不能超过10MB' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer());

    // 上传图片
    const image = await productLibraryService.uploadProductImage(user.userId, {
      productId,
      viewName,
      fileContent: buffer,
      fileName: file.name,
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('上传商品图片失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传商品图片失败' },
      { status: 500 }
    );
  }
}
