import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { sendApprovalResultNotification, ASSIGNABLE_ROLES, type AssignableRole } from '@/lib/feishu-webhook';
interface ApproveUserRow {
  username: string;
}
function isApproveUserRow(value: unknown): value is ApproveUserRow {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).username === 'string';
}

/**
 * 飞书智能体审核接口
 * POST /api/admin/users/approve
 * 
 * Body: {
 *   user_id: string;      // 用户ID
 *   action: 'approve' | 'reject';  // 操作类型
 *   role?: 'material_member' | 'material_leader' | 'finance';  // 审核通过时的角色
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, action, role } = body;

    // 验证参数
    if (!user_id) {
      return NextResponse.json(
        { success: false, message: '缺少用户ID' },
        { status: 400 }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'action 必须是 approve 或 reject' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // 允许所有有效角色：material_member, material_leader, admin, super_admin, finance
      const validRoles = ['material_member', 'material_leader', 'admin', 'super_admin', 'finance'];
      if (!role || !validRoles.includes(role)) {
        return NextResponse.json(
          { 
            success: false, 
            message: `审核通过时必须指定角色，可选值：${validRoles.join(', ')}` 
          },
          { status: 400 }
        );
      }
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, username, status')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: '用户不存在' },
        { status: 404 }
      );
    }

    if (user.status !== 'pending') {
      return NextResponse.json(
        { success: false, message: `用户状态不是待审核（当前状态：${user.status}）` },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // 审核通过
      const { error: updateError } = await client
        .from('users')
        .update({
          status: 'active',
          role: role as AssignableRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (updateError) {
        console.error('更新用户状态失败:', updateError);
        return NextResponse.json(
          { success: false, message: '审核失败，请稍后重试' },
          { status: 500 }
        );
      }

      // 记录操作日志
      await client.from('operation_logs').insert({
        user_id,
        action: 'user_approved',
        details: { role, approved_by: 'feishu_agent' },
      });

      // 发送飞书通知
      const roleLabel = ASSIGNABLE_ROLES.find(r => r.value === role)?.label || role;
      if (isApproveUserRow(user)) {
        sendApprovalResultNotification(user.username, true, role as string).catch(err => {
          console.error('发送审核结果通知失败:', err);
        });
      }

      return NextResponse.json({
        success: true,
        message: `用户 ${user.username} 审核通过，已分配角色：${roleLabel}`,
        username: user.username,
        role: roleLabel,
      });

    } else {
      // 审核拒绝
      const { error: updateError } = await client
        .from('users')
        .update({
          status: 'disabled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (updateError) {
        console.error('更新用户状态失败:', updateError);
        return NextResponse.json(
          { success: false, message: '审核失败，请稍后重试' },
          { status: 500 }
        );
      }

      // 记录操作日志
      await client.from('operation_logs').insert({
        user_id,
        action: 'user_rejected',
        details: { rejected_by: 'feishu_agent' },
      });

      // 发送飞书通知
      if (isApproveUserRow(user)) {
        sendApprovalResultNotification(user.username, false, '').catch(err => {
          console.error('发送审核结果通知失败:', err);
        });
      }

      return NextResponse.json({
        success: true,
        message: `用户 ${user.username} 的注册申请已拒绝`,
        username: user.username,
      });
    }

  } catch (error) {
    console.error('审核接口错误:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '审核失败' },
      { status: 500 }
    );
  }
}
