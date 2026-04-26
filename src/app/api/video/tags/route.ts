import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, normalizeText, ok, requireAuth } from '@/lib/server/api-kit';

export async function PUT(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;

  try {
    const body = await request.json();
    const videoId = normalizeText(body?.videoId);
    const tagsInput = Array.isArray(body?.tags) ? body.tags : [];
    const tags = tagsInput
      .map((tag: unknown) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter((tag: string) => tag.length > 0)
      .slice(0, 20);

    if (!videoId) return fail('缺少视频ID', 400);

    const client = getSupabaseClient();
    const { data: video, error: videoError } = await client
      .from('videos')
      .select('id,user_id')
      .eq('id', videoId)
      .single();

    if (videoError || !video) return fail('视频不存在', 404);

    const role = auth.user.role;
    const canEditAny = role === 'super_admin' || role === 'material_leader' || role === 'admin';
    if (!canEditAny && video.user_id !== auth.user.userId) {
      return fail('无权修改该视频标签', 403);
    }

    const { error } = await client
      .from('videos')
      .update({
        tags,
        tag_source: 'manual',
        auto_tag_status: 'success',
        updated_at: new Date().toISOString(),
      })
      .eq('id', videoId);

    if (error) return fail(`更新标签失败: ${error.message}`, 500);
    return ok({ videoId, tags });
  } catch (error) {
    return fail(error instanceof Error ? error.message : '更新标签失败', 500);
  }
}
