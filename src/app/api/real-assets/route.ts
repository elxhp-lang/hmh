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
 * GET /api/real-assets?status=active&page=1&pageSize=20
 * 获取演员素材列表（所有登录用户可读）
 * page/pageSize 为可选参数，不传时返回全部（向后兼容）
 * pageSize 上限 100，防止单次拉取过多数据
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '0', 10) || 0, 100);

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

    // Step 2.3: 分页——不传 pageSize 时返回全部(向后兼容)
    if (pageSize > 0) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      assets: data || [],
      total: data?.length || 0,
      page: pageSize > 0 ? page : 1,
      pageSize: pageSize > 0 ? pageSize : (data?.length || 0),
    });
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

