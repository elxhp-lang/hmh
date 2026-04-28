'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { streamAgentRequest } from '@/lib/api';
import { SSEEvent, MessagePart, getToolResultData } from '@/lib/agent-sse';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Sparkles, 
  Loader2, 
  Download, 
  Layers, 
  Eye,
  Bell,
  X,
  Bug,
  Save,
  Trash2,
  Search,
  Square
} from 'lucide-react';

// 新组件
import { MessageGroup } from '@/components/agent/MessageBubble';
import { HybridInput, HybridInputAttachment } from '@/components/agent/HybridInput';

// ========== 调试日志系统 ==========
interface DebugLog {
  id: string;
  timestamp: Date;
  category: 'state' | 'sse' | 'api' | 'render' | 'error';
  action: string;
  detail: string;
}

interface HistoryVideoRow {
  id: string;
  prompt?: string;
  public_video_url?: string;
  video_url?: string;
  result_url?: string;
  cover_url?: string;
  status?: string;
  created_at?: string;
}

interface LearningMaterialRow {
  id: string;
  title?: string;
  video_name?: string;
  video_type?: string;
  cover_url?: string;
  created_at?: string;
}

const DEBUG_LOGS: DebugLog[] = [];
const MAX_DEBUG_LOGS = 100;

const addDebugLog = (category: DebugLog['category'], action: string, detail: unknown) => {
  const log: DebugLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    category,
    action,
    detail: typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail)
  };
  DEBUG_LOGS.push(log);
  if (DEBUG_LOGS.length > MAX_DEBUG_LOGS) DEBUG_LOGS.shift();
  
  // 输出到控制台
  const prefix = {
    state: '🔵 [STATE]',
    sse: '🟢 [SSE]',
    api: '🟡 [API]',
    render: '🟣 [RENDER]',
    error: '🔴 [ERROR]'
  }[category];
  console.log(`${prefix} [${log.timestamp.toLocaleTimeString()}] ${action}`, detail);
};

// 调试面板组件
function DebugPanel({ logs, onClear, onExport }: { logs: DebugLog[]; onClear: () => void; onExport: () => void }) {
  const getCategoryColor = (cat: string) => {
    const colors = { state: 'text-blue-500', sse: 'text-green-500', api: 'text-yellow-500', render: 'text-purple-500', error: 'text-red-500' };
    return colors[cat as keyof typeof colors] || 'text-gray-500';
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 h-80 bg-black/95 text-white rounded-lg shadow-2xl border border-white/10 flex flex-col z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-green-400" />
          <span className="text-sm font-medium">调试日志</span>
          <Badge variant="outline" className="text-xs">{logs.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onExport}>
            <Save className="h-3 w-3 mr-1" />
            导出
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
            <Trash2 className="h-3 w-3 mr-1" />
            清空
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">暂无日志</p>
          ) : (
            logs.slice().reverse().map((log) => (
              <div key={log.id} className="text-xs p-2 bg-white/5 rounded hover:bg-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{log.timestamp.toLocaleTimeString()}</span>
                  <span className={`font-medium ${getCategoryColor(log.category)}`}>[{log.category.toUpperCase()}]</span>
                </div>
                <div className="text-gray-300 mt-1">{log.action}</div>
                {log.detail && (
                  <pre className="text-gray-400 mt-1 text-[10px] overflow-x-auto whitespace-pre-wrap max-h-20">
                    {typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
import { RightSidebar, CreationOption, TemplateItem, HistoryItem, MaterialItem, WorkerTaskItem } from '@/components/agent/RightSidebar';

// ========== 类型定义 ==========

interface VideoAnalysis {
  videoType?: string;
  videoStyle?: string;
  targetAudience?: string;
  emotionalTone?: string;
}

interface ScriptOption {
  id: string;
  title: string;
  description: string;
  content?: string;
}

interface ScriptTableRow {
  lens: string;
  visual: string;
  narration: string;
}

function normalizeScriptOptions(input: unknown): ScriptOption[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const content = typeof raw.content === 'string' ? raw.content : '';
      const description =
        typeof raw.description === 'string' && raw.description.trim()
          ? raw.description
          : content.slice(0, 80) || `脚本方案 ${index + 1}`;
      return {
        id:
          typeof raw.id === 'string' && raw.id.trim()
            ? raw.id
            : `script_${Date.now()}_${index}`,
        title:
          typeof raw.title === 'string' && raw.title.trim()
            ? raw.title
            : `脚本方案 ${index + 1}`,
        description,
        content,
      } as ScriptOption;
    })
    .filter((option): option is ScriptOption => !!option);
}

function extractMediaAttachments(content: string): {
  cleanedContent: string;
  attachments: Array<{ type: string; url: string; name?: string }>;
} {
  const imageRegex = /(https?:\/\/[^\s)]+?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s)]*)?)/gi;
  const videoRegex = /(https?:\/\/[^\s)]+?\.(?:mp4|webm|mov|m4v)(?:\?[^\s)]*)?)/gi;
  const imageMatches = Array.from(content.matchAll(imageRegex)).map((item) => item[1]).filter(Boolean);
  const videoMatches = Array.from(content.matchAll(videoRegex)).map((item) => item[1]).filter(Boolean);
  if (imageMatches.length === 0 && videoMatches.length === 0) {
    return { cleanedContent: content, attachments: [] };
  }

  const uniqueImages = Array.from(new Set(imageMatches));
  const uniqueVideos = Array.from(new Set(videoMatches));
  const cleaned = content
    .replace(imageRegex, '')
    .replace(videoRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const imageAttachments = uniqueImages.map((url, index) => ({
    type: 'image',
    url,
    name: `图片 ${index + 1}`,
  }));
  const videoAttachments = uniqueVideos.map((url, index) => ({
    type: 'video',
    url,
    name: `视频 ${index + 1}`,
  }));
  return {
    cleanedContent: cleaned || '已生成媒体内容，见下方预览',
    attachments: [...imageAttachments, ...videoAttachments],
  };
}

function removePartMediaUrls(content: string, parts: MessagePart[]): string {
  if (!content || !Array.isArray(parts) || parts.length === 0) return content;
  const mediaUrls = parts
    .filter((part): part is Extract<MessagePart, { type: 'image' | 'video' }> => part.type === 'image' || part.type === 'video')
    .map((part) => part.url)
    .filter(Boolean);
  if (mediaUrls.length === 0) return content;
  let cleaned = content;
  for (const url of Array.from(new Set(mediaUrls))) {
    cleaned = cleaned.replaceAll(url, '');
  }
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeMessageParts(input: unknown): MessagePart[] {
  if (!Array.isArray(input)) return [];
  return input.filter((part): part is MessagePart => {
    if (!part || typeof part !== 'object') return false;
    const raw = part as Record<string, unknown>;
    if (raw.type === 'table') return Array.isArray(raw.columns) && Array.isArray(raw.rows);
    if (raw.type === 'image' || raw.type === 'video') return typeof raw.url === 'string';
    if (raw.type === 'card') return typeof raw.cardType === 'string' && !!raw.data && typeof raw.data === 'object';
    if (raw.type === 'text') return typeof raw.text === 'string';
    return false;
  });
}

function parseScriptRows(content: string): ScriptTableRow[] {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: ScriptTableRow[] = [];

  const numberedPattern = /^\d+[\.、\s]/;
  for (const line of lines) {
    if (!numberedPattern.test(line) && !/镜头|画面|旁白|台词|字幕/.test(line)) continue;
    const normalized = line.replace(numberedPattern, '').trim();
    const segments = normalized
      .split(/[|｜]/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length >= 3) {
      rows.push({
        lens: segments[0] || '-',
        visual: segments[1] || '-',
        narration: segments.slice(2).join(' | ') || '-',
      });
      continue;
    }

    const lensMatch = normalized.match(/(?:镜头|景别)[:：]\s*([^，。；;]+)/);
    const visualMatch = normalized.match(/(?:画面|动作)[:：]\s*([^，。；;]+)/);
    const narrationMatch = normalized.match(/(?:台词|旁白|字幕|对白)[:：]\s*(.+)$/);
    if (lensMatch || visualMatch || narrationMatch) {
      rows.push({
        lens: lensMatch?.[1]?.trim() || '-',
        visual: visualMatch?.[1]?.trim() || '-',
        narration: narrationMatch?.[1]?.trim() || '-',
      });
    }
  }

  return rows.slice(0, 12);
}

// 🔧 简化：删除 VideoTask 接口，视频生成后去视频历史页面查看

interface CopywritingOption {
  style_name: string;
  content: string;
  tags: string[];
}

interface MemoryCandidate {
  id: string;
  memoryType: 'general' | 'preference' | 'rule' | 'experience' | 'document';
  content: string;
  question: string;
  keywords: string[];
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  videoAnalysis?: VideoAnalysis;
  scriptOptions?: ScriptOption[];
  selectedScriptId?: string;
  // 🔧 简化：删除 task 字段，视频生成后去视频历史页面查看
  copywritingOptions?: CopywritingOption[];
  modifiedScript?: ScriptOption;
  attachments?: Array<{ type: string; url: string; name?: string }>;
  parts?: MessagePart[];
  memoryCandidate?: MemoryCandidate;
  memoryDecision?: 'pending' | 'confirmed' | 'rejected' | 'never_ask';
}

interface CreativeSession {
  id: string;
  title: string;
  status: string;
  message_count?: number;
  last_message_at?: string;
  created_at?: string;
}

type SessionGroupKey = 'today' | 'week' | 'earlier';
type SessionPhase = 'bootstrapping' | 'switching' | 'streaming' | 'idle';

function groupSessionsByTime(items: CreativeSession[]) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const grouped: Record<SessionGroupKey, CreativeSession[]> = {
    today: [],
    week: [],
    earlier: [],
  };
  items.forEach((session) => {
    const ts = session.last_message_at || session.created_at;
    const ms = ts ? new Date(ts).getTime() : 0;
    if (!ms || Number.isNaN(ms)) {
      grouped.earlier.push(session);
      return;
    }
    const diff = now - ms;
    if (diff <= oneDay) grouped.today.push(session);
    else if (diff <= oneWeek) grouped.week.push(session);
    else grouped.earlier.push(session);
  });
  return grouped;
}

function isRenderablePreviewUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'seedance-public.oss-cn-beijing.aliyuncs.com') return false;
    return true;
  } catch {
    return false;
  }
}

// ========== 工具函数 ==========
// 生成唯一的 ID，确保不会出现重复
let idCounter = 0;
function generateId(prefix: string = 'msg'): string {
  return `${prefix}_${Date.now()}_${++idCounter}_${Math.random().toString(36).substr(2, 9)}`;
}

// ========== 欢迎页组件 ==========

interface WelcomePageProps {
  onQuickStart: (tag: string) => void;
}

function WelcomePage({ onQuickStart }: WelcomePageProps) {
  const quickTags = [
    { label: '美妆带货', desc: '快速生成美妆产品推广视频' },
    { label: '美食种草', desc: '餐饮美食类视频脚本' },
    { label: '数码测评', desc: '3C数码产品介绍视频' },
    { label: '服装展示', desc: '服装模特展示视频' },
    { label: '知识科普', desc: '科普教育类视频' },
    { label: '剧情演绎', desc: '有情节的故事类视频' }
  ];
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 max-w-lg mx-auto">
      {/* Logo 和标题 */}
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4 mx-auto">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">创意小海</h1>
        <p className="text-muted-foreground">您的 AI 视频创作助手</p>
      </div>
      
      {/* 功能介绍 */}
      <div className="grid grid-cols-3 gap-4 mb-8 w-full">
        <div className="p-4 rounded-xl bg-muted/50">
          <Sparkles className="w-5 h-5 mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">智能分析</p>
          <p className="text-xs text-muted-foreground">分析视频风格</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50">
          <Layers className="w-5 h-5 mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">脚本生成</p>
          <p className="text-xs text-muted-foreground">创作视频脚本</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50">
          <Download className="w-5 h-5 mx-auto mb-2 text-primary" />
          <p className="text-sm font-medium">视频生成</p>
          <p className="text-xs text-muted-foreground">一键生成视频</p>
        </div>
      </div>
      
      {/* 快速开始 */}
      <div className="w-full">
        <p className="text-sm text-muted-foreground mb-4">选择创作类型开始</p>
        <div className="grid grid-cols-2 gap-3">
          {quickTags.map((tag) => (
            <button
              key={tag.label}
              onClick={() => onQuickStart(tag.label)}
              className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left group"
            >
              <p className="font-medium text-sm mb-1 group-hover:text-primary transition-colors">
                {tag.label}
              </p>
              <p className="text-xs text-muted-foreground">{tag.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 视频分析卡片 ==========

function AnalysisCard({ analysis }: { analysis: VideoAnalysis }) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">视频风格分析</CardTitle>
          <Badge variant="secondary">{analysis.videoStyle || '已分析'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground">类型：</span>
            <span>{analysis.videoType || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">受众：</span>
            <span>{analysis.targetAudience || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">基调：</span>
            <span>{analysis.emotionalTone || '-'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ========== 脚本预览卡片 ==========

function ScriptPreviewCard({ script }: { script: ScriptOption }) {
  const rows = parseScriptRows(script.content || script.description || '');
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{script.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-24">镜头</th>
                  <th className="px-3 py-2 text-left font-medium">画面内容</th>
                  <th className="px-3 py-2 text-left font-medium">台词/旁白</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={`${script.id}_${idx}`} className="border-t">
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.lens}</td>
                    <td className="px-3 py-2 align-top">{row.visual}</td>
                    <td className="px-3 py-2 align-top">{row.narration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 rounded-lg p-4">
              {script.content || script.description}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 🔧 简化：删除视频结果卡片组件，视频生成后去视频历史页面查看
// 原 ResultCard 组件已删除

// ========== 主组件 ==========

export default function CreativeAgentPageNew() {
  const { token, user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<CreativeSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyReloadSeed, setHistoryReloadSeed] = useState(0);
  const [sessionQuery, setSessionQuery] = useState('');
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('bootstrapping');
  const [isLoading, setIsLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [memoryActionLoading, setMemoryActionLoading] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // ========== 调试日志系统 ==========
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  const handleClearDebugLogs = useCallback(() => {
    DEBUG_LOGS.length = 0;
    setDebugLogs([]);
    addDebugLog('state', '清空调试日志', {});
  }, []);
  
  const handleExportDebugLogs = useCallback(() => {
    const logsText = DEBUG_LOGS.map(log => 
      `[${log.timestamp.toISOString()}] [${log.category.toUpperCase()}] ${log.action}\n${log.detail}\n`
    ).join('\n');
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    addDebugLog('api', '导出调试日志', { count: DEBUG_LOGS.length });
  }, []);
  
  // ========== 方案一：视频完成通知 ==========
  const [hasNewVideo, setHasNewVideo] = useState(false);
  const [newVideoNotification, setNewVideoNotification] = useState<{
    video_id: string;
    video_name?: string;
    public_video_url?: string;
    status: string;
  } | null>(null);
  
  // 使用 localStorage 持久化已通知的视频 ID，避免页面刷新后重复弹窗
  const [notifiedVideoIds, setNotifiedVideoIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notifiedVideoIds');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  
  // 当 notifiedVideoIds 变化时，同步到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && notifiedVideoIds.size > 0) {
      localStorage.setItem('notifiedVideoIds', JSON.stringify([...notifiedVideoIds]));
    }
  }, [notifiedVideoIds]);
  
  // 附件管理
  const [attachments, setAttachments] = useState<HybridInputAttachment[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // 右侧配置
  const [creationOptions, setCreationOptions] = useState<CreationOption>({
    aspectRatio: '9:16',
    duration: 5,
    style: 'talking'
  });
  
  // 右侧数据
  const [templates] = useState<TemplateItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [workerTasks, setWorkerTasks] = useState<WorkerTaskItem[]>([]);

  // 联网搜索状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);
  const streamingMessageIdRef = useRef<string | null>(null);
  const historyRequestSeq = useRef(0);
  const lastStreamUiFlushRef = useRef(0);
  const historyAbortRef = useRef<AbortController | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const previousTaskStatusRef = useRef<Map<string, string>>(new Map());
  const notifiedTerminalTaskRef = useRef<Set<string>>(new Set());
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const filteredSessions = sessions.filter((session) => {
    if (!sessionQuery.trim()) return true;
    const keyword = sessionQuery.trim().toLowerCase();
    return (
      (session.title || '').toLowerCase().includes(keyword) ||
      session.id.toLowerCase().includes(keyword)
    );
  });
  const groupedSessions = groupSessionsByTime(filteredSessions);
  const loadSessions = useCallback(async (options?: { preferredSessionId?: string | null }) => {
    if (!token) return;
    try {
      const res = await fetch('/api/xiaohai/agent/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const nextSessions = (data?.data?.sessions || []) as CreativeSession[];
      setSessions(nextSessions);
      const preferredSessionId = options?.preferredSessionId || null;
      if (preferredSessionId && nextSessions.some((session) => session.id === preferredSessionId)) {
        setActiveSessionId(preferredSessionId);
        return;
      }
      if (nextSessions.length > 0) {
        setActiveSessionId((prev) => prev || nextSessions[0].id);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    }
  }, [token]);

  const loadWorkerTasks = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/xiaohai/agent/tasks?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setWorkerTasks((data?.data?.tasks || []) as WorkerTaskItem[]);
    } catch (error) {
      console.error('加载后台任务失败:', error);
    }
  }, [token]);

  // ========== 双笔记本系统：加载历史消息 ==========
  useEffect(() => {
    if (!user?.user_id || !token || !activeSessionId || !sessionReady) return;
    
    const fetchHistory = async () => {
      const requestId = ++historyRequestSeq.current;
      setSessionPhase('switching');
      setHistoryLoading(true);
      setHistoryError(null);
      historyAbortRef.current?.abort();
      const controller = new AbortController();
      historyAbortRef.current = controller;
      const requestedSessionId = activeSessionId;
      try {
        addDebugLog('api', '加载对话历史开始', { userId: user.user_id, activeSessionId });
        const qs = `?sessionId=${activeSessionId}`;
        const historyRes = await fetch(`/api/xiaohai/agent/sessions${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (requestId !== historyRequestSeq.current) return;
          if (requestedSessionId !== activeSessionIdRef.current) return;
          if (historyData.success && historyData.data?.conversationHistory) {
            const msgCount = historyData.data.conversationHistory.length;
            addDebugLog('api', '加载对话历史成功', { count: msgCount });
            console.log(`📔 [笔记本1号] 加载了 ${msgCount} 条历史消息`);
            
            // 优先按 id 去重，避免同内容消息误伤
            const seenKeys = new Set<string>();
            const uniqueMessages: Message[] = [];
            
            for (const msg of historyData.data.conversationHistory) {
              const key = String(msg.id || `${msg.created_at}_${msg.role}_${msg.content}`);
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueMessages.push({
                  id: `msg_${msg.id || key}`,
                  type: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  timestamp: new Date(msg.created_at),
                  parts: normalizeMessageParts((msg as { parts?: unknown }).parts),
                });
              }
            }
            
            console.log(`📔 [笔记本1号] 去重后剩余 ${uniqueMessages.length} 条消息（原始 ${msgCount} 条）`);
            addDebugLog('api', '历史消息去重', { original: msgCount, deduplicated: uniqueMessages.length });
            
            // 将去重后的消息转换为前端 Message 格式
            const historyMessages: Message[] = uniqueMessages;
            
            // 🔧 修复：同时更新 conversationHistory.current（使用去重后的消息）
            const historyForAI = uniqueMessages.map((msg) => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            }));
            conversationHistory.current = historyForAI;
            addDebugLog('state', '同步 conversationHistory.current', { 
              count: conversationHistory.current.length,
              sample: conversationHistory.current.slice(0, 2)
            });
            
            // 更新 messages 状态
            setMessages(historyMessages);
            addDebugLog('state', '更新 messages 状态', { count: historyMessages.length });
          } else {
            addDebugLog('api', '加载对话历史失败：无数据', historyData);
            setHistoryError('该会话历史加载失败，请重试。');
          }
        } else {
          addDebugLog('error', '加载对话历史失败：HTTP错误', { status: historyRes.status });
          setHistoryError('加载历史失败，请检查网络后重试。');
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('📔 [笔记本1号] 加载历史消息失败:', error);
        addDebugLog('error', '加载历史消息异常', { error: String(error) });
        setHistoryError('加载历史失败，请重试。');
      } finally {
        if (requestId === historyRequestSeq.current) {
          setHistoryLoading(false);
          if (!isLoading) {
            setSessionPhase('idle');
          }
        }
      }
    };
    
    fetchHistory();
    return () => {
      historyAbortRef.current?.abort();
    };
  }, [user?.user_id, token, activeSessionId, sessionReady, historyReloadSeed, isLoading]);

  useEffect(() => {
    return () => {
      historyAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!user?.user_id || !token) return;
    let mounted = true;
    const bootstrap = async () => {
      setSessionPhase('bootstrapping');
      setSessionLoading(true);
      const res = await fetch('/api/xiaohai/agent/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mounted) return;
      if (!res.ok) {
        setSessionLoading(false);
        setSessionPhase('idle');
        return;
      }
      const data = await res.json();
      const nextSessions = (data?.data?.sessions || []) as CreativeSession[];
      setSessions(nextSessions);
      if (nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      } else {
        setActiveSessionId(null);
      }
      setSessionReady(true);
      setSessionLoading(false);
      setSessionPhase('idle');
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [user?.user_id, token]);

  const handleCreateSession = async () => {
    if (!token || isLoading || sessionLoading) return;
    setSessionPhase('switching');
    setSessionLoading(true);
    try {
      const res = await fetch('/api/xiaohai/agent/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'create' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const newSession = data?.data?.session as CreativeSession | undefined;
      if (!newSession) return;
      setSessions((prev) => [newSession, ...prev.filter((item) => item.id !== newSession.id)]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      conversationHistory.current = [];
      setSessionReady(true);
    } catch (error) {
      console.error('创建新会话失败:', error);
    } finally {
      setSessionLoading(false);
      if (!isLoading) {
        setSessionPhase('idle');
      }
    }
  };

  const handleStopStreaming = () => {
    if (!isLoading) return;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    streamingMessageIdRef.current = null;
    setIsLoading(false);
    setMessages((prev) => [
      ...prev,
      {
        id: generateId('msg'),
        type: 'system',
        content: '已停止当前生成。',
        timestamp: new Date(),
      },
    ]);
    setSendError(null);
    setSessionPhase('idle');
  };

  const handleMemoryDecision = async (
    messageId: string,
    action: 'confirm' | 'reject' | 'never_ask',
    candidate?: MemoryCandidate
  ) => {
    if (!token || !candidate) return;
    setMemoryActionLoading(messageId);
    try {
      const response = await fetch('/api/xiaohai/agent/memory/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          candidateId: candidate.id,
          memoryType: candidate.memoryType,
          content: candidate.content,
          keywords: candidate.keywords,
        }),
      });
      if (!response.ok) return;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, memoryDecision: action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'never_ask' } : msg))
      );
    } catch (error) {
      console.error('记忆确认失败:', error);
    } finally {
      setMemoryActionLoading(null);
    }
  };

  // 获取右侧数据
  useEffect(() => {
    if (!user?.user_id) return;
    
    const fetchData = async () => {
      try {
        // 获取历史任务
        const sessionQuery = activeSessionId ? `&sessionId=${activeSessionId}` : '';
        const historyRes = await fetch(`/api/material/history?type=personal&limit=8${sessionQuery}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory((historyData.videos as HistoryVideoRow[] | undefined)?.slice(0, 8).map((v) => ({
            id: v.id,
            title: v.prompt?.substring(0, 20) || '视频创作',
            thumbnail: v.public_video_url || v.video_url || v.result_url || v.cover_url,
            status: v.status === 'completed' || v.status === 'succeeded' ? 'completed' : 'processing',
            createdAt: new Date(v.created_at || Date.now())
          })) || []);
        }
        
        // 获取素材列表
        const materialsRes = await fetch('/api/learning-library?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials((materialsData.learnings as LearningMaterialRow[] | undefined)?.slice(0, 10).map((m) => ({
            id: m.id,
            name: m.title || m.video_name || '未命名素材',
            type: m.video_type === 'video' ? 'video' : 'image',
            thumbnail: m.cover_url,
            createdAt: new Date(m.created_at || Date.now())
          })) || []);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      }
    };
    
    fetchData();
  }, [user?.user_id, token, activeSessionId]);

  useEffect(() => {
    if (!token || !user?.user_id) return;
    loadWorkerTasks();
    const timer = setInterval(() => {
      loadWorkerTasks();
    }, 8000);
    return () => clearInterval(timer);
  }, [token, user?.user_id, loadWorkerTasks]);

  // ========== 方案一：视频完成通知轮询 ==========
  useEffect(() => {
    if (!user?.user_id || !token) return;
    
    // 每60秒轮询一次
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/material/history?type=personal&limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) return;
        
        const result = await response.json();
        if (!result.success || !result.videos) return;
        
        // 查找状态为 completed 且未通知过的视频
        for (const video of result.videos) {
          if (video.status === 'completed' && !notifiedVideoIds.has(video.id)) {
            // 检查是否是最近10分钟内生成的（避免通知很久以前的视频）
            const videoCreatedAt = new Date(video.created_at).getTime();
            const now = Date.now();
            if (now - videoCreatedAt < 10 * 60 * 1000) {
              // 找到新完成的视频！
              setNewVideoNotification({
                video_id: video.video_id || video.id,
                video_name: video.video_name,
                public_video_url: video.public_video_url || video.video_url || video.result_url,
                status: video.status
              });
              setHasNewVideo(true);
              setShowNotificationDialog(true);
              setNotifiedVideoIds(prev => new Set([...prev, video.id]));
              break; // 只通知最新的一个
            }
          }
        }
      } catch (error) {
        console.error('[视频通知] 轮询失败:', error);
      }
    }, 60 * 1000); // 每60秒
    
    return () => clearInterval(pollInterval);
  }, [user?.user_id, token, notifiedVideoIds]);
  
  // 关闭通知弹窗
  const handleCloseNotification = () => {
    setShowNotificationDialog(false);
    setHasNewVideo(false);
    setNewVideoNotification(null);
  };
  
  // 查看视频
  const handleViewVideo = () => {
    setShowNotificationDialog(false);
    setHasNewVideo(false);
    setNewVideoNotification(null);
    // 可以在这里添加跳转到素材历史页面的逻辑
    window.location.href = '/material/history';
  };

  const handleTaskAction = useCallback(async (action: 'retry' | 'cancel', taskId: string) => {
    if (!token || !taskId) return;
    try {
      await fetch('/api/xiaohai/agent/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, taskId }),
      });
      await loadWorkerTasks();
    } catch (error) {
      console.error(`${action} task failed`, error);
    }
  }, [token, loadWorkerTasks]);

  const handleOpenTaskReplay = useCallback(async (taskId: string) => {
    if (!token || !taskId) return;
    try {
      const res = await fetch(`/api/xiaohai/agent/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const taskSessionId = (data?.data?.task?.session_id || null) as string | null;
      if (taskSessionId && activeSessionId && taskSessionId !== activeSessionId) {
        setHistoryError('该任务属于其他会话，请先切换到对应会话再回放。');
        return;
      }
      const outputs = (data?.data?.outputs || []) as Array<{ id: string; text_content?: string; parts?: MessagePart[]; created_at?: string }>;
      const items = (data?.data?.items || []) as Array<{
        id: string;
        output_data?: {
          result?: {
            image_url?: string;
            video_url?: string;
            public_video_url?: string;
            image_id?: string;
          };
        };
        created_at?: string;
      }>;

      const replayMessages: Message[] = outputs.map((item) => ({
        id: `task_${taskId}_${item.id}`,
        type: 'assistant',
        content: item.text_content || '',
        timestamp: new Date(item.created_at || Date.now()),
        parts: normalizeMessageParts(item.parts),
      }));

      if (replayMessages.length === 0) {
        const previewMessages = items
          .map((item, idx) => {
            const result = (item?.output_data?.result || {}) as Record<string, unknown>;
            const imageCandidates = [
              typeof result.public_image_url === 'string' ? result.public_image_url : '',
              typeof result.preview_image_url === 'string' ? result.preview_image_url : '',
              typeof result.signed_image_url === 'string' ? result.signed_image_url : '',
              typeof result.image_url === 'string' ? result.image_url : '',
            ].filter(Boolean);
            const videoCandidates = [
              typeof result.public_video_url === 'string' ? result.public_video_url : '',
              typeof result.video_url === 'string' ? result.video_url : '',
              typeof result.preview_video_url === 'string' ? result.preview_video_url : '',
            ].filter(Boolean);
            const imageUrl = imageCandidates.find((u) => isRenderablePreviewUrl(u)) || '';
            const videoUrl = videoCandidates.find((u) => isRenderablePreviewUrl(u)) || '';
            const parts: MessagePart[] = [];
            if (imageUrl) {
              parts.push({ type: 'image', url: imageUrl, alt: `任务预览图 ${idx + 1}` });
            }
            if (videoUrl) {
              parts.push({ type: 'video', url: videoUrl });
            }
            if (parts.length === 0) return null;
            return {
              id: `task_preview_${taskId}_${item.id}`,
              type: 'assistant' as const,
              content: imageUrl
                ? `第 ${idx + 1} 条任务已生成预览图，看看是否符合预期，我可以继续帮你优化。`
                : `第 ${idx + 1} 条任务已生成视频结果，看看是否符合预期。`,
              timestamp: new Date(item.created_at || Date.now()),
              parts,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => !!msg);
        replayMessages.push(...previewMessages);
      }
      if (!replayMessages.length) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId('sys_task'),
            type: 'system',
            content: '该任务暂未产出可回放内容，可能仍在后台执行中，请稍后再试。',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const next = [...prev];
        for (const msg of replayMessages) {
          if (!known.has(msg.id)) next.push(msg);
        }
        conversationHistory.current = next
          .filter((m) => m.type === 'user' || m.type === 'assistant')
          .map((m) => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content }));
        return next;
      });
    } catch (error) {
      console.error('任务回放失败:', error);
    }
  }, [token, activeSessionId]);

  useEffect(() => {
    if (!workerTasks.length) return;
    for (const task of workerTasks) {
      const prev = previousTaskStatusRef.current.get(task.id);
      previousTaskStatusRef.current.set(task.id, task.status);
      if (!prev || prev === task.status) continue;

      const isTerminal =
        task.status === 'succeeded' ||
        task.status === 'partial_succeeded' ||
        task.status === 'failed' ||
        task.status === 'cancelled';
      if (!isTerminal) continue;
      if (notifiedTerminalTaskRef.current.has(task.id)) continue;
      notifiedTerminalTaskRef.current.add(task.id);

      const isCurrentSessionTask = !task.session_id || !activeSessionId || task.session_id === activeSessionId;
      const taskType = (task.task_type || '').toLowerCase();
      const taskLabel =
        taskType === 'image_generate'
          ? '图片任务'
          : taskType === 'video_generate'
          ? '视频任务'
          : '后台任务';
      const systemText =
        task.status === 'succeeded'
          ? `${taskLabel}已完成：${task.id.slice(0, 8)}`
          : task.status === 'partial_succeeded'
          ? `${taskLabel}部分完成：${task.id.slice(0, 8)}`
          : task.status === 'failed'
          ? `${taskLabel}失败：${task.error_message || task.id.slice(0, 8)}`
          : `${taskLabel}已取消：${task.id.slice(0, 8)}`;

      setMessages((prevMsgs) => {
        const msg: Message = {
          id: generateId('sys_task'),
          type: 'system',
          content: systemText,
          timestamp: new Date(),
        };
        return [...prevMsgs, msg];
      });

      if (isCurrentSessionTask && (task.status === 'succeeded' || task.status === 'partial_succeeded')) {
        handleOpenTaskReplay(task.id);
      }
    }
  }, [workerTasks, activeSessionId, handleOpenTaskReplay]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 快速开始
  const handleQuickStart = (tag: string) => {
    const welcomeMessage = `我想创作一个${tag}类型的视频`;
    handleSend(welcomeMessage);
  };

  // 发送消息
  const handleSend = async (messageText?: string) => {
    const text = messageText || '';
    if (!text.trim() && attachments.length === 0) return;
    
    addDebugLog('state', '开始发送消息', { 
      text: text.substring(0, 100),
      attachmentsCount: attachments.length,
      conversationHistoryLength: conversationHistory.current.length,
      conversationHistorySample: conversationHistory.current.slice(0, 2)
    });
    
    const userMessage: Message = {
      id: generateId('msg'),
      type: 'user',
      content: text,
      timestamp: new Date(),
      attachments: attachments.map(a => ({ 
        type: a.type, 
        url: a.url || '', 
        name: a.name 
      }))
    };
    
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      addDebugLog('state', '添加用户消息', { messagesCount: newMessages.length });
      return newMessages;
    });
    addDebugLog('state', '添加用户消息到 messages', { messagesCount: messages.length + 1 });
    
    setAttachments([]);
    setIsLoading(true);
    setSendError(null);
    setSessionPhase('streaming');
    
    // 构建附件
    const apiAttachments = attachments
      .filter(a => a.status === 'success' && a.url)
      .map(a => ({ type: a.type, url: a.url!, name: a.name }));
    
    // 收集对话历史
    let currentText = '';
    let currentAnalysis: VideoAnalysis | undefined;
    let currentScripts: ScriptOption[] = [];
    let currentParts: MessagePart[] = [];
    // 🔧 简化：删除 currentTask，视频生成后去视频历史页面查看
    
    let boundSessionId = activeSessionId;
    if (!boundSessionId && token) {
      try {
        const createRes = await fetch('/api/xiaohai/agent/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'create' }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          const sid = created?.data?.session?.id as string | undefined;
          if (sid) {
            boundSessionId = sid;
            setActiveSessionId(sid);
            setSessions((prev) => [created.data.session as CreativeSession, ...prev.filter((item) => item.id !== sid)]);
          }
        }
      } catch (createErr) {
        console.error('发送前创建会话失败:', createErr);
      }
    }

    const requestBody = {
      clientRequestId: generateId('req'),
      message: text,
      attachments: apiAttachments,
      history: conversationHistory.current,
      sessionId: boundSessionId,
      webSearchEnabled  // 联网搜索开关
    };
    
    addDebugLog('api', '发送请求到 API', { 
      historyLength: conversationHistory.current.length,
      requestBodyKeys: Object.keys(requestBody)
    });
    
    try {
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;
      await streamAgentRequest(
        '/api/xiaohai/agent/chat',
        requestBody,
        token || '',
        (event: SSEEvent) => {
          addDebugLog('sse', `收到 SSE 事件: ${event.type}`, event);
          
          switch (event.type) {
            case 'start':
              currentText = '';
              currentParts = [];
              streamingMessageIdRef.current = generateId('stream');
              if (event.data && typeof event.data === 'object' && 'sessionId' in event.data) {
                const sid = (event.data as { sessionId?: unknown }).sessionId;
                if (typeof sid === 'string' && sid) {
                  setActiveSessionId((prev) => prev || sid);
                }
              }
              break;
              
            case 'content':
            case 'text':
              currentText += event.content || '';
              {
                const now = Date.now();
                if (now - lastStreamUiFlushRef.current < 50 && event.type !== 'text') {
                  break;
                }
                lastStreamUiFlushRef.current = now;
                setMessages(prev => {
                  const streamingId = streamingMessageIdRef.current;
                  const exists = streamingId ? prev.some((m) => m.id === streamingId) : false;
                  if (exists && streamingId) {
                    return prev.map((msg) =>
                      msg.id === streamingId ? { ...msg, content: currentText, parts: currentParts } : msg
                    );
                  } else {
                    const nextId = streamingId || generateId('stream');
                    streamingMessageIdRef.current = nextId;
                    return [...prev, {
                      id: nextId,
                      type: 'assistant' as const,
                      content: currentText,
                      timestamp: new Date(),
                      parts: currentParts,
                    }];
                  }
                });
              }
              break;
              
            case 'tool_result':
              {
                const resultData = getToolResultData(event.result);
                if (event.tool === 'analyze_video' && resultData) {
                  currentAnalysis = resultData;
                }
                if (event.tool === 'generate_script' && resultData) {
                  currentScripts = normalizeScriptOptions(resultData);
                }
              }
              // 🔧 简化：删除 submit_video_task 的收集，改为在文字提示中告知用户
              // if (event.tool === 'submit_video_task' && event.result?.data) {
              //   currentTask = event.result.data;
              // }
              break;

            case 'video_analysis':
              if (event.data) {
                currentAnalysis = event.data;
              }
              break;

            case 'script_options': {
              const options = normalizeScriptOptions(event.data);
              if (options.length > 0) {
                currentScripts = options;
              }
              break;
            }

            case 'message_part': {
              if (event.part) {
                currentParts = [...currentParts, event.part];
                setMessages((prev) => {
                  const streamingId = streamingMessageIdRef.current;
                  if (!streamingId) return prev;
                  return prev.map((msg) =>
                    msg.id === streamingId ? { ...msg, parts: currentParts } : msg
                  );
                });
              }
              break;
            }

            case 'memory_candidate': {
              if (event.data && typeof event.data === 'object') {
                const candidate = event.data as MemoryCandidate;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: generateId('msg'),
                    type: 'assistant',
                    content: candidate.question || '这条信息要帮你记住吗？',
                    timestamp: new Date(),
                    memoryCandidate: candidate,
                    memoryDecision: 'pending',
                  },
                ]);
              }
              break;
            }
              
            case 'done':
              addDebugLog('sse', '收到 done 事件', { 
                currentTextLength: currentText.length,
                hasAnalysis: !!currentAnalysis,
                scriptsCount: currentScripts.length
              });
              
              // 更新历史记录
              conversationHistory.current.push({ role: 'user', content: text });
              if (currentText.trim()) {
                conversationHistory.current.push({ role: 'assistant', content: currentText });
              }
              addDebugLog('state', '更新 conversationHistory', { 
                totalLength: conversationHistory.current.length 
              });

              // 将结构化结果绑定到流式消息，避免“正文+额外卡片消息”重复堆叠
              const streamingId = streamingMessageIdRef.current;
              if (streamingId) {
                const hasPartMedia = currentParts.some((part) => part.type === 'image' || part.type === 'video');
                const { cleanedContent, attachments: parsedAttachments } = hasPartMedia
                  ? { cleanedContent: removePartMediaUrls(currentText, currentParts), attachments: [] as Array<{ type: string; url: string; name?: string }> }
                  : extractMediaAttachments(currentText);
                const hasScriptPart = currentParts.some((part) => part.type === 'table');
                const hasScriptDup =
                  hasScriptPart ||
                  (currentScripts.length > 0 &&
                    currentScripts.some((script) =>
                      (script.content || '').trim() &&
                      cleanedContent.includes((script.content || '').trim().slice(0, 40))
                    ));
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== streamingId) return msg;
                    const hasParts = currentParts.length > 0;
                    return {
                      ...msg,
                      content: hasScriptDup ? '已生成结构化脚本，请查看下方表格。' : cleanedContent,
                      attachments: [...(msg.attachments || []), ...parsedAttachments],
                      // V1.4: parts 为主，旧字段仅保留为历史兜底
                      videoAnalysis: hasParts ? msg.videoAnalysis : (currentAnalysis || msg.videoAnalysis),
                      scriptOptions: hasParts ? msg.scriptOptions : (currentScripts.length > 0 ? currentScripts : msg.scriptOptions),
                      parts: hasParts ? currentParts : msg.parts,
                    };
                  })
                );
              }
              
              setIsLoading(false);
              streamingMessageIdRef.current = null;
              streamAbortRef.current = null;
              setSessionPhase('idle');
              loadSessions({ preferredSessionId: activeSessionId });
              break;
          }
        },
        (error: Error) => {
          if (error.message === '请求已取消') {
            setIsLoading(false);
            setSessionPhase('idle');
            return;
          }
          addDebugLog('error', 'SSE 流错误', { message: error.message });
          setIsLoading(false);
          streamingMessageIdRef.current = null;
          streamAbortRef.current = null;
          setSessionPhase('idle');
          setMessages((prev) => [
            ...prev,
            {
              id: generateId('msg'),
              type: 'system',
              content: '网络波动或服务超时，已自动停止本次请求。你可以重试。',
              timestamp: new Date(),
            },
          ]);
        },
        controller.signal
      );
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsLoading(false);
      streamingMessageIdRef.current = null;
      streamAbortRef.current = null;
      setSessionPhase('idle');
      setSendError('发送失败，网络波动或服务超时。');
    }
  };

  // 联网搜索功能（切换模式）
  const handleWebSearchToggle = () => {
    setWebSearchEnabled(prev => !prev);
  };

  // 文件上传 - 使用 Presign 模式直接上传到 TOS
  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileCategory = file.type.startsWith('video/') ? 'video' : 'image';
    
    // 添加上传中的附件
    const tempId = `upload_${Date.now()}`;
    setAttachments(prev => [...prev, {
      id: tempId,
      type: fileCategory,
      file,
      name: file.name,
      progress: 0,
      status: 'uploading'
    }]);
    
    try {
      // 1. 获取预签名上传 URL
      const presignResponse = await fetch('/api/creative-agent/upload/presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileCategory
        })
      });
      
      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error || '获取上传地址失败');
      }
      
      const presignData = await presignResponse.json();
      const { uploadUrl, publicUrl, fileKey } = presignData;
      
      // 2. 直接上传到 TOS
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      if (!uploadResponse.ok) {
        throw new Error('上传到存储失败');
      }
      
      // 3. 调用确认接口，设置文件为公开读取
      const confirmResponse = await fetch('/api/creative-agent/upload/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fileKey })
      });
      
      if (!confirmResponse.ok) {
        console.warn('[上传] 设置公开权限失败，使用原 URL');
      }
      
      const confirmData = await confirmResponse.json();
      const finalUrl = confirmData.publicUrl || publicUrl;
      
      // 4. 更新附件状态为成功，使用公开 URL
      setAttachments(prev => prev.map(a => 
        a.id === tempId 
          ? { ...a, status: 'success', url: finalUrl, progress: 100 }
          : a
      ));
      
    } catch (error) {
      console.error('上传失败:', error);
      setAttachments(prev => prev.map(a => 
        a.id === tempId 
          ? { ...a, status: 'error', error: error instanceof Error ? error.message : '上传失败' }
          : a
      ));
    }
  };

  // 链接提交
  const handleLinkSubmit = (url: string) => {
    setAttachments(prev => [...prev, {
      id: `link_${Date.now()}`,
      type: 'video',
      url,
      name: url,
      status: 'success'
    }]);
  };

  if (!isClient) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* ========== 方案一：视频完成通知弹窗 ========== */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              视频生成完成！
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {newVideoNotification && (
              <>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium">
                    {newVideoNotification.video_name || '未命名视频'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    video_id: {newVideoNotification.video_id}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleViewVideo}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    前往查看
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleCloseNotification}
                  >
                    <X className="h-4 w-4 mr-2" />
                    稍后
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <div className="flex h-[calc(100vh-128px)] rounded-2xl border bg-card/70 backdrop-blur-sm overflow-hidden shadow-sm">
        {/* 左侧对话区 - min-h-0 关键！ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gradient-to-b from-background to-muted/20">
          {/* 头部 - shrink-0 防止被压缩 */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b bg-background/80 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-semibold">创意小海</h1>
                  {/* ========== 方案一：小红点 ========== */}
                  {hasNewVideo && (
                    <Badge 
                      variant="destructive" 
                      className="animate-pulse cursor-pointer"
                      onClick={() => setShowNotificationDialog(true)}
                    >
                      <Bell className="h-3 w-3 mr-1" />
                      新视频
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">AI 视频创作助手</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={sessionQuery}
                  onChange={(e) => setSessionQuery(e.target.value)}
                  placeholder="搜索会话..."
                  className="h-8 w-[150px] rounded-md border bg-background pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <Select
                value={activeSessionId || undefined}
                onValueChange={(value) => {
                  if (isLoading || sessionLoading) return;
                  setSessionPhase('switching');
                  setActiveSessionId(value);
                  setHistoryError(null);
                }}
              >
                <SelectTrigger className="w-[240px] h-8">
                  <SelectValue placeholder="选择会话" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSessions.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">无匹配会话</div>
                  )}
                  {(['today', 'week', 'earlier'] as SessionGroupKey[]).map((key) => {
                    const items = groupedSessions[key];
                    if (!items.length) return null;
                    const label = key === 'today' ? '今天' : key === 'week' ? '近 7 天' : '更早';
                    return (
                      <div key={key}>
                        <div className="px-2 py-1 text-[10px] text-muted-foreground">{label}</div>
                        {items.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            <div className="flex items-center justify-between gap-3 w-full">
                              <span className="truncate max-w-[130px]">{session.title || session.id.slice(0, 8)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {session.message_count || 0}条
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateSession}
                disabled={isLoading || sessionLoading}
              >
                {sessionLoading ? '创建中...' : '新会话'}
              </Button>
              {isLoading && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopStreaming}
                >
                  <Square className="w-3.5 h-3.5 mr-1" />
                  停止
                </Button>
              )}
              {sessionPhase !== 'idle' && (
                <Badge variant="secondary" className="text-xs">
                  {sessionPhase === 'bootstrapping' ? '初始化中' : sessionPhase === 'switching' ? '切换中' : '生成中'}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                在线
              </Badge>
            </div>
          </div>
          
          {/* 消息区域 - min-h-0 关键！允许收缩 */}
          <ScrollArea className="min-h-0 flex-1 px-6 py-5">
            {historyLoading && (
              <div className="mb-3 text-xs text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                正在加载该会话历史...
              </div>
            )}
            {historyError && (
              <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 inline-flex items-center gap-3">
                <span>{historyError}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    if (!activeSessionId) return;
                    setHistoryReloadSeed((prev) => prev + 1);
                  }}
                >
                  重试
                </Button>
              </div>
            )}
            {messages.length === 0 ? (
              <WelcomePage onQuickStart={handleQuickStart} />
            ) : (
              <div>
                <MessageGroup 
                  messages={messages.map(m => ({
                    id: m.id,
                    type: m.type,
                    content: m.content,
                    timestamp: m.timestamp,
                    parts: m.parts,
                    attachments: m.attachments?.map(a => ({
                      type: a.type as 'video' | 'image' | 'link',
                      url: a.url,
                      name: a.name
                    })),
                    isStreaming: m.id.startsWith('stream_')
                  }))}
                />
                
                {/* 兼容旧消息：仅当没有 parts 时显示旧分析卡片 */}
                {messages.map(m => m.videoAnalysis && (!m.parts || m.parts.length === 0) && (
                  <div key={`analysis-${m.id}`} className="mt-4">
                    <AnalysisCard analysis={m.videoAnalysis} />
                  </div>
                ))}
                
                {/* 兼容旧消息：仅当没有 parts 时显示旧脚本预览 */}
                {messages.map(m => m.scriptOptions && (!m.parts || m.parts.length === 0) && (
                  <div key={`scripts-${m.id}`} className="mt-4 space-y-3">
                    {m.scriptOptions.map(script => (
                      <ScriptPreviewCard key={script.id} script={script} />
                    ))}
                  </div>
                ))}

                {messages.map((m) => m.memoryCandidate && (
                  <div key={`memory-${m.id}`} className="mt-4">
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">记忆确认</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{m.memoryCandidate.content}</p>
                        {m.memoryDecision === 'pending' ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleMemoryDecision(m.id, 'confirm', m.memoryCandidate)}
                              disabled={memoryActionLoading === m.id}
                            >
                              记住
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMemoryDecision(m.id, 'reject', m.memoryCandidate)}
                              disabled={memoryActionLoading === m.id}
                            >
                              这次不记
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleMemoryDecision(m.id, 'never_ask', m.memoryCandidate)}
                              disabled={memoryActionLoading === m.id}
                            >
                              以后别再问
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="outline">
                            {m.memoryDecision === 'confirmed'
                              ? '已记住'
                              : m.memoryDecision === 'never_ask'
                              ? '已关闭记忆询问'
                              : '本次不记忆'}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
                
                {/* 🔧 简化：删除视频结果卡片，视频生成后去视频历史页面查看 */}
                {/* {messages.map(m => m.task && (
                  <div key={`task-${m.id}`} className="mt-4">
                    <ResultCard 
                      task={m.task} 
                      onDownload={() => {}}
                      onShare={() => {}}
                      onRegenerate={() => {}}
                      onCopywriting={() => {}}
                    />
                  </div>
                ))} */}
              </div>
            )}
            <div ref={messagesEndRef} />
          </ScrollArea>
          
          {/* 输入区 - shrink-0 防止被压缩 */}
          <div className="shrink-0 px-6 py-4 border-t bg-background/90 backdrop-blur">
            {sendError && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <span>{sendError}</span>
              </div>
            )}
            <HybridInput
              value={inputValue}
              onChange={setInputValue}
              onSend={() => {
                if (inputValue.trim() || attachments.length > 0) {
                  handleSend(inputValue);
                  setInputValue('');
                }
              }}
              onFileUpload={handleFileUpload}
              onLinkSubmit={(url) => {
                handleLinkSubmit(url);
              }}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={handleWebSearchToggle}
              disabled={isLoading}
              placeholder="输入消息或拖拽文件..."
            />
          </div>
        </div>
        
        {/* 右侧功能区 */}
        <div className="w-80 border-l bg-muted/25 shrink-0 overflow-y-auto">
          <RightSidebar
            creationOptions={creationOptions}
            onCreationOptionsChange={setCreationOptions}
            templates={templates}
            history={history}
            materials={materials}
            tasks={workerTasks}
            onTaskRetry={(taskId) => handleTaskAction('retry', taskId)}
            onTaskCancel={(taskId) => handleTaskAction('cancel', taskId)}
            onTaskOpen={handleOpenTaskReplay}
          />
        </div>
      </div>
      
      {/* 调试面板按钮 */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 left-4 z-50 bg-black/80 border-white/20 text-white hover:bg-black/90"
        onClick={() => {
          setDebugLogs([...DEBUG_LOGS]);
          setShowDebugPanel(!showDebugPanel);
        }}
      >
        <Bug className="h-4 w-4 mr-1" />
        {showDebugPanel ? '隐藏' : '调试'}
        {DEBUG_LOGS.length > 0 && (
          <Badge variant="outline" className="ml-1 text-xs">{DEBUG_LOGS.length}</Badge>
        )}
      </Button>
      
      {/* 调试面板 */}
      {showDebugPanel && (
        <DebugPanel 
          logs={debugLogs} 
          onClear={handleClearDebugLogs}
          onExport={handleExportDebugLogs}
        />
      )}
    </DashboardLayout>
  );
}
