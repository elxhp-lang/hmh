/**
 * 工作流进度反馈组件
 * 
 * 显示：
 * - 当前工作阶段
 * - 使用的模型
 * - 预计等待时间
 * - 进度条
 */

'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Video, 
  FileText, 
  Sparkles,
  Image as ImageIcon 
} from 'lucide-react';

interface WorkflowProgressProps {
  currentStep: number;
  currentModel: string;
  currentTask: string;
  percentage: number;
  estimatedTime: number;
}

const STEP_NAMES: Record<number, string> = {
  1: '初始化',
  2: '任务识别',
  3: '模型调用',
  4: '脚本生成',
  5: '脚本确认',
  6: '视频制作',
  7: '批量生成',
  8: '完成',
};

const MODEL_ICONS: Record<string, React.ReactNode> = {
  'doubao-seed-1-6-vision': <ImageIcon className="w-4 h-4" />,
  'doubao-seed-1-8': <FileText className="w-4 h-4" />,
  'Seedance 2.0': <Video className="w-4 h-4" />,
};

export function WorkflowProgress({
  currentStep,
  currentModel,
  currentTask,
  percentage,
  estimatedTime,
}: WorkflowProgressProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds > 0 ? remainingSeconds + '秒' : ''}`;
  };

  const getStepIcon = () => {
    if (currentStep === 6) return <Video className="w-4 h-4" />;
    if (currentStep === 3 || currentStep === 4) return <FileText className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
  };

  const getModelIcon = () => {
    return MODEL_ICONS[currentModel] || <Sparkles className="w-4 h-4" />;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStepIcon()}
          <span className="font-medium text-sm">正在进行：{STEP_NAMES[currentStep]}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          步骤 {currentStep}/8
        </Badge>
      </div>

      {/* 当前任务 */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>{currentTask}</span>
      </div>

      {/* 模型信息 */}
      {currentModel && (
        <div className="flex items-center gap-2 text-sm">
          {getModelIcon()}
          <span className="text-muted-foreground">模型：</span>
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
            {currentModel}
          </span>
        </div>
      )}

      {/* 进度条 */}
      <div className="space-y-1">
        <Progress value={percentage} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{percentage}%</span>
          {estimatedTime > 0 && (
            <span>预计还需 {formatTime(estimatedTime)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 步骤指示器组件
 */
export function WorkflowSteps({ currentStep }: { currentStep: number }) {
  const steps = [
    { step: 1, name: '唤醒' },
    { step: 2, name: '识别' },
    { step: 3, name: '分析' },
    { step: 4, name: '脚本' },
    { step: 5, name: '确认' },
    { step: 6, name: '视频' },
    { step: 7, name: '批量' },
    { step: 8, name: '完成' },
  ];

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((s, index) => (
        <React.Fragment key={s.step}>
          {/* 步骤圆点 */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                s.step < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : s.step === currentStep
                  ? 'bg-primary/20 text-primary border-2 border-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s.step < currentStep ? '✓' : s.step}
            </div>
            <span className="text-xs text-muted-foreground">{s.name}</span>
          </div>

          {/* 连接线 */}
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 transition-colors ${
                s.step < currentStep ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
