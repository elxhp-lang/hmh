import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';
import { decrypt } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return fail('缺少模型ID', 400);

  const supabase = getSupabaseClient();
  const { data: model } = await supabase.from('user_models')
    .select('id,api_url,api_key_encrypted')
    .eq('id', id).eq('user_id', auth.user!.userId).single();

  if (!model) return fail('模型不存在', 404);

  try {
    const apiKey = decrypt(model.api_key_encrypted as string);
    const res = await fetch(`${model.api_url}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const status = res.ok ? 'ok' : 'failed';
    await supabase.from('user_models').update({ status, last_tested_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', auth.user!.userId);
    return ok({ data: { status, httpStatus: res.status } });
  } catch (e) {
    await supabase.from('user_models').update({ status: 'failed', last_tested_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', auth.user!.userId);
    return ok({ data: { status: 'failed', error: e instanceof Error ? e.message : '连接失败' } });
  }
}
