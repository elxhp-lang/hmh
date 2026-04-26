/**
 * 商品图片整合 API
 * 将多视角图片整合为单一图片，供Seedance理解
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { productLibraryService } from '@/lib/product-library-service';

/**
 * POST /api/product-library/integrate
 * 整合商品图片
 * Body: { productId, maxImages?, layout? }
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

    const body = await request.json();
    const { productId, maxImages, layout } = body;

    if (!productId) {
      return NextResponse.json({ error: '商品ID不能为空' }, { status: 400 });
    }

    // 整合图片
    const result = await productLibraryService.integrateProductImages(
      user.userId,
      productId,
      {
        maxImages: maxImages || 4,
        layout: layout || 'grid',
      }
    );

    if (!result) {
      return NextResponse.json({ error: '商品不存在或没有图片' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      integrated: result,
    });
  } catch (error) {
    console.error('整合商品图片失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '整合商品图片失败' },
      { status: 500 }
    );
  }
}
