/**
 * 脚本表格展示组件
 * 
 * 专业表格形式展示脚本：
 * - 时间（3秒维度）
 * - 画面内容
 * - 台词/文案
 * - 备注（人物、动作、风格）
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, X, Clock, Image, Mic, User } from 'lucide-react';

interface ScriptScene {
  time: string;
  visual: string;
  character: string;
  action: string;
  voiceover: string;
  style: string;
}

interface Script {
  id: string;
  scenes: ScriptScene[];
  style: string;
  duration: number;
  product?: string;
}

interface ScriptTableProps {
  script: Script;
  index: number;
  isSelected?: boolean;
  onSelect?: () => void;
  showActions?: boolean;
}

export function ScriptTable({
  script,
  index,
  isSelected,
  onSelect,
  showActions = true,
}: ScriptTableProps) {
  return (
    <Card
      className={`transition-all ${
        isSelected
          ? 'ring-2 ring-primary shadow-lg'
          : 'hover:shadow-md'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">脚本方案 {index + 1}</CardTitle>
            <Badge variant="outline">{script.duration}秒</Badge>
          </div>
          {script.product && (
            <Badge variant="secondary">{script.product}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 脚本表格 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16 text-center font-medium">
                  <Clock className="w-4 h-4 inline mr-1" />
                  时间
                </TableHead>
                <TableHead className="font-medium">
                  <Image className="w-4 h-4 inline mr-1" />
                  画面内容
                </TableHead>
                <TableHead className="font-medium">
                  <Mic className="w-4 h-4 inline mr-1" />
                  台词/文案
                </TableHead>
                <TableHead className="font-medium">
                  <User className="w-4 h-4 inline mr-1" />
                  备注
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {script.scenes.map((scene, sceneIndex) => (
                <TableRow key={sceneIndex}>
                  <TableCell className="text-center font-mono text-sm">
                    {scene.time}
                  </TableCell>
                  <TableCell className="text-sm">
                    {scene.visual}
                    {scene.style && (
                      <div className="text-xs text-muted-foreground mt-1">
                        风格：{scene.style}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {scene.voiceover || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {scene.character && (
                      <div className="mb-1">
                        <span className="text-xs text-muted-foreground">人物：</span>
                        {scene.character}
                      </div>
                    )}
                    {scene.action && (
                      <div>
                        <span className="text-xs text-muted-foreground">动作：</span>
                        {scene.action}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 操作按钮 */}
        {showActions && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={onSelect}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              className="flex items-center gap-1"
            >
              {isSelected ? (
                <>
                  <Check className="w-4 h-4" />
                  已选择
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  选择此脚本
                </>
              )}
            </Button>
            <Button variant="ghost" size="sm">
              查看详情
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 多脚本展示组件
 */
interface ScriptListProps {
  scripts: Script[];
  selectedIndex?: number;
  onSelect: (index: number) => void;
}

export function ScriptList({ scripts, selectedIndex, onSelect }: ScriptListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">生成脚本方案</h3>
        <p className="text-sm text-muted-foreground">
          已生成 {scripts.length} 个脚本供选择
        </p>
      </div>

      <div className="grid gap-4">
        {scripts.map((script, index) => (
          <ScriptTable
            key={script.id}
            script={script}
            index={index}
            isSelected={selectedIndex === index}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 参考脚本展示组件
 */
interface ReferenceScriptProps {
  script: Script;
  onModify?: () => void;
  onKeep?: () => void;
}

export function ReferenceScript({ script, onModify, onKeep }: ReferenceScriptProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">参考脚本（视频分析结果）</CardTitle>
          <Badge variant="outline">{script.style}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ScriptTable script={script} index={0} showActions={false} />

        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={onKeep} variant="default" size="sm">
            保持脚本不变
          </Button>
          <Button onClick={onModify} variant="outline" size="sm">
            微调二创
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
