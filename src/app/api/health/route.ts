import { NextRequest, NextResponse } from 'next/server';

/**
 * 健康检查 API
 * GET /api/health
 * 
 * 返回服务状态信息，用于监控和自动修复
 */
export async function GET(request: NextRequest) {
  const healthInfo = {
    status: 'ok',
    service: 'nextjs',
    timestamp: new Date().toISOString(),
    env: process.env.COZE_PROJECT_ENV || 'DEV',
    port: process.env.PORT || '5000',
  };

  return NextResponse.json(healthInfo);
}
