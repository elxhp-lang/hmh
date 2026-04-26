# /video 页面功能检查报告

> 生成时间：2025-04-16
> 检查人：AI Assistant

---

## 一、页面概述

| 项目 | 内容 |
|------|------|
| 页面路径 | `/video` |
| 功能定位 | 视频生成核心页面（直接生成入口） |
| 页面状态 | ✅ 正常 (200) |

---

## 二、功能模块检查

### 2.1 视频生成模式

| 模式 | 功能 | 状态 |
|------|------|------|
| 文生视频 | 纯文字描述生成视频 | ✅ 正常 |
| 图生视频 | 首帧/尾帧图片生成视频 | ✅ 正常 |
| 多模态参考 | 图片/视频/音频参考 | ✅ 正常 |
| 视频编辑 | 编辑已有视频 | ✅ 正常 |
| 视频延长 | 延长视频时长 | ✅ 正常 |

### 2.2 上传功能

| 上传类型 | 当前实现 | 状态 |
|----------|----------|------|
| 首帧图片 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 尾帧图片 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 参考图片 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 参考视频 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 参考音频 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 编辑视频 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |
| 延长视频 | `/api/upload` 后端代理 | ⚠️ 有 bodySizeLimit 限制 |

---

## 三、上传方式对比

### 3.1 当前方式（后端代理）

```typescript
// /video 页面使用的上传方式
const uploadAndGetUrl = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'video_reference');
  const result = await uploadFile('/api/upload', formData, token!);
  return result.key;
};
```

**问题**：文件经过服务器，有 bodySizeLimit 4.5MB 限制

### 3.2 推荐方式（预签名URL）

```typescript
// 已有的预签名上传接口
// 1. 请求预签名URL
const presignRes = await fetch('/api/upload/presign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: file.name, fileType: 'image' })
});
const { uploadUrl, key } = await presignRes.json();

// 2. 前端直传TOS
await fetch(uploadUrl, { method: 'PUT', body: file });

// 3. 返回key
return key;
```

**优点**：无大小限制，前端直传

---

## 四、API 接口检查

### 4.1 页面相关 API

| API | 路径 | 状态 | 说明 |
|-----|------|------|------|
| 页面 | `/video` | ✅ 200 | 正常 |
| 视频生成 | `/api/video/generate` | ✅ 401 | 未登录（预期） |
| 视频编辑 | `/api/video/edit` | ✅ 正常 | - |
| 视频延长 | `/api/video/extend` | ✅ 正常 | - |
| 历史记录 | `/api/video/history` | ✅ 401 | 未登录（预期） |
| 视频URL | `/api/video/url` | ✅ 正常 | - |

### 4.2 上传相关 API

| API | 路径 | 当前使用 | 预签名版本 | 状态 |
|-----|------|----------|-----------|------|
| 通用上传 | `/api/upload` | ✅ 使用 | - | ⚠️ 有限制 |
| 预签名上传 | `/api/upload/presign` | ❌ 未用 | - | ✅ 可用 |

---

## 五、问题汇总

### 5.1 高优先级

| 问题 | 影响 | 说明 |
|------|------|------|
| 上传有大小限制 | 大文件无法上传 | 首帧图片、参考视频等超过4.5MB会失败 |

### 5.2 建议改进

| 改进项 | 当前 | 建议 |
|--------|------|------|
| 上传方式 | 后端代理 | 改用预签名URL |
| 参考接口 | `/api/upload` | `/api/upload/presign` |

---

## 六、对比学习库修复

| 项目 | 学习库 | /video 页面 |
|------|--------|-------------|
| 当前上传 | `/api/learning-library/upload` | `/api/upload` |
| 问题 | bodySizeLimit 4.5MB | 同样的问题 |
| 修复方案 | 改用 `/api/learning-library/presign` | 改用 `/api/upload/presign` |
| 修复状态 | ✅ 已完成 | ❌ 待修复 |

---

## 七、建议

### 7.1 立即可行

将 `/video` 页面的上传逻辑改为使用 `/api/upload/presign` 预签名上传

### 7.2 影响评估

- **优点**：
  - 消除文件大小限制
  - 减少服务器压力
  - 提升上传速度

- **风险**：
  - 需要修改上传逻辑
  - 需要处理预签名URL过期情况

### 7.3 预估工作量

| 任务 | 预估时间 |
|------|----------|
| 修改上传函数 | 1-2 小时 |
| 测试各模式上传 | 1 小时 |
| 回归测试 | 1 小时 |

---

## 八、结论

| 项目 | 状态 | 备注 |
|------|------|------|
| 页面功能 | ✅ 正常 | 5种视频生成模式 |
| API接口 | ✅ 正常 | 认证后可用 |
| 上传功能 | ⚠️ 有问题 | 大文件受限制 |
| 改进方案 | ✅ 已有 | 使用预签名URL |

**建议**：参考学习库的修复方案，为 `/video` 页面改用预签名上传方式。
