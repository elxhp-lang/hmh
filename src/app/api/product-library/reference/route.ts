/**
 * 商品参考 API
 * 供创意小海调用，根据商品名称查找商品并生成参考提示词
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { productLibraryService } from '@/lib/product-library-service';

/**
 * POST /api/product-library/reference
 * 根据商品名称生成参考信息
 * Body: { productName }
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
    const { productName } = body;

    if (!productName) {
      return NextResponse.json({ error: '商品名称不能为空' }, { status: 400 });
    }

    // 查找商品并生成参考提示词
    const result = await productLibraryService.generateProductPrompt(
      user.userId,
      productName
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('生成商品参考失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成商品参考失败' },
      { status: 500 }
    );
  }
}
