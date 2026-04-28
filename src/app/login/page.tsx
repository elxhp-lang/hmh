'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  ArrowRight,
  User,
  Lock,
  Clock,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('login');
  
  // 审核中弹窗状态
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalUsername, setApprovalUsername] = useState('');

  // 登录表单
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
  });

  // 注册表单
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiRequest<{ token: string; user: unknown }>('/api/auth/login', {
        method: 'POST',
        body: loginForm,
      });

      login(response.token, response.user as Parameters<typeof login>[1]);
      router.push('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录失败';
      
      // 如果是审核中的状态，显示弹窗
      if (errorMessage.includes('审核中')) {
        setApprovalUsername(loginForm.username);
        setShowApprovalDialog(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest<{ 
        success: string; 
        needApproval?: boolean;
        user?: { username: string };
      }>('/api/auth/register', {
        method: 'POST',
        body: {
          username: registerForm.username,
          password: registerForm.password,
        },
      });

      // 如果需要审核
      if (response.needApproval) {
        setApprovalUsername(registerForm.username);
        setShowApprovalDialog(true);
        // 重置表单
        setRegisterForm({ username: '', password: '', confirmPassword: '' });
        setActiveTab('login');
      } else {
        // 第一个用户，自动登录
        const loginResponse = await apiRequest<{ token: string; user: unknown }>('/api/auth/login', {
          method: 'POST',
          body: {
            username: registerForm.username,
            password: registerForm.password,
          },
        });

        login(loginResponse.token, loginResponse.user as Parameters<typeof login>[1]);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧视觉展示区 - 深色背景 + 玻璃拟态几何图形 */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#0F172A]">
        {/* 渐变背景层 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] via-[#1E1B4B] to-[#0F172A]" />
        
        {/* 光晕效果 */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/15 rounded-full blur-[100px]" />
        </div>

        {/* 玻璃拟态几何图形 - 层叠效果 */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* 底层图形 - 最大 */}
          <div 
            className="absolute w-72 h-80 rounded-3xl -rotate-12 translate-x-[-30px] translate-y-[40px]"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.08)',
            }}
          />
          
          {/* 中层图形 */}
          <div 
            className="absolute w-64 h-72 rounded-3xl rotate-6 translate-x-[15px] translate-y-[-20px]"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
            }}
          />
          
          {/* 顶层图形 */}
          <div 
            className="absolute w-56 h-64 rounded-3xl -rotate-3 translate-x-[5px] translate-y-[5px]"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.45) 0%, rgba(168, 85, 247, 0.35) 100%)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
            }}
          />

          {/* 最顶层 - Logo 展示 */}
          <div 
            className="relative w-48 h-56 rounded-3xl flex flex-col items-center justify-center p-6"
            style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.55) 0%, rgba(168, 85, 247, 0.45) 100%)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), inset 0 2px 2px rgba(255, 255, 255, 0.2), 0 0 60px rgba(99, 102, 241, 0.3)',
            }}
          >
            {/* Logo */}
            <div className="relative w-20 h-20 mb-4">
              <Image
                src="/images/logo.png"
                alt="海盟会"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
            
            {/* 品牌名 */}
            <h1 className="text-2xl font-bold text-white tracking-wide">
              海盟会
            </h1>
          </div>
        </div>
      </div>

      {/* 右侧登录区 - 浅灰背景 + 白色卡片 */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-8">
            <Logo size="lg" variant="light" />
            <p className="mt-2 text-muted-foreground text-sm">多智能体协作的视频生成平台</p>
          </div>

          {/* 登录卡片 - 白色 + 大圆角 + 发光阴影 */}
          <div 
            className="rounded-2xl p-8 bg-white"
            style={{
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1), 0 8px 40px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* 标题 */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {activeTab === 'login' ? '欢迎回来' : '创建账户'}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {activeTab === 'login' ? '登录您的账户继续' : '填写信息完成注册'}
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 rounded-lg h-10">
                <TabsTrigger value="login" className="rounded-md text-sm">登录</TabsTrigger>
                <TabsTrigger value="register" className="rounded-md text-sm">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-sm font-medium">用户名</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-username"
                        type="text"
                        placeholder="请输入用户名"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        required
                        className="h-11 pl-10 bg-white border-[#E0E0E0] rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium">密码</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="请输入密码"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                        className="h-11 pl-10 bg-white border-[#E0E0E0] rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* 登录按钮 - 大圆角，蓝色，占宽度大部分 */}
                  <Button 
                    type="submit" 
                    className="w-full h-11 mt-6 rounded-lg bg-[#1E40AF] hover:bg-[#1E40AF]/90 text-white font-medium shadow-lg transition-all text-sm" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登录中...
                      </>
                    ) : (
                      <>
                        登录
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-username" className="text-sm font-medium">用户名</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="请输入用户名"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                        required
                        className="h-11 pl-10 bg-white border-[#E0E0E0] rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-sm font-medium">密码</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-password"
                          type="password"
                          placeholder="至少6位"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          required
                          minLength={6}
                          className="h-11 pl-10 bg-white border-[#E0E0E0] rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm" className="text-sm font-medium">确认密码</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="register-confirm"
                          type="password"
                          placeholder="再次输入"
                          value={registerForm.confirmPassword}
                          onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                          required
                          className="h-11 pl-10 bg-white border-[#E0E0E0] rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 注册按钮 */}
                  <Button 
                    type="submit" 
                    className="w-full h-11 mt-6 rounded-lg bg-[#1E40AF] hover:bg-[#1E40AF]/90 text-white font-medium shadow-lg transition-all text-sm" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        注册中...
                      </>
                    ) : (
                      <>
                        注册账号
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* 底部 */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              登录即表示您同意我们的服务条款和隐私政策
            </p>
          </div>
        </div>
      </div>

      {/* 审核中弹窗 */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              注册申请已提交
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <Clock className="w-8 h-8 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-amber-900">管理员审核中</div>
                    <div className="text-sm text-amber-700 mt-1">
                      您的注册申请已发送至管理员，请等待审核通过后登录使用。
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <div>用户名：<span className="font-medium">{approvalUsername}</span></div>
                  <div className="mt-2">审核结果将通过飞书通知您，请注意查收。</div>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setShowApprovalDialog(false)}>
              我知道了
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
