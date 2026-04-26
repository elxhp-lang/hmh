'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { streamRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, FileText, User, Bot, Lock, History, Calendar, Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

const HOUR_24 = 24 * 60 * 60 * 1000;

export default function AgentPage() {
  const { user, token } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId] = useState(() => `finance_${Date.now()}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 历史记录相关
  const [showFinanceHistory, setShowFinanceHistory] = useState(false);
  const [financeHistory, setFinanceHistory] = useState<Message[]>([]);
  const [hasOlderFinanceHistory, setHasOlderFinanceHistory] = useState(false);
  const [loadingFinanceHistory, setLoadingFinanceHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false); // 标记是否已加载过历史

  // 联网搜索相关
  const [isSearching, setIsSearching] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{title: string; url: string; snippet: string; siteName?: string}>>([]);
  const [searchSummary, setSearchSummary] = useState<string | null>(null);

  // 加载财务助手历史记录
  const loadFinanceHistory = useCallback(async () => {
    if (!token || historyLoaded) return;

    setLoadingFinanceHistory(true);
    try {
      const response = await fetch('/api/agent/finance/history?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.messages && Array.isArray(data.messages)) {
        const now = Date.now();
        const recentMsgs = data.messages
          .filter((m: any) => {
            // API 返回的是 timestamp，前端需要 created_at
            const msgTime = new Date(m.created_at || m.timestamp).getTime();
            return now - msgTime < HOUR_24;
          })
          .map((m: any) => ({
            id: m.id || `msg_${m.created_at || m.timestamp}`,
            role: m.role,
            content: m.content,
            created_at: m.created_at || m.timestamp,
          }));

        // 保存历史记录
        setFinanceHistory(recentMsgs);
        setHasOlderFinanceHistory(data.messages.length > recentMsgs.length);

        // 首次加载时设置消息列表
        setMessages(recentMsgs);
        setHistoryLoaded(true);
      }
    } catch (e) {
      console.error('加载财务助手历史失败:', e);
    } finally {
      setLoadingFinanceHistory(false);
    }
  }, [token, historyLoaded]);

  // 初始化加载
  useEffect(() => {
    if (token) {
      loadFinanceHistory();
    }
  }, [token, loadFinanceHistory]);

  // 滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputMessage.trim() || loading || !token) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputMessage,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      await streamRequest(
        '/api/agent/finance',
        { message: inputMessage, conversationId, webSearchEnabled },
        token,
        (chunk) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return prev.map(m =>
                m.id === last.id
                  ? { ...m, content: m.content + chunk }
                  : m
              );
            } else {
              return [...prev, {
                id: `assistant_${Date.now()}`,
                role: 'assistant',
                content: chunk,
                created_at: new Date().toISOString(),
              }];
            }
          });
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // 联网搜索功能
  // 联网搜索开关
  const handleWebSearchToggle = () => {
    setWebSearchEnabled(prev => !prev);
  };

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < HOUR_24) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-80px)]">
        {/* 左侧栏 */}
        <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
          {/* 标题 */}
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">智能助手</h2>
            <p className="text-xs text-muted-foreground mt-1">财务管理 & 咨询</p>
          </div>

          {/* 财务助手 */}
          <div className="p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#1E40AF] text-white rounded-lg">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">财务助手</span>
                <Lock className="h-3 w-3 ml-auto opacity-60" />
              </div>
              {hasOlderFinanceHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground"
                  onClick={() => setShowFinanceHistory(true)}
                >
                  <History className="h-3 w-3 mr-1" />
                  24小时前历史
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1" />
        </div>

        {/* 右侧对话区 */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* 顶部 */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#1E40AF] text-white text-sm">F</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-slate-900">财务助手</p>
                <p className="text-xs text-muted-foreground">解答账单和费用问题</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              #{user?.username?.slice(0, 5).toUpperCase()}
            </span>
          </div>

          {/* 消息区 */}
          <div className="flex-1 overflow-hidden p-4">
            <ScrollArea className="h-full">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Bot className="h-12 w-12 text-slate-300 mb-4" />
                  <p className="text-slate-500">开始与财务助手对话</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    查询消费明细、账户余额或了解计费规则
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role === 'assistant' && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-sm">F</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`rounded-2xl px-4 py-2 max-w-[80%] ${
                        msg.role === 'user'
                          ? 'bg-[#1E40AF] text-white'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === 'user' && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-slate-200 text-slate-600 text-sm">U</AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-slate-100 text-slate-600 text-sm">F</AvatarFallback>
                      </Avatar>
                      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    </div>
                  )}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>
          </div>

          {/* 输入区 */}
          <div className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-3 max-w-3xl mx-auto">
              <Input
                placeholder="输入您的问题..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || isSearching}
                className="flex-1 h-11 rounded-xl"
              />
              {/* 联网搜索开关 */}
              <Button
                variant="outline"
                onClick={handleWebSearchToggle}
                disabled={loading}
                className={cn(
                  "h-11 px-4 rounded-xl border-slate-300 transition-all",
                  webSearchEnabled 
                    ? "bg-blue-100 hover:bg-blue-200 border-blue-300" 
                    : "hover:bg-slate-100"
                )}
                title={webSearchEnabled ? "联网已开启" : "联网已关闭"}
              >
                <Globe className={cn(
                  "h-4 w-4",
                  webSearchEnabled ? "text-blue-500" : "text-slate-500"
                )} />
              </Button>
              <Button
                onClick={handleSend}
                disabled={loading || !inputMessage.trim()}
                className="h-11 px-6 rounded-xl bg-[#1E40AF]"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {error && (
              <p className="text-destructive text-sm mt-2 text-center">{error}</p>
            )}
          </div>
        </div>

        {/* 历史记录弹窗 */}
        <Dialog open={showFinanceHistory} onOpenChange={setShowFinanceHistory}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                财务助手历史记录
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {loadingFinanceHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : financeHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无历史记录
                </div>
              ) : (
                <div className="space-y-4 p-2">
                  {financeHistory.map((msg) => (
                    <div key={msg.id} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                        <span>{formatTime(msg.created_at)}</span>
                      </div>
                      <div className={`rounded-lg px-3 py-2 ${
                        msg.role === 'user' ? 'bg-blue-50 ml-4' : 'bg-slate-100 mr-4'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
