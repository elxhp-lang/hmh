import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getBearerToken, fail, ok } from '@/lib/server/api-kit';
import { XiaohaiMemoryService, MemoryType } from '@/lib/xiaohai-memory-service';
import { getSupabaseClient } from '@/storage/database/supabase-client';

interface ConfirmMemoryBody {
  action: 'confirm' | 'reject' | 'never_ask';
  candidateId: string;
  memoryType?: MemoryType;
  content?: string;
  keywords?: string[];
}

const memoryService = new XiaohaiMemoryService();

function extractKeywords(text: string): string[] {
  return text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .slice(0, 8);
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return fail('未登录', 401);

  const user = await verifyToken(token);
  if (!user?.userId) return fail('未登录', 401);

  let body: ConfirmMemoryBody;
  try {
    body = await request.json();
  } catch {
    return fail('请求参数格式错误', 400);
  }

  if (!body?.action || !body?.candidateId) {
    return fail('缺少必要参数', 400);
  }

  if (body.action === 'never_ask') {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('creative_user_preferences')
      .upsert({
        user_id: user.userId,
        preference_type: 'memory_prompt_opt_out',
        content: 'true',
        tags: ['memory', 'confirm'],
        last_updated_at: new Date().toISOString(),
      });
    if (error) return fail(`保存设置失败: ${error.message}`, 500);
    return ok({ data: { action: 'never_ask' } });
  }

  if (body.action === 'reject') {
    return ok({ data: { action: 'reject', candidateId: body.candidateId } });
  }

  const content = (body.content || '').trim();
  if (!content) return fail('记忆内容不能为空', 400);

  const memoryType = body.memoryType || 'general';
  const keywords = Array.isArray(body.keywords) && body.keywords.length > 0
    ? body.keywords.slice(0, 8)
    : extractKeywords(content);

  const saved = await memoryService.saveMemory(
    user.userId,
    content,
    memoryType,
    keywords,
    { source: 'user', metadata: { candidateId: body.candidateId, confirmed: true } }
  );

  if (!saved.success) {
    return fail(saved.error || '记忆保存失败', 500);
  }

  return ok({
    data: {
      action: 'confirm',
      candidateId: body.candidateId,
      memoryId: saved.data?.id || null,
    },
  });
}

