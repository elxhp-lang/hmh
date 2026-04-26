'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Upload,
  Video,
  Trash2,
  RefreshCw,
  Brain,
  Play,
  Clock,
  HardDrive,
  Sparkles,
  FileVideo,
  AlertCircle,
  CheckCircle,
  Loader2,
  BookOpen,
  Lightbulb,
  Link,
  ExternalLink,
  Music,
} from 'lucide-react';

// TOS 配置
const BUCKET_NAME = process.env.NEXT_PUBLIC_TOS_BUCKET || 'hmhv';
const ENDPOINT = process.env.NEXT_PUBLIC_TOS_ENDPOINT?.replace('https://', '') || 'tos-cn-beijing.volces.com';

interface LearningVideo {
  id: string;
  video_name: string;
  video_url: string;
  video_size: number;
  video_duration?: number;
  video_style?: string;
  summary?: string;
  key_learnings?: string[];
  style_keywords?: string[];
  analysis_status: string;
  analysis_progress: number;
  analysis_error?: string;
  scene_analysis?: {
    source?: string;
    sourceName?: string;
    author?: string;
    videoId?: string;
    originalUrl?: string;
    cover?: string;
  };
  created_at: string;
  analyzed_at?: string;
}

interface Stats {
  pending?: number;
  processing?: number;
  completed?: number;
  failed?: number;
}

export default function LearningLibraryPage() {
  const { token, user } = useAuth();
  const [learnings, setLearnings] = useState<LearningVideo[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<LearningVideo | null>(null);
  const [activeTab, setActiveTab] = useState('file');
  const [videoUrl, setVideoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载学习库列表
  const loadLearnings = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/learning-library', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLearnings(data.learnings || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('加载学习库失败:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadLearnings();
  }, [loadLearnings]);

  // 上传视频文件（使用预签名URL，支持大文件）
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    setUploading(true);
    
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('video/')) {
        continue;
      }

      const fileSizeMB = file.size / 1024 / 1024;
      console.log(`[上传] 准备上传 ${file.name} (${fileSizeMB.toFixed(2)} MB)`);

      try {
        await uploadWithPresignedUrl(file);
        setTimeout(() => loadLearnings(), 1000);
      } catch (error) {
        console.error('上传失败:', error);
        alert(error instanceof Error ? error.message : '上传失败，请重试');
      }
    }

    setUploading(false);
    e.target.value = '';
  };

  // 使用预签名URL上传（无大小限制）
  const uploadWithPresignedUrl = async (file: File) => {
    try {
      // 1. 请求预签名上传URL
      const presignRes = await fetch('/api/learning-library/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!presignRes.ok) {
        const error = await presignRes.json();
        throw new Error(error.error || '获取上传地址失败');
      }

      const { uploadUrl, fileKey } = await presignRes.json();
      console.log(`[预签名上传] 获取URL成功，key: ${fileKey}`);

      // 2. 前端直接上传到TOS（无大小限制）
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('上传到存储失败');
      }

      console.log(`[预签名上传] TOS上传成功`);

      // 3. 确认上传（存储记录到数据库）
      const publicUrl = `https://${BUCKET_NAME}.${ENDPOINT}/${fileKey}`;
      const confirmRes = await fetch('/api/learning-library/upload/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: fileKey,
          fileName: file.name,
          fileSize: file.size,
          publicUrl,
        }),
      });

      if (!confirmRes.ok) {
        const error = await confirmRes.json();
        throw new Error(error.error || '确认上传失败');
      }

      console.log(`[学习库上传] ${file.name} 上传成功`);
    } catch (error) {
      console.error('[学习库上传] 失败:', error);
      throw error;
    }
  };

  // 上传视频链接（支持多平台）
  const handleVideoLinkUpload = async () => {
    if (!videoUrl.trim() || !token) return;
    
    // 检测是否为有效链接
    const urlPatterns = [
      // 抖音
      /https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/,
      /https?:\/\/www\.douyin\.com\/video\/\d+/,
      /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+/,
      // 快手
      /https?:\/\/v\.kuaishou\.com\/[A-Za-z0-9]+/,
      /https?:\/\/www\.kuaishou\.com\/short-video\/[A-Za-z0-9]+/,
      /https?:\/\/kuaishou\.cn\/short-video\/[A-Za-z0-9]+/,
      // B站
      /https?:\/\/www\.bilibili\.com\/video\/BV[A-Za-z0-9]+/,
      /https?:\/\/www\.bilibili\.com\/video\/av\d+/,
      /https?:\/\/b23\.tv\/[A-Za-z0-9]+/,
      // 小红书
      /https?:\/\/www\.xiaohongshu\.com\/discovery\/item\/[A-Za-z0-9]+/,
      /https?:\/\/www\.xiaohongshu\.com\/explore\/[A-Za-z0-9]+/,
      /https?:\/\/xhslink\.com\/[A-Za-z0-9]+/,
      // 微博
      /https?:\/\/weibo\.com\/\d+\/[A-Za-z0-9]+/,
      /https?:\/\/m\.weibo\.cn\/status\/\d+/,
      /https?:\/\/t\.cn\/[A-Za-z0-9]+/,
    ];
    
    const isValid = urlPatterns.some(pattern => pattern.test(videoUrl));
    if (!isValid) {
      alert('请输入有效的视频链接（支持抖音、快手、B站、小红书、微博等平台）');
      return;
    }

    setUploading(true);
    
    try {
      const response = await fetch('/api/learning-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ videoUrl }),
      });

      // 尝试解析响应
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        result = await response.json();
      } else {
        // 非JSON响应
        const text = await response.text();
        console.error('服务器返回非JSON响应:', text);
        throw new Error(`服务器错误: ${response.status}`);
      }
      
      if (response.ok && result.success) {
        setVideoUrl('');
        setTimeout(() => loadLearnings(), 1000);
      } else if (result.needManual) {
        alert(result.message || '无法自动下载，请手动下载后上传文件');
      } else {
        alert(result.error || '解析失败');
      }
    } catch (error) {
      console.error('视频链接解析失败:', error);
      alert(error instanceof Error ? error.message : '解析失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  // 删除视频
  const handleDelete = async (id: string) => {
    if (!token || !confirm('确定要删除这个学习视频吗？')) return;

    try {
      const response = await fetch(`/api/learning-library?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setLearnings(prev => prev.filter(l => l.id !== id));
      }
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  // 重新分析
  const handleReanalyze = async (id: string) => {
    if (!token) return;

    try {
      await fetch('/api/learning-library', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'analyze', id }),
      });

      setLearnings(prev => prev.map(l => 
        l.id === id ? { ...l, analysis_status: 'processing', analysis_progress: 0 } : l
      ));
    } catch (error) {
      console.error('重新分析失败:', error);
    }
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  // 格式化时长
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '等待分析';
      case 'processing': return '分析中';
      case 'completed': return '分析完成';
      case 'failed': return '分析失败';
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl">
        {/* 页面标题 */}
        {/* 页面标题 - 火山引擎风格 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6 mb-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">学习库</h1>
              <p className="text-muted-foreground">上传视频让创意小海学习，进化创作能力</p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">总视频数</p>
                  <p className="text-2xl font-bold">{learnings.length}</p>
                </div>
                <FileVideo className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">已学习</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">学习中</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.processing || 0}</p>
                </div>
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">等待中</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 上传区域 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              添加学习视频
            </CardTitle>
            <CardDescription>
              支持上传视频文件或粘贴视频链接（抖音、快手、B站、小红书等）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" className="gap-2">
                  <FileVideo className="w-4 h-4" />
                  上传文件
                </TabsTrigger>
                <TabsTrigger value="link" className="gap-2">
                  <Link className="w-4 h-4" />
                  视频链接
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="file" className="mt-4">
                <div 
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <p className="text-muted-foreground">上传中...</p>
                      <p className="text-xs text-muted-foreground">大文件会自动分块上传</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-1">点击或拖拽上传视频</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        支持 MP4、MOV、AVI 等格式，大文件自动分块上传
                      </p>
                      <p className="text-xs text-green-600">
                        ✅ 支持 500MB 以内的视频文件
                      </p>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="link" className="mt-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="粘贴视频链接（支持抖音、快手、B站、小红书、微博等）"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleVideoLinkUpload} 
                      disabled={uploading || !videoUrl.trim()}
                      className="gap-2"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          解析中
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          添加
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* 支持的平台列表 */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Music className="w-3 h-3" />
                      抖音
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      ⚡ 快手
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      📺 B站
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      📕 小红书
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      🐦 微博
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    支持解析多个平台的视频链接，自动下载到学习库并分析
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 说明卡片 */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">如何使用学习库？</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>1. 上传你认为优秀的视频作品（抖音爆款、广告大片、创意短片等）</li>
                  <li>2. 系统会自动分析视频的风格、镜头、色彩等元素</li>
                  <li>3. 创意小海会学习这些视频的创作技巧</li>
                  <li>4. 在对话时，小海会参考学习库的知识创作更符合你需求的视频</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 视频列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              学习库视频
            </CardTitle>
            <CardDescription>
              上传的视频会自动分析并存储到 TOS 学习库目录
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : learnings.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-2">学习库为空</p>
                <p className="text-sm text-muted-foreground">上传优秀视频让创意小海学习吧！</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {learnings.map((learning) => (
                    <div
                      key={learning.id}
                      className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {/* 视频图标 */}
                      <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center shrink-0 relative">
                        {learning.scene_analysis?.cover ? (
                          <img 
                            src={learning.scene_analysis.cover} 
                            alt="" 
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Video className="w-8 h-8 text-muted-foreground" />
                        )}
                        {/* 平台来源标记 */}
                        {learning.scene_analysis?.source && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                            style={{ 
                              backgroundColor: learning.scene_analysis.source === 'douyin' ? '#000000' :
                                learning.scene_analysis.source === 'kuaishou' ? '#FF6600' :
                                learning.scene_analysis.source === 'bilibili' ? '#00A1D6' :
                                learning.scene_analysis.source === 'xiaohongshu' ? '#FF2442' :
                                learning.scene_analysis.source === 'weibo' ? '#E6162D' :
                                '#666666'
                            }}
                          >
                            {learning.scene_analysis.source === 'douyin' && '🎵'}
                            {learning.scene_analysis.source === 'kuaishou' && '⚡'}
                            {learning.scene_analysis.source === 'bilibili' && '📺'}
                            {learning.scene_analysis.source === 'xiaohongshu' && '📕'}
                            {learning.scene_analysis.source === 'weibo' && '🐦'}
                            {!['douyin', 'kuaishou', 'bilibili', 'xiaohongshu', 'weibo'].includes(learning.scene_analysis.source) && '🎬'}
                          </div>
                        )}
                      </div>
                      
                      {/* 视频信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{learning.video_name}</h3>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(learning.analysis_status)}
                            <span className="text-xs text-muted-foreground">
                              {getStatusText(learning.analysis_status)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {formatSize(learning.video_size)}
                          </span>
                          {learning.video_duration && (
                            <span className="flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              {formatDuration(learning.video_duration)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(learning.created_at).toLocaleDateString()}
                          </span>
                          {learning.scene_analysis?.author && (
                            <span className="flex items-center gap-1">
                              {learning.scene_analysis?.source === 'douyin' && <Music className="w-3 h-3" />}
                              {learning.scene_analysis?.sourceName || learning.scene_analysis.source}
                              {' · '}
                              {learning.scene_analysis.author}
                            </span>
                          )}
                        </div>
                        
                        {/* 分析进度 */}
                        {learning.analysis_status === 'processing' && (
                          <div className="mb-2">
                            <Progress value={learning.analysis_progress} className="h-1" />
                          </div>
                        )}
                        
                        {/* 分析结果 */}
                        {learning.analysis_status === 'completed' && learning.summary && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {learning.summary}
                          </p>
                        )}
                        
                        {/* 风格标签 */}
                        {learning.style_keywords && learning.style_keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {learning.style_keywords.slice(0, 5).map((keyword, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        )}
                        
                        {/* 错误信息 */}
                        {learning.analysis_status === 'failed' && learning.analysis_error && (
                          <p className="text-sm text-red-500">{learning.analysis_error}</p>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {learning.analysis_status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVideo(learning)}
                          >
                            <Sparkles className="w-4 h-4 mr-1" />
                            详情
                          </Button>
                        )}
                        {(learning.analysis_status === 'failed' || learning.analysis_status === 'pending') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReanalyze(learning.id)}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            分析
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(learning.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* 详情弹窗 */}
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {selectedVideo && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    {selectedVideo.video_name}
                  </DialogTitle>
                  <DialogDescription>
                    视频分析详情
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  {/* 抖音信息 */}
                  {selectedVideo.scene_analysis?.source === 'douyin' && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 text-sm">
                        <Music className="w-4 h-4" />
                        <span className="font-medium">来源：抖音</span>
                        {selectedVideo.scene_analysis.author && (
                          <span className="text-muted-foreground">
                            作者：{selectedVideo.scene_analysis.author}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 视频风格 */}
                  <div>
                    <h4 className="font-medium mb-1">视频风格</h4>
                    <Badge variant="outline">{selectedVideo.video_style || '未识别'}</Badge>
                  </div>
                  
                  {/* 摘要 */}
                  {selectedVideo.summary && (
                    <div>
                      <h4 className="font-medium mb-1">内容摘要</h4>
                      <p className="text-sm text-muted-foreground">{selectedVideo.summary}</p>
                    </div>
                  )}
                  
                  {/* 关键学习点 */}
                  {selectedVideo.key_learnings && selectedVideo.key_learnings.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">关键学习点</h4>
                      <ul className="space-y-2">
                        {selectedVideo.key_learnings.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* 风格关键词 */}
                  {selectedVideo.style_keywords && selectedVideo.style_keywords.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">风格标签</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedVideo.style_keywords.map((keyword, i) => (
                          <Badge key={i} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
