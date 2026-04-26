# JWT Token 过期处理修复报告

> 生成时间：2025-04-16
> 修改人：AI Assistant

---

## 一、问题描述

### 1.1 错误现象
用户访问 `/video` 页面时，控制台报错：
```
jwt expired
Call Stack
3
apiRequest
```

### 1.2 根本原因
- JWT Token 已过期（过期时间 2026-04-11，当前时间 2026-04-13）
- 后端 API 返回 500 错误而不是 401
- 前端 useApi hook 无法正确处理 token 过期

### 1.3 问题代码
```typescript
// 原代码：所有错误都返回 500
} catch (error) {
  console.error('查询视频历史错误:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : '查询失败' },
    { status: 500 }
  );
}
```

---

## 二、修复方案

### 2.1 后端修复
在所有视频相关 API 添加 token 过期检测：

```typescript
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

// 验证 token 并处理过期情况
let decoded;
try {
  decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
} catch (jwtError) {
  if (jwtError instanceof TokenExpiredError) {
    return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
  }
  if (jwtError instanceof JsonWebTokenError) {
    return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
  }
  throw jwtError;
}
```

### 2.2 前端处理
useApi hook 已有 401 处理逻辑，会自动调用 logout()：

```typescript
const request = async <T>(endpoint: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> => {
  try {
    return await apiRequest<T>(endpoint, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      logout();  // 自动登出
    }
    throw error;
  }
};
```

---

## 三、修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `/api/video/generate/route.ts` | 添加 TokenExpiredError 处理 |
| `/api/video/edit/route.ts` | 添加 TokenExpiredError 处理 |
| `/api/video/extend/route.ts` | 添加 TokenExpiredError 处理 |
| `/api/video/history/route.ts` | 添加 TokenExpiredError 处理 |
| `/api/video/url/route.ts` | 添加 TokenExpiredError 处理 |
| `/video/page.tsx` | loadHistory 添加 401 特殊处理 |

---

## 四、用户体验

### 4.1 修复前
- 控制台报错 "jwt expired"
- 页面显示加载中
- 无跳转登录提示

### 4.2 修复后
- 后端返回友好的错误消息
- 前端自动登出
- 页面跳转到登录页
- 用户体验流畅

---

## 五、验证结果

| 测试项 | 结果 |
|--------|------|
| 构建 | ✅ 通过 |
| Token 过期检测 | ✅ 返回 401 |
| 错误消息 | ✅ "登录已过期，请重新登录" |
| 前端自动登出 | ✅ 正常工作 |

---

## 六、建议

### 6.1 短期
- 用户重新登录即可恢复正常

### 6.2 长期
- 考虑实现 Token 自动刷新机制
- 前端定期检查 token 有效期
- 提前提示用户 token 即将过期

---

## 七、相关文档

- JWT 配置：`/api/auth/login/route.ts`
- AuthContext：`/contexts/AuthContext.tsx`
- API 工具：`/lib/api.ts`
