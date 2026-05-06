import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';
import { decrypt } from '@/lib/crypto';
import { ModelConfigAgent } from '@/lib/model-config-agent';

const configAgent = new ModelConfigAgent();

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { id } = body;
  if (!id) return fail('缺少模型ID', 400);

  const supabase = getSupabaseClient();
  const { data: model } = await supabase.from('user_models')
    .select('id,api_url,api_key_encrypted,model_type,api_example,audit_result')
    .eq('id', id).eq('user_id', auth.user!.userId).single();

  if (!model) return fail('模型不存在', 404);

  try {
    const apiKey = decrypt(model.api_key_encrypted as string);
    const apiUrl = model.api_url as string;

    // chat 类型：简单连通测试
    if (model.model_type === 'chat') {
      const res = await fetch(`${apiUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      const status = res.ok ? 'ok' : 'failed';
      await supabase.from('user_models').update({ status, last_tested_at: new Date().toISOString() }).eq('id', id);
      return ok({ data: { status, httpStatus: res.status } });
    }

    // image/video 类型：全链路管道测试
    const audit = (model.audit_result || {}) as Record<string, unknown>;
    const existingAdapter = typeof audit.adapter === 'string' ? audit.adapter : '';

    // 1. 如果没有适配器，先生成
    let adapterCode = existingAdapter;
    if (!adapterCode && model.api_example) {
      const analysis = await configAgent.analyze(model.api_example as string, model.model_type as string);
      adapterCode = await configAgent.generateAdapter(analysis, model.model_type as string);
      if (!adapterCode) {
        return ok({ data: { status: 'failed', error: '无法生成适配器，请检查API示例代码', tests: [] } });
      }
      audit.adapter = adapterCode;
    }
    if (!adapterCode) {
      return ok({ data: { status: 'failed', error: '请先保存模型或提供API示例代码', tests: [] } });
    }

    // 2. 运行管道测试
    const tests = await configAgent.runPipelineTests(apiUrl, apiKey, model.model_type as string, adapterCode);
    const allOk = tests.every(t => t.status === 'ok');

    // 3. 更新状态
    const newStatus = allOk ? 'ok' : 'partial';
    await supabase.from('user_models').update({
      status: newStatus,
      last_tested_at: new Date().toISOString(),
      audit_result: { ...audit, tests: tests.map(t => ({ step: t.step, status: t.status, detail: t.detail })), adapter: adapterCode },
    }).eq('id', id);

    // 4. 生成解释
    const explanation = await configAgent.explainResults(tests, model.model_type as string);

    return ok({ data: { status: newStatus, tests, explanation } });
  } catch (e) {
    await supabase.from('user_models').update({ status: 'failed', last_tested_at: new Date().toISOString() }).eq('id', id);
    return ok({ data: { status: 'failed', error: e instanceof Error ? e.message : '测试失败' } });
  }
}
