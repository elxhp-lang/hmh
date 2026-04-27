'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles,
  Clock,
  History,
  FolderOpen,
  Settings2,
  Video,
  Image as ImageIcon,
  Trash2,
  Edit3,
  Plus,
  ChevronRight,
  LayoutGrid,
  Palette,
  Wand2,
  ListChecks
} from 'lucide-react';

// ========== 类型定义 ==========

export interface CreationOption {
  aspectRatio: '9:16' | '16:9' | '1:1';
  duration: number;
  style: 'talking' | 'showcase' | 'drama';
}

export interface TemplateItem {
  id: string;
  name: string;
  thumbnail?: string;
  usageCount: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  thumbnail?: string;
  status: 'completed' | 'processing';
  createdAt: Date;
}

export interface MaterialItem {
  id: string;
  name: string;
  type: 'video' | 'image';
  thumbnail?: string;
  createdAt: Date;
}

export interface WorkerTaskItem {
  id: string;
  task_type?: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number;
  error_message?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RightSidebarProps {
  className?: string;
  creationOptions?: CreationOption;
  onCreationOptionsChange?: (options: CreationOption) => void;
  templates?: TemplateItem[];
  onTemplateSelect?: (template: TemplateItem) => void;
  history?: HistoryItem[];
  onHistorySelect?: (item: HistoryItem) => void;
  materials?: MaterialItem[];
  onMaterialDelete?: (id: string) => void;
  onMaterialEdit?: (id: string) => void;
  tasks?: WorkerTaskItem[];
  onTaskRetry?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
  onTaskOpen?: (taskId: string) => void;
}

// ========== 预设标签组件 ==========

interface PresetTagsProps {
  onSelect?: (tag: string) => void;
}

function PresetTags({ onSelect }: PresetTagsProps) {
  const tags = [
    { label: '美妆带货', icon: '💄' },
    { label: '美食种草', icon: '🍜' },
    { label: '数码测评', icon: '📱' },
    { label: '服装展示', icon: '👗' },
    { label: '知识科普', icon: '📚' },
    { label: '剧情演绎', icon: '🎭' }
  ];
  
  return (
    <div className="grid grid-cols-2 gap-2">
      {tags.map((tag) => (
        <button
          key={tag.label}
          onClick={() => onSelect?.(tag.label)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
        >
          <span>{tag.icon}</span>
          <span>{tag.label}</span>
        </button>
      ))}
    </div>
  );
}

// ========== 创作选项配置 ==========

interface CreationOptionsProps {
  options: CreationOption;
  onChange: (options: CreationOption) => void;
}

function CreationOptions({ options, onChange }: CreationOptionsProps) {
  const aspectRatios = [
    { value: '9:16', label: '竖屏', icon: '📱' },
    { value: '16:9', label: '横屏', icon: '🖥️' },
    { value: '1:1', label: '方形', icon: '⬜' }
  ] as const;
  
  const durations = [3, 5, 7, 10];
  const styles = [
    { value: 'talking', label: '口播为主' },
    { value: 'showcase', label: '画面展示' },
    { value: 'drama', label: '剧情类' }
  ] as const;
  
  return (
    <div className="space-y-4">
      {/* 视频比例 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">视频比例</label>
        <div className="flex gap-2">
          {aspectRatios.map((ratio) => (
            <button
              key={ratio.value}
              onClick={() => onChange({ ...options, aspectRatio: ratio.value })}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded-lg border transition-colors',
                options.aspectRatio === ratio.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 hover:bg-muted border-transparent'
              )}
            >
              <span>{ratio.icon}</span>
              <span>{ratio.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* 时长 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">时长</label>
        <div className="flex gap-2">
          {durations.map((duration) => (
            <button
              key={duration}
              onClick={() => onChange({ ...options, duration })}
              className={cn(
                'flex-1 px-2 py-2 text-xs rounded-lg border transition-colors',
                options.duration === duration
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 hover:bg-muted border-transparent'
              )}
            >
              {duration}秒
            </button>
          ))}
        </div>
      </div>
      
      {/* 风格偏好 */}
      <div>
        <label className="text-xs text-muted-foreground mb-2 block">风格</label>
        <div className="flex flex-wrap gap-2">
          {styles.map((style) => (
            <button
              key={style.value}
              onClick={() => onChange({ ...options, style: style.value })}
              className={cn(
                'px-3 py-1.5 text-xs rounded-full border transition-colors',
                options.style === style.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 hover:bg-muted border-transparent'
              )}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 模板选择 ==========

interface TemplateSelectorProps {
  templates: TemplateItem[];
  onSelect: (template: TemplateItem) => void;
}

function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <LayoutGrid className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无保存的模板</p>
        <Button variant="link" size="sm" className="mt-2">
          <Plus className="w-4 h-4 mr-1" />
          创建模板
        </Button>
      </div>
    );
  }
  
  return (
    <div className="grid gap-3">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template)}
          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
            {template.thumbnail ? (
              <img src={template.thumbnail} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{template.name}</p>
            <p className="text-xs text-muted-foreground">
              使用 {template.usageCount} 次
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

// ========== 历史任务 ==========

interface HistoryListProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
}

function HistoryList({ items, onSelect }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无创作历史</p>
      </div>
    );
  }
  
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };
  
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 relative">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className="w-full h-full object-cover rounded" />
            ) : (
              <Video className="w-4 h-4 text-muted-foreground" />
            )}
            {item.status === 'processing' && (
              <div className="absolute inset-0 bg-background/50 rounded flex items-center justify-center">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground">{formatTime(item.createdAt)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ========== 素材管理 ==========

interface MaterialManagerProps {
  materials: MaterialItem[];
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

function MaterialManager({ materials, onDelete, onEdit }: MaterialManagerProps) {
  const [filter, setFilter] = useState<'all' | 'video' | 'image'>('all');
  
  const filteredMaterials = filter === 'all' 
    ? materials 
    : materials.filter(m => m.type === filter);
  
  return (
    <div className="space-y-3">
      {/* 筛选器 */}
      <div className="flex gap-2">
        {(['all', 'video', 'image'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 text-xs rounded-full transition-colors',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted'
            )}
          >
            {f === 'all' ? '全部' : f === 'video' ? '视频' : '图片'}
          </button>
        ))}
      </div>
      
      {/* 素材列表 */}
      {filteredMaterials.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>暂无素材</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {filteredMaterials.map((material) => (
            <div 
              key={material.id}
              className="group relative rounded-lg border overflow-hidden"
            >
              <div className="aspect-square bg-muted">
                {material.thumbnail ? (
                  <img 
                    src={material.thumbnail} 
                    alt="" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {material.type === 'video' ? (
                      <Video className="w-6 h-6 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
              <p className="p-2 text-xs truncate">{material.name}</p>
              
              {/* 悬停操作 */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  onClick={() => onEdit(material.id)}
                >
                  <Edit3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={() => onDelete(material.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRail({
  tasks,
  onRetry,
  onCancel,
  onOpen,
}: {
  tasks: WorkerTaskItem[];
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onOpen: (taskId: string) => void;
}) {
  if (!tasks.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>暂无任务记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 12).map((task) => (
        <div key={task.id} className="rounded-lg border p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium truncate">{task.task_type || 'creative_chat'}</p>
            <Badge variant={task.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">
              {task.status}
            </Badge>
          </div>
          <div className="h-1.5 w-full rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(task.progress || 0, 100))}%` }} />
          </div>
          {task.error_message ? (
            <p className="text-[11px] text-destructive line-clamp-2">{task.error_message}</p>
          ) : (
            <p className="text-[11px] text-muted-foreground line-clamp-1">{task.id.slice(0, 12)}</p>
          )}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onOpen(task.id)}>
              查看
            </Button>
            {task.status === 'failed' || task.status === 'cancelled' ? (
              <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2" onClick={() => onRetry(task.id)}>
                重试
              </Button>
            ) : null}
            {task.status === 'queued' || task.status === 'running' ? (
              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onCancel(task.id)}>
                取消
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========== 主组件 ==========

export function RightSidebar({
  className,
  creationOptions,
  onCreationOptionsChange,
  templates = [],
  onTemplateSelect,
  history = [],
  onHistorySelect,
  materials = [],
  onMaterialDelete,
  onMaterialEdit,
  tasks = [],
  onTaskRetry,
  onTaskCancel,
  onTaskOpen,
}: RightSidebarProps) {
  const [options, setOptions] = useState<CreationOption>(
    creationOptions || {
      aspectRatio: '9:16',
      duration: 5,
      style: 'talking'
    }
  );
  
  const handleOptionsChange = (newOptions: CreationOption) => {
    setOptions(newOptions);
    onCreationOptionsChange?.(newOptions);
  };
  
  return (
    <div className={cn('flex flex-col h-full', className)}>
      <Tabs defaultValue="options" className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="options" className="text-xs">
            <Wand2 className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs">
            <LayoutGrid className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs">
            <History className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">
            <FolderOpen className="w-4 h-4" />
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">
            <ListChecks className="w-4 h-4" />
          </TabsTrigger>
        </TabsList>
        
        <ScrollArea className="flex-1 mt-4">
          {/* 创作选项 */}
          <TabsContent value="options" className="m-0 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  创作选项
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CreationOptions 
                  options={options} 
                  onChange={handleOptionsChange} 
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">快速开始</CardTitle>
              </CardHeader>
              <CardContent>
                <PresetTags />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 模板 */}
          <TabsContent value="templates" className="m-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">模板库</CardTitle>
                  <Button size="sm" variant="ghost">
                    <Plus className="w-4 h-4 mr-1" />
                    新建
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TemplateSelector 
                  templates={templates} 
                  onSelect={onTemplateSelect || (() => {})} 
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 历史 */}
          <TabsContent value="history" className="m-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">最近创作</CardTitle>
                  {history.length > 0 && (
                    <Button size="sm" variant="ghost">
                      清空
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <HistoryList 
                  items={history} 
                  onSelect={onHistorySelect || (() => {})} 
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 素材 */}
          <TabsContent value="materials" className="m-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">素材管理</CardTitle>
                  <Button size="sm" variant="ghost">
                    <Plus className="w-4 h-4 mr-1" />
                    上传
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialManager 
                  materials={materials}
                  onDelete={onMaterialDelete || (() => {})}
                  onEdit={onMaterialEdit || (() => {})}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="m-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">后台任务</CardTitle>
              </CardHeader>
              <CardContent>
                <TaskRail
                  tasks={tasks}
                  onRetry={onTaskRetry || (() => {})}
                  onCancel={onTaskCancel || (() => {})}
                  onOpen={onTaskOpen || (() => {})}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
