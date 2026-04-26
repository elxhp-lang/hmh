'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Package,
  Users,
  Copy,
  Sparkles,
} from 'lucide-react';

interface VideoItem {
  id: string;
  user_id: string;
  video_id?: string;
  seedance_task_id?: string;
  video_name?: string;
  prompt: string;
  script?: string;
  copywriting?: string;
  tags?: string[];
  category?: string;
  task_type: string;
  status: string;
  tos_key: string | null;
  video_url: string | null;
  public_video_url?: string;
  ratio: string;
  duration: number;
  cost: number | null;
  error_message: string | null;
  error_reason?: string;
  created_at: string;
  model?: string;
  source?: 'videos' | 'learning_library';
  users: {
    id: string;
    username: string;
    email: string;
    role: string;
  } | null;
}

interface HistoryResponse {
  success: boolean;
  videos: VideoItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filter?: {
    type: string;
    status: string;
    userIds: string[];
  };
}

interface ProductImage {
  view_name: string;
  key: string;
  url: string;
  uploaded_at: string;
}

interface ProductItem {
  id: string;
  product_name: string;
  product_description?: string;
  category?: string;
  images: ProductImage[];
  usage_count: number;
  created_at: string;
}

interface RealAsset {
  id: string;
  asset_id: string;
  asset_url?: string;
  name: string;
  description?: string;
  category?: string;
  status: 'active' | 'inactive';
  updated_at: string;
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
  const { token } = useAuth();
  const permission = usePermission();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState<string>('');
  const [page, setPage] = useState(1);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [remixingIds, setRemixingIds] = useState<Set<string>>(new Set());
  const [materialTab, setMaterialTab] = useState<'videos' | 'products' | 'actors'>('videos');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [realAssets, setRealAssets] = useState<RealAsset[]>([]);
  const [realAssetsLoading, setRealAssetsLoading] = useState(false);

  // 是否可以查看团队
  const canViewTeam = permission.isMaterialLeader || permission.isAdmin;
  
  // 团队视图的标签文字
  const teamTabLabel = permission.isAdmin ? '全部素材' : '团队素材';

  // 加载历史数据
  const loadHistory = useCallback(async () => {
    if (!token) return;

    setLoading(true);
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

      if (keyword && keyword.trim()) {
        params.set('keyword', keyword.trim());
      }

      const response = await fetch(`/api/material/history?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error('加载历史失败:', error);
    } finally {
      setLoading(false);
    }
  }, [token, activeTab, statusFilter, categoryFilter, keyword, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadProducts = useCallback(async () => {
    if (!token) return;
    setProductsLoading(true);
    try {
      const response = await fetch('/api/product-library', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok) {
        setProducts(result.products || []);
      }
    } catch (error) {
      console.error('加载商品素材失败:', error);
    } finally {
      setProductsLoading(false);
    }
  }, [token]);

  const loadRealAssets = useCallback(async () => {
    if (!token) return;
    setRealAssetsLoading(true);
    try {
      const response = await fetch('/api/real-assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setRealAssets(result.data || []);
      }
    } catch (error) {
      console.error('加载演员素材失败:', error);
    } finally {
      setRealAssetsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (materialTab === 'products' && products.length === 0) {
      loadProducts();
    }
    if (materialTab === 'actors' && realAssets.length === 0) {
      loadRealAssets();
    }
  }, [materialTab, products.length, realAssets.length, loadProducts, loadRealAssets]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      loadHistory();
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword]);

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
          generateAudio: true,
          watermark: false,
          webSearch: false,
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

  const copyAssetRef = async (assetId: string) => {
    try {
      await navigator.clipboard.writeText(`asset://${assetId}`);
      setSyncToast(`已复制 asset://${assetId}`);
      setTimeout(() => setSyncToast(null), 2500);
    } catch (error) {
      console.error('复制演员引用失败:', error);
      setSyncToast('复制失败，请手动复制');
      setTimeout(() => setSyncToast(null), 2500);
    }
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
          <h1 className="text-2xl font-bold">素材中心</h1>
          <p className="text-muted-foreground">统一管理视频素材、商品素材和演员素材</p>
        </div>

        <Tabs value={materialTab} onValueChange={(value) => setMaterialTab(value as 'videos' | 'products' | 'actors')}>
          <TabsList>
            <TabsTrigger value="videos">
              <Film className="h-4 w-4 mr-2" />
              视频素材
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              商品素材
            </TabsTrigger>
            <TabsTrigger value="actors">
              <Users className="h-4 w-4 mr-2" />
              演员素材
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-6 space-y-6">
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
              />
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
                      <span>筛选: {data.filter.userIds?.length || 0} 位成员</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <ProductGrid products={products} loading={productsLoading} onRefresh={loadProducts} formatDate={formatDate} />
          </TabsContent>

          <TabsContent value="actors" className="mt-6">
            <RealAssetGrid
              assets={realAssets}
              loading={realAssetsLoading}
              onRefresh={loadRealAssets}
              onCopyAssetRef={copyAssetRef}
              formatDate={formatDate}
            />
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
                          <Badge key={index} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

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

function ProductGrid({
  products,
  loading,
  onRefresh,
  formatDate,
}: {
  products: ProductItem[];
  loading: boolean;
  onRefresh: () => void;
  formatDate: (date: string) => string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">暂无商品素材</p>
          <Button variant="outline" onClick={onRefresh}>刷新</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base line-clamp-1">{product.product_name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {product.images?.[0]?.url ? (
                <img
                  src={product.images[0].url}
                  alt={product.product_name}
                  className="w-full h-32 rounded border object-cover"
                />
              ) : (
                <div className="w-full h-32 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  暂无图片
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{product.product_description || '暂无描述'}</p>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>图片 {product.images?.length || 0} 张</span>
                <span>使用 {product.usage_count || 0} 次</span>
              </div>
              <p className="text-xs text-muted-foreground">创建于 {formatDate(product.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RealAssetGrid({
  assets,
  loading,
  onRefresh,
  onCopyAssetRef,
  formatDate,
}: {
  assets: RealAsset[];
  loading: boolean;
  onRefresh: () => void;
  onCopyAssetRef: (assetId: string) => void;
  formatDate: (date: string) => string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">暂无演员素材</p>
          <Button variant="outline" onClick={onRefresh}>刷新</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" />
          刷新
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Card key={asset.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base line-clamp-1">{asset.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {asset.asset_url ? (
                <img src={asset.asset_url} alt={asset.name} className="w-full h-32 rounded border object-cover" />
              ) : (
                <div className="w-full h-32 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  暂无预览图
                </div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2">{asset.description || '暂无描述'}</p>
              <div className="rounded border px-2 py-1 font-mono text-xs break-all">asset://{asset.asset_id}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onCopyAssetRef(asset.asset_id)}>
                  <Copy className="h-3 w-3 mr-1" />
                  复制引用
                </Button>
                <Badge variant={asset.status === 'active' ? 'outline' : 'secondary'}>
                  {asset.status === 'active' ? '启用中' : '已停用'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">更新时间 {formatDate(asset.updated_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
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
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {video.tags.length > 3 && (
                    <span className="text-xs">+{video.tags.length - 3}</span>
                  )}
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
