'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Crown,
  Bot,
  CheckCircle2,
  XCircle,
  Sparkles,
  Brain,
  Info,
} from 'lucide-react';

// ========== 类型定义 ==========

export interface CompareResult {
  mode: 'learning' | 'compare' | 'independent';
  profile: {
    overall: number;
    level: string;
  };
  master?: {
    output: string;
    context: string;
  };
  agent?: {
    output: string;
    context: string;
  };
  message: string;
}

interface CompareModePanelProps {
  result: CompareResult;
  onSelect: (choice: 'master' | 'agent' | 'both' | 'neither') => void;
  isSelecting?: boolean;
}

// ========== 主组件 ==========

export function CompareModePanel({ result, onSelect, isSelecting }: CompareModePanelProps) {
  const [selectedVersion, setSelectedVersion] = useState<'master' | 'agent' | null>(null);
  const [showContext, setShowContext] = useState(false);

  const getModeInfo = () => {
    switch (result.mode) {
      case 'learning':
        return {
          title: '学习模式',
          description: '智能体正在观察大师的输出',
          color: 'text-orange-500',
          bgColor: 'bg-orange-50',
        };
      case 'compare':
        return {
          title: '对比模式',
          description: '请选择更好的版本，帮助智能体学习',
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
        };
      case 'independent':
        return {
          title: '独立模式',
          description: '智能体已成长，可以独立完成任务',
          color: 'text-green-500',
          bgColor: 'bg-green-50',
        };
    }
  };

  const modeInfo = getModeInfo();
  const levelInfo = getLevelInfo(result.profile.level);

  return (
    <div className="space-y-4">
      {/* 模式状态栏 */}
      <Card className={`${modeInfo.bgColor} border-0`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className={`w-6 h-6 ${modeInfo.color}`} />
              <div>
                <div className="font-medium">{modeInfo.title}</div>
                <div className="text-sm text-muted-foreground">{modeInfo.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={levelInfo.color}>
                {levelInfo.text}
              </Badge>
              <span className="text-lg font-bold">{result.profile.overall.toFixed(0)}分</span>
            </div>
          </div>
          <Progress value={result.profile.overall} className="h-2 mt-3" />
        </CardContent>
      </Card>

      {/* 学习模式：只显示大师输出 */}
      {result.mode === 'learning' && result.master && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <CardTitle className="text-lg">大师输出</CardTitle>
              <Badge variant="outline" className="ml-auto">学习中</Badge>
            </div>
            <CardDescription>智能体正在观察这个输出</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded border p-4 bg-muted/30">
              <div className="whitespace-pre-wrap text-sm">{result.master.output}</div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 对比模式：显示两个版本 */}
      {result.mode === 'compare' && result.master && result.agent && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 大师版本 */}
          <Card className={`relative ${selectedVersion === 'master' ? 'ring-2 ring-amber-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <CardTitle className="text-lg">大师版本</CardTitle>
              </div>
              <CardDescription>标准输出（无学习库参考）</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] w-full rounded border p-3 bg-muted/30">
                <div className="whitespace-pre-wrap text-sm">{result.master.output}</div>
              </ScrollArea>
              <Button
                className="w-full mt-3"
                variant={selectedVersion === 'master' ? 'default' : 'outline'}
                onClick={() => setSelectedVersion('master')}
                disabled={isSelecting}
              >
                {selectedVersion === 'master' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    已选择
                  </>
                ) : (
                  '选择这个版本'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 智能体版本 */}
          <Card className={`relative ${selectedVersion === 'agent' ? 'ring-2 ring-blue-500' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">智能体版本</CardTitle>
                <Badge variant="secondary" className="text-xs">学习库增强</Badge>
              </div>
              <CardDescription>个性化输出（参考学习库和用户偏好）</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] w-full rounded border p-3 bg-muted/30">
                <div className="whitespace-pre-wrap text-sm">{result.agent.output}</div>
              </ScrollArea>
              <Button
                className="w-full mt-3"
                variant={selectedVersion === 'agent' ? 'default' : 'outline'}
                onClick={() => setSelectedVersion('agent')}
                disabled={isSelecting}
              >
                {selectedVersion === 'agent' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    已选择
                  </>
                ) : (
                  '选择这个版本'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 独立模式：只显示智能体输出 */}
      {result.mode === 'independent' && result.agent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-green-500" />
              <CardTitle className="text-lg">智能体输出</CardTitle>
              <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700">独立执行</Badge>
            </div>
            <CardDescription>智能体已成长为专家，可以独立完成任务</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded border p-4 bg-muted/30">
              <div className="whitespace-pre-wrap text-sm">{result.agent.output}</div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      {result.mode === 'compare' && (
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            onClick={() => onSelect('both')}
            disabled={!selectedVersion && true}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            两个都好
          </Button>
          <Button
            variant="outline"
            onClick={() => onSelect('neither')}
          >
            <XCircle className="w-4 h-4 mr-2" />
            都不满意
          </Button>
          {selectedVersion && (
            <Button onClick={() => onSelect(selectedVersion)}>
              <Sparkles className="w-4 h-4 mr-2" />
              确认选择
            </Button>
          )}
        </div>
      )}

      {/* 查看上下文按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => setShowContext(true)}
      >
        <Info className="w-4 h-4 mr-2" />
        查看执行上下文
      </Button>

      {/* 上下文详情对话框 */}
      <Dialog open={showContext} onOpenChange={setShowContext}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>执行上下文</DialogTitle>
            <DialogDescription>
              了解智能体是如何学习和生成输出的
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {result.master && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  大师上下文
                </h4>
                <div className="p-3 rounded bg-muted text-sm whitespace-pre-wrap">
                  {result.master.context}
                </div>
              </div>
            )}
            {result.agent && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  智能体上下文
                </h4>
                <div className="p-3 rounded bg-muted text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {result.agent.context}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ========== 辅助函数 ==========

function getLevelInfo(level: string) {
  const levels: Record<string, { text: string; color: string }> = {
    master: { text: '大师', color: 'bg-yellow-100 text-yellow-700' },
    expert: { text: '专家', color: 'bg-purple-100 text-purple-700' },
    skilled: { text: '熟练', color: 'bg-blue-100 text-blue-700' },
    apprentice: { text: '学徒', color: 'bg-green-100 text-green-700' },
    novice: { text: '新手', color: 'bg-gray-100 text-gray-700' },
  };
  return levels[level] || levels.novice;
}

export default CompareModePanel;
