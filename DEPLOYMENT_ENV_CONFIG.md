# 环境变量配置文档

## 概述

部署海盟会平台需要在生产环境配置以下环境变量。这些变量分为两类：
1. **Coze 平台内置变量**：自动填充，无需手动配置
2. **业务变量**：需要从火山引擎、Supabase 等平台获取

---

## 一、必须配置的业务变量

### 1. Supabase 数据库

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `COZE_SUPABASE_URL` | Supabase 项目 URL | Supabase 控制台 → Settings → API → Project URL | `https://xxxx.supabase.co` |
| `COZE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | Supabase 控制台 → Settings → API → anon public | `eyJhbGc...` |

**获取步骤**：
1. 登录 [Supabase 控制台](https://supabase.com/dashboard)
2. 进入你的项目
3. 点击 Settings → API
4. 复制 `Project URL` 和 `anon public` 密钥

---

### 2. ARK API（视频生成）

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `ARK_API_KEY` | ARK 平台 API Key | 火山引擎控制台 → ARK → API Key | `4aa1bb2b-xxxx` |

**获取步骤**：
1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. 搜索「ARK」或进入「扣子」服务
3. 点击左侧「API Key 管理」
4. 创建或复制已有的 API Key

**注意**：此 Key 专门用于 Seedance 2.0 视频生成，与火山引擎 AK/SK 不同！

---

### 3. TOS 对象存储

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `TOS_BUCKET_NAME` | 存储桶名称 | TOS 控制台 | `hmhv` |
| `TOS_ENDPOINT` | TOS 端点 | TOS 控制台 → 桶详情 | `tos-cn-beijing.volces.com` |
| `TOS_REGION` | TOS 区域 | TOS 控制台 → 桶详情 | `cn-beijing` |

---

### 4. 火山引擎 AK/SK（财务 API + TOS 存储）

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `VOLCENGINE_ACCESS_KEY_ID` | Access Key ID | 火山引擎控制台 → 账号中心 → 密钥管理 | `AKLTMWRj...` |
| `VOLCENGINE_SECRET_ACCESS_KEY` | Secret Access Key | 火山引擎控制台 → 账号中心 → 密钥管理 | `TVdZd01E...` |

**获取步骤**：
1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. 点击右上角头像 → 账号中心
3. 点击「密钥管理」
4. 创建或复制 Access Key

---

### 5. JWT 密钥

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `JWT_SECRET` | JWT 签名密钥 | 自行生成 | 32位以上随机字符串 |

**生成方式**：
```bash
openssl rand -base64 32
```

---

### 6. 飞书通知（可选）

| 变量名 | 说明 | 获取位置 | 示例值 |
|--------|------|---------|--------|
| `FEISHU_WEBHOOK_URL` | 飞书群机器人 Webhook | 飞书群设置 → 群机器人 → Webhook | `https://open.feishu.cn/...` |

**获取步骤**：
1. 打开飞书群
2. 点击群设置 → 群机器人
3. 添加「自定义机器人」
4. 复制 Webhook 地址

---

## 二、Coze 平台自动配置的变量

以下变量由 Coze 平台自动填充，无需手动配置：

| 变量名 | 说明 | 自动填充 |
|--------|------|---------|
| `COZE_PROJECT_DOMAIN_DEFAULT` | 部署域名 | ✅ 自动 |
| `DEPLOY_RUN_PORT` | 服务端口 | ✅ 自动（5000） |
| `COZE_WORKSPACE_PATH` | 工作目录 | ✅ 自动 |
| `COZE_PROJECT_ENV` | 环境标识 | ✅ 自动 |
| `COZE_SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务密钥 | ✅ 自动 |

---

## 三、生产环境变量完整列表

在 Coze 部署平台的「生产环境变量」中添加以下配置：

```
COZE_SUPABASE_URL=https://xxxx.supabase.co
COZE_SUPABASE_ANON_KEY=eyJhbGc...你的anon_key
ARK_API_KEY=4aa1bb2b-xxxx
JWT_SECRET=你生成的随机密钥
TOS_BUCKET_NAME=hmhv
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_REGION=cn-beijing
VOLCENGINE_ACCESS_KEY_ID=你的AK
VOLCENGINE_SECRET_ACCESS_KEY=你的SK
FEISHU_WEBHOOK_URL=https://open.feishu.cn/...（可选）
```

---

## 四、获取方式速查表

| 平台 | 需要的变量 | 控制台入口 |
|------|-----------|-----------|
| Supabase | URL + ANON_KEY | Settings → API |
| 火山引擎 ARK | ARK_API_KEY | ARK → API Key 管理 |
| 火山引擎 TOS | 桶名称 + 端点 + 区域 | TOS → 桶详情 |
| 火山引擎 AK/SK | ACCESS_KEY + SECRET_KEY | 账号中心 → 密钥管理 |

---

## 五、配置检查清单

部署前请确认以下变量已配置：

- [ ] `COZE_SUPABASE_URL`
- [ ] `COZE_SUPABASE_ANON_KEY`
- [ ] `ARK_API_KEY`
- [ ] `JWT_SECRET`
- [ ] `TOS_BUCKET_NAME`
- [ ] `TOS_ENDPOINT`
- [ ] `TOS_REGION`
- [ ] `VOLCENGINE_ACCESS_KEY_ID`
- [ ] `VOLCENGINE_SECRET_ACCESS_KEY`
- [ ] `FEISHU_WEBHOOK_URL`（可选）

---

## 六、常见问题

### Q1: 部署后报错 "COZE_SUPABASE_URL is not set"
**原因**：生产环境变量未配置或配置有误
**解决**：检查 Supabase 相关变量是否正确填写

### Q2: 视频生成接口报错
**原因**：`ARK_API_KEY` 未配置或 Key 无效
**解决**：确认 ARK API Key 已开通 Seedance 2.0 模型权限

### Q3: 文件上传失败
**原因**：TOS 存储配置有误
**解决**：确认 TOS 端点、区域、AK/SK 正确

### Q4: 用户登录失败
**原因**：`JWT_SECRET` 未配置
**解决**：确保 JWT 密钥与开发环境一致（或重新生成）
