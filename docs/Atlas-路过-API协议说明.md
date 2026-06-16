# Atlas - 路过 API 协议说明

## 1. 文档目标

本文档定义“路过（Atlas）”MVP 阶段前后端联调用的接口协议草案。

---

## 2. 协议规范

### 2.1 基本约定

- 所有接口返回 JSON
- 成功响应统一包含 `success`
- 错误响应统一包含 `code` 与 `message`
- 写接口建议支持幂等请求标识

### 2.2 通用返回结构

```json
{
  "success": true,
  "data": {}
}
```

错误结构：

```json
{
  "success": false,
  "code": "ACTION_NOT_AVAILABLE",
  "message": "Action is not available"
}
```

---

## 2.5 认证接口

MVP 无数据库：用户账户与会话持久化到后端本地 `cache/` 目录（`users.json` / `sessions.json`）。
密码用 scrypt + 随机 salt 哈希存储，绝不存明文。token 为不透明字符串，请求经
`Authorization: Bearer <token>` 携带，由全局中间件解析为当前用户。

### 注册 `POST /api/auth/register`

请求：`{ "username": "tourist", "password": "secret123", "nickname": "成都旅人" }`
返回：`{ "success": true, "data": { "token": "...", "user": { "id","username","nickname","createdAt" } } }`

### 登录 `POST /api/auth/login`

请求：`{ "username": "tourist", "password": "secret123" }`
返回：同注册（token + user）。

### 登出 `POST /api/auth/logout`

请求头携带 `Authorization: Bearer <token>`；返回 `{ "success": true, "data": { "ok": true } }`。

### 当前用户 `GET /api/auth/me`

请求头携带 token；返回 `{ "success": true, "data": { "user": {...} } }`；未登录返回 `UNAUTHORIZED`。

> 相关错误码：`USERNAME_TAKEN`、`INVALID_CREDENTIALS`、`UNAUTHORIZED`、`BAD_REQUEST`。

---

## 3. 内容查询接口

### 3.1 获取世界地图

`GET /api/world`

返回示例：

```json
{
  "success": true,
  "data": {
    "regions": []
  }
}
```

### 3.2 获取区域详情

`GET /api/regions/{regionId}`

返回示例：

```json
{
  "success": true,
  "data": {
    "region": {},
    "spots": [],
    "progress": {}
  }
}
```

### 3.3 获取景点详情

`GET /api/spots/{spotId}`

返回示例：

```json
{
  "success": true,
  "data": {
    "spot": {},
    "actions": [],
    "progress": {}
  }
}
```

---

## 4. 行为接口

### 4.1 景点打卡

`POST /api/spots/{spotId}/check-in`

返回示例：

```json
{
  "success": true,
  "data": {
    "spotId": "spot_001",
    "checkedIn": true,
    "reward": []
  }
}
```

### 4.2 获取景点可执行 Action

`GET /api/spots/{spotId}/actions`

返回示例：

```json
{
  "success": true,
  "data": {
    "actions": []
  }
}
```

### 4.3 执行 Action

`POST /api/actions/{actionId}/execute`

请求示例：

```json
{
  "requestId": "req_123",
  "payload": {}
}
```

返回示例：

```json
{
  "success": true,
  "data": {
    "actionId": "action_001",
    "event": {},
    "reward": [],
    "aiTask": null,
    "progress": {}
  }
}
```

---

## 5. AI 接口

### 5.1 上传图片

`POST /api/uploads/image`

返回示例：

```json
{
  "success": true,
  "data": {
    "imageId": "img_001",
    "url": "https://example.com/a.png"
  }
}
```

### 5.2 提交生成任务

`POST /api/ai/photo-generate`

请求示例：

```json
{
  "templateId": "tpl_001",
  "imageId": "img_001",
  "spotId": "spot_001"
}
```

返回示例：

```json
{
  "success": true,
  "data": {
    "taskId": "task_001",
    "status": "pending"
  }
}
```

### 5.3 查询任务状态

`GET /api/ai/tasks/{taskId}`

### 5.4 获取任务结果

`GET /api/ai/results/{taskId}`

---

## 6. 用户资产接口

### 6.1 获取图鉴

`GET /api/me/collections`

### 6.2 获取生成记录

`GET /api/me/generated-assets`

### 6.3 获取成就

`GET /api/me/achievements`

---

## 7. 错误码

业务错误码：

- `REGION_NOT_OPEN`
- `SPOT_NOT_UNLOCKED`
- `ACTION_NOT_AVAILABLE`
- `ACTION_COOLDOWN`
- `UPLOAD_INVALID`
- `AI_TASK_FAILED`
- `RISK_BLOCKED`

框架级兜底错误码（非业务，由全局异常过滤器按 HTTP 状态映射）：

- `BAD_REQUEST`（4xx，如参数错误）
- `NOT_FOUND`（404，路由/资源不存在）
- `INTERNAL_ERROR`（5xx，服务器内部错误）

---

## 8. 联调建议

- 先使用 mock 返回结构联调页面
- 所有返回结构优先稳定，不频繁改字段
- Action execute 为联调核心接口
- AI 任务先跑通任务壳，再接具体生成能力
