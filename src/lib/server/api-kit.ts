import { NextRequest, NextResponse } from 'next/server';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthUser {
  userId: string;
  username?: string;
  role: string;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error: message, ...(extra || {}) }, { status });
}

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function requireAuth(request: NextRequest): { user: AuthUser | null; response?: NextResponse } {
  const token = getBearerToken(request);
  if (!token) {
    return { user: null, response: fail('未登录', 401) };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return { user: decoded };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { user: null, response: fail('登录已过期，请重新登录', 401) };
    }
    if (error instanceof JsonWebTokenError) {
      return { user: null, response: fail('无效的登录凭证', 401) };
    }
    return { user: null, response: fail('鉴权失败', 401) };
  }
}

export function toPositiveInt(input: string | null, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!input) return fallback;
  const value = Number.parseInt(input, 10);
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(input: string | null): string | null {
  if (!input) return null;
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

export function createSSEWriter(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder) {
  return (event: Record<string, unknown>) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
}
