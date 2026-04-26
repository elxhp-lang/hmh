import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * 验证JWT token并返回用户信息
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    if (!token) return null;
    
    // 移除 Bearer 前缀
    const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    const decoded = jwt.verify(tokenValue, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * 从请求头中提取并验证token
 */
export function getUserFromRequest(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  return verifyToken(authHeader);
}

/**
 * 检查用户是否是超级管理员
 */
export function isSuperAdmin(request: Request): boolean {
  const user = getUserFromRequest(request);
  return user?.role === 'super_admin';
}

/**
 * 检查用户是否有权限访问
 * @param request 请求对象
 * @param requiredRole 需要的角色
 */
export function hasPermission(request: Request, requiredRole: string): boolean {
  const user = getUserFromRequest(request);
  if (!user) return false;
  
  const roleHierarchy: Record<string, number> = {
    super_admin: 100,
    admin: 80,
    finance: 60,
    member: 20,
  };
  
  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}
