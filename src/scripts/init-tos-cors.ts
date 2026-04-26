/**
 * TOS CORS 初始化脚本
 * 
 * 功能：确保 TOS 存储桶的 CORS 配置正确
 * 
 * 使用方式：
 * - 在部署时自动调用
 * - 或者在 Next.js 启动时调用
 */

import { getTosClient, BUCKET_NAME } from '../lib/tos-storage';

// 支持的域名列表
const ALLOWED_ORIGINS = [
  'https://*.dev.coze.site',  // 沙箱环境
  'https://*.coze.site',       // 正式部署
  'https://*.coze.cn',        // 备用
];

export async function initTosCors(): Promise<boolean> {
  try {
    console.log('[TOS CORS 初始化] 开始配置跨域规则...');

    const client = getTosClient();

    // 配置 CORS 规则
    await (client.putBucketCORS as any)({
      bucket: BUCKET_NAME,
      CORSRules: [
        {
          AllowedOrigins: ALLOWED_ORIGINS,
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag', 'Content-Length', 'x-tos-request-id'],
          MaxAgeSeconds: 3600,
        },
      ],
    });

    console.log('[TOS CORS 初始化] 跨域规则配置成功');
    return true;

  } catch (error) {
    console.error('[TOS CORS 初始化] 配置失败:', error);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initTosCors()
    .then((success) => {
      if (success) {
        console.log('CORS 初始化成功');
        process.exit(0);
      } else {
        console.error('CORS 初始化失败');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('CORS 初始化异常:', error);
      process.exit(1);
    });
}
