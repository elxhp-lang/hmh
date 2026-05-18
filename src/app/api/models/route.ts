import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';
import { encrypt, decrypt, maskKey } from '@/lib/crypto';
import { ModelConfigAgent } from '@/lib/model-config-agent';

const configAgent = new ModelConfigAgent();

// Step 1.2b: api_url 安全校验——仅允许公网 HTTP/HTTPS URL
// 拒绝: 环回(127.*/localhost/::1)、内网(10.*/172.16-31.*/192.168.*)、非 http 协议
function isValidPublicUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('0.') || hostname.startsWith('169.254.')) return false;
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.length === parts.filter(n => !isNaN(n)).length) {
      if (parts[0] === 10) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;
  const supabase = getSupabaseClient();
  const { data: models } = await supabase
    .from('user_models')
    .select('id,alias,model_type,api_url,model_name,is_default,auto_fallback,status,caps,last_tested_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return ok({ data: models || [] });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;

  const body = await request.json().catch(() => ({}));
  const { alias, model_type = 'chat', api_url, api_key, model_name, api_example } = body;

  if (!alias || !api_url || !api_key || !model_name) {
    return fail('缺少必要参数: alias, api_url, api_key, model_name', 400);
  }

  // Step 1.2b: 拒绝内网/非法 api_url
  if (!isValidPublicUrl(api_url)) {
    return fail('api_url 无效：仅支持公网 HTTPS 地址', 400);
  }

  const supabase = getSupabaseClient();
  // 有 api_example 时触发语义分析
  let audit_result = null;
  if (api_example && (model_type === 'image' || model_type === 'video')) {
    try {
      const analysis = await configAgent.analyze(api_example, model_type);
      audit_result = { fields: analysis.fields, caps: analysis.caps, errors: analysis.errors };
    } catch { /* 分析失败不阻塞保存 */ }
  }

  const { data, error } = await supabase.from('user_models').insert({
    user_id: userId,
    alias,
    model_type,
    api_url,
    api_key_encrypted: encrypt(api_key),
    model_name,
    api_example: api_example || null,
    audit_result,
    caps: audit_result ? (audit_result as Record<string, unknown>).caps : null,
    status: audit_result ? 'analyzing' : 'untested',
  }).select('id,alias,model_type,api_url,model_name,is_default,auto_fallback,status,created_at').single();

  if (error || !data) return fail(error?.message || '创建失败', 500);
  console.log(`[Models] 创建: userId=${userId}, alias=${alias}, type=${model_type}, id=${(data as Record<string,unknown>)?.id}`);
  return ok({ data: { ...data, api_key_masked: maskKey(api_key) } });
}

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id, alias, api_url, api_key, model_name, is_default, auto_fallback, model_type } = body;
  if (!id) return fail('缺少模型ID', 400);

  // Step 1.2b: 更新 api_url 时同样校验
  if (api_url !== undefined && !isValidPublicUrl(api_url)) {
    return fail('api_url 无效：仅支持公网 HTTPS 地址', 400);
  }

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
  console.log(`[Models] 删除: userId=${auth.user!.userId}, id=${id}`);
  return ok({ message: '已删除' });
}
