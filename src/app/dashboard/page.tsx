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
  usePermission();

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
        <div className="hmh-shell-card p-4">
          <div className="hmh-hero-gradient rounded-xl px-4 py-3 text-white flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{config.title}</h1>
              <p className="text-sm text-white/90">
                {config.subtitle}
                {user?.role && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                    {ROLE_NAMES[user.role as keyof typeof ROLE_NAMES]}
                  </span>
                )}
              </p>
            </div>
            <a href="/agent/create" className="text-sm rounded-full bg-white text-sky-700 px-4 py-2 font-medium hover:bg-slate-100">
              新建创意小海
            </a>
          </div>
        </div>

        {/* 根据角色渲染不同的 Dashboard */}
        {renderDashboard()}
      </div>
    </DashboardLayout>
  );
}
