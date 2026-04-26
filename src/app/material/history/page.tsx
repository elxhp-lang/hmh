'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, usePermission } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VideoLibraryItem, VideoLibraryResponse } from '@/types/video-library';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Video,
  Loader2,
  Download,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Film,
  RefreshCw,
  Search,
  Tag,
  Info,
  BookOpen,
  Dot,
  Sparkles,
} from 'lucide-react';

type VideoItem = VideoLibraryItem;
type HistoryResponse = VideoLibraryResponse;

interface FilterPreset {
  id: string;
  name: string;
  activeTab: 'personal' | 'team';
  statusFilter: string;
  categoryFilter: string;
  versionFilter: string;
  keyword: string;
  tagKeyword: string;
  sourceVideoFilter: string;
}

interface TagDefinition {
  id: string;
  name: string;
  enabled: boolean;
}

// 视频分类配置
const CATEGORIES = [
  { value: 'all', label: '全部' },
  { value: '开箱', label: '开箱' },
  { value: '测评', label: '测评' },
  { value: '参数科普', label: '参数科普' },
  { value: '热点解读', label: '热点解读' },
];

export default function MaterialHistoryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();
  const permission = usePermission();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [tagKeyword, setTagKeyword] = useState<string>('');
  const [sourceVideoFilter, setSourceVideoFilter] = useState<string>('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const debouncedTagKeyword = useDebouncedValue(tagKeyword, 300);
  const debouncedSourceVideoFilter = useDebouncedValue(sourceVideoFilter, 300);
  const [page, setPage] = useState(1);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [remixingIds, setRemixingIds] = useState<Set<string>>(new Set());
  const [openingSourceIds, setOpeningSourceIds] = useState<Set<string>>(new Set());
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState<string>('');
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [tagPoolLoading, setTagPoolLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savingTags, setSavingTags] = useState(false);
  const historyRequestSeq = useRef(0);
  const historyAbortController = useRef<AbortController | null>(null);
  const hasInitializedFromUrl = useRef(false);
  const urlSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const videoById = new Map((data?.videos || []).map((v) => [v.id, v] as const));
  const remixGroups = useMemo(() => {
    const groups = new Map<string, { sourceId: string; sourceTitle: string; total: number; processing: number; failed: number }>();
    for (const video of data?.videos || []) {
      if (!video.is_remix || !video.source_video_id) continue;
      const existing = groups.get(video.source_video_id) || {
        sourceId: video.source_video_id,
        sourceTitle: videoById.get(video.source_video_id)?.video_name || videoById.get(video.source_video_id)?.prompt || video.source_video_id.slice(0, 8),
        total: 0,
        processing: 0,
        failed: 0,
      };
      existing.total += 1;
      if (video.status === 'processing') existing.processing += 1;
      if (video.status === 'failed') existing.failed += 1;
      groups.set(video.source_video_id, existing);
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [data?.videos]);
  const selectedSourceVersions = useMemo(() => {
    if (!sourceVideoFilter.trim()) return [];
    const sourceId = sourceVideoFilter.trim();
    return (data?.videos || [])
      .filter((video) => video.source_video_id === sourceId || video.id === sourceId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [data?.videos, sourceVideoFilter]);

  // 是否可以查看团队
  const canViewTeam = permission.isMaterialLeader || permission.isAdmin;
  
  // 团队视图的标签文字
  const teamTabLabel = permission.isAdmin ? '全部素材' : '团队素材';
  const FILTER_PRESETS_KEY = 'video_library_filter_presets_v1';

  // 初始化：从 URL 恢复筛选状态（支持刷新后保留筛选）
  useEffect(() => {
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const version = searchParams.get('version');
    const keywordParam = searchParams.get('keyword');
    const tag = searchParams.get('tag');
    const sourceVideoId = searchParams.get('sourceVideoId');
    const pageParam = searchParams.get('page');

    if (type === 'personal' || type === 'team') setActiveTab(type);
    if (status) setStatusFilter(status);
    if (category) setCategoryFilter(category);
    if (version) setVersionFilter(version);
    if (keywordParam !== null) setKeyword(keywordParam);
    if (tag !== null) setTagKeyword(tag);
    if (sourceVideoId !== null) setSourceVideoFilter(sourceVideoId);
    if (pageParam && !Number.isNaN(Number(pageParam))) setPage(Math.max(1, Number(pageParam)));
    hasInitializedFromUrl.current = true;
    // 只在初次挂载时同步一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 状态变更时同步到 URL（差异更新 + 防抖）
  useEffect(() => {
    if (!hasInitializedFromUrl.current) return;

    const params = new URLSearchParams();
    params.set('type', activeTab);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (versionFilter !== 'all') params.set('version', versionFilter);
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (tagKeyword.trim()) params.set('tag', tagKeyword.trim());
    if (sourceVideoFilter.trim()) params.set('sourceVideoId', sourceVideoFilter.trim());
    if (page > 1) params.set('page', String(page));

    const nextQuery = params.toString();
    const current = searchParams.toString();
    if (nextQuery === current) return;

    if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    urlSyncTimer.current = setTimeout(() => {
      router.replace(`/material/history?${nextQuery}`);
    }, 120);
  }, [activeTab, statusFilter, categoryFilter, versionFilter, keyword, tagKeyword, sourceVideoFilter, page, router, searchParams]);

  useEffect(() => {
    return () => {
      if (urlSyncTimer.current) clearTimeout(urlSyncTimer.current);
    };
  }, []);

  // 加载本地筛选预设
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESETS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) {
        setFilterPresets(parsed.slice(0, 12));
      }
    } catch (error) {
      console.error('读取筛选预设失败:', error);
    }
  }, []);

  const persistPresets = (next: FilterPreset[]) => {
    setFilterPresets(next);
    try {
      localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('保存筛选预设失败:', error);
    }
  };

  // 加载历史数据
  const loadHistory = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setHistoryError(null);
    let requestSeq = 0;
    try {
      const params = new URLSearchParams({
        type: activeTab,
        page: page.toString(),
        limit: '12',
      });

      if (statusFilter && statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (categoryFilter && categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }

      if (debouncedKeyword && debouncedKeyword.trim()) {
        params.set('keyword', debouncedKeyword.trim());
      }
      if (debouncedTagKeyword && debouncedTagKeyword.trim()) {
        params.set('tag', debouncedTagKeyword.trim());
      }

      if (versionFilter && versionFilter !== 'all') {
        params.set('version', versionFilter);
      }

      if (debouncedSourceVideoFilter && debouncedSourceVideoFilter.trim()) {
        params.set('sourceVideoId', debouncedSourceVideoFilter.trim());
      }

      historyAbortController.current?.abort();
      const controller = new AbortController();
      historyAbortController.current = controller;
      requestSeq = ++historyRequestSeq.current;

      const response = await fetch(`/api/material/history?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      const result = await response.json();
      if (requestSeq !== historyRequestSeq.current) {
        return;
      }
      if (response.ok && result.success) {
        setData(result);
      } else {
        setHistoryError(result?.error || '加载视频库失败，请稍后重试');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('加载历史失败:', error);
      setHistoryError('加载视频库失败，请检查网络或稍后重试');
    } finally {
      // 仅由最新请求关闭 loading，避免旧请求覆盖新请求状态
      if (requestSeq === historyRequestSeq.current) {
        setLoading(false);
      }
    }
  }, [token, activeTab, statusFilter, categoryFilter, debouncedKeyword, debouncedTagKeyword, versionFilter, debouncedSourceVideoFilter, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadTagDefinitions = useCallback(async () => {
    if (!token) return;
    setTagPoolLoading(true);
    try {
      const response = await fetch('/api/tag-definitions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setTagDefinitions(result.tags || []);
      }
    } catch (error) {
      console.error('加载标签池失败:', error);
    } finally {
      setTagPoolLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadTagDefinitions();
  }, [loadTagDefinitions]);

  useEffect(() => {
    return () => {
      historyAbortController.current?.abort();
    };
  }, []);

  // 搜索项变化时回到第一页（请求由 loadHistory 统一触发）
  useEffect(() => {
    setPage(1);
  }, [debouncedKeyword, debouncedTagKeyword, debouncedSourceVideoFilter]);

  // 切换 Tab 时重置页码
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'personal' | 'team');
    setPage(1);
  };

  // 状态筛选变化时重置页码
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  // 分类筛选变化时重置页码
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setPage(1);
  };

  const handleVersionChange = (value: string) => {
    setVersionFilter(value);
    setPage(1);
  };

  const filterBySourceVideo = (sourceId: string) => {
    setVersionFilter('remix');
    setSourceVideoFilter(sourceId);
    setPage(1);
  };

  const clearSourceVideoFilter = () => {
    setSourceVideoFilter('');
    setPage(1);
  };

  const applyTagFilter = (tag: string) => {
    setTagKeyword(tag);
    setPage(1);
  };

  const resetAllFilters = () => {
    setActiveTab('personal');
    setStatusFilter('all');
    setCategoryFilter('all');
    setVersionFilter('all');
    setKeyword('');
    setTagKeyword('');
    setSourceVideoFilter('');
    setPage(1);
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim() || `筛选方案 ${filterPresets.length + 1}`;
    const next: FilterPreset[] = [
      {
        id: `preset_${Date.now()}`,
        name,
        activeTab,
        statusFilter,
        categoryFilter,
        versionFilter,
        keyword,
        tagKeyword,
        sourceVideoFilter,
      },
      ...filterPresets,
    ].slice(0, 12);
    persistPresets(next);
    setPresetName('');
    showToast(`已保存筛选预设：${name}`);
  };

  const applyPreset = (preset: FilterPreset) => {
    setActiveTab(preset.activeTab);
    setStatusFilter(preset.statusFilter || 'all');
    setCategoryFilter(preset.categoryFilter || 'all');
    setVersionFilter(preset.versionFilter || 'all');
    setKeyword(preset.keyword || '');
    setTagKeyword(preset.tagKeyword || '');
    setSourceVideoFilter(preset.sourceVideoFilter || '');
    setPage(1);
  };

  const deletePreset = (presetId: string) => {
    const next = filterPresets.filter((preset) => preset.id !== presetId);
    persistPresets(next);
  };

  const showToast = (message: string, duration = 2500) => {
    setSyncToast(message);
    setTimeout(() => setSyncToast(null), duration);
  };

  useEffect(() => {
    setEditingTags(selectedVideo?.tags || []);
    setTagInput('');
  }, [selectedVideo]);

  const handleAddTagToPool = async () => {
    if (!token || !newTagName.trim()) return;
    try {
      const response = await fetch('/api/tag-definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTagName.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        showToast(result.error || '添加标签失败');
        return;
      }
      setNewTagName('');
      await loadTagDefinitions();
      showToast('标签已加入标签池');
    } catch (error) {
      console.error('添加标签失败:', error);
      showToast('添加标签失败');
    }
  };

  const handleDeleteTagFromPool = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/tag-definitions?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        showToast(result.error || '移除标签失败');
        return;
      }
      await loadTagDefinitions();
      showToast('标签已从标签池移除');
    } catch (error) {
      console.error('移除标签失败:', error);
      showToast('移除标签失败');
    }
  };

  const appendTag = (tag: string) => {
    setEditingTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  const removeTag = (tag: string) => {
    setEditingTags((prev) => prev.filter((item) => item !== tag));
  };

  const addCustomTag = () => {
    const next = tagInput.trim();
    if (!next) return;
    appendTag(next);
    setTagInput('');
  };

  const saveVideoTags = async () => {
    if (!token || !selectedVideo) return;
    setSavingTags(true);
    try {
      const response = await fetch('/api/video/tags', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ videoId: selectedVideo.id, tags: editingTags }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        showToast(result.error || '保存标签失败');
        return;
      }
      setSelectedVideo((prev) => (prev ? { ...prev, tags: editingTags, tag_source: 'manual', auto_tag_status: 'success' } : prev));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          videos: prev.videos.map((video) =>
            video.id === selectedVideo.id
              ? { ...video, tags: editingTags, tag_source: 'manual', auto_tag_status: 'success' }
              : video
          ),
        };
      });
      showToast('标签已保存');
    } catch (error) {
      console.error('保存标签失败:', error);
      showToast('保存标签失败');
    } finally {
      setSavingTags(false);
    }
  };

  // 下载视频
  const handleDownload = async (video: VideoItem) => {
    const url = video.public_video_url || video.video_url;
    if (!url) return;

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `video_${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 存到学习库
  const handleSyncToLibrary = async (video: VideoItem) => {
    if (!video.video_url && !video.public_video_url) {
      setSyncToast('视频链接不可用，无法同步');
      setTimeout(() => setSyncToast(null), 3000);
      return;
    }
    
    try {
      const videoUrl = video.public_video_url || video.video_url;
      const response = await fetch('/api/learning-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoUrl: videoUrl,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSyncToast('已同步到学习库，正在分析中...');
      } else {
        setSyncToast(data.error || '同步失败，请重试');
      }
    } catch (error) {
      console.error('同步到学习库失败:', error);
      setSyncToast('同步失败，请重试');
    }
    
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleRemix = async (video: VideoItem) => {
    if (!token) return;
    const sourceVideoUrl = video.public_video_url || video.video_url;
    if (!sourceVideoUrl) {
      setSyncToast('该素材缺少可用视频链接，无法 REMIX');
      setTimeout(() => setSyncToast(null), 3000);
      return;
    }

    if (remixingIds.has(video.id)) return;

    setRemixingIds((prev) => {
      const next = new Set(prev);
      next.add(video.id);
      return next;
    });

    try {
      const remixPrompt = (video.script && video.script.trim()) || (video.prompt && video.prompt.trim()) || '保持原视频核心内容，优化节奏与镜头表现';
      const referenceImages = (video.reference_images || []).filter((url) => !url.startsWith('asset://'));
      const inheritedAssetRef = (video.reference_images || []).find((url) => url.startsWith('asset://'));
      const inheritedRealAssetId = inheritedAssetRef ? inheritedAssetRef.replace('asset://', '') : undefined;
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          taskType: 'generate',
          prompt: remixPrompt,
          referenceVideos: [sourceVideoUrl],
          ratio: video.ratio || '16:9',
          duration: video.duration || 5,
          model: video.model || 'doubao-seedance-2-0-260128',
          referenceImages,
          realAssetId: inheritedRealAssetId,
          generateAudio: video.generate_audio ?? true,
          watermark: video.watermark ?? false,
          webSearch: video.web_search ?? false,
          sourceVideoId: video.id,
          sourceTaskId: video.task_id || video.seedance_task_id,
          isRemix: true,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'REMIX 提交失败');
      }

      setSyncToast('REMIX 已提交，正在生成中');
      loadHistory();
    } catch (error) {
      console.error('REMIX 失败:', error);
      setSyncToast(error instanceof Error ? error.message : 'REMIX 提交失败');
    } finally {
      setRemixingIds((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
      setTimeout(() => setSyncToast(null), 3000);
    }
  };

  const handleOpenSourceVideo = useCallback(async (video: VideoItem) => {
    if (!token || !video.source_video_id) return;
    setOpeningSourceIds((prev) => {
      const next = new Set(prev);
      next.add(video.id);
      return next;
    });
    const source = videoById.get(video.source_video_id);
    if (source) {
      setSelectedVideo(source);
      setOpeningSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
      return;
    }

    try {
      const response = await fetch(`/api/material/history?type=${activeTab}&id=${video.source_video_id}&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result?.success && Array.isArray(result.videos) && result.videos.length > 0) {
        setSelectedVideo(result.videos[0] as VideoItem);
        setOpeningSourceIds((prev) => {
          const next = new Set(prev);
          next.delete(video.id);
          return next;
        });
        return;
      }
      showToast(`未找到来源视频 ${video.source_video_id.slice(0, 8)}`);
    } catch (error) {
      console.error('加载来源视频失败:', error);
      showToast('加载来源视频失败，请稍后重试');
    } finally {
      setOpeningSourceIds((prev) => {
        const next = new Set(prev);
        next.delete(video.id);
        return next;
      });
    }
  }, [token, videoById, activeTab]);

  // 判断是否是新生成（1小时内）
  const isNewlyCreated = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    return now - created < 60 * 60 * 1000;
  };

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { label: '等待中', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      processing: { label: '生成中', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      completed: { label: '已完成', variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
      failed: { label: '失败', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 获取模型友好名称
  const getModelName = (model?: string) => {
    if (!model) return '未知模型';
    
    const modelNames: Record<string, string> = {
      'doubao-seedance-2-0-260128': 'Seedance 2.0 标准版',
      'doubao-seedance-2-0-fast-260128': 'Seedance 2.0 快速版',
    };
    
    return modelNames[model] || model;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 同步提示 */}
        {syncToast && (
          <div className="fixed top-4 right-4 bg-background border border-border rounded-lg shadow-lg p-4 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-sm">{syncToast}</span>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold">视频库</h1>
          <p className="text-muted-foreground">专门管理生成视频、创作详情与 REMIX 任务</p>
        </div>

        <Tabs value="videos">
          <TabsList>
            <TabsTrigger value="videos">
              <Film className="h-4 w-4 mr-2" />
              视频库
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-6 space-y-6">
            {remixGroups.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">REMIX 版本追踪</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {remixGroups.slice(0, 6).map((group) => (
                    <div key={group.sourceId} className="flex items-center justify-between gap-3 border rounded px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{group.sourceTitle}</p>
                        <p className="text-xs text-muted-foreground font-mono">来源ID: {group.sourceId}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">总 {group.total}</Badge>
                        {group.processing > 0 && <Badge variant="secondary">进行中 {group.processing}</Badge>}
                        {group.failed > 0 && <Badge variant="destructive">失败 {group.failed}</Badge>}
                        <Button size="sm" variant="outline" onClick={() => filterBySourceVideo(group.sourceId)}>
                          查看版本
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {selectedSourceVersions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">来源版本树</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedSourceVersions.map((video, idx) => (
                    <div key={video.id} className="flex items-center justify-between border rounded px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {idx === 0 && !video.is_remix ? '原片' : `REMIX V${idx}`}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{video.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={video.status === 'completed' ? 'default' : video.status === 'failed' ? 'destructive' : 'secondary'}>
                          {video.status}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => setSelectedVideo(video)}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="输入预设名称（可选）"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="w-[220px]"
                  />
                  <Button variant="outline" size="sm" onClick={saveCurrentPreset}>
                    保存当前筛选为预设
                  </Button>
                </div>
                {filterPresets.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {filterPresets.map((preset) => (
                      <div key={preset.id} className="inline-flex items-center gap-1 rounded border px-2 py-1">
                        <button
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="text-xs hover:underline"
                        >
                          {preset.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(preset.id)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                          aria-label={`删除预设 ${preset.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">标签池管理</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="新增标签（例如：转场/开箱）"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="max-w-[260px]"
                  />
                  <Button size="sm" variant="outline" onClick={handleAddTagToPool}>
                    添加标签
                  </Button>
                </div>
                {tagPoolLoading ? (
                  <p className="text-sm text-muted-foreground">标签池加载中...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagDefinitions.map((tag) => (
                      <div key={tag.id} className="inline-flex items-center gap-1 rounded border px-2 py-1">
                        <span className="text-xs">{tag.name}</span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteTagFromPool(tag.id)}
                          aria-label={`删除标签 ${tag.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {tagDefinitions.length === 0 && (
                      <p className="text-xs text-muted-foreground">暂无可用标签，可先新增</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索视频名、标签、描述..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="min-w-[180px]">
                <Input
                  placeholder="按标签筛选，如：开箱"
                  value={tagKeyword}
                  onChange={(e) => setTagKeyword(e.target.value)}
                />
              </div>

              <div className="min-w-[220px]">
                <Input
                  placeholder="按来源视频ID筛选REMIX"
                  value={sourceVideoFilter}
                  onChange={(e) => setSourceVideoFilter(e.target.value)}
                />
              </div>

              <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="分类筛选" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="状态筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="processing">生成中</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="pending">等待中</SelectItem>
                </SelectContent>
              </Select>

              <Select value={versionFilter} onValueChange={handleVersionChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="版本筛选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部版本</SelectItem>
                  <SelectItem value="original">原片</SelectItem>
                  <SelectItem value="remix">REMIX</SelectItem>
                </SelectContent>
              </Select>

              {sourceVideoFilter && (
                <Button variant="outline" onClick={clearSourceVideoFilter}>
                  清除来源筛选
                </Button>
              )}

              <Button variant="outline" onClick={resetAllFilters}>
                重置筛选
              </Button>

              <Button variant="outline" size="icon" onClick={loadHistory}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {canViewTeam ? (
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList>
                  <TabsTrigger value="personal">
                    <User className="h-4 w-4 mr-2" />
                    我的素材
                  </TabsTrigger>
                  <TabsTrigger value="team">
                    <Film className="h-4 w-4 mr-2" />
                    {teamTabLabel}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="mt-6">
                  <VideoGrid
                    loading={loading}
                    videos={data?.videos || []}
                    onDownload={handleDownload}
                    onSyncToLibrary={handleSyncToLibrary}
                    onViewDetails={setSelectedVideo}
                    getStatusBadge={getStatusBadge}
                    formatDate={formatDate}
                    showUser={false}
                    getModelName={getModelName}
                    isNewlyCreated={isNewlyCreated}
                    onRemix={handleRemix}
                    remixingIds={remixingIds}
                    onOpenSourceVideo={handleOpenSourceVideo}
                    onTagClick={applyTagFilter}
                    openingSourceIds={openingSourceIds}
                  />
                </TabsContent>

                <TabsContent value="team" className="mt-6">
                  <VideoGrid
                    loading={loading}
                    videos={data?.videos || []}
                    onDownload={handleDownload}
                    onSyncToLibrary={handleSyncToLibrary}
                    onViewDetails={setSelectedVideo}
                    getStatusBadge={getStatusBadge}
                    formatDate={formatDate}
                    showUser={true}
                    getModelName={getModelName}
                    isNewlyCreated={isNewlyCreated}
                    onRemix={handleRemix}
                    remixingIds={remixingIds}
                    onOpenSourceVideo={handleOpenSourceVideo}
                    onTagClick={applyTagFilter}
                    openingSourceIds={openingSourceIds}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <VideoGrid
                loading={loading}
                videos={data?.videos || []}
                onDownload={handleDownload}
                onSyncToLibrary={handleSyncToLibrary}
                onViewDetails={setSelectedVideo}
                getStatusBadge={getStatusBadge}
                formatDate={formatDate}
                showUser={false}
                getModelName={getModelName}
                isNewlyCreated={isNewlyCreated}
                onRemix={handleRemix}
                remixingIds={remixingIds}
                onOpenSourceVideo={handleOpenSourceVideo}
                onTagClick={applyTagFilter}
                openingSourceIds={openingSourceIds}
              />
            )}

            {historyError && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-destructive">{historyError}</p>
                    <Button variant="outline" size="sm" onClick={loadHistory}>
                      重试加载
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {page} / {data.pagination.totalPages} 页
                </span>
                <Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>
                  下一页
                </Button>
              </div>
            )}

            {data && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>共 {data.pagination.total} 条记录</span>
                    {activeTab === 'team' && data.filter && (
                      <span>
                        筛选: {data.filter.userIds?.length || 0} 位成员
                        {data.filter.version && data.filter.version !== 'all' ? ` · ${data.filter.version === 'remix' ? '仅REMIX' : '仅原片'}` : ''}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

        </Tabs>

        {/* 创作详情弹窗 */}
        {selectedVideo && (
          <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
            <DialogContent className="max-w-3xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  创作详情
                </DialogTitle>
                <DialogDescription>
                  {selectedVideo.video_name || '未命名视频'}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  {/* 视频预览 */}
                  {selectedVideo.status === 'completed' && (selectedVideo.public_video_url || selectedVideo.video_url) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">视频预览</h4>
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                        <video
                          src={selectedVideo.public_video_url || selectedVideo.video_url || ''}
                          className="w-full h-full object-cover"
                          controls
                        />
                      </div>
                    </div>
                  )}

                  {/* 提示词 */}
                  {selectedVideo.prompt && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">提示词</h4>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm whitespace-pre-wrap">{selectedVideo.prompt}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* 脚本 */}
                  {selectedVideo.script && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">视频脚本</h4>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm whitespace-pre-wrap">{selectedVideo.script}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* 配文 */}
                  {selectedVideo.copywriting && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">配文</h4>
                      <Card>
                        <CardContent className="pt-6">
                          <p className="text-sm whitespace-pre-wrap">{selectedVideo.copywriting}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* 分类和标签 */}
                  {(selectedVideo.category || (selectedVideo.tags && selectedVideo.tags.length > 0)) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">分类和标签</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedVideo.category && (
                          <Badge variant="secondary">{selectedVideo.category}</Badge>
                        )}
                        {selectedVideo.tags?.map((tag, index) => (
                          <button
                            type="button"
                            key={index}
                            onClick={() => applyTagFilter(tag)}
                            className="inline-flex"
                          >
                            <Badge variant="outline">{tag}</Badge>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        标签来源：{selectedVideo.tag_source || 'manual'} · 自动识别状态：{selectedVideo.auto_tag_status || 'pending'}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium mb-2">标签编辑（可手工覆盖）</h4>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {editingTags.map((tag) => (
                          <button key={tag} type="button" onClick={() => removeTag(tag)}>
                            <Badge variant="secondary">{tag} ×</Badge>
                          </button>
                        ))}
                        {editingTags.length === 0 && <span className="text-xs text-muted-foreground">暂无标签</span>}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="输入自定义标签后添加"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          className="max-w-[240px]"
                        />
                        <Button size="sm" variant="outline" onClick={addCustomTag}>
                          添加自定义标签
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tagDefinitions.map((tag) => (
                          <button key={tag.id} type="button" onClick={() => appendTag(tag.name)}>
                            <Badge variant="outline">{tag.name}</Badge>
                          </button>
                        ))}
                      </div>
                      <Button size="sm" onClick={saveVideoTags} disabled={savingTags}>
                        {savingTags ? '保存中...' : '保存标签'}
                      </Button>
                    </div>
                  </div>

                  {/* 其他信息 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">视频ID:</span>
                      <p className="font-mono">{selectedVideo.video_id || selectedVideo.id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">状态:</span>
                      <p>{selectedVideo.status}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">时长:</span>
                      <p>{selectedVideo.duration}秒</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">比例:</span>
                      <p>{selectedVideo.ratio}</p>
                    </div>
                    {selectedVideo.model && (
                      <div>
                        <span className="text-muted-foreground">使用模型:</span>
                        <p>{getModelName(selectedVideo.model)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">创建时间:</span>
                      <p>{formatDate(selectedVideo.created_at)}</p>
                    </div>
                    {selectedVideo.is_remix && (
                      <div>
                        <span className="text-muted-foreground">版本类型:</span>
                        <p>REMIX 版本</p>
                      </div>
                    )}
                    {selectedVideo.source_video_id && (
                      <div>
                        <span className="text-muted-foreground">来源视频ID:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="font-mono">{selectedVideo.source_video_id}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => filterBySourceVideo(selectedVideo.source_video_id!)}
                          >
                            查看同源REMIX
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedVideo.source_task_id && (
                      <div>
                        <span className="text-muted-foreground">来源任务ID:</span>
                        <p className="font-mono">{selectedVideo.source_task_id}</p>
                      </div>
                    )}
                  </div>

                  {/* 失败原因 */}
                  {selectedVideo.status === 'failed' && (selectedVideo.error_message || selectedVideo.error_reason) && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-destructive">失败原因</h4>
                      <Card className="border-destructive">
                        <CardContent className="pt-6">
                          <p className="text-sm text-destructive">
                            {selectedVideo.error_reason || selectedVideo.error_message}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}

// 视频网格组件
function VideoGrid({
  loading,
  videos,
  onDownload,
  onSyncToLibrary,
  onViewDetails,
  getStatusBadge,
  formatDate,
  showUser,
  getModelName,
  isNewlyCreated,
  onRemix,
  remixingIds,
  onOpenSourceVideo,
  onTagClick,
  openingSourceIds,
}: {
  loading: boolean;
  videos: VideoItem[];
  onDownload: (video: VideoItem) => void;
  onSyncToLibrary: (video: VideoItem) => void;
  onViewDetails: (video: VideoItem) => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatDate: (date: string) => string;
  showUser: boolean;
  getModelName: (model?: string) => string;
  isNewlyCreated: (createdAt: string) => boolean;
  onRemix: (video: VideoItem) => void;
  remixingIds: Set<string>;
  onOpenSourceVideo: (video: VideoItem) => void;
  onTagClick: (tag: string) => void;
  openingSourceIds: Set<string>;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="aspect-video w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">暂无素材记录</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((video) => (
        <Card key={video.id} className="overflow-hidden">
          {/* 视频预览 */}
          <div className="aspect-video bg-muted relative">
            {/* 新生成小红点 */}
            {isNewlyCreated(video.created_at) && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                  <Dot className="h-2 w-2 fill-current" />
                  新生成
                </Badge>
              </div>
            )}

            {video.status === 'completed' && (video.public_video_url || video.video_url) ? (
              <video
                src={video.public_video_url || video.video_url || ''}
                className="w-full h-full object-cover"
                controls
                preload="metadata"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {video.status === 'processing' ? (
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">生成中...</p>
                  </div>
                ) : video.status === 'failed' ? (
                  <div className="text-center">
                    <XCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <p className="text-sm text-muted-foreground">生成失败</p>
                  </div>
                ) : (
                  <Play className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            )}
          </div>

          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm line-clamp-2">
                {video.video_name || video.prompt}
              </CardTitle>
              {getStatusBadge(video.status)}
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              {/* 用户信息 */}
              {showUser && video.users && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>来源于 @{video.users.username}</span>
                </div>
              )}

              {/* 时间 */}
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(video.created_at)}</span>
              </div>

              {/* 标签 */}
              {video.tags && video.tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Tag className="h-3 w-3" />
                  {video.tags.slice(0, 3).map((tag, index) => (
                    <button
                      type="button"
                      key={index}
                      onClick={() => onTagClick(tag)}
                      className="inline-flex"
                    >
                      <Badge variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    </button>
                  ))}
                  {video.tags.length > 3 && (
                    <span className="text-xs">+{video.tags.length - 3}</span>
                  )}
                </div>
              )}

              {video.is_remix && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">REMIX</Badge>
                  {video.source_video_id && (
                    <span className="text-xs font-mono text-muted-foreground">
                      来源: {video.source_video_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              )}

              {video.source_task_id && (
                <div className="text-xs font-mono text-muted-foreground truncate">
                  来源任务: {video.source_task_id}
                </div>
              )}

              {/* 视频信息 */}
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  {video.duration}秒
                </span>
                <span>{video.ratio}</span>
                {video.cost && (
                  <span>¥{parseFloat(String(video.cost)).toFixed(2)}</span>
                )}
              </div>

              {/* 模型信息 */}
              {video.model && (
                <div className="flex items-center gap-1">
                  <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
                    {getModelName(video.model)}
                  </span>
                </div>
              )}

              {/* 错误信息 */}
              {video.status === 'failed' && (video.error_message || video.error_reason) && (
                <p className="text-destructive text-xs mt-2">
                  {video.error_reason || video.error_message}
                </p>
              )}
            </div>

            {/* 操作按钮 */}
            {video.status === 'completed' && (video.public_video_url || video.video_url) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 min-w-[80px]"
                  onClick={() => onViewDetails(video)}
                >
                  <Info className="h-3 w-3 mr-1" />
                  查看创作详情
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 min-w-[80px]"
                  onClick={() => onSyncToLibrary(video)}
                >
                  <BookOpen className="h-3 w-3 mr-1" />
                  存到学习库
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 min-w-[80px]"
                  onClick={() => onRemix(video)}
                  disabled={remixingIds.has(video.id)}
                >
                  {remixingIds.has(video.id) ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  REMIX
                </Button>
                {video.source_video_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[80px]"
                    onClick={() => onOpenSourceVideo(video)}
                    disabled={openingSourceIds.has(video.id)}
                  >
                    {openingSourceIds.has(video.id) ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Info className="h-3 w-3 mr-1" />
                    )}
                    来源视频
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1 min-w-[80px]"
                  onClick={() => onDownload(video)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  下载
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
