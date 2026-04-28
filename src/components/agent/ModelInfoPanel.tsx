'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Cpu,
  Sparkles,
  Video,
  Image as ImageIcon,
  FileText,
  Lightbulb,
  ChevronRight,
  TrendingUp,
  Clock,
  Star,
  Zap,
  Users,
  Bot,
  Award,
  Target,
  Lightbulb as IdeaIcon,
} from 'lucide-react';
import { TASK_MODEL_MAPPINGS, type TaskModelMapping, type ModelInfo } from '@/lib/model-config';

// ========== 类型定义 ==========

interface AbilityProfile {
  overall: number;
  level: string;
  dimensions: {
    completeness: number;
    accuracy: number;
    creativity: number;
    practicality: number;
    efficiency: number;
  };
  trend: string;
}

// ========== 主组件：模型信息徽章（用于页面头部） ==========

export function ModelInfoBadge() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<AbilityProfile | null>(null);

  const loadAbilityProfile = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch('/api/agent/ability?agent_type=creative_agent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
      }
    } catch (error) {
      console.error('加载能力档案失败:', error);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadAbilityProfile();
    }
  }, [token, loadAbilityProfile]);

  const getLevelInfo = (level: string) => {
    const levels: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
      master: { text: '大师', color: 'text-yellow-500', icon: <Award className="w-3 h-3" /> },
      expert: { text: '专家', color: 'text-purple-500', icon: <Star className="w-3 h-3" /> },
      skilled: { text: '熟练', color: 'text-blue-500', icon: <Target className="w-3 h-3" /> },
      apprentice: { text: '学徒', color: 'text-green-500', icon: <Lightbulb className="w-3 h-3" /> },
      novice: { text: '新手', color: 'text-gray-500', icon: <IdeaIcon className="w-3 h-3" /> },
    };
    return levels[level] || levels.novice;
  };

  const levelInfo = profile ? getLevelInfo(profile.level) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8">
          <Cpu className="w-4 h-4" />
          <span className="hidden sm:inline">AI 模型</span>
          {profile && (
            <>
              <span className={`hidden md:inline ${levelInfo?.color}`}>
                {levelInfo?.icon}
              </span>
              <span className="hidden md:inline text-xs text-muted-foreground">
                {profile.overall.toFixed(0)}分
              </span>
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" />
            AI 模型与能力
          </DialogTitle>
          <DialogDescription>
            查看系统使用的AI模型和智能体能力评分
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="models" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="models">AI 模型</TabsTrigger>
            <TabsTrigger value="ability">智能体能力</TabsTrigger>
          </TabsList>
          
          <TabsContent value="models" className="mt-4">
            <ModelsTab />
          </TabsContent>
          
          <TabsContent value="ability" className="mt-4">
            <AbilityTab profile={profile} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ========== 模型标签页 ==========

function ModelsTab() {
  const dualLayerTasks = TASK_MODEL_MAPPINGS.filter(t => t.supportsDualLayer);
  const directTasks = TASK_MODEL_MAPPINGS.filter(t => !t.supportsDualLayer);

  return (
    <div className="space-y-6">
      {/* 双层能力系统说明 */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          双层能力系统
        </h4>
        <p className="text-sm text-muted-foreground mb-3">
          智能体通过「观察大模型 → 对比学习 → 独立执行」三阶段提升能力。
          学习型任务支持双层系统，智能体会逐步学习提升。
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-background/50 border">
            <div className="font-medium text-orange-600">学习模式</div>
            <div className="text-muted-foreground">评分 &lt; 60</div>
          </div>
          <div className="p-2 rounded bg-background/50 border">
            <div className="font-medium text-blue-600">对比模式</div>
            <div className="text-muted-foreground">评分 60-85</div>
          </div>
          <div className="p-2 rounded bg-background/50 border">
            <div className="font-medium text-green-600">独立模式</div>
            <div className="text-muted-foreground">评分 &gt; 85</div>
          </div>
        </div>
      </div>

      {/* 学习型任务 */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500" />
          学习型任务
          <Badge variant="secondary" className="text-xs font-normal">智能体可提升</Badge>
        </h4>
        <div className="space-y-3">
          {dualLayerTasks.map((task) => (
            <TaskModelCardV2 key={task.taskType} task={task} />
          ))}
        </div>
      </div>

      {/* 工具型任务 */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          工具型任务
          <Badge variant="outline" className="text-xs font-normal">直接调用API</Badge>
        </h4>
        <div className="space-y-3">
          {directTasks.map((task) => (
            <TaskModelCardV2 key={task.taskType} task={task} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 能力标签页 ==========

function AbilityTab({ profile }: { profile: AbilityProfile | null }) {
  if (!profile) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>开始使用后将建立能力档案</p>
        <p className="text-sm mt-1">智能体会通过学习不断提升能力评分</p>
      </div>
    );
  }

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'master':
        return { bg: 'bg-gradient-to-r from-yellow-500 to-amber-500', text: '大师', desc: '可教导其他智能体' };
      case 'expert':
        return { bg: 'bg-gradient-to-r from-purple-500 to-violet-500', text: '专家', desc: '可独立执行，定期抽查' };
      case 'skilled':
        return { bg: 'bg-gradient-to-r from-blue-500 to-cyan-500', text: '熟练', desc: '可独立执行，需对比验证' };
      case 'apprentice':
        return { bg: 'bg-gradient-to-r from-green-500 to-emerald-500', text: '学徒', desc: '偶尔尝试，大模型审核' };
      default:
        return { bg: 'bg-gradient-to-r from-gray-500 to-slate-500', text: '新手', desc: '主要观察大模型执行' };
    }
  };

  const levelStyle = getLevelStyle(profile.level);

  return (
    <div className="space-y-6">
      {/* 综合评分卡片 */}
      <Card className="overflow-hidden">
        <div className={`h-2 ${levelStyle.bg}`} />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">当前等级</div>
              <div className="text-2xl font-bold">{levelStyle.text}</div>
              <div className="text-xs text-muted-foreground mt-1">{levelStyle.desc}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">综合评分</div>
              <div className="text-4xl font-bold text-primary">{profile.overall.toFixed(1)}</div>
              {profile.trend === 'improving' && (
                <div className="flex items-center justify-end gap-1 text-green-500 text-sm mt-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>正在提升</span>
                </div>
              )}
            </div>
          </div>
          
          <Progress value={profile.overall} className="h-3" />
          
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0</span>
            <span className="text-green-600">60 (对比模式)</span>
            <span className="text-blue-600">85 (独立模式)</span>
            <span>100</span>
          </div>
        </CardContent>
      </Card>

      {/* 维度评分 */}
      <div>
        <h4 className="font-medium mb-3">能力维度分析</h4>
        <div className="space-y-3">
          {[
            { key: 'completeness', label: '完整性', desc: '输出是否包含所有必要元素', icon: FileText },
            { key: 'accuracy', label: '准确性', desc: '内容是否符合用户需求', icon: Target },
            { key: 'creativity', label: '创意性', desc: '是否有创新点或亮点', icon: Lightbulb },
            { key: 'practicality', label: '实用性', desc: '是否可直接使用', icon: Zap },
            { key: 'efficiency', label: '效率', desc: '执行速度和资源消耗', icon: Clock },
          ].map(({ key, label, desc, icon: Icon }) => {
            const score = (profile.dimensions as Record<string, number>)[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm font-bold">{score}</span>
                  </div>
                  <Progress value={score} className="h-2" />
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 提升建议 */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <IdeaIcon className="w-4 h-4 text-yellow-500" />
            提升建议
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {profile.dimensions.creativity < 70 && (
              <li>• 多学习创意类视频脚本，提升创意能力</li>
            )}
            {profile.dimensions.accuracy < 70 && (
              <li>• 注意理解用户需求细节，提高准确性</li>
            )}
            {profile.overall < 60 && (
              <li>• 当前处于学习模式，建议多观察大模型执行</li>
            )}
            {profile.overall >= 60 && profile.overall < 85 && (
              <li>• 已进入对比模式，可在对比中学习提升</li>
            )}
            {profile.overall >= 85 && (
              <li>• 已达独立模式，继续保持学习提升</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 改进版任务模型卡片 ==========

function TaskModelCardV2({ task }: { task: TaskModelMapping }) {
  const [expanded, setExpanded] = useState(false);
  
  const getTaskIcon = (taskType: string) => {
    switch (taskType) {
      case 'script_generation': return <FileText className="w-4 h-4" />;
      case 'video_analysis': return <Video className="w-4 h-4" />;
      case 'prompt_optimization': return <Sparkles className="w-4 h-4" />;
      case 'first_frame_generation': return <ImageIcon className="w-4 h-4" />;
      case 'creative_suggestion': return <Lightbulb className="w-4 h-4" />;
      case 'video_generation': return <Video className="w-4 h-4" />;
      case 'video_extension': return <ChevronRight className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  const masterModel = task.models.master;
  const agentModel = task.models.agent;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* 任务头部 */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-2 rounded bg-primary/10 text-primary">
          {getTaskIcon(task.taskType)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{task.taskName}</span>
            {task.supportsDualLayer && (
              <Badge variant="secondary" className="text-xs">可学习</Badge>
            )}
            {!task.supportsDualLayer && (
              <Badge variant="outline" className="text-xs">直接调用</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">{task.description}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          {expanded ? '收起' : '展开'}
        </div>
      </div>
      
      {/* 展开的模型详情 */}
      {expanded && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          {/* 大模型（大师） */}
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">大模型</span>
            </div>
            <div className="flex-1">
              <ModelDetailCard model={masterModel} isMaster />
            </div>
          </div>
          
          {/* 智能体（如果支持双层） */}
          {task.supportsDualLayer && agentModel && (
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-1.5 text-blue-600">
                <Bot className="w-4 h-4" />
                <span className="text-xs font-medium">智能体</span>
              </div>
              <div className="flex-1">
                <ModelDetailCard model={agentModel} isMaster={false} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== 模型详情卡片 ==========

function ModelDetailCard({ model, isMaster }: { model: ModelInfo; isMaster: boolean }) {
  const getSpeedText = (speed?: string) => {
    switch (speed) {
      case 'fast': return { text: '快速', color: 'text-green-600' };
      case 'slow': return { text: '深度', color: 'text-orange-600' };
      default: return { text: '标准', color: 'text-blue-600' };
    }
  };

  const getQualityText = (quality?: string) => {
    switch (quality) {
      case 'ultra': return { text: '超清', color: 'text-purple-600' };
      case 'high': return { text: '高清', color: 'text-green-600' };
      default: return { text: '标准', color: 'text-blue-600' };
    }
  };

  const speedInfo = getSpeedText(model.speed);
  const qualityInfo = getQualityText(model.quality);

  return (
    <div className={`p-2.5 rounded border ${isMaster ? 'bg-amber-50/50 border-amber-200/50' : 'bg-blue-50/50 border-blue-200/50'}`}>
      {/* 模型名称和基本信息 */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{model.name}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className={speedInfo.color}>{speedInfo.text}</span>
          <span className="text-muted-foreground">·</span>
          <span className={qualityInfo.color}>{qualityInfo.text}</span>
        </div>
      </div>
      
      {/* 模型ID（技术信息） */}
      <div className="text-xs text-muted-foreground mb-2 font-mono bg-muted/50 px-1.5 py-0.5 rounded inline-block">
        {model.id}
      </div>
      
      {/* 提供商 */}
      <div className="text-xs text-muted-foreground mb-2">
        提供商：{model.provider}
      </div>
      
      {/* 描述 */}
      <div className="text-xs text-muted-foreground mb-2">
        {model.description}
      </div>
      
      {/* 能力标签 */}
      <div className="flex flex-wrap gap-1">
        {model.capabilities.map((cap, i) => (
          <Badge key={i} variant="outline" className="text-[10px] h-5">
            {cap}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ========== 完整面板组件（用于侧边栏等） ==========

export function ModelInfoPanel({ className }: { className?: string }) {
  return (
    <div className={className}>
      <ModelInfoBadge />
    </div>
  );
}

export default ModelInfoBadge;
