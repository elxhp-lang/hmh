/**
 * 脚本模板管理 API
 * 
 * POST /api/template - 创建模板
 * GET /api/template - 获取用户模板列表
 * GET /api/template/[id] - 获取单个模板
 * DELETE /api/template/[id] - 删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ScriptTemplateService } from '@/lib/script-template-service';

const templateService = new ScriptTemplateService();

/**
 * POST /api/template
 * 创建新模板
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const body = await request.json();
    const { template_name, category, duration, aspect_ratio, style, shots, variable_desc } = body;

    if (!template_name || !shots || shots.length === 0) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const result = await templateService.createTemplate({
      template_name,
      category: category || '',
      duration: duration || 8,
      aspect_ratio: aspect_ratio || '9:16',
      style: style || '默认',
      shots,
      variable_desc: variable_desc || {},
      created_by: user.userId
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('创建模板失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

/**
 * GET /api/template
 * 获取用户模板列表
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const result = await templateService.getUserTemplates(user.userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data || [] });
  } catch (error) {
    console.error('获取模板列表失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
