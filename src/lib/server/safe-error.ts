// ============================================================
// src/lib/server/safe-error.ts — Step 0.2
// ============================================================
// 统一安全错误处理工具
//
// 做了什么:
//   生产环境: 返回通用中文文案 + correlationId（内部排查用）
//   开发环境: 返回完整错误信息（方便调试）
//
// 不做什么:
//   不阻塞异常——只做响应格式化
//   不改变 error 对象本身
// ============================================================

import crypto from 'crypto';
import { NextResponse } from 'next/server';

/**
 * 安全包装错误响应。
 *
 * 生产环境: 返回通用文案 + 内部追踪 ID
 * 开发环境: 返回原始错误信息
 *
 * @param err - 原始错误对象
 * @param publicMessage - 生产环境下对用户展示的消息（默认 '操作失败'）
 * @param status - HTTP 状态码（默认 500）
 */
export function safeError(
  err: unknown,
  publicMessage = '操作失败',
  status = 500
): NextResponse {
  const correlationId = crypto.randomUUID().slice(0, 8);

  if (process.env.NODE_ENV === 'development') {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `${publicMessage} [${correlationId}]`, detail },
      { status }
    );
  }

  const detail = err instanceof Error ? err.message : String(err);
  console.error(`[safeError ${correlationId}]`, detail);

  return NextResponse.json(
    { success: false, error: publicMessage, code: correlationId },
    { status }
  );
}
