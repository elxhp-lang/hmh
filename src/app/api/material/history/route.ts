import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoStorageService } from '@/lib/tos-storage';
import { fail, normalizeText, requireAuth, toPositiveInt } from '@/lib/server/api-kit';

/**
 * 素材历史 API
 * GET /api/material/history
 * 
 * 权限：
 * - material_member: 只能查看自己的素材
 * - material_leader: 可以查看团队成员的素材
 * - super_admin: 可以查看所有素材
 * 
 * 参数：
 * - type: 'personal' | 'team' (默认 personal)
 * - page: 页码
 * - limit: 每页数量
 * - status: 筛选状态
 * - userId: 指定用户ID（仅管理员可用）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (auth.response || !auth.user) return auth.response;
    const decoded = auth.user;

    // 权限检查：财务角色无权访问
    if (decoded.role === 'finance') {
      return NextResponse.json({ error: '无权访问素材历史' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'team' ? 'team' : 'personal';
    const page = toPositiveInt(searchParams.get('page'), 1);
    const limit = toPositiveInt(searchParams.get('limit'), 20, 1, 100);
    const status = normalizeText(searchParams.get('status'));
    const category = normalizeText(searchParams.get('category'));
    const keyword = normalizeText(searchParams.get('keyword'));
    const tag = normalizeText(searchParams.get('tag'));
    const version = searchParams.get('version') || 'all';
    const sourceVideoId = normalizeText(searchParams.get('sourceVideoId'));
    const targetVideoId = normalizeText(searchParams.get('id'));
    const targetUserId = normalizeText(searchParams.get('userId'));

    const client = getSupabaseClient();
    const offset = (page - 1) * limit;

    // 根据角色和类型确定查询范围
    let queryUserIds: string[] = [];

    if (type === 'personal' || decoded.role === 'material_member') {
      // 个人视图 或 素材团队成员只能看自己的
      queryUserIds = [decoded.userId];
    } else if (type === 'team' && decoded.role === 'material_leader') {
      // 素材负责人查看团队成员（仅 material_member）
      const { data: teamMembers } = await client
        .from('users')
        .select('id')
        .eq('role', 'material_member');

      queryUserIds = (teamMembers as any[])?.map((m: any) => m.id as string) || [];
    } else if (decoded.role === 'super_admin') {
      // 超级管理员可以查看所有素材
      if (targetUserId) {
        // 指定了用户ID
        queryUserIds = [targetUserId];
      } else {
        // 不限制用户，查看所有素材
        queryUserIds = [];
      }
    }

    // ===== 同时查询 videos 表和 learning_library 表 =====
    
    // 1. 查询 videos 表
    let videoQuery = client
      .from('videos')
      .select(`
        id,
        user_id,
        task_id,
        prompt,
        script,
        copywriting,
        tags,
        tag_source,
        auto_tag_status,
        category,
        reference_images,
        generate_audio,
        watermark,
        web_search,
        source_video_id,
        source_task_id,
        is_remix,
        task_type,
        status,
        tos_key,
        result_url,
        ratio,
        duration,
        cost,
        error_message,
        created_at,
        model
      `)
      .order('created_at', { ascending: false });

    // 应用用户筛选
    if (queryUserIds.length > 0) {
      videoQuery = videoQuery.in('user_id', queryUserIds);
    }

    // 应用状态筛选
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      videoQuery = videoQuery.eq('status', status);
    }

    // 应用 category 筛选
    if (category) {
      videoQuery = videoQuery.eq('category', category);
    }

    // 应用关键词搜索
    if (keyword) {
      videoQuery = videoQuery.or(`prompt.ilike.%${keyword}%,script.ilike.%${keyword}%,copywriting.ilike.%${keyword}%`);
    }

    // 标签精确筛选（jsonb 数组包含）
    if (tag) {
      videoQuery = videoQuery.contains('tags', [tag]);
    }

    // 版本筛选
    if (version === 'remix') {
      videoQuery = videoQuery.eq('is_remix', true);
    } else if (version === 'original') {
      videoQuery = videoQuery.or('is_remix.is.null,is_remix.eq.false');
    }

    if (sourceVideoId) {
      videoQuery = videoQuery.eq('source_video_id', sourceVideoId);
    }

    if (targetVideoId) {
      videoQuery = videoQuery.eq('id', targetVideoId);
    }

    // 不分页，获取所有数据（后续合并后再分页）
    const { data: videosData, error: videosError } = await videoQuery;

    if (videosError) {
      throw new Error(`查询 videos 表失败: ${videosError.message}`);
    }

    // 2. 查询 learning_library 表（仅查询已完成的视频）
    let learningQuery = client
      .from('learning_library')
      .select(`
        id,
        user_id,
        video_name,
        video_url,
        video_size,
        video_duration,
        video_style,
        summary,
        analysis_status,
        created_at
      `)
      .eq('analysis_status', 'completed')  // 仅查询已分析完成的视频
      .order('created_at', { ascending: false });

    // 应用用户筛选
    if (queryUserIds.length > 0) {
      learningQuery = learningQuery.in('user_id', queryUserIds);
    }

    const { data: learningData, error: learningError } = await learningQuery;

    if (learningError) {
      throw new Error(`查询 learning_library 表失败: ${learningError.message}`);
    }

    // 3. 合并两个表的结果
    const mergedVideos: Array<{
      id: string;
      user_id: string;
      task_id?: string | null;
      prompt: string;
      script?: string | null;
      copywriting?: string | null;
      tags?: string[] | null;
      tag_source?: string | null;
      auto_tag_status?: string | null;
      category?: string | null;
      reference_images?: string[] | null;
      generate_audio?: boolean | null;
      watermark?: boolean | null;
      web_search?: boolean | null;
      source_video_id?: string | null;
      source_task_id?: string | null;
      is_remix?: boolean | null;
      task_type: string;
      status: string;
      tos_key: string | null;
      result_url: string | null;
      ratio: string;
      duration: number;
      cost: number | null;
      error_message?: string | null;
      created_at: string;
      model?: string;
      video_url?: string;  // 用于前端显示
      video_name?: string;  // 学习库视频名称
      error_reason?: string | null;  // 错误原因
      source: 'videos' | 'learning_library';  // 标识数据来源
    }> = [];

    // 添加 videos 表的数据
    const videoUrls = new Set<string>();  // 用于去重
    if (videosData) {
      for (const video of videosData) {
        const v = video as any;
        const urlKey = v.result_url || v.tos_key || v.id;
        if (!videoUrls.has(urlKey as string)) {
          videoUrls.add(urlKey as string);
          mergedVideos.push({
            id: v.id,
            user_id: v.user_id,
            task_id: v.task_id as string,
            prompt: (v.prompt as string) || '视频生成任务',
            script: (v.script as string) || null,
            copywriting: (v.copywriting as string) || null,
            tags: (v.tags as string[]) || [],
            tag_source: (v.tag_source as string) || null,
            auto_tag_status: (v.auto_tag_status as string) || null,
            category: (v.category as string) || null,
            reference_images: (v.reference_images as string[]) || [],
            generate_audio: v.generate_audio ?? true,
            watermark: v.watermark ?? false,
            web_search: v.web_search ?? false,
            source_video_id: (v.source_video_id as string) || null,
            source_task_id: (v.source_task_id as string) || null,
            is_remix: Boolean(v.is_remix),
            task_type: v.task_type || 'text_to_video',
            status: v.status || 'completed',
            tos_key: v.tos_key,
            result_url: v.result_url,
            ratio: v.ratio || '16:9',
            duration: v.duration || 0,
            cost: v.cost,
            error_reason: v.error_reason,
            error_message: v.error_message,
            created_at: v.created_at,
            model: v.model || 'doubao-seedance-2-0',
            video_url: v.result_url,
            source: 'videos',
          });
        }
      }
    }

    // 添加 learning_library 表的数据
    if (learningData) {
      for (const learning of learningData) {
        const l = learning as any;
        const urlKey = l.video_url || l.id;
        // 仅当 videos 表中没有相同 URL 时才添加
        if (!videoUrls.has(urlKey as string)) {
          videoUrls.add(urlKey as string);
          mergedVideos.push({
            id: l.id,
            user_id: l.user_id,
            video_name: l.video_name,
            prompt: (l.video_name as string) || (l.summary as string) || '学习库视频',
            task_type: 'learning_library',
            status: 'completed',  // 学习库中的视频都是已完成的
            tos_key: null,
            result_url: l.video_url,
            ratio: '9:16',  // 默认值
            duration: (l.video_duration as number) || 0,
            cost: null,
            error_reason: null,
            error_message: null,
            created_at: l.created_at,
            model: 'doubao-seedance-2-0',  // 默认值
            video_url: l.video_url,
            source: 'learning_library',
          });
        }
      }
    }

    // 4. 按创建时间排序
    mergedVideos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 5. 分页
    const total = mergedVideos.length;
    const paginatedVideos = mergedVideos.slice(offset, offset + limit);
    const count = total;  // 用于计算总页数

    // 获取所有相关的用户 ID
    const userIds = [...new Set(paginatedVideos.map(v => v.user_id))];
    
    // 批量查询用户信息
    const { data: usersData } = await client
      .from('users')
      .select('id, username, email, role')
      .in('id', userIds);
    
    // 创建用户 ID 到用户信息的映射
    const userMap = new Map((usersData || []).map(u => [u.id, u]));

    // 为完成的视频生成 URL
    const videosWithUrl = await Promise.all(
      paginatedVideos.map(async (video) => {
        let videoUrl = video.result_url || video.video_url;

        // 如果没有 result_url，但有 TOS key 且状态为完成，生成签名 URL
        if (!videoUrl && video.tos_key && video.status === 'completed') {
          try {
            videoUrl = await VideoStorageService.getVideoUrl(video.tos_key, 86400);
          } catch (e) {
            console.error(`生成签名 URL 失败: ${video.id}`, e);
          }
        }

        // 从映射中获取用户信息
        const userInfo = userMap.get(video.user_id);

        return {
          ...video,
          video_url: videoUrl,
          users: userInfo || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      videos: videosWithUrl,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filter: {
        type,
        status,
        version,
        userIds: queryUserIds,
      },
    });
  } catch (error) {
    console.error('查询素材历史失败:', error);

    return fail(error instanceof Error ? error.message : '查询失败', 500);
  }
}
