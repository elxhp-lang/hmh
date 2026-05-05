import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未提供Token' }, { status: 401 });
    }
    const token = authHeader.slice(7);

    // 验证Token（允许过期1天内的Token刷新）
    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      payload = decoded;
    } catch (e) {
      // TokenExpiredError: 允许7天内过期的token刷新
      if (e instanceof jwt.TokenExpiredError) {
        const decoded = jwt.decode(token) as jwt.JwtPayload | null;
        if (!decoded || !decoded.userId) {
          return NextResponse.json({ error: 'Token无效' }, { status: 401 });
        }
        const ageInDays = (Date.now() / 1000 - (decoded.iat || 0)) / 86400;
        if (ageInDays > 8) {
          return NextResponse.json({ error: 'Token已过期超过8天，请重新登录' }, { status: 401 });
        }
        payload = decoded;
      } else {
        return NextResponse.json({ error: 'Token无效' }, { status: 401 });
      }
    }

    // 签发新Token（7天有效）
    const newToken = jwt.sign(
      { userId: payload.userId, username: payload.username, role: payload.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ token: newToken });
  } catch {
    return NextResponse.json({ error: '刷新失败' }, { status: 500 });
  }
}
