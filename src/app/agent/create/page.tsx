'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { streamAgentRequest, apiRequest } from '@/lib/api';
import { SSEEvent, getToolResultData } from '@/lib/agent-sse';
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
  Share2, 
  RefreshCw, 
  Layers, 
  Eye,
  Plus,
  Settings2,
  MessageSquare,
  Bell,
  X,
  ExternalLink,
  Terminal,
  Bug,
  Save,
  Trash2,
  Play,
  Maximize2
} from 'lucide-react';

// 新组件
import { MessageBubble, MessageBubbleProps, MessageGroup } from '@/components/agent/MessageBubble';
import { HybridInput, HybridInputAttachment } from '@/components/agent/HybridInput';

// ========== 调试日志系统 ==========
interface DebugLog {
  id: string;
  timestamp: Date;
  category: 'state' | 'sse' | 'api' | 'render' | 'error';
  action: string;
  detail: any;
}

const DEBUG_LOGS: DebugLog[] = [];
const MAX_DEBUG_LOGS = 100;

const addDebugLog = (category: DebugLog['category'], action: string, detail: any) => {
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
import { RightSidebar, CreationOption, TemplateItem, HistoryItem, MaterialItem } from '@/components/agent/RightSidebar';

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

function extractImageAttachments(content: string): {
  cleanedContent: string;
  attachments: Array<{ type: string; url: string; name?: string }>;
} {
  const urlRegex = /(https?:\/\/[^\s)]+?\.(?:png|jpg|jpeg|gif|webp)(?:\?[^\s)]*)?)/gi;
  const matches = Array.from(content.matchAll(urlRegex)).map((item) => item[1]).filter(Boolean);
  if (matches.length === 0) {
    return { cleanedContent: content, attachments: [] };
  }

  const uniqueUrls = Array.from(new Set(matches));
  const cleaned = content
    .replace(urlRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    cleanedContent: cleaned || '已生成图片，见下方预览',
    attachments: uniqueUrls.map((url, index) => ({
      type: 'image',
      url,
      name: `图片 ${index + 1}`,
    })),
  };
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
  const [isLoading, setIsLoading] = useState(false);
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
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);

  // 联网搜索状态
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);
  const streamingMessageIdRef = useRef<string | null>(null);
  const historyRequestSeq = useRef(0);
  const lastStreamUiFlushRef = useRef(0);
  
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadSessions = useCallback(async (options?: { preferredSessionId?: string | null }) => {
    if (!token) return;
    try {
      const res = await fetch('/api/xiaohai/agent/chat?listSessions=1', {
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
      if (!activeSessionId && nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      }
    } catch (error) {
      console.error('加载会话列表失败:', error);
    }
  }, [token, activeSessionId]);

  // ========== 双笔记本系统：加载历史消息 ==========
  useEffect(() => {
    if (!user?.user_id || !token || !activeSessionId || !sessionReady) return;
    
    const fetchHistory = async () => {
      const requestId = ++historyRequestSeq.current;
      try {
        addDebugLog('api', '加载对话历史开始', { userId: user.user_id, activeSessionId });
        const qs = `?sessionId=${activeSessionId}`;
        const historyRes = await fetch(`/api/xiaohai/agent/chat${qs}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (requestId !== historyRequestSeq.current) return;
          if (historyData.success && historyData.data?.conversationHistory) {
            const msgCount = historyData.data.conversationHistory.length;
            addDebugLog('api', '加载对话历史成功', { count: msgCount });
            console.log(`📔 [笔记本1号] 加载了 ${msgCount} 条历史消息`);
            
            // 🔧 修复重复卡片问题：基于 content + created_at 去重
            const seenKeys = new Set<string>();
            const uniqueMessages: Message[] = [];
            
            for (const msg of historyData.data.conversationHistory) {
              // 使用 content + created_at 作为唯一键
              const key = `${msg.content}_${msg.created_at}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueMessages.push({
                  id: `msg_${msg.id || key}`,
                  type: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  timestamp: new Date(msg.created_at)
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
          }
        } else {
          addDebugLog('error', '加载对话历史失败：HTTP错误', { status: historyRes.status });
        }
      } catch (error) {
        console.error('📔 [笔记本1号] 加载历史消息失败:', error);
        addDebugLog('error', '加载历史消息异常', { error: String(error) });
      }
    };
    
    fetchHistory();
  }, [user?.user_id, token, activeSessionId]);

  useEffect(() => {
    if (!user?.user_id || !token) return;
    let mounted = true;
    const bootstrap = async () => {
      setSessionLoading(true);
      const res = await fetch('/api/xiaohai/agent/chat?listSessions=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mounted) return;
      if (!res.ok) {
        setSessionLoading(false);
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
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [user?.user_id, token, loadSessions]);

  const handleCreateSession = async () => {
    if (!token || isLoading || sessionLoading) return;
    setSessionLoading(true);
    try {
      const res = await fetch('/api/xiaohai/agent/chat?createSession=1', {
        headers: { Authorization: `Bearer ${token}` },
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
    }
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
          setHistory(historyData.videos?.slice(0, 8).map((v: any) => ({
            id: v.id,
            title: v.prompt?.substring(0, 20) || '视频创作',
            thumbnail: v.video_url || v.result_url || v.cover_url,
            status: v.status === 'completed' || v.status === 'succeeded' ? 'completed' : 'processing',
            createdAt: new Date(v.created_at)
          })) || []);
        }
        
        // 获取素材列表
        const materialsRes = await fetch('/api/learning-library?limit=10', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials(materialsData.learnings?.slice(0, 10).map((m: any) => ({
            id: m.id,
            name: m.title || m.video_name || '未命名素材',
            type: m.video_type === 'video' ? 'video' : 'image',
            thumbnail: m.cover_url,
            createdAt: new Date(m.created_at)
          })) || []);
        }
      } catch (error) {
        console.error('获取数据失败:', error);
      }
    };
    
    fetchData();
  }, [user?.user_id, token, activeSessionId]);

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
                public_video_url: video.public_video_url || video.video_url,
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
  };
  
  // 查看视频
  const handleViewVideo = () => {
    setShowNotificationDialog(false);
    // 可以在这里添加跳转到素材历史页面的逻辑
    window.location.href = '/material/history';
  };
  
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
    
    // 构建附件
    const apiAttachments = attachments
      .filter(a => a.status === 'success' && a.url)
      .map(a => ({ type: a.type, url: a.url!, name: a.name }));
    
    // 收集对话历史
    let currentText = '';
    let currentAnalysis: VideoAnalysis | undefined;
    let currentScripts: ScriptOption[] = [];
    // 🔧 简化：删除 currentTask，视频生成后去视频历史页面查看
    
    const requestBody = {
      message: text,
      attachments: apiAttachments,
      history: conversationHistory.current,
      sessionId: activeSessionId,
      webSearchEnabled  // 联网搜索开关
    };
    
    addDebugLog('api', '发送请求到 API', { 
      historyLength: conversationHistory.current.length,
      requestBodyKeys: Object.keys(requestBody)
    });
    
    try {
      await streamAgentRequest(
        '/api/xiaohai/agent/chat',
        requestBody,
        token || '',
        (event: SSEEvent) => {
          addDebugLog('sse', `收到 SSE 事件: ${event.type}`, event);
          
          switch (event.type) {
            case 'start':
              currentText = '';
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
                      msg.id === streamingId ? { ...msg, content: currentText } : msg
                    );
                  } else {
                    const nextId = streamingId || generateId('stream');
                    streamingMessageIdRef.current = nextId;
                    return [...prev, {
                      id: nextId,
                      type: 'assistant' as const,
                      content: currentText,
                      timestamp: new Date()
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
                const { cleanedContent, attachments: imageAttachments } = extractImageAttachments(currentText);
                const hasScriptDup =
                  currentScripts.length > 0 &&
                  currentScripts.some((script) =>
                    (script.content || '').trim() &&
                    cleanedContent.includes((script.content || '').trim().slice(0, 40))
                  );
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id !== streamingId) return msg;
                    return {
                      ...msg,
                      content: hasScriptDup ? '已生成结构化脚本，请查看下方表格。' : cleanedContent,
                      attachments: [...(msg.attachments || []), ...imageAttachments],
                      videoAnalysis: currentAnalysis || msg.videoAnalysis,
                      scriptOptions: currentScripts.length > 0 ? currentScripts : msg.scriptOptions,
                    };
                  })
                );
              }
              
              setIsLoading(false);
              streamingMessageIdRef.current = null;
              loadSessions({ preferredSessionId: activeSessionId });
              break;
          }
        },
        (error: Error) => {
          addDebugLog('error', 'SSE 流错误', { message: error.message });
          setIsLoading(false);
          streamingMessageIdRef.current = null;
          setMessages((prev) => [
            ...prev,
            {
              id: generateId('msg'),
              type: 'system',
              content: '网络波动或服务超时，已自动停止本次请求。你可以重试。',
              timestamp: new Date(),
            },
          ]);
        }
      );
    } catch (error) {
      console.error('发送消息失败:', error);
      setIsLoading(false);
      streamingMessageIdRef.current = null;
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
      
      <div className="flex h-[calc(100vh-140px)]">
        {/* 左侧对话区 - min-h-0 关键！ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 头部 - shrink-0 防止被压缩 */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b">
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
              <Select
                value={activeSessionId || undefined}
                onValueChange={(value) => {
                  if (isLoading || sessionLoading) return;
                  setActiveSessionId(value);
                  setMessages([]);
                  conversationHistory.current = [];
                }}
              >
                <SelectTrigger className="w-[240px] h-8">
                  <SelectValue placeholder="选择会话" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.title || session.id.slice(0, 8)}
                    </SelectItem>
                  ))}
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
              <Badge variant="outline" className="text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                在线
              </Badge>
            </div>
          </div>
          
          {/* 消息区域 - min-h-0 关键！允许收缩 */}
          <ScrollArea className="min-h-0 flex-1 px-6 py-4">
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
                    attachments: m.attachments?.map(a => ({
                      type: a.type as 'video' | 'image' | 'link',
                      url: a.url,
                      name: a.name
                    })),
                    isStreaming: m.id.startsWith('stream_')
                  }))}
                />
                
                {/* 显示分析卡片 */}
                {messages.map(m => m.videoAnalysis && (
                  <div key={`analysis-${m.id}`} className="mt-4">
                    <AnalysisCard analysis={m.videoAnalysis} />
                  </div>
                ))}
                
                {/* 显示脚本预览 */}
                {messages.map(m => m.scriptOptions && (
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
          <div className="shrink-0 px-6 py-4 border-t">
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
        <div className="w-80 border-l bg-muted/30 shrink-0 overflow-y-auto">
          <RightSidebar
            creationOptions={creationOptions}
            onCreationOptionsChange={setCreationOptions}
            templates={templates}
            history={history}
            materials={materials}
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
