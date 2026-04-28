'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Shield,
  Calendar,
  Loader2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  display_name?: string;
  avatar_url?: string;
}

const ROLE_NAMES: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  finance: '财务',
  material_leader: '素材组长',
  material_member: '素材成员',
};

export default function SettingsPage() {
  const { token, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setDisplayName(data.user.display_name || data.user.username);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      toast.error('加载用户信息失败');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 加载用户信息
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // 监听变化
  useEffect(() => {
    if (profile) {
      const originalName = profile.display_name || profile.username;
      setHasChanges(displayName !== originalName);
    }
  }, [displayName, profile]);

  // 保存修改
  const handleSave = async () => {
    if (!token || !displayName.trim()) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      
      if (response.ok) {
        toast.success('保存成功');
        setHasChanges(false);
        // 更新本地状态
        if (profile) {
          setProfile({ ...profile, display_name: displayName.trim() });
        }
        // 更新 AuthContext 中的用户信息
        updateUser({ display_name: displayName.trim() });
        // 通知 DashboardLayout 刷新用户信息
        window.dispatchEvent(new CustomEvent('profileUpdated'));
      } else {
        const data = await response.json();
        toast.error(data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 获取头像首字母
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">账户设置</h1>
              <p className="text-muted-foreground">管理您的个人资料和偏好</p>
            </div>
          </div>
        </div>

        {/* 基本信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">基本信息</CardTitle>
            <CardDescription>您的账户标识信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 头像区域 */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                  {getInitials(profile?.display_name || profile?.username || 'U')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{profile?.display_name || profile?.username}</p>
                <p className="text-sm text-muted-foreground">{profile?.role && ROLE_NAMES[profile.role]}</p>
              </div>
            </div>

            <Separator />

            {/* 显示名称编辑 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">显示名称</Label>
                <div className="flex gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="输入您的显示名称"
                    className="flex-1"
                    maxLength={50}
                  />
                  {hasChanges && (
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      保存
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  显示名称用于界面展示，修改后其他用户将看到您的新名称
                </p>
              </div>
            </div>

            <Separator />

            {/* 账户信息 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">用户名</p>
                  <p className="font-medium">{profile?.username}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">角色</p>
                  <p className="font-medium">
                    {profile?.role && ROLE_NAMES[profile.role]}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">注册时间</p>
                  <p className="font-medium">
                    {profile?.created_at && formatDate(profile.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 提示信息 */}
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            用户名（{profile?.username}）是您的唯一账户标识，不可修改。显示名称可以随时更改，不影响系统对您身份的识别。
          </AlertDescription>
        </Alert>
      </div>
    </DashboardLayout>
  );
}
