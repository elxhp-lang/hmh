/**
 * TOS CORS 配置 API
 * 
 * 功能：配置 TOS 存储桶的跨域规则，允许浏览器直接上传
 * 
 * 方式：直接调用 TOS API，使用正确的 XML 格式
 * 
 * POST /api/tos/cors
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 支持的域名列表
const ALLOWED_ORIGINS = [
  'https://*.dev.coze.site',
  'https://*.coze.site',
  'https://*.coze.cn',
];
interface TosClientLike {
  fetchBucket: (
    bucket: string,
    method: 'PUT',
    query?: Record<string, string>,
    headers?: Record<string, string>,
    options?: { data?: string }
  ) => Promise<unknown>;
  getBucketCORS: (params: { bucket: string }) => Promise<{ CORSRules?: unknown[] }>;
}

interface TosErrorLike {
  code?: string;
  message?: string;
}

function assertAdmin(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return { ok: false as const, response: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  if (!['super_admin', 'admin'].includes(user.role)) {
    return { ok: false as const, response: NextResponse.json({ error: '权限不足' }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const auth = assertAdmin(request);
    if (!auth.ok) return auth.response;

    console.log('[TOS CORS] 开始配置跨域规则...');

    // 使用 SDK 的底层方法
    const client = getTosClient();

    // 构建 CORS XML 配置
    const corsRules = ALLOWED_ORIGINS.map(origin => `
    <CORSRule>
      <AllowedOrigin>${origin}</AllowedOrigin>
      <AllowedMethod>GET</AllowedMethod>
      <AllowedMethod>PUT</AllowedMethod>
      <AllowedMethod>POST</AllowedMethod>
      <AllowedMethod>DELETE</AllowedMethod>
      <AllowedMethod>HEAD</AllowedMethod>
      <AllowedHeader>*</AllowedHeader>
      <MaxAgeSeconds>3600</MaxAgeSeconds>
    </CORSRule>`).join('');

    const corsXml = `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration>
${corsRules}
</CORSConfiguration>`;

    console.log('[TOS CORS] 发送 CORS 配置...');

    // 直接使用 SDK 的请求方法
    const tosClient = client as unknown as TosClientLike;
    const result = await tosClient.fetchBucket(BUCKET_NAME, 'PUT', { cors: '' }, {}, { data: corsXml });

    console.log('[TOS CORS] 跨域规则配置成功:', result);

    return NextResponse.json({
      success: true,
      message: 'CORS 配置成功',
      allowedOrigins: ALLOWED_ORIGINS,
    });

  } catch (error: unknown) {
    const err = error as TosErrorLike;
    console.error('[TOS CORS] 配置失败:', error);
    return NextResponse.json(
      { error: err?.message || 'CORS 配置失败' },
      { status: 500 }
    );
  }
}

// 获取当前 CORS 配置
export async function GET(request: NextRequest) {
  try {
    const auth = assertAdmin(request);
    if (!auth.ok) return auth.response;

    const client = getTosClient();

    const tosClient = client as unknown as TosClientLike;
    const result = await tosClient.getBucketCORS({
      bucket: BUCKET_NAME,
    });

    return NextResponse.json({
      success: true,
      corsRules: result.CORSRules || [],
    });

  } catch (error: unknown) {
    const err = error as TosErrorLike;
    // 如果不存在，返回空配置
    if (err?.code === 'NoSuchCORSConfiguration') {
      return NextResponse.json({
        success: true,
        corsRules: [],
        message: 'CORS 配置不存在',
      });
    }
    console.error('[TOS CORS] 获取配置失败:', error);
    return NextResponse.json(
      { error: err?.message || '获取 CORS 配置失败' },
      { status: 500 }
    );
  }
}
