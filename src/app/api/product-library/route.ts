/**
 * 商品图库管理 API
 * 支持商品的增删改查、图片上传、图片整合等操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  productLibraryService,
  CreateProductParams,
} from '@/lib/product-library-service';

/**
 * GET /api/product-library
 * 获取商品列表或单个商品详情
 * Query params:
 * - id: 商品ID（可选，不传则返回列表）
 * - search: 搜索关键词
 * - category: 分类筛选
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    // 获取单个商品
    if (productId) {
      const product = await productLibraryService.getProduct(user.userId, productId);
      if (!product) {
        return NextResponse.json({ error: '商品不存在' }, { status: 404 });
      }
      return NextResponse.json({ product });
    }

    // 按名称搜索商品
    if (search) {
      const product = await productLibraryService.findProductByName(user.userId, search);
      return NextResponse.json({
        products: product ? [product] : [],
        total: product ? 1 : 0,
      });
    }

    // 获取商品列表
    const products = await productLibraryService.getProducts(user.userId, {
      category: category || undefined,
      limit: 100,
    });

    return NextResponse.json({
      products,
      total: products.length,
    });
  } catch (error) {
    console.error('获取商品列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取商品列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/product-library
 * 创建商品
 * Body: { product_name, product_description?, category?, tags? }
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
    const { product_name, product_description, category, tags } = body;

    if (!product_name) {
      return NextResponse.json({ error: '商品名称不能为空' }, { status: 400 });
    }

    const params: CreateProductParams = {
      product_name,
      product_description,
      category,
      tags,
    };

    const product = await productLibraryService.createProduct(user.userId, params);

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('创建商品失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建商品失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/product-library
 * 更新商品信息
 * Body: { id, product_name?, product_description?, category?, tags?, primary_image_index? }
 */
export async function PUT(request: NextRequest) {
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少商品ID' }, { status: 400 });
    }

    const product = await productLibraryService.updateProduct(
      user.userId,
      id,
      updates
    );

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('更新商品失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新商品失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/product-library
 * 删除商品或商品图片
 * Query params:
 * - id: 商品ID
 * - imageKey: 图片key（可选，如果传则只删除图片）
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');
    const imageKey = searchParams.get('imageKey');

    if (!productId) {
      return NextResponse.json({ error: '缺少商品ID' }, { status: 400 });
    }

    // 删除单张图片
    if (imageKey) {
      await productLibraryService.deleteProductImage(user.userId, productId, imageKey);
      return NextResponse.json({ success: true });
    }

    // 删除整个商品
    await productLibraryService.deleteProduct(user.userId, productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除商品失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除商品失败' },
      { status: 500 }
    );
  }
}
