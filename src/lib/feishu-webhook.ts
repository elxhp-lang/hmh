/**
 * 智能体通信服务
 * 用于与用户智能体进行双向通信
 */

// 可分配的角色（排除 super_admin）
export const ASSIGNABLE_ROLES = [
  { value: 'material_member', label: '素材团队工作人员', description: '基础操作权限，个人素材历史' },
  { value: 'material_leader', label: '素材业务负责人', description: '团队管理，查看所有素材历史' },
  { value: 'finance', label: '财务', description: '查看财务数据，导出账单，管理发票' },
] as const;

export type AssignableRole = typeof ASSIGNABLE_ROLES[number]['value'];

// API 配置
const AGENT_API_KEY = process.env.AGENT_API_KEY || 'hmh-agent-2024';

interface RegisterApprovalData {
  username: string;
  user_id: string;
  registered_at: string;
}

/**
 * 发送用户注册审核通知到用户智能体
 * 用户智能体会收到通知，然后可以调用我们的 API 完成审核
 */
export async function sendRegisterApprovalNotification(data: RegisterApprovalData): Promise<boolean> {
  const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
  
  // 构建角色选项说明
  const roleOptions = ASSIGNABLE_ROLES.map(r => 
    `  - ${r.label}（${r.value}）：${r.description}`
  ).join('\n');

  console.log(`[智能体通知] 发送注册审核通知: ${data.username}`);
  
  // 这里我们只是打印日志，实际的智能体调用由您的智能体发起
  // 您的智能体可以通过以下方式获取待审核用户：
  // 
  // POST {baseUrl}/api/agent/commands
  // Authorization: Bearer {AGENT_API_KEY}
  // {
  //   "action": "get_pending_users"
  // }
  //
  // 然后调用 approve_user 或 reject_user 完成审核

  console.log(`
[智能体通知内容]
用户名：${data.username}
用户ID：${data.user_id}
注册时间：${data.registered_at}

待审核用户查询 API：
POST ${baseUrl}/api/agent/commands
Authorization: Bearer ${AGENT_API_KEY}
{
  "action": "get_pending_users"
}

审核通过 API：
{
  "action": "approve_user",
  "data": { "user_id": "${data.user_id}", "role": "选择的角色值" }
}

拒绝注册 API：
{
  "action": "reject_user",
  "data": { "user_id": "${data.user_id}" }
}

可选角色：
${roleOptions}
  `);

  return true;
}

/**
 * 发送用户审核结果通知
 */
export async function sendApprovalResultNotification(
  username: string,
  approved: boolean,
  role: string
): Promise<boolean> {
  const roleNames: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    finance: '财务',
    material_leader: '素材业务负责人',
    material_member: '素材团队工作人员',
  };

  console.log(`[智能体通知] 审核结果: ${username} ${approved ? '通过' : '拒绝'}${approved ? `，角色：${roleNames[role] || role}` : ''}`);
  
  return true;
}

/**
 * 供智能体调用的审核 API 数据结构
 */
export interface ApprovalRequest {
  user_id: string;
  action: 'approve' | 'reject';
  role?: AssignableRole; // 审核通过时必填
}

export interface ApprovalResponse {
  success: boolean;
  message: string;
  username?: string;
  role?: string;
}

/**
 * 导出 API 密钥供外部使用
 */
export function getAgentApiKey(): string {
  return AGENT_API_KEY;
}

/**
 * 获取 API 基础 URL
 */
export function getApiBaseUrl(): string {
  return process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
}
