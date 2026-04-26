import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 通用智能体指令 API
 * POST /api/agent/commands
 * 
 * 支持的操作：
 * - approve_user: 审核通过用户
 * - reject_user: 拒绝用户
 * - get_pending_users: 获取待审核用户列表
 * - get_system_status: 获取系统状态
 * - get_video_tasks: 获取视频任务列表
 * - get_financial_overview: 获取财务概览
 * 
 * 请求格式：
 * {
 *   "action": "操作名称",
 *   "data": { 操作相关参数 }
 * }
 */

// 可分配的角色
const ASSIGNABLE_ROLES = [
  { value: 'material_member', label: '素材团队工作人员', description: '基础操作权限，个人素材历史' },
  { value: 'material_leader', label: '素材业务负责人', description: '团队管理，查看所有素材历史' },
  { value: 'finance', label: '财务', description: '查看财务数据，导出账单，管理发票' },
] as const;

type Action = 
  | 'approve_user' 
  | 'reject_user' 
  | 'get_pending_users' 
  | 'get_system_status' 
  | 'get_video_tasks' 
  | 'get_financial_overview';

interface CommandRequest {
  action: Action;
  data?: Record<string, unknown>;
}

/**
 * 验证 API 密钥
 */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
  const validKey = process.env.AGENT_API_KEY || 'hmh-agent-2024';
  return apiKey === validKey;
}

/**
 * 审核通过用户
 */
async function approveUser(data: { user_id: string; role: string }) {
  const { user_id, role } = data;
  
  if (!user_id) {
    return { success: false, message: '缺少用户ID' };
  }
  
  const validRoles = ASSIGNABLE_ROLES.map(r => r.value);
  if (!role || !(validRoles as string[]).includes(role)) {
    return { 
      success: false, 
      message: `角色无效，可选值：${validRoles.join(', ')}` 
    };
  }
  
  const client = getSupabaseClient();
  
  // 查询用户
  const { data: user, error: userError } = await client
    .from('users')
    .select('id, username, status, display_name')
    .eq('id', user_id)
    .single();
  
  if (userError || !user) {
    return { success: false, message: '用户不存在' };
  }
  
  if (user.status !== 'pending') {
    return { success: false, message: `用户状态不是待审核（当前：${user.status}）` };
  }
  
  // 更新用户状态
  const { error: updateError } = await client
    .from('users')
    .update({
      status: 'active',
      role: role,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id);
  
  if (updateError) {
    console.error('更新用户状态失败:', updateError);
    return { success: false, message: '审核失败，请稍后重试' };
  }
  
  // 记录操作日志
  await client.from('operation_logs').insert({
    user_id,
    action: 'user_approved',
    details: { role, approved_by: 'agent_api' },
  });
  
  const roleLabel = ASSIGNABLE_ROLES.find(r => r.value === role)?.label || role;
  
  return {
    success: true,
    message: `用户 ${user.display_name || user.username} 审核通过，已分配角色：${roleLabel}`,
    data: {
      user_id,
      username: user.username,
      display_name: user.display_name,
      role: roleLabel,
    }
  };
}

/**
 * 拒绝用户
 */
async function rejectUser(data: { user_id: string }) {
  const { user_id } = data;
  
  if (!user_id) {
    return { success: false, message: '缺少用户ID' };
  }
  
  const client = getSupabaseClient();
  
  // 查询用户
  const { data: user, error: userError } = await client
    .from('users')
    .select('id, username, status, display_name')
    .eq('id', user_id)
    .single();
  
  if (userError || !user) {
    return { success: false, message: '用户不存在' };
  }
  
  if (user.status !== 'pending') {
    return { success: false, message: `用户状态不是待审核（当前：${user.status}）` };
  }
  
  // 更新用户状态
  const { error: updateError } = await client
    .from('users')
    .update({
      status: 'disabled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id);
  
  if (updateError) {
    console.error('更新用户状态失败:', updateError);
    return { success: false, message: '操作失败，请稍后重试' };
  }
  
  // 记录操作日志
  await client.from('operation_logs').insert({
    user_id,
    action: 'user_rejected',
    details: { rejected_by: 'agent_api' },
  });
  
  return {
    success: true,
    message: `用户 ${user.display_name || user.username} 的注册申请已拒绝`,
    data: {
      user_id,
      username: user.username,
    }
  };
}

/**
 * 获取待审核用户列表
 */
async function getPendingUsers() {
  const client = getSupabaseClient();
  
  const { data: users, error } = await client
    .from('users')
    .select('id, username, display_name, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('查询待审核用户失败:', error);
    return { success: false, message: '查询失败' };
  }
  
  return {
    success: true,
    message: `当前有 ${users?.length || 0} 个待审核用户`,
    data: {
      users: users || [],
      assignable_roles: ASSIGNABLE_ROLES,
    }
  };
}

/**
 * 获取系统状态
 */
async function getSystemStatus() {
  const client = getSupabaseClient();
  
  // 获取用户统计
  const { count: totalUsers } = await client
    .from('users')
    .select('*', { count: 'exact', head: true });
  
  const { count: activeUsers } = await client
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  const { count: pendingUsers } = await client
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  // 获取视频统计
  const { count: totalVideos } = await client
    .from('videos')
    .select('*', { count: 'exact', head: true });
  
  const { count: processingVideos } = await client
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');
  
  return {
    success: true,
    message: '系统运行正常',
    data: {
      users: {
        total: totalUsers || 0,
        active: activeUsers || 0,
        pending: pendingUsers || 0,
      },
      videos: {
        total: totalVideos || 0,
        processing: processingVideos || 0,
      },
      server_time: new Date().toISOString(),
    }
  };
}

/**
 * 获取视频任务列表
 */
async function getVideoTasks(data: { status?: string; limit?: number }) {
  const { status, limit = 10 } = data || {};
  const client = getSupabaseClient();
  
  let query = client
    .from('videos')
    .select('task_id, user_id, prompt, status, created_at, video_url')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data: videos, error } = await query;
  
  if (error) {
    console.error('查询视频任务失败:', error);
    return { success: false, message: '查询失败' };
  }
  
  return {
    success: true,
    message: `获取到 ${videos?.length || 0} 个视频任务`,
    data: {
      videos: videos || [],
    }
  };
}

/**
 * 获取财务概览
 */
async function getFinancialOverview() {
  const client = getSupabaseClient();
  
  // 获取今日统计
  const today = new Date().toISOString().split('T')[0];
  const { data: todayStats } = await client
    .from('daily_stats')
    .select('*')
    .eq('date', today)
    .single();
  
  // 获取账单统计
  const { data: billingStats } = await client
    .from('billing')
    .select('task_type, amount')
    .gte('created_at', today);
  
  const taskTypeAmounts: Record<string, number> = {};
  billingStats?.forEach(b => {
    const bAny = b as any;
    taskTypeAmounts[bAny.task_type as string] = (taskTypeAmounts[bAny.task_type as string] || 0) + (bAny.amount || 0);
  });
  
  return {
    success: true,
    message: '财务数据获取成功',
    data: {
      today: todayStats || { date: today },
      task_type_amounts: taskTypeAmounts,
    }
  };
}

/**
 * 处理 POST 请求
 */
export async function POST(request: NextRequest) {
  try {
    // 验证 API 密钥
    if (!validateApiKey(request)) {
      return NextResponse.json(
        { success: false, message: '无效的访问密钥' },
        { status: 401 }
      );
    }
    
    const body: CommandRequest = await request.json();
    const { action, data = {} } = body;
    
    console.log(`[智能体API] 收到指令: ${action}`, data);
    
    // 路由到对应的处理函数
    let result;
    
    switch (action) {
      case 'approve_user':
        result = await approveUser(data as { user_id: string; role: string });
        break;
      
      case 'reject_user':
        result = await rejectUser(data as { user_id: string });
        break;
      
      case 'get_pending_users':
        result = await getPendingUsers();
        break;
      
      case 'get_system_status':
        result = await getSystemStatus();
        break;
      
      case 'get_video_tasks':
        result = await getVideoTasks(data as { status?: string; limit?: number });
        break;
      
      case 'get_financial_overview':
        result = await getFinancialOverview();
        break;
      
      default:
        result = { 
          success: false, 
          message: `未知操作: ${action}。支持的操作：approve_user, reject_user, get_pending_users, get_system_status, get_video_tasks, get_financial_overview` 
        };
    }
    
    console.log(`[智能体API] 响应:`, result.message);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[智能体API] 错误:', error);
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * 处理 GET 请求 - 返回 API 说明
 */
export async function GET(request: NextRequest) {
  // 验证 API 密钥
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { success: false, message: '无效的访问密钥' },
      { status: 401 }
    );
  }
  
  return NextResponse.json({
    success: true,
    message: '海盟会智能体指令 API',
    version: '1.0.0',
    supported_actions: [
      {
        action: 'approve_user',
        description: '审核通过用户',
        params: { user_id: '用户ID', role: '角色 (material_member/material_leader/finance)' }
      },
      {
        action: 'reject_user',
        description: '拒绝用户注册',
        params: { user_id: '用户ID' }
      },
      {
        action: 'get_pending_users',
        description: '获取待审核用户列表',
        params: {}
      },
      {
        action: 'get_system_status',
        description: '获取系统状态',
        params: {}
      },
      {
        action: 'get_video_tasks',
        description: '获取视频任务列表',
        params: { status: '状态过滤 (可选)', limit: '数量限制 (默认10)' }
      },
      {
        action: 'get_financial_overview',
        description: '获取财务概览',
        params: {}
      },
    ],
    assignable_roles: ASSIGNABLE_ROLES,
  });
}
