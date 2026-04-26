/**
 * 单个模板管理 API
 * 
 * GET /api/template/[id] - 获取模板详情
 * DELETE /api/template/[id] - 删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ScriptTemplateService } from '@/lib/script-template-service';

const templateService = new ScriptTemplateService();

/**
 * GET /api/template/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const { id } = await params;
    const result = await templateService.getTemplate(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    if (!result.data) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('获取模板失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/template/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const { id } = await params;
    const result = await templateService.deleteTemplate(id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
