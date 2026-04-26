/**
 * 多工作流切换组件
 * 
 * 功能：
 * - 显示当前工作流
 * - 显示暂停的工作流列表
 * - 支持切换工作流
 * - 支持暂停当前工作流
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pause, Play, CheckCircle2, Clock, RotateCcw } from 'lucide-react';

interface Workflow {
  id: string;
  product?: string;
  currentStep: number;
  status: 'active' | 'paused' | 'completed';
  generatedVideos: string[];
  createdAt: string;
}

interface WorkflowSwitcherProps {
  currentWorkflow: Workflow | null;
  pausedWorkflows: Workflow[];
  onPauseCurrent: () => void;
  onResumeWorkflow: (workflowId: string) => void;
}

export function WorkflowSwitcher({
  currentWorkflow,
  pausedWorkflows,
  onPauseCurrent,
  onResumeWorkflow,
}: WorkflowSwitcherProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4 text-primary" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return '进行中';
      case 'paused':
        return '已暂停';
      case 'completed':
        return '已完成';
      default:
        return '未知';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="w-4 h-4 mr-1" />
          切换工作流
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>工作流管理</DialogTitle>
          <DialogDescription>
            查看和切换不同的工作流任务
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 当前工作流 */}
          {currentWorkflow && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-primary" />
                    <span>当前工作流</span>
                  </div>
                  <Badge variant="default">{getStatusText(currentWorkflow.status)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">产品</span>
                  <span className="font-medium">{currentWorkflow.product || '未命名'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">步骤</span>
                  <span>{currentWorkflow.currentStep}/8</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">已生成视频</span>
                  <span>{currentWorkflow.generatedVideos.length}个</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{formatDate(currentWorkflow.createdAt)}</span>
                </div>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onPauseCurrent}
                >
                  <Pause className="w-4 h-4 mr-1" />
                  暂停当前工作流
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 暂停的工作流 */}
          {pausedWorkflows.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                暂停的工作流 ({pausedWorkflows.length})
              </h3>
              {pausedWorkflows.map((workflow) => (
                <Card key={workflow.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(workflow.status)}
                        <span className="font-medium">
                          {workflow.product || '未命名'}
                        </span>
                      </div>
                      <Badge variant="outline">{getStatusText(workflow.status)}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>步骤 {workflow.currentStep}/8</span>
                      <span>{workflow.generatedVideos.length}个视频</span>
                      <span>{formatDate(workflow.createdAt)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onResumeWorkflow(workflow.id)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      恢复此工作流
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!currentWorkflow && pausedWorkflows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无工作流</p>
              <p className="text-sm">创建新任务后，工作流会显示在这里</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
