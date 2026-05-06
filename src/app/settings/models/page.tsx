'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Play, Loader2, Shield, Zap, ArrowLeft, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface UserModel {
  id: string;
  alias: string;
  model_type: 'chat' | 'video';
  api_url: string;
  model_name: string;
  is_default: boolean;
  auto_fallback: boolean;
  status: string;
  last_tested_at?: string;
  created_at: string;
}

export default function ModelsPage() {
  const { token } = useAuth();
  const [models, setModels] = useState<UserModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Form state
  const [alias, setAlias] = useState('');
  const [modelType, setModelType] = useState<'chat' | 'video'>('chat');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');

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

  const resetForm = () => {
    setAlias(''); setModelType('chat'); setApiUrl(''); setApiKey(''); setModelName('');
    setShowKey(false); setShowForm(false);
  };

  const handleSave = async () => {
    if (!alias || !apiUrl || !apiKey || !modelName) {
      toast.error('请填写所有字段'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ alias, model_type: modelType, api_url: apiUrl, api_key: apiKey, model_name: modelName }),
      });
      if (res.ok) { toast.success('模型已添加'); resetForm(); loadModels(); }
      else { const err = await res.json(); toast.error(err.error || '添加失败'); }
    } catch { toast.error('网络错误'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/models?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      toast.success('已删除'); loadModels();
    } catch { toast.error('删除失败'); }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data?.data?.status === 'ok') toast.success('连接成功');
      else toast.error(data?.data?.error || '连接失败');
      loadModels();
    } catch { toast.error('测试失败'); }
    setTesting(null);
  };

  const statusBadge = (status: string) => {
    if (status === 'ok') return <Badge variant="outline" className="text-green-600 border-green-300">已连接</Badge>;
    if (status === 'failed') return <Badge variant="destructive">连接失败</Badge>;
    return <Badge variant="secondary">未测试</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/settings"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
            <h1 className="text-2xl font-bold">模型配置</h1>
          </div>
          <Button onClick={() => setShowForm(true)} disabled={showForm} className="gap-1">
            <Plus className="w-4 h-4" /> 添加模型
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-lg">添加新模型</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>别名</Label><Input value={alias} onChange={e => setAlias(e.target.value)} placeholder="如: 我的DeepSeek" /></div>
                <div>
                  <Label>模型类型</Label>
                  <Select value={modelType} onValueChange={v => setModelType(v as 'chat' | 'video')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat"><Zap className="w-3 h-3 inline mr-1" />对话模型</SelectItem>
                      <SelectItem value="video"><Play className="w-3 h-3 inline mr-1" />视频模型</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>API 地址</Label><Input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://api.openai.com" /></div>
              <div>
                <Label>API 密钥</Label>
                <div className="flex gap-2">
                  <Input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." className="flex-1" />
                  <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div><Label>模型名称</Label><Input value={modelName} onChange={e => setModelName(e.target.value)} placeholder="gpt-4o / deepseek-v3" /></div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}保存
                </Button>
                <Button variant="outline" onClick={resetForm}>取消</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />加载中...</div>
        ) : models.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无自定义模型</p>
            <p className="text-xs mt-1">添加模型后可在此管理</p>
          </div>
        ) : (
          <div className="space-y-3">
            {models.map(m => (
              <Card key={m.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.alias}</span>
                    {statusBadge(m.status)}
                    {m.is_default && <Badge variant="outline" className="text-amber-600 border-amber-300">默认</Badge>}
                    <Badge variant="secondary" className="text-xs">{m.model_type === 'chat' ? '对话' : '视频'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{m.model_name} · {m.api_url}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleTest(m.id)} disabled={testing === m.id}>
                    {testing === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    <span className="ml-1 hidden sm:inline">测试</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
