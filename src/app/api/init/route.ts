/**
 * 项目初始化 API
 * 
 * 功能：项目启动时的初始化操作（如配置 CORS、启动轮询服务）
 * 
 * GET /api/init
 */

import { NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import { getVideoPoller } from '@/lib/video-generation-poller';

// 支持的域名列表
const ALLOWED_ORIGINS = [
  'https://*.dev.coze.site',
  'https://*.coze.site',
  'https://*.coze.cn',
];
const ALLOWED_METHODS_FOR_TOS = ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'] as unknown as never[];

// 标记是否已初始化（防止重复启动轮询服务）
let initialized = false;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[项目初始化] 开始初始化...');

    // 强制重新初始化（开发环境）
    const forceReinit = process.env.COZE_PROJECT_ENV !== 'PROD';
    if (forceReinit) {
      console.log('[项目初始化] 开发环境，强制重新启动轮询服务');
      initialized = false;
    }

    const client = getTosClient();

    // 配置 TOS CORS
    try {
      await client.putBucketCORS({
        bucket: BUCKET_NAME,
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ALLOWED_METHODS_FOR_TOS,
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'Content-Length', 'x-tos-request-id'],
            MaxAgeSeconds: 3600,
          },
        ],
      });
      console.log('[项目初始化] CORS 配置成功');
    } catch (corsError) {
      // CORS 配置失败不影响其他功能
      console.warn('[项目初始化] CORS 配置失败（可能已配置）:', corsError);
    }

    // 启动视频生成轮询服务（只启动一次）
    if (!initialized) {
      console.log('[项目初始化] 启动视频生成轮询服务...');
      try {
        const poller = getVideoPoller();
        poller.start();
        initialized = true;
        console.log('[项目初始化] 视频生成轮询服务启动成功');
      } catch (pollerError) {
        console.error('[项目初始化] 轮询服务启动失败:', pollerError);
      }
    } else {
      console.log('[项目初始化] 轮询服务已在运行中');
    }

    return NextResponse.json({
      success: true,
      message: '初始化成功',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[项目初始化] 失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初始化失败' },
      { status: 500 }
    );
  }
}
