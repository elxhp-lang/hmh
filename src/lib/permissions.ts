/**
 * 权限配置文件
 * 定义各角色的权限等级、页面访问权限和功能
 */

// 角色类型
export type UserRole = 'super_admin' | 'finance' | 'material_leader' | 'material_member';

// 权限等级（数字越大权限越高）
export const ROLE_LEVELS: Record<UserRole, number> = {
  super_admin: 100,
  finance: 60,
  material_leader: 40,
  material_member: 20,
};

// 角色显示名称
export const ROLE_NAMES: Record<UserRole, string> = {
  super_admin: '超级管理员',
  finance: '财务',
  material_leader: '素材业务负责人',
  material_member: '素材团队工作人员',
};

// 角色描述
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: '最高权限，可查看所有数据和进行系统管理',
  finance: '查看财务数据，导出账单明细，管理发票',
  material_leader: '查看团队素材生成情况，管理团队成员，查看团队素材历史',
  material_member: '查看个人素材生成情况，创建和管理工作任务，查看个人素材历史',
};

// 页面访问权限配置
export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  // 仪表盘 - 所有角色可访问
  '/dashboard': ['super_admin', 'finance', 'material_leader', 'material_member'],
  
  // 手动制作视频 - 素材相关角色可访问
  '/video': ['super_admin', 'material_leader', 'material_member'],
  
  // 创意小海 - 素材相关角色可访问
  '/agent/create': ['super_admin', 'material_leader', 'material_member'],
  
  // 学习库 - 素材相关角色可访问
  '/learning-library': ['super_admin', 'material_leader', 'material_member'],
  
  // 商品图库 - 素材相关角色可访问
  '/product-library': ['super_admin', 'material_leader', 'material_member'],
  
  // 素材历史 - 仅超级管理员和素材团队可访问
  '/material/history': ['super_admin', 'material_leader', 'material_member'],
  
  // 账单管理 - 超级管理员和财务可访问
  '/billing': ['super_admin', 'finance'],
  
  // 智能助手 - 所有角色可访问
  '/agent': ['super_admin', 'finance', 'material_leader', 'material_member'],
  
  // 用户管理 - 仅超级管理员可访问
  '/admin/users': ['super_admin'],
  
  // 账户设置 - 所有角色可访问
  '/settings': ['super_admin', 'finance', 'material_leader', 'material_member'],
};

// 导航菜单配置（根据角色显示不同菜单）
export const NAV_CONFIG: Record<UserRole, Array<{
  label: string;
  href: string;
  icon: string;
}>> = {
  super_admin: [
    { label: '数据概览', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: '手动制作视频', href: '/video', icon: 'Video' },
    { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
    { label: '学习库', href: '/learning-library', icon: 'Brain' },
    { label: '商品图库', href: '/product-library', icon: 'Package' },
    { label: '素材历史', href: '/material/history', icon: 'History' },
    { label: '账单管理', href: '/billing', icon: 'Receipt' },
    { label: '智能助手', href: '/agent', icon: 'MessageSquare' },
    { label: '用户管理', href: '/admin/users', icon: 'Users' },
  ],
  finance: [
    { label: '财务概览', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: '账单管理', href: '/billing', icon: 'Receipt' },
    { label: '智能助手', href: '/agent', icon: 'MessageSquare' },
  ],
  material_leader: [
    { label: '团队概览', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: '手动制作视频', href: '/video', icon: 'Video' },
    { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
    { label: '学习库', href: '/learning-library', icon: 'Brain' },
    { label: '商品图库', href: '/product-library', icon: 'Package' },
    { label: '素材历史', href: '/material/history', icon: 'History' },
    { label: '智能助手', href: '/agent', icon: 'MessageSquare' },
  ],
  material_member: [
    { label: '工作台', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: '手动制作视频', href: '/video', icon: 'Video' },
    { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
    { label: '学习库', href: '/learning-library', icon: 'Brain' },
    { label: '商品图库', href: '/product-library', icon: 'Package' },
    { label: '素材历史', href: '/material/history', icon: 'History' },
    { label: '智能助手', href: '/agent', icon: 'MessageSquare' },
  ],
};

// Dashboard 配置
export interface DashboardCard {
  id: string;
  title: string;
  type: 'stat' | 'chart' | 'action' | 'list';
  dataSource?: string;
  icon?: string;
  description?: string;
}

export interface DashboardConfig {
  title: string;
  subtitle: string;
  cards: DashboardCard[];
  quickActions?: Array<{
    label: string;
    href?: string;
    externalHref?: string;
    icon: string;
  }>;
}

export const DASHBOARD_CONFIG: Record<UserRole, DashboardConfig> = {
  super_admin: {
    title: '数据概览',
    subtitle: '海盟会整体运营数据',
    cards: [
      { id: 'total_videos', title: '总生成视频', type: 'stat', dataSource: 'totalVideos', icon: 'Video' },
      { id: 'processing', title: '生成中', type: 'stat', dataSource: 'processingCount', icon: 'Loader2' },
      { id: 'total_users', title: '总用户数', type: 'stat', dataSource: 'totalUsers', icon: 'Users' },
      { id: 'monthly_cost', title: '本月消费', type: 'stat', dataSource: 'monthlyCost', icon: 'DollarSign' },
    ],
    quickActions: [
      { label: '用户管理', href: '/admin/users', icon: 'Users' },
      { label: '手动制作', href: '/video', icon: 'Video' },
      { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
    ],
  },
  finance: {
    title: '财务概览',
    subtitle: '火山引擎账户财务数据',
    cards: [
      { id: 'balance', title: '账户余额', type: 'stat', dataSource: 'balance', icon: 'Wallet' },
      { id: 'daily_cost', title: '今日消费', type: 'stat', dataSource: 'dailyCost', icon: 'TrendingDown' },
      { id: 'monthly_cost', title: '本月消费', type: 'stat', dataSource: 'monthlyCost', icon: 'Calendar' },
      { id: 'total_tasks', title: '总任务数', type: 'stat', dataSource: 'totalTasks', icon: 'ClipboardList' },
    ],
    quickActions: [
      { label: '导出账单', href: '/billing?export=true', icon: 'Download' },
      { label: '开发票', externalHref: 'https://console.volcengine.com/finance/invoice', icon: 'FileText' },
      { label: '账单明细', href: '/billing', icon: 'Receipt' },
    ],
  },
  material_leader: {
    title: '团队概览',
    subtitle: '素材团队工作数据',
    cards: [
      { id: 'team_videos', title: '团队生成总量', type: 'stat', dataSource: 'teamVideos', icon: 'Video' },
      { id: 'processing', title: '生成中', type: 'stat', dataSource: 'processingCount', icon: 'Loader2' },
      { id: 'team_members', title: '团队人数', type: 'stat', dataSource: 'teamMembers', icon: 'Users' },
      { id: 'success_rate', title: '成功率', type: 'stat', dataSource: 'successRate', icon: 'CheckCircle' },
    ],
    quickActions: [
      { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
      { label: '手动制作', href: '/video', icon: 'Video' },
      { label: '团队素材', href: '/material/history?type=team', icon: 'History' },
    ],
  },
  material_member: {
    title: '我的工作台',
    subtitle: '个人素材生成数据',
    cards: [
      { id: 'my_videos', title: '我的生成总量', type: 'stat', dataSource: 'myVideos', icon: 'Video' },
      { id: 'processing', title: '生成中', type: 'stat', dataSource: 'myProcessing', icon: 'Loader2' },
      { id: 'completed', title: '已完成', type: 'stat', dataSource: 'myCompleted', icon: 'CheckCircle' },
      { id: 'failed', title: '失败', type: 'stat', dataSource: 'myFailed', icon: 'XCircle' },
    ],
    quickActions: [
      { label: '创意小海', href: '/agent/create', icon: 'Sparkles' },
      { label: '手动制作', href: '/video', icon: 'Video' },
      { label: '我的素材', href: '/material/history', icon: 'History' },
    ],
  },
};

// 检查是否有权限访问页面
export function hasPagePermission(role: string, pagePath: string): boolean {
  const userRole = role as UserRole;
  if (!ROLE_LEVELS[userRole]) return false;
  
  const allowedRoles = PAGE_PERMISSIONS[pagePath];
  if (!allowedRoles) return true; // 未配置的页面默认允许访问
  
  return allowedRoles.includes(userRole);
}

// 检查是否有足够权限等级
export function hasPermissionLevel(userRole: string, requiredLevel: number): boolean {
  const role = userRole as UserRole;
  return (ROLE_LEVELS[role] || 0) >= requiredLevel;
}

// 获取用户可访问的导航菜单
export function getUserNavMenu(role: string) {
  const userRole = role as UserRole;
  return NAV_CONFIG[userRole] || NAV_CONFIG.material_member;
}

// 获取用户的 Dashboard 配置
export function getDashboardConfig(role: string): DashboardConfig {
  const userRole = role as UserRole;
  return DASHBOARD_CONFIG[userRole] || DASHBOARD_CONFIG.material_member;
}
