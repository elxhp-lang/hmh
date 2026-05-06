import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';
import { encrypt, decrypt, maskKey } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;
  const supabase = getSupabaseClient();
  const { data: models } = await supabase
    .from('user_models')
    .select('id,alias,model_type,api_url,model_name,is_default,auto_fallback,status,last_tested_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return ok({ data: models || [] });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;

  const body = await request.json().catch(() => ({}));
  const { alias, model_type = 'chat', api_url, api_key, model_name } = body;

  if (!alias || !api_url || !api_key || !model_name) {
    return fail('缺少必要参数: alias, api_url, api_key, model_name', 400);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('user_models').insert({
    user_id: userId,
    alias,
    model_type,
    api_url,
    api_key_encrypted: encrypt(api_key),
    model_name,
  }).select('id,alias,model_type,api_url,model_name,is_default,auto_fallback,status,created_at').single();

  if (error || !data) return fail(error?.message || '创建失败', 500);
  return ok({ data: { ...data, api_key_masked: maskKey(api_key) } });
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id, alias, api_url, api_key, model_name, is_default, auto_fallback, model_type } = body;
  if (!id) return fail('缺少模型ID', 400);

  const supabase = getSupabaseClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (alias !== undefined) update.alias = alias;
  if (api_url !== undefined) update.api_url = api_url;
  if (model_name !== undefined) update.model_name = model_name;
  if (is_default !== undefined) update.is_default = is_default;
  if (auto_fallback !== undefined) update.auto_fallback = auto_fallback;
  if (model_type !== undefined) update.model_type = model_type;
  if (api_key) update.api_key_encrypted = encrypt(api_key);

  const { data, error } = await supabase.from('user_models')
    .update(update).eq('id', id).eq('user_id', auth.user!.userId)
    .select('id,alias,model_type,api_url,model_name,is_default,auto_fallback,status,created_at').single();

  if (error || !data) return fail(error?.message || '更新失败', 500);
  return ok({ data });
}

export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return fail('缺少模型ID', 400);

  const supabase = getSupabaseClient();
  await supabase.from('user_models').delete().eq('id', id).eq('user_id', auth.user!.userId);
  return ok({ message: '已删除' });
}
