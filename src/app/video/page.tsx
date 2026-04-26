'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Video,
  Image,
  Upload,
  Sparkles,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  Film,
  Wand2,
  Plus,
  X,
  Trash2,
  Globe,
  ChevronDown,
} from 'lucide-react';

// 类型定义
type TaskType = 'generate' | 'edit' | 'extend';
type VideoRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive';
type SeedanceModel = 'doubao-seedance-2-0-260128' | 'doubao-seedance-2-0-fast-260128';

interface VideoTask {
  id: string;
  task_id: string;
  prompt: string;
  task_type: TaskType;
  status: string;
  result_url?: string;
  error_message?: string;
  created_at: string;
  duration: number;
  ratio: string;
  model: string;
}

interface ReferenceFile {
  type: 'image' | 'video' | 'audio';
  url: string;
  preview?: string;
  name: string;
}

// 进行中的任务类型（用于并发模式）
interface ActiveTask {
  localId: string;              // 前端生成的临时 ID
  backendId: string;            // 后端返回的任务 ID
  mode: 'text' | 'image' | 'multimodal' | 'edit' | 'extend';
  prompt: string;              // 任务描述（用于显示）
  params: VideoGenerateRequest; // 完整参数
  status: 'pending' | 'submitting' | 'polling' | 'completed' | 'failed';
  progress: number;             // 0-100
  resultUrl?: string;           // 完成后视频 URL
  error?: string;               // 失败原因
  createdAt: Date;
}

interface VideoGenerateRequest {
  model?: SeedanceModel;
  ratio?: VideoRatio;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  webSearch?: boolean;
  prompt?: string;
  taskType?: TaskType;
  firstFrame?: string;
  lastFrame?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  videoUrl?: string;
  videoUrls?: string[];
}

export default function VideoPage() {
  const { token } = useAuth();
  const { request } = useApi();

  // 模式选择
  const [activeMode, setActiveMode] = useState<'text' | 'image' | 'multimodal' | 'edit' | 'extend'>('text');

  // 模型与参数
  const [model, setModel] = useState<SeedanceModel>('doubao-seedance-2-0-260128');
  const [ratio, setRatio] = useState<VideoRatio>('16:9');
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [watermark, setWatermark] = useState(false);
  const [webSearch, setWebSearch] = useState(false);

  // 文生视频
  const [textPrompt, setTextPrompt] = useState('');

  // 图生视频
  const [firstFrame, setFirstFrame] = useState<File | null>(null);
  const [firstFramePreview, setFirstFramePreview] = useState<string | null>(null);
  const [firstFrameUrl, setFirstFrameUrl] = useState<string>('');
  const [lastFrame, setLastFrame] = useState<File | null>(null);
  const [lastFramePreview, setLastFramePreview] = useState<string | null>(null);
  const [lastFrameUrl, setLastFrameUrl] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState('');

  // 多模态参考
  const [referenceImages, setReferenceImages] = useState<ReferenceFile[]>([]);
  const [referenceVideos, setReferenceVideos] = useState<ReferenceFile[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<ReferenceFile[]>([]);
  const [multiModalPrompt, setMultiModalPrompt] = useState('');

  // 视频编辑
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null);
  const [editVideoPreview, setEditVideoPreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editReferenceImages, setEditReferenceImages] = useState<ReferenceFile[]>([]);

  // 视频延长
  const [extendVideos, setExtendVideos] = useState<{ url: string; file: File | null; preview: string | null }[]>([{ url: '', file: null, preview: null }]);
  const [extendPrompt, setExtendPrompt] = useState('');

  // 任务状态（并发模式）
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>([]);  // 进行中的任务列表
  const [submitting, setSubmitting] = useState(false);              // 提交中状态（用于按钮防抖）
  const [cooldown, setCooldown] = useState(false);                  // 冷却状态（2秒防抖）
  const [historyCollapsed, setHistoryCollapsed] = useState(true);    // 历史记录折叠状态
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 轮询管理（Map 存储多个任务的定时器）
  const pollTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 历史记录
  const [history, setHistory] = useState<VideoTask[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // 文件输入引用
  const firstFrameInputRef = useRef<HTMLInputElement>(null);
  const lastFrameInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const refVideoInputRef = useRef<HTMLInputElement>(null);
  const refAudioInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);
  const extendVideoInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      pollTimersRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollTimersRef.current.clear();
    };
  }, []);

  // 获取模型友好名称
  const getModelName = (model?: string) => {
    if (!model) return '未知模型';
    const modelMap: Record<string, string> = {
      'doubao-seedance-2-0-260128': 'Seedance 2.0 标准版',
      'doubao-seedance-2-0-fast-260128': 'Seedance 2.0 快速版',
    };
    return modelMap[model] || model;
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const data = await request<{ videos: VideoTask[] }>('/api/video/history');
      setHistory(data.videos || []);
    } catch (e: any) {
      console.error('加载历史失败:', e);
      // token 过期时不需要显示错误，让 useApi 的 logout 处理即可
      if (e?.status === 401) {
        // useApi 会在 401 时自动 logout，页面会自动跳转
        return;
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  // ========== 并发任务管理函数 ==========

  // 更新任务状态
  const updateTask = (localId: string, updates: Partial<ActiveTask>) => {
    setActiveTasks(prev => prev.map(task =>
      task.localId === localId ? { ...task, ...updates } : task
    ));
  };

  // 添加新任务
  const addTask = (task: ActiveTask) => {
    setActiveTasks(prev => [task, ...prev]);
  };

  // 移除任务
  const removeTask = (localId: string) => {
    // 先停止轮询
    const timer = pollTimersRef.current.get(localId);
    if (timer) {
      clearInterval(timer);
      pollTimersRef.current.delete(localId);
    }
    // 从列表移除
    setActiveTasks(prev => prev.filter(task => task.localId !== localId));
  };

  // 根据模式获取提示词
  const getPromptByMode = (): string => {
    switch (activeMode) {
      case 'text':
        return textPrompt;
      case 'image':
        return imagePrompt;
      case 'multimodal':
        return multiModalPrompt;
      case 'edit':
        return editPrompt;
      case 'extend':
        return extendPrompt;
      default:
        return '';
    }
  };

  // 删除历史记录
  const handleDeleteHistory = async (id: string) => {
    if (deletingIds.has(id)) return;
    
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      
      const res = await fetch(`/api/video/history?ids=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '删除失败');
      }

      // 从列表中移除
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (e: any) {
      console.error('删除失败:', e);
      alert(e?.message || '删除失败');
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // 文件选择处理
  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'firstFrame' | 'lastFrame' | 'refImage' | 'refVideo' | 'refAudio' | 'editImage' | 'editVideo' | 'extendVideo',
    index?: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;

      switch (type) {
        case 'firstFrame':
          setFirstFrame(file);
          setFirstFramePreview(preview);
          break;
        case 'lastFrame':
          setLastFrame(file);
          setLastFramePreview(preview);
          break;
        case 'refImage':
          if (referenceImages.length < 9) {
            setReferenceImages([...referenceImages, { type: 'image', url: preview, preview, name: file.name }]);
          }
          break;
        case 'refVideo':
          if (referenceVideos.length < 3) {
            setReferenceVideos([...referenceVideos, { type: 'video', url: preview, preview, name: file.name }]);
          }
          break;
        case 'refAudio':
          if (referenceAudios.length < 3) {
            setReferenceAudios([...referenceAudios, { type: 'audio', url: preview, name: file.name }]);
          }
          break;
        case 'editImage':
          if (editReferenceImages.length < 9) {
            setEditReferenceImages([...editReferenceImages, { type: 'image', url: preview, preview, name: file.name }]);
          }
          break;
        case 'editVideo':
          setEditVideoFile(file);
          setEditVideoPreview(preview);
          setEditVideoUrl(''); // 清空 URL 输入
          break;
        case 'extendVideo':
          if (index !== undefined) {
            const newVideos = [...extendVideos];
            newVideos[index] = { url: '', file, preview };
            setExtendVideos(newVideos);
          }
          break;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 上传文件到存储（使用预签名URL，无大小限制）
  const uploadAndGetUrl = async (file: File): Promise<string> => {
    try {
      // 1. 请求预签名上传URL
      const fileType = file.type.startsWith('video/') ? 'video' : 
                      file.type.startsWith('image/') ? 'image' : 'video';
      
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: file.name,
          fileType,
          expiresIn: 3600,
        }),
      });

      if (!presignRes.ok) {
        const error = await presignRes.json();
        throw new Error(error.error || '获取上传地址失败');
      }

      const { uploadUrl, key, publicUrl: presignedPublicUrl } = await presignRes.json();

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

      // 3. 调用确认接口设置公开权限
      try {
        const confirmRes = await fetch('/api/upload/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ key }),
        });
        
        if (confirmRes.ok) {
          const confirmData = await confirmRes.json();
          if (confirmData.publicUrl) {
            return confirmData.publicUrl;
          }
        }
        console.warn('[视频页面上传] 设置公开权限失败，使用预签名 URL');
      } catch (confirmError) {
        console.warn('[视频页面上传] 设置公开权限异常:', confirmError);
      }

      // 4. 返回公开 URL
      return presignedPublicUrl || key;
    } catch (error) {
      console.error('[视频页面上传] 失败:', error);
      throw error;
    }
  };

  // ========== 并发任务提交与轮询 ==========

  // 提交任务（主函数）
  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    // 2秒冷却检查
    if (cooldown) {
      return;
    }

    try {
      // 1. 收集参数
      const requestBody = await collectFormParams();

      // 2. 生成临时 ID
      const localId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const prompt = getPromptByMode();

      // 3. 创建任务记录
      const newTask: ActiveTask = {
        localId,
        backendId: '',
        mode: activeMode,
        prompt: prompt || '未提供描述',
        params: requestBody,
        status: 'submitting',
        progress: 5,
        createdAt: new Date(),
      };

      // 4. 添加到任务列表
      addTask(newTask);

      // 5. 清空表单
      clearForm();

      // 6. 开始提交
      await submitTask(newTask);

      // 7. 启动冷却（2秒）
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);

    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    }
  };

  // 收集表单参数
  const collectFormParams = async (): Promise<VideoGenerateRequest> => {
    const requestBody: VideoGenerateRequest = {
      model,
      ratio,
      duration,
      generateAudio,
      watermark,
      webSearch,
    };

    if (activeMode === 'text') {
      if (!textPrompt.trim()) throw new Error('请输入视频描述');
      requestBody.prompt = textPrompt;
      requestBody.taskType = 'generate';
    } else if (activeMode === 'image') {
      if (!imagePrompt.trim()) throw new Error('请输入视频描述');
      requestBody.prompt = imagePrompt;
      requestBody.taskType = 'generate';
      if (firstFrame) {
        requestBody.firstFrame = await uploadAndGetUrl(firstFrame);
      } else if (firstFrameUrl) {
        requestBody.firstFrame = firstFrameUrl;
      }
      if (lastFrame) {
        requestBody.lastFrame = await uploadAndGetUrl(lastFrame);
      } else if (lastFrameUrl) {
        requestBody.lastFrame = lastFrameUrl;
      }
    } else if (activeMode === 'multimodal') {
      if (!multiModalPrompt.trim()) throw new Error('请输入视频描述');
      requestBody.prompt = multiModalPrompt;
      requestBody.taskType = 'generate';
      if (referenceImages.length > 0) {
        requestBody.referenceImages = await uploadReferences(referenceImages);
      }
      if (referenceVideos.length > 0) {
        requestBody.referenceVideos = await uploadReferences(referenceVideos);
      }
      if (referenceAudios.length > 0) {
        requestBody.referenceAudios = await uploadReferences(referenceAudios);
      }
    } else if (activeMode === 'edit') {
      if (!editVideoUrl && !editVideoFile) throw new Error('请上传视频或输入视频 URL');
      if (!editPrompt.trim()) throw new Error('请输入编辑指令');
      if (editVideoFile) {
        requestBody.videoUrl = await uploadAndGetUrl(editVideoFile);
      } else {
        requestBody.videoUrl = editVideoUrl;
      }
      if (editReferenceImages.length > 0) {
        requestBody.referenceImages = await uploadReferences(editReferenceImages);
      }
      requestBody.prompt = editPrompt;
      requestBody.taskType = 'edit';
    } else if (activeMode === 'extend') {
      const validVideos = extendVideos.filter(v => v.url.trim() || v.file);
      if (validVideos.length === 0) throw new Error('请上传至少一个视频或输入视频 URL');
      if (!extendPrompt.trim()) throw new Error('请输入延长指令');
      requestBody.videoUrls = [];
      for (const video of validVideos) {
        if (video.file) {
          requestBody.videoUrls.push(await uploadAndGetUrl(video.file));
        } else {
          requestBody.videoUrls.push(video.url);
        }
      }
      requestBody.prompt = extendPrompt;
      requestBody.taskType = 'extend';
    }

    return requestBody;
  };

  // 上传参考资料
  const uploadReferences = async (refs: ReferenceFile[]): Promise<string[]> => {
    const result: string[] = [];
    for (const ref of refs) {
      if (ref.url.startsWith('data:')) {
        const response = await fetch(ref.url);
        const blob = await response.blob();
        const file = new File([blob], ref.name, { type: blob.type });
        result.push(await uploadAndGetUrl(file));
      } else {
        result.push(ref.url);
      }
    }
    return result;
  };

  // 提交任务到后端
  const submitTask = async (task: ActiveTask) => {
    updateTask(task.localId, { status: 'submitting', progress: 10 });

    try {
      const apiPath = activeMode === 'edit' ? '/api/video/edit' :
                      activeMode === 'extend' ? '/api/video/extend' : '/api/video/generate';

      const result = await request<{ taskId: string; seedanceTaskId: string }>(apiPath, {
        method: 'POST',
        body: task.params,
      });

      // 更新后端 ID，开始轮询
      updateTask(task.localId, { backendId: result.taskId, status: 'polling', progress: 20 });
      pollTask(task.localId, result.taskId);

    } catch (e) {
      updateTask(task.localId, {
        status: 'failed',
        error: e instanceof Error ? e.message : '提交失败',
      });
    }
  };

  // 轮询任务状态（固定间隔，不退避）
  const pollTask = (localId: string, taskId: string) => {
    const MAX_POLLS = 120;  // 最多轮询 10 分钟（120 * 5秒）
    let pollCount = 0;

    const interval = setInterval(async () => {
      pollCount++;

      // 超时检查
      if (pollCount >= MAX_POLLS) {
        updateTask(localId, { status: 'failed', error: '生成超时（超过10分钟）' });
        clearInterval(interval);
        pollTimersRef.current.delete(localId);
        return;
      }

      try {
        const result = await request<{ video: VideoTask }>(`/api/video/generate?taskId=${taskId}`);
        const video = result.video;

        if (video.status === 'processing') {
          // 处理中，更新进度（估算）
          const progress = Math.min(20 + pollCount * 2, 90);
          updateTask(localId, { progress });
        } else if (video.status === 'completed') {
          // 完成
          updateTask(localId, { status: 'completed', progress: 100, resultUrl: video.result_url });
          clearInterval(interval);
          pollTimersRef.current.delete(localId);
          loadHistory();  // 刷新历史
        } else if (video.status === 'failed') {
          // 失败
          updateTask(localId, { status: 'failed', error: video.error_message || '生成失败' });
          clearInterval(interval);
          pollTimersRef.current.delete(localId);
        }
      } catch (e) {
        // API 调用失败，继续轮询
        console.error(`轮询失败 (${localId}):`, e);
      }
    }, 5000);

    pollTimersRef.current.set(localId, interval);
  };

  // 清空表单
  const clearForm = () => {
    switch (activeMode) {
      case 'text':
        setTextPrompt('');
        break;
      case 'image':
        setImagePrompt('');
        setFirstFrame(null);
        setFirstFrameUrl('');
        setLastFrame(null);
        setLastFrameUrl('');
        break;
      case 'multimodal':
        setMultiModalPrompt('');
        setReferenceImages([]);
        setReferenceVideos([]);
        setReferenceAudios([]);
        break;
      case 'edit':
        setEditPrompt('');
        setEditVideoUrl('');
        setEditVideoFile(null);
        setEditReferenceImages([]);
        break;
      case 'extend':
        setExtendPrompt('');
        setExtendVideos([]);
        break;
    }
  };
  const retryTask = (task: ActiveTask) => {
    // 移除旧任务
    removeTask(task.localId);

    // 重新提交
    const newTask: ActiveTask = {
      ...task,
      localId: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'submitting',
      progress: 5,
      createdAt: new Date(),
    };
    addTask(newTask);
    submitTask(newTask);
  };

  // ========== 任务卡片组件 ==========
  const TaskCard = ({ task }: { task: ActiveTask }) => {
    const getStatusBadge = () => {
      switch (task.status) {
        case 'pending':
          return <Badge variant="outline">等待中</Badge>;
        case 'submitting':
          return <Badge variant="secondary">提交中</Badge>;
        case 'polling':
          return <Badge variant="secondary">处理中</Badge>;
        case 'completed':
          return <Badge variant="default">已完成</Badge>;
        case 'failed':
          return <Badge variant="destructive">失败</Badge>;
        default:
          return null;
      }
    };

    return (
      <div className="border rounded-lg p-3 border-l-4 border-l-primary/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <span className="text-xs text-muted-foreground">
              {new Date(task.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {task.status === 'failed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryTask(task)}
                className="h-7 text-xs"
              >
                重试
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => removeTask(task.localId)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* 提示词 */}
        <p className="text-sm line-clamp-2 mb-2">{task.prompt}</p>

        {/* 模型标签 */}
        <div className="flex items-center gap-1 mb-2">
          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
            {getModelName(task.params.model)}
          </span>
          <span className="text-xs text-muted-foreground">
            {task.params.duration}秒 / {task.params.ratio}
          </span>
        </div>

        {/* 进度条 */}
        {(task.status === 'submitting' || task.status === 'polling') && (
          <div className="space-y-1">
            <Progress value={task.progress} className="h-1.5" />
            <span className="text-xs text-muted-foreground">{task.progress}%</span>
          </div>
        )}

        {/* 完成后的视频链接 */}
        {task.status === 'completed' && task.resultUrl && (
          <a
            href={task.resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            <Play className="h-3 w-3 mr-1" />
            查看视频
          </a>
        )}

        {/* 失败原因 */}
        {task.status === 'failed' && task.error && (
          <p className="text-xs text-destructive">{task.error}</p>
        )}
      </div>
    );
  };

  // 添加延长视频
  const addExtendVideo = () => {
    if (extendVideos.length < 3) {
      setExtendVideos([...extendVideos, { url: '', file: null, preview: null }]);
    }
  };

  // 移除延长视频
  const removeExtendVideo = (index: number) => {
    setExtendVideos(extendVideos.filter((_, i) => i !== index));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 - 火山引擎风格 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">手动制作视频</h1>
              </div>
              <p className="text-muted-foreground">使用 Seedance 2.0 模型生成、编辑、延长高质量视频</p>
            </div>
            <Badge variant="secondary" className="text-sm hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              {model === 'doubao-seedance-2-0-260128' ? 'Seedance 2.0 标准版' : 'Seedance 2.0 快速版'}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 左侧：生成区域 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 模式选择 */}
            <Tabs value={activeMode} onValueChange={(v) => setActiveMode(v as 'text' | 'image' | 'multimodal' | 'edit' | 'extend')} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="text" className="text-xs sm:text-sm">
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">文生视频</span>
                </TabsTrigger>
                <TabsTrigger value="image" className="text-xs sm:text-sm">
                  <Image className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">图生视频</span>
                </TabsTrigger>
                <TabsTrigger value="multimodal" className="text-xs sm:text-sm">
                  <Wand2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">多模态</span>
                </TabsTrigger>
                <TabsTrigger value="edit" className="text-xs sm:text-sm">
                  <Film className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">视频编辑</span>
                </TabsTrigger>
                <TabsTrigger value="extend" className="text-xs sm:text-sm">
                  <Video className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">视频延长</span>
                </TabsTrigger>
              </TabsList>

              {/* 文生视频 */}
              <TabsContent value="text" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>文字描述生成视频</CardTitle>
                    <CardDescription>输入详细的视频描述，AI 将为您生成对应的视频内容</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>视频描述</Label>
                      <Textarea
                        placeholder="例如：一只可爱的橘猫在阳光下的花园里追逐蝴蝶，画面温馨治愈..."
                        value={textPrompt}
                        onChange={(e) => setTextPrompt(e.target.value)}
                        rows={4}
                        disabled={cooldown}
                      />
                      <p className="text-xs text-muted-foreground">
                        提示：详细的描述可获得更好的效果，建议包含场景、动作、氛围等要素
                      </p>
                    </div>

                    {/* 联网搜索开关 */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label className="cursor-pointer">联网搜索增强</Label>
                          <p className="text-xs text-muted-foreground">根据提示词自动搜索相关信息增强生成</p>
                        </div>
                      </div>
                      <Switch checked={webSearch} onCheckedChange={setWebSearch} disabled={cooldown} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 图生视频 */}
              <TabsContent value="image" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>图片生成视频</CardTitle>
                    <CardDescription>上传首帧和尾帧图片，AI 将生成过渡动画</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* 首帧 */}
                      <div className="space-y-2">
                        <Label>首帧图片</Label>
                        <div 
                          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => firstFrameInputRef.current?.click()}
                        >
                          {firstFramePreview ? (
                            <img src={firstFramePreview} alt="首帧" className="max-h-40 mx-auto rounded" />
                          ) : (
                            <div className="py-8">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                              <p className="text-sm text-muted-foreground mt-2">点击上传首帧</p>
                            </div>
                          )}
                        </div>
                        <Input
                          ref={firstFrameInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, 'firstFrame')}
                        />
                        <Input
                          placeholder="或输入图片URL"
                          value={firstFrameUrl}
                          onChange={(e) => setFirstFrameUrl(e.target.value)}
                          disabled={cooldown || !!firstFrame}
                        />
                      </div>

                      {/* 尾帧 */}
                      <div className="space-y-2">
                        <Label>尾帧图片（可选）</Label>
                        <div 
                          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => lastFrameInputRef.current?.click()}
                        >
                          {lastFramePreview ? (
                            <img src={lastFramePreview} alt="尾帧" className="max-h-40 mx-auto rounded" />
                          ) : (
                            <div className="py-8">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                              <p className="text-sm text-muted-foreground mt-2">点击上传尾帧</p>
                            </div>
                          )}
                        </div>
                        <Input
                          ref={lastFrameInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, 'lastFrame')}
                        />
                        <Input
                          placeholder="或输入图片URL"
                          value={lastFrameUrl}
                          onChange={(e) => setLastFrameUrl(e.target.value)}
                          disabled={cooldown || !!lastFrame}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>视频描述</Label>
                      <Textarea
                        placeholder="描述图片如何动起来，例如：镜头缓慢推进，花瓣随风飘落..."
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        rows={3}
                        disabled={cooldown}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 多模态参考 */}
              <TabsContent value="multimodal" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>多模态参考生成</CardTitle>
                    <CardDescription>上传参考图片、视频、音频，AI 将综合生成新视频</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 参考图片 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>参考图片（最多9张）</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refImageInputRef.current?.click()}
                          disabled={cooldown || referenceImages.length >= 9}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加
                        </Button>
                      </div>
                      <Input
                        ref={refImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'refImage')}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {referenceImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img.preview} alt={`参考图${idx + 1}`} className="w-full h-24 object-cover rounded" />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReferenceImages(referenceImages.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 参考视频 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>参考视频（最多3个）</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refVideoInputRef.current?.click()}
                          disabled={cooldown || referenceVideos.length >= 3}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          上传
                        </Button>
                      </div>
                      <Input
                        ref={refVideoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'refVideo')}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="或输入视频 URL"
                          onChange={(e) => {
                            if (e.target.value && referenceVideos.length < 3) {
                              setReferenceVideos([...referenceVideos, { type: 'video', url: e.target.value, name: e.target.value }]);
                              e.target.value = '';
                            }
                          }}
                          disabled={cooldown || referenceVideos.length >= 3}
                        />
                      </div>
                      {/* 视频预览列表 */}
                      {referenceVideos.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {referenceVideos.map((video, idx) => (
                            <div key={idx} className="relative group">
                              {video.preview ? (
                                <video src={video.preview} className="w-full h-20 object-cover rounded" />
                              ) : (
                                <div className="w-full h-20 bg-muted rounded flex items-center justify-center">
                                  <Film className="h-6 w-6 text-muted-foreground" />
                                </div>
                              )}
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setReferenceVideos(referenceVideos.filter((_, i) => i !== idx))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <p className="text-xs text-center truncate mt-1">{video.name || `视频${idx + 1}`}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 参考音频 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>参考音频（最多3个）</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => refAudioInputRef.current?.click()}
                          disabled={cooldown || referenceAudios.length >= 3}
                        >
                          <Upload className="h-4 w-4 mr-1" />
                          上传
                        </Button>
                      </div>
                      <Input
                        ref={refAudioInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'refAudio')}
                      />
                      <div className="flex gap-2">
                        <Input
                          placeholder="或输入音频 URL"
                          onChange={(e) => {
                            if (e.target.value && referenceAudios.length < 3) {
                              setReferenceAudios([...referenceAudios, { type: 'audio', url: e.target.value, name: e.target.value }]);
                              e.target.value = '';
                            }
                          }}
                          disabled={cooldown || referenceAudios.length >= 3}
                        />
                      </div>
                      {/* 音频列表 */}
                      {referenceAudios.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {referenceAudios.map((audio, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-muted rounded px-3 py-2">
                              <span className="text-sm truncate flex-1">{audio.name || `音频${idx + 1}`}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setReferenceAudios(referenceAudios.filter((_, i) => i !== idx))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>生成描述</Label>
                      <Textarea
                        placeholder="描述你想要生成的视频，可以引用参考素材如：参考图片1的风格，参考视频1的运镜..."
                        value={multiModalPrompt}
                        onChange={(e) => setMultiModalPrompt(e.target.value)}
                        rows={4}
                        disabled={cooldown}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 视频编辑 */}
              <TabsContent value="edit" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>视频编辑</CardTitle>
                    <CardDescription>对现有视频进行编辑，如替换主体、增删元素等</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>视频文件或 URL</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => editVideoInputRef.current?.click()}
                          disabled={cooldown}
                          className="shrink-0"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          上传视频
                        </Button>
                        <Input
                          ref={editVideoInputRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, 'editVideo')}
                        />
                        <Input
                          placeholder="或输入视频 URL"
                          value={editVideoUrl}
                          onChange={(e) => {
                            setEditVideoUrl(e.target.value);
                            setEditVideoFile(null);
                            setEditVideoPreview(null);
                          }}
                          disabled={cooldown || !!editVideoFile}
                        />
                      </div>
                      {/* 视频预览 */}
                      {editVideoPreview && (
                        <div className="relative mt-2">
                          <video 
                            src={editVideoPreview} 
                            controls 
                            className="w-full max-h-48 rounded border"
                          />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => {
                              setEditVideoFile(null);
                              setEditVideoPreview(null);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        支持 mp4、mov 格式，文件大小不超过 500MB
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>编辑指令</Label>
                      <Textarea
                        placeholder="例如：将视频中的香水替换成图片1中的面霜，运镜不变"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        disabled={cooldown}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>参考图片（可选）</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => editImageInputRef.current?.click()}
                          disabled={cooldown || editReferenceImages.length >= 9}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加
                        </Button>
                      </div>
                      <Input
                        ref={editImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'editImage')}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {editReferenceImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img.preview} alt={`参考图${idx + 1}`} className="w-full h-24 object-cover rounded" />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditReferenceImages(editReferenceImages.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 视频延长 */}
              <TabsContent value="extend" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>视频延长</CardTitle>
                    <CardDescription>延长视频或串联多个视频片段</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>视频文件或 URL（1-3个）</Label>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addExtendVideo}
                          disabled={cooldown || extendVideos.length >= 3}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          添加视频
                        </Button>
                      </div>
                      {extendVideos.map((video, idx) => (
                        <div key={idx} className="space-y-2">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => extendVideoInputRefs.current[idx]?.click()}
                              disabled={cooldown || !!video.file}
                              className="shrink-0"
                            >
                              <Upload className="h-4 w-3 mr-1" />
                              上传
                            </Button>
                            <Input
                              ref={el => { extendVideoInputRefs.current[idx] = el; }}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e, 'extendVideo', idx)}
                            />
                            <Input
                              placeholder={`视频 ${idx + 1} URL`}
                              value={video.url}
                              onChange={(e) => {
                                const newVideos = [...extendVideos];
                                newVideos[idx] = { url: e.target.value, file: null, preview: null };
                                setExtendVideos(newVideos);
                              }}
                              disabled={cooldown || !!video.file}
                            />
                            {extendVideos.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeExtendVideo(idx)}
                                disabled={cooldown}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {/* 视频预览 */}
                          {video.preview && (
                            <div className="relative">
                              <video 
                                src={video.preview} 
                                controls 
                                className="w-full max-h-32 rounded border"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => {
                                  const newVideos = [...extendVideos];
                                  newVideos[idx] = { url: '', file: null, preview: null };
                                  setExtendVideos(newVideos);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        传入1个视频可向前或向后延长，传入2-3个视频会将它们串联
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>延长指令</Label>
                      <Textarea
                        placeholder="例如：向前延长视频1，展示主角走进场景的过程，最后接视频1"
                        value={extendPrompt}
                        onChange={(e) => setExtendPrompt(e.target.value)}
                        rows={3}
                        disabled={cooldown}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* 提交区域 */}
            <Card>
              <CardContent className="pt-6">
                {/* 错误提示 */}
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* 成功提示 */}
                {success && (
                  <Alert className="mb-4 border-green-500 text-green-700 bg-green-50">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleSubmit} 
                  disabled={cooldown}
                  className="w-full"
                  size="lg"
                >
                  {cooldown ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      已提交...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      开始生成
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：任务列表 + 参数设置 + 历史记录 */}
          <div className="space-y-6">
            {/* 进行中的任务 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>进行中的任务</span>
                  {activeTasks.length > 0 && (
                    <Badge variant="secondary">{activeTasks.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">暂无进行中的任务</p>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-3">
                      {activeTasks.map((task) => (
                        <TaskCard key={task.localId} task={task} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* 参数设置 */}
            <Card>
              <CardHeader>
                <CardTitle>生成参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>模型选择</Label>
                  <Select value={model} onValueChange={(v) => setModel(v as SeedanceModel)} disabled={cooldown}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doubao-seedance-2-0-260128">Seedance 2.0 标准版</SelectItem>
                      <SelectItem value="doubao-seedance-2-0-fast-260128">Seedance 2.0 快速版</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>视频时长 ({duration}秒)</Label>
                  <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))} disabled={cooldown}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((s) => (
                        <SelectItem key={s} value={s.toString()}>{s} 秒</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>视频比例</Label>
                  <Select value={ratio} onValueChange={(v) => setRatio(v as VideoRatio)} disabled={cooldown}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (横屏)</SelectItem>
                      <SelectItem value="9:16">9:16 (竖屏)</SelectItem>
                      <SelectItem value="1:1">1:1 (方形)</SelectItem>
                      <SelectItem value="4:3">4:3</SelectItem>
                      <SelectItem value="3:4">3:4</SelectItem>
                      <SelectItem value="21:9">21:9 (超宽)</SelectItem>
                      {activeMode === 'text' && (
                        <SelectItem value="adaptive">自适应</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>生成音频</Label>
                    <p className="text-xs text-muted-foreground">自动生成配音和背景音乐</p>
                  </div>
                  <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={cooldown} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>添加水印</Label>
                    <p className="text-xs text-muted-foreground">在视频中添加水印</p>
                  </div>
                  <Switch checked={watermark} onCheckedChange={setWatermark} disabled={cooldown} />
                </div>
              </CardContent>
            </Card>

            {/* 历史记录（可折叠） */}
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setHistoryCollapsed(!historyCollapsed)}>
                <CardTitle className="flex items-center justify-between">
                  <span>生成历史</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${historyCollapsed ? '' : 'rotate-180'}`} />
                </CardTitle>
              </CardHeader>
              {!historyCollapsed && (
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">暂无生成记录</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {history.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant={
                              item.status === 'completed' ? 'default' :
                              item.status === 'processing' ? 'secondary' :
                              item.status === 'failed' ? 'destructive' : 'outline'
                            }>
                              {item.status === 'completed' ? '已完成' :
                               item.status === 'processing' ? '处理中' :
                               item.status === 'failed' ? '失败' : '等待中'}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteHistory(item.id)}
                                disabled={deletingIds.has(item.id)}
                              >
                                {deletingIds.has(item.id) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm line-clamp-2">{item.prompt}</p>
                          {/* 模型信息 */}
                          {item.model && (
                            <div className="flex items-center gap-1 mt-2">
                              <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded">
                                {getModelName(item.model)}
                              </span>
                            </div>
                          )}
                          {item.result_url && (
                            <a 
                              href={item.result_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-primary hover:underline mt-2"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              查看视频
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
