import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { verifyToken } from '@/lib/auth';

function getTokenPayload(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return verifyToken(authHeader.substring(7));
}

/**
 * GET /api/real-assets/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getTokenPayload(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('real_assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    return NextResponse.json({ asset: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取演员素材失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/real-assets/:id
 * 仅管理员
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getTokenPayload(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const client = getSupabaseClient();

    const payload = {
      asset_id: body.asset_id,
      asset_url: body.asset_url ?? null,
      name: body.name,
      description: body.description ?? null,
      category: body.category ?? null,
      status: body.status ?? 'active',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('real_assets')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, asset: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新演员素材失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/real-assets/:id
 * 仅管理员
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getTokenPayload(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { id } = await params;
    const client = getSupabaseClient();
    const { error } = await client.from('real_assets').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除演员素材失败' },
      { status: 500 }
    );
  }
}

