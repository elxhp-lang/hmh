import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, normalizeText, ok, requireAuth } from '@/lib/server/api-kit';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tag_definitions')
      .select('id,name,enabled,created_by,created_at,updated_at')
      .eq('enabled', true)
      .order('name', { ascending: true });

    if (error) return fail(`加载标签池失败: ${error.message}`, 500);
    return ok({ tags: data || [] });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '加载标签池失败', 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const body = await request.json();
    const name = normalizeText(body?.name);
    if (!name) return fail('标签名称不能为空', 400);

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('tag_definitions')
      .insert({
        name,
        enabled: true,
        created_by: auth.user.userId,
      })
      .select('id,name,enabled')
      .single();

    if (error) {
      if (error.message?.includes('duplicate')) return fail('标签已存在', 409);
      return fail(`创建标签失败: ${error.message}`, 500);
    }
    return ok({ tag: data });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '创建标签失败', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = normalizeText(searchParams.get('id'));
    if (!id) return fail('缺少标签ID', 400);

    const client = getSupabaseClient();
    const { error } = await client
      .from('tag_definitions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return fail(`删除标签失败: ${error.message}`, 500);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '删除标签失败', 500);
  }
}
