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
 * GET /api/real-assets
 * 获取演员素材列表（所有登录用户可读）
 */
export async function GET(request: NextRequest) {
  try {
    const user = getTokenPayload(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const category = searchParams.get('category');
    const keyword = searchParams.get('keyword');

    const client = getSupabaseClient();

    let query = client
      .from('real_assets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (keyword) {
      query = query.ilike('name', `%${keyword}%`);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ assets: data || [], total: data?.length || 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取演员素材失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/real-assets
 * 新增演员素材（仅 super_admin）
 */
export async function POST(request: NextRequest) {
  try {
    const user = getTokenPayload(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (user.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { asset_id, asset_url, name, description, category, status = 'active' } = body;

    if (!asset_id || !name) {
      return NextResponse.json({ error: 'asset_id 和 name 为必填项' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('real_assets')
      .insert({
        asset_id,
        asset_url: asset_url || null,
        name,
        description: description || null,
        category: category || null,
        status,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, asset: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '新增演员素材失败' },
      { status: 500 }
    );
  }
}

