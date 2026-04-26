'use client';

import { useAuth, usePermission } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Video,
  FileText,
  Users,
  MessageSquare,
  LogOut,
  Menu,
  X,
  Sparkles,
  Brain,
  Package,
  TrendingUp,
  Settings,
  User,
  Bell,
  Check,
  CheckCheck,
  VideoIcon,
  AlertCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getUserNavMenu, ROLE_NAMES, UserRole } from '@/lib/permissions';

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Video,
  Receipt: FileText,
  Sparkles,
  Users,
  UserCog: User,
  Brain,
  History: FileText,
  Package,
  TrendingUp,
};

interface UserProfile {
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
}

interface Notification {
  id: string;
  notification_type: string;
  title: string;
  content: string;
  related_video_id?: string;
  related_video_name?: string;
  related_video_url?: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { isAdmin, isFinance } = usePermission();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // 加载用户资料
  useEffect(() => {
    // 只要有 token 就尝试加载 profile
    const token = localStorage.getItem('haimeng_token');
    if (token) {
      loadProfile();
      loadNotifications();
    }
  }, []);

  // 监听 profile 更新事件（设置页面保存后触发）
  useEffect(() => {
    const handleProfileUpdate = () => {
      loadProfile();
    };
    
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('haimeng_token');
      if (!token) return;
      
      const response = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
      }
    } catch (error) {
      console.error('加载用户资料失败:', error);
    }
  };

  // 加载消息通知
  const loadNotifications = async () => {
    const token = localStorage.getItem('haimeng_token');
    if (!token) return;

    try {
      setLoadingNotifications(true);
      const response = await fetch('/api/notifications?limit=10', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('加载通知失败:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // 标记单个通知为已读
  const markAsRead = async (id: string) => {
    const token = localStorage.getItem('haimeng_token');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 标记全部已读
  const markAllAsRead = async () => {
    const token = localStorage.getItem('haimeng_token');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
  };

  // 获取通知类型图标
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'video_completed':
        return <VideoIcon className="h-4 w-4 text-green-500" />;
      case 'video_failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  // 根据角色获取导航菜单
  const navItems = getUserNavMenu(user?.role || 'material_member').map(item => ({
    href: item.href,
    label: item.label,
    icon: iconMap[item.icon] || LayoutDashboard,
  }));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // 获取显示名称
  const displayName = profile?.display_name || profile?.username || user?.username || '用户';
  
  // 获取头像首字母
  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      {/* 移动端顶部导航 */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-9 w-9"
        >
          {sidebarOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
        </Button>
        <span className="font-semibold text-slate-900">海盟会</span>
        <div className="w-9" />
      </header>

      {/* 侧边栏 - 可伸缩设计 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-[#0F172A] transform transition-all duration-300 ease-in-out flex flex-col group ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-16 xl:w-20 hover:w-64'
        }`}
      >
        {/* Logo 区域 */}
        <div className="h-14 lg:h-16 flex items-center justify-center w-full border-b border-white/10 overflow-hidden">
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm lg:text-base">海</span>
          </div>
          <span className="ml-3 text-white font-semibold text-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            海盟会
          </span>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4 flex flex-col overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center h-12 lg:h-14 w-full px-4 transition-all relative group/item ${
                  active
                    ? 'bg-[#1E40AF] text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-r-full" />
                )}
                <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 lg:h-6 lg:w-6" />
                </div>
                <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* 消息通知中心 */}
        <div className="py-2 border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center h-12 lg:h-14 w-full px-4 hover:bg-white/5 transition-colors relative">
                <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center shrink-0 relative">
                  <Bell className="h-5 w-5 lg:h-6 lg:w-6 text-white/60" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 lg:w-5 lg:h-5 bg-red-500 text-white text-[10px] lg:text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium text-white/60">
                  消息中心
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>消息通知</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-500 hover:text-blue-600 flex items-center"
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    全部已读
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  暂无通知
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={`flex flex-col items-start p-3 cursor-pointer ${!notification.is_read ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                      if (notification.action_url) {
                        router.push(notification.action_url);
                      }
                    }}
                  >
                    <div className="flex items-center w-full">
                      {getNotificationIcon(notification.notification_type)}
                      <span className="ml-2 text-sm font-medium flex-1 truncate">
                        {notification.title}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full mt-1" />
                    )}
                  </DropdownMenuItem>
                ))
              )}
              {notifications.length > 5 && (
                <DropdownMenuItem
                  onClick={() => router.push('/notifications')}
                  className="text-center text-blue-500 hover:text-blue-600 justify-center"
                >
                  查看全部消息
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 用户信息 */}
        <div className="py-4 flex flex-col border-t border-white/10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center h-12 lg:h-14 w-full px-4 hover:bg-white/5 transition-colors">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#1E293B] flex items-center justify-center shrink-0 hover:bg-[#334155] transition-colors">
                  <Avatar className="w-7 h-7 lg:w-9 lg:h-9">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="bg-transparent text-white text-xs lg:text-sm">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-left">
                  <p className="text-white text-sm font-medium truncate max-w-[140px]">{displayName}</p>
                  <p className="text-white/50 text-xs truncate max-w-[140px]">{ROLE_NAMES[(user?.role || 'material_member') as UserRole]}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{profile?.username || user?.username}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                账户设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 遮罩层（移动端） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 主内容区 - 浅蓝灰渐变背景 */}
      <main className="lg:ml-16 xl:ml-20 pt-14 lg:pt-0 min-h-screen transition-all duration-300">
        <div className="p-4 lg:p-6 min-h-screen bg-gradient-to-br from-[#F0F4F8] via-[#E8F0FE] to-[#F0F4F8]">
          {children}
        </div>
      </main>
    </div>
  );
}
