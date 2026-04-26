import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  // 禁用 Next.js 开发者工具栏（左下角的悬浮菜单）
  devIndicators: false,
  // 禁用开发者工具栏
  experimental: {
    // 启用大文件上传支持
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  // 允许大文件上传的API路由
  serverExternalPackages: ['@volcengine/tos-sdk'],
};

export default nextConfig;
