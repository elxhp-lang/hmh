'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Eye, EyeOff, Zap, Image, Video, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AddModelPage() {
  const { token } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({
    alias: '', model_type: 'chat' as 'chat' | 'image' | 'video',
    api_url: '', api_key: '', model_name: '', api_example: '',
  });

  const handleSave = async () => {
    if (!form.alias || !form.api_url || !form.api_key || !form.model_name) {
      toast.error('请填写必填字段'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) { toast.success('模型已添加'); router.push('/settings/models'); }
      else { const err = await res.json(); toast.error(err.error || '添加失败'); }
    } catch { toast.error('网络错误'); }
    setSaving(false);
  };

  const typeIcons: Record<string, React.ReactNode> = {
    chat: <Zap className="w-4 h-4" />,
    image: <Image className="w-4 h-4" />,
    video: <Video className="w-4 h-4" />,
  };

  const typePlaceholders: Record<string, string> = {
    chat: 'https://api.openai.com',
    image: 'https://api.openai.com',
    video: 'https://api.minimax.com',
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/settings/models"><ArrowLeft className="w-5 h-5 text-muted-foreground hover:text-foreground" /></Link>
          <h1 className="text-2xl font-bold">添加模型</h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">模型信息</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>别名 *</Label>
                <Input value={form.alias} onChange={e => setForm({...form, alias: e.target.value})} placeholder="如: 我的DeepSeek" />
              </div>
              <div>
                <Label>模型类型 *</Label>
                <Select value={form.model_type} onValueChange={v => setForm({...form, model_type: v as typeof form.model_type})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">{typeIcons.chat} <span className="ml-1">主Agent对话模型</span></SelectItem>
                    <SelectItem value="image">{typeIcons.image} <span className="ml-1">图片生成模型</span></SelectItem>
                    <SelectItem value="video">{typeIcons.video} <span className="ml-1">视频生成模型</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>API 地址 *</Label>
              <Input value={form.api_url} onChange={e => setForm({...form, api_url: e.target.value})} placeholder={typePlaceholders[form.model_type]} />
            </div>
            <div>
              <Label>API 密钥 *</Label>
              <div className="flex gap-2">
                <Input type={showKey ? 'text' : 'password'} value={form.api_key} onChange={e => setForm({...form, api_key: e.target.value})} placeholder="sk-..." className="flex-1" />
                <Button variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label>模型名称 *</Label>
              <Input value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})} placeholder="gpt-4o / deepseek-v3" />
            </div>
            {(form.model_type === 'image' || form.model_type === 'video') && (
              <div>
                <Label>标准调用代码（图片/视频模型必填）</Label>
                <p className="text-xs text-muted-foreground mb-1">粘贴该模型的标准API调用代码，子Agent将自动分析字段映射</p>
                <Textarea
                  value={form.api_example}
                  onChange={e => setForm({...form, api_example: e.target.value})}
                  placeholder="import ...&#10;client = ...&#10;response = client.images.generate(prompt='...')&#10;print(response.data[0].url)"
                  className="min-h-[120px] font-mono text-xs"
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}保存并分析
              </Button>
              <Button variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
