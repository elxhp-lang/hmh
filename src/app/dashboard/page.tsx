'use client';

import { useAuth, usePermission } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FinanceDashboard } from '@/components/dashboard/FinanceDashboard';
import { MaterialLeaderDashboard } from '@/components/dashboard/MaterialLeaderDashboard';
import { MaterialMemberDashboard } from '@/components/dashboard/MaterialMemberDashboard';
import { SuperAdminDashboard } from '@/components/dashboard/SuperAdminDashboard';
import { ROLE_NAMES, getDashboardConfig } from '@/lib/permissions';

export default function DashboardPage() {
  const { user, token } = useAuth();
  const { isAdmin } = usePermission();

  // 根据角色获取 Dashboard 配置
  const config = getDashboardConfig(user?.role || 'material_member');

  // 根据角色渲染不同的 Dashboard 组件
  const renderDashboard = () => {
    switch (user?.role) {
      case 'super_admin':
        return <SuperAdminDashboard token={token!} />;
      
      case 'finance':
        return <FinanceDashboard token={token!} />;
      
      case 'material_leader':
        return <MaterialLeaderDashboard token={token!} />;
      
      case 'material_member':
      default:
        return <MaterialMemberDashboard token={token!} userId={user?.user_id || ''} />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 欢迎信息 */}
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-muted-foreground">
            {config.subtitle}
            {user?.role && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}
              </span>
            )}
          </p>
        </div>

        {/* 根据角色渲染不同的 Dashboard */}
        {renderDashboard()}
      </div>
    </DashboardLayout>
  );
}
