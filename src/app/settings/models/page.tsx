'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Play, Loader2, Shield, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Zap, Image, Video, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface UserModel {
  id: string; alias: string; model_type: 'chat' | 'image' | 'video';
  api_url: string; model_name: string; status: string; caps?: Record<string, unknown>;
  audit_result?: Record<string, unknown>; last_tested_at?: string; created_at: string;
}

export default function ModelsPage() {
  const { token } = useAuth();
  const [models, setModels] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [dialogInput, setDialogInput] = useState('');

  const loadModels = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/models', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setModels(data?.data || []);
    } catch { /* */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadModels(); }, [loadModels]);

  const handleDelete = async (id: string) => {
    try { await fetch(`/api/models?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); toast.success('已删除'); loadModels(); }
    catch { toast.error('删除失败'); }
  };

  const handleTest = async (id: string) => {
    setTesting(id); setTestResult(null); setExpanded(id);
    try {
      const res = await fetch('/api/models/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id }) });
      const data = await res.json();
      setTestResult(data?.data || null);
      if (data?.data?.status === 'ok') toast.success('全部连通');
      else toast.error(`${data?.data?.tests?.filter((t:Record<string,unknown>)=>t.status==='failed').length || 0} 项失败`);
      loadModels();
    } catch { toast.error('测试失败'); }
    setTesting(null);
  };

  const statusBadge = (s: string) => {
    if (s === 'ok') return <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />已连通</Badge>;
    if (s === 'partial') return <Badge variant="outline" className="text-amber-600 border-amber-300"><AlertTriangle className="w-3 h-3 mr-1" />部分通过</Badge>;
    if (s === 'failed') return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />失败</Badge>;
    if (s === 'analyzing') return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />分析中</Badge>;
    return <Badge variant="secondary">未测试</Badge>;
  };

  const typeIcon = (t: string) => {
    if (t === 'chat') return <Zap className="w-3 h-3" />;
    if (t === 'image') return <Image className="w-3 h-3" />;
    if (t === 'video') return <Video className="w-3 h-3" />;
    return null;
  };

  const capLabels: Record<string, string> = {
    multi_modal: '多模态生成', reference_video: '视频生视频', reference_audio: '音频参考', max_duration: '最大时长',
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
            <h1 className="text-2xl font-bold">模型管理</h1>
          </div>
          <Link href="/settings/models/add">
            <Button className="gap-1"><Plus className="w-4 h-4" />添加模型</Button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />加载中...</div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无自定义模型</p>
            <p className="text-xs mt-1">点击"添加模型"开始配置</p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.map(m => (
              <div key={m.id}>
                <Card className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.alias}</span>
                      {statusBadge(m.status)}
                      {typeIcon(m.model_type)}
                      <span className="text-xs text-muted-foreground">{m.model_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{m.api_url}</p>
                    {m.caps && Object.keys(m.caps).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(m.caps).map(([k, v]) => (
                          <Badge key={k} variant="outline" className={`text-[10px] h-4 ${v === false ? 'text-muted-foreground line-through' : ''}`}>
                            {capLabels[k] || k}{typeof v === 'number' ? `:${v}s` : ''}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleTest(m.id)} disabled={testing === m.id}>
                      {testing === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      <span className="ml-1 hidden sm:inline">测试</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                      {expanded === m.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </Card>
                {expanded === m.id && testResult && (() => {
                  const tr = testResult as Record<string,unknown>;
                  const tests = tr.tests as Array<Record<string,unknown>> | undefined;
                  return (
                  <div className="bg-muted/30 border rounded-b-lg p-3 space-y-2">
                    {tr.explanation ? <p className="text-sm font-medium">{String(tr.explanation)}</p> : null}
                    {tests?.map((t, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        {t.status === 'ok' ? <CheckCircle className="w-3 h-3 text-green-500" /> :
                         t.status === 'failed' ? <XCircle className="w-3 h-3 text-red-500" /> :
                         <AlertTriangle className="w-3 h-3 text-amber-500" />}
                        <span>{String(t.detail || '')}</span>
                        {t.status === 'failed' && t.error ? <span className="text-muted-foreground">({String(t.error)})</span> : null}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <Textarea value={dialogInput} onChange={e => setDialogInput(e.target.value)} placeholder="补充配置信息..." className="text-xs h-16" />
                      <Button size="sm" onClick={() => handleTest(m.id)} disabled={testing === m.id}>重新测试</Button>
                    </div>
                  </div>
                  );})()}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
