import { NextRequest, NextResponse } from 'next/server';

// 上传路由需要更大的 body 大小限制
const UPLOAD_ROUTES = ['/api/creative-agent/upload', '/api/learning-library/upload'];
const MAX_BODY_SIZE = 500 * 1024 * 1024; // 500MB

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 安全头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 只处理上传路由
  const pathname = request.nextUrl.pathname;
  if (!UPLOAD_ROUTES.some(route => pathname.startsWith(route))) {
    return response;
  }

  // 获取 content-length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    const limitResponse = new NextResponse(
      JSON.stringify({ error: '请求体过大，最大支持 500MB' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
    limitResponse.headers.set('X-Content-Type-Options', 'nosniff');
    return limitResponse;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
