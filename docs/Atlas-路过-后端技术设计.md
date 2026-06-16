# Atlas - 路过 后端技术设计

## 1. 文档目标

本文档定义“路过（Atlas）”项目的后端实现方案，作为后端 Agent 与工程开发的直接执行依据。目标包括：

- 明确服务边界与模块划分
- 明确配置驱动与规则执行方式
- 明确用户进度、AI 任务和奖励流程
- 支持 MVP 快速联调并可持续扩展

---

## 2. 后端职责

后端主要承担以下职责：

- 内容配置读取
- 地图层级数据输出
- Action 可执行性判断
- Event 触发与结果返回
- 用户进度记录
- 奖励发放
- AI 异步任务编排
- 审核与风控
- 运营开关控制

---

## 3. 模块划分

建议按域拆分：

### 3.1 用户模块
- 登录态
- 用户信息
- 基础画像

### 3.2 内容配置模块
- World / Region / Spot 查询
- Action / Event / Reward / Template 查询

### 3.3 Action 模块
- 获取某 Spot 可执行 Action
- 执行 Action
- 计算冷却、前置条件、执行结果

### 3.4 Event 模块
- 从事件池中选择可触发事件
- 处理一次性事件与权重规则

### 3.5 Progress 模块
- 用户区域进度
- 用户景点进度
- 打卡记录
- 解锁关系

### 3.6 Reward 模块
- 奖励发放
- 图鉴记录
- 成就状态

### 3.7 AI Task 模块
- 上传记录
- AI 任务创建
- 任务状态更新
- 结果回写

### 3.8 Ops 模块
- Feature Flag
- 活动配置
- 开放控制

---

## 4. 服务设计原则

1. 以配置驱动为主，逻辑引擎为辅
2. 查询接口尽量稳定，方便前端缓存
3. Action 执行返回结构统一
4. AI 任务全部异步化
5. 所有奖励发放必须可追踪
6. 所有关键行为支持幂等控制

---

## 5. 核心接口职责

### 5.1 内容接口
- `GET /api/world`
- `GET /api/regions/{id}`
- `GET /api/spots/{id}`
- `GET /api/spots/{id}/actions`

### 5.2 行为接口
- `POST /api/spots/{id}/check-in`
- `POST /api/actions/{id}/execute`

### 5.3 AI 接口
- `POST /api/uploads/image`
- `POST /api/ai/photo-generate`
- `GET /api/ai/tasks/{id}`
- `GET /api/ai/results/{id}`

### 5.4 用户资产接口
- `GET /api/me/collections`
- `GET /api/me/generated-assets`
- `GET /api/me/achievements`

---

## 6. Action 执行流程

### 6.1 标准流程

1. 校验用户与登录态
2. 校验 Action 是否存在
3. 校验 Spot / Region 是否开放
4. 校验前置条件与冷却
5. 写入行为记录
6. 选择事件 / 结果模板
7. 发放奖励或创建 AI 任务
8. 返回统一结果结构

### 6.2 返回结构建议

```json
{
  "success": true,
  "actionId": "a1",
  "event": {},
  "reward": [],
  "aiTask": null,
  "progress": {}
}
```

---

## 7. AI 任务流程

### 7.1 上传流程

1. 前端上传图片
2. 后端记录 `uploaded_images`
3. 返回文件标识

### 7.2 生成流程

1. 提交生成任务
2. 创建 `ai_tasks`
3. 推送到队列
4. AI 服务处理
5. 写入 `ai_task_results`
6. 前端轮询获取状态和结果

---

## 8. 幂等与一致性

需要重点保证：

- 打卡接口幂等
- 奖励发放不重复
- AI 任务重复提交可追踪
- 用户进度状态更新顺序可控

建议：

- 为关键写操作设置 requestId
- 奖励发放使用唯一索引或去重逻辑
- 用户首次打卡与首次解锁逻辑分离处理

---

## 9. 错误码建议

建议定义统一错误码：

- `REGION_NOT_OPEN`
- `SPOT_NOT_UNLOCKED`
- `ACTION_COOLDOWN`
- `ACTION_NOT_AVAILABLE`
- `UPLOAD_INVALID`
- `AI_TASK_FAILED`
- `RISK_BLOCKED`

---

## 10. 开发顺序

1. 建立基础服务框架
2. 建立配置表与读取接口
3. 建立 check-in / execute-action 接口
4. 建立用户进度与奖励逻辑
5. 建立 AI Task 骨架
6. 建立运营开关与活动控制

---

## 11. 交付结果

后端最终应交付：

- 稳定的内容查询接口
- 可联调的 Action 执行接口
- 可追踪的用户进度与奖励能力
- 异步 AI 任务框架
- 支持后续扩内容的稳定后端骨架
