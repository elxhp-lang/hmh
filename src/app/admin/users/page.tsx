'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePermission } from '@/contexts/AuthContext';
import { useApi } from '@/lib/api';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Edit, AlertCircle, Check, X, Trash2 } from 'lucide-react';

interface UserRecord {
  user_id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  company: string;
  created_at: string;
}

interface RequestErrorLike {
  message?: string;
}

export default function UsersPage() {
  const { hasPermission } = usePermission();
  const { request } = useApi();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState({ role: '', status: '' });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 审核对话框
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingUser, setApprovingUser] = useState<UserRecord | null>(null);
  const [approveRole, setApproveRole] = useState('material_member');

  // 删除对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }

      const data = await request<{ users: UserRecord[] }>(`/api/admin/users?${params}`);
      setUsers(data.users || []);
    } catch (e) {
      console.error('加载用户列表失败:', e);
    } finally {
      setLoading(false);
    }
  }, [request, search]);

  useEffect(() => {
    if (hasPermission) {
      loadUsers();
    }
  }, [hasPermission, loadUsers]);

  const handleEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditForm({ role: user.role, status: user.status });
    setEditError(null);
    setEditDialogOpen(true);
  };

  // 审核用户（通过/拒绝）
  const handleApprove = async (userId: string, action: 'approve' | 'reject') => {
    try {
      setLoading(true);
      await request(`/api/admin/users/approve`, {
        method: 'POST',
        body: { user_id: userId, action },
      });
      toast.success(action === 'approve' ? '已通过审核' : '已拒绝该申请');
      loadUsers();
    } catch (e: unknown) {
      toast.error((e as RequestErrorLike)?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 通过审核（带角色选择）
  const handleApproveWithRole = async (userId: string, role: string) => {
    try {
      setLoading(true);
      await request(`/api/admin/users/approve`, {
        method: 'POST',
        body: { user_id: userId, action: 'approve', role },
      });
      const roleText = role === 'material_member' ? '普通用户' : role === 'material_leader' ? '团队负责人' : role === 'admin' ? '管理员' : '超级管理员';
      toast.success(`审核通过，已分配角色：${roleText}`);
      setApproveDialogOpen(false);
      loadUsers();
    } catch (e: unknown) {
      toast.error((e as RequestErrorLike)?.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setLoading(true);
      await request(`/api/admin/users/${deletingUser.user_id}`, {
        method: 'DELETE',
      });
      toast.success(`用户 ${deletingUser.username} 已删除`);
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      loadUsers();
    } catch (e: unknown) {
      toast.error((e as RequestErrorLike)?.message || '删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    setEditError(null);
    setEditSubmitting(true);

    try {
      await request(`/api/admin/users/${editingUser.user_id}`, {
        method: 'PUT',
        body: editForm,
      });

      setEditDialogOpen(false);
      loadUsers();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>您没有权限访问此页面</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">用户管理</h1>
            <p className="text-muted-foreground">管理系统用户和权限</p>
          </div>
        </div>

        {/* 搜索 */}
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-4">
              <Input
                placeholder="搜索用户名或邮箱..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无用户</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'}>
                          {user.role === 'super_admin'
                            ? '超级管理员'
                            : user.role === 'admin'
                            ? '管理员'
                            : user.role === 'finance'
                            ? '财务'
                            : '普通用户'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            user.status === 'active' || user.status === 'approved' 
                              ? 'default' 
                              : user.status === 'disabled' 
                              ? 'destructive' 
                              : 'secondary'
                          }
                        >
                          {user.status === 'active' && '正常'}
                          {user.status === 'approved' && '已认证'}
                          {user.status === 'pending' && '等待审核'}
                          {user.status === 'rejected' && '已拒绝'}
                          {user.status === 'disabled' && '已禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleString('zh-CN')}</TableCell>
                      <TableCell>
                        {user.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => {
                                setApprovingUser(user);
                                setApproveRole('material_member');
                                setApproveDialogOpen(true);
                              }}
                              disabled={loading}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              通过
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleApprove(user.user_id, 'reject')}
                              disabled={loading}
                            >
                              <X className="h-4 w-4 mr-1" />
                              拒绝
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setDeletingUser(user);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={loading}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 编辑对话框 */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑用户</DialogTitle>
              <DialogDescription>修改用户角色和状态</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">用户名: {editingUser?.username}</p>
                <p className="text-sm text-muted-foreground">邮箱: {editingUser?.email}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">角色</label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">普通用户</SelectItem>
                    <SelectItem value="finance">财务</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">状态</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="disabled">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSubmitting}>
                {editSubmitting ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 审核对话框 */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>审核用户申请</DialogTitle>
              <DialogDescription>
                为 {approvingUser?.username} 分配角色
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="approve-role">分配角色</Label>
                <Select value={approveRole} onValueChange={setApproveRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material_member">普通用户</SelectItem>
                    <SelectItem value="material_leader">团队负责人</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={() => {
                if (approvingUser) {
                  handleApproveWithRole(approvingUser.user_id, approveRole);
                }
              }} disabled={loading}>
                {loading ? '处理中...' : '确认通过'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 删除确认对话框 */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除用户</DialogTitle>
              <DialogDescription>
                确定要删除用户 <strong>{deletingUser?.username}</strong> 吗？此操作不可恢复。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDeleteDialogOpen(false);
                setDeletingUser(null);
              }}>
                取消
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser} disabled={loading}>
                {loading ? '删除中...' : '确认删除'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
