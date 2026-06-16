# @atlas/backend — 后端服务

Atlas「路过」后端，依据 [tasks/01-后端.md](../tasks/01-后端.md) 实现。

- 技术栈：**NestJS + 内存仓储（从 `@atlas/shared` seed 载入）+ 进程内异步队列**（worker 模拟 AI）。
- 零外部依赖即可本地运行与验收；建表项以内存仓储等价实现，结构预留 Postgres/Redis/对象存储切换接口。
- 所有请求/响应类型统一引用 `@atlas/shared` 契约，杜绝接口漂移。

## 目录结构（按域分模块）

```
backend/src/
  main.ts                 启动入口（全局拦截器 + 错误过滤器 + CORS）
  app.module.ts           根模块，聚合各域模块
  health.controller.ts    GET /health
  config/                 运行时配置（AppConfigService）
  common/                 统一返回包络、错误码过滤器、业务异常、登录态解析
  store/                  内存仓储：ConfigRepository（只读配置）/ StateRepository（用户态）
  content/                B1 内容查询：world / region / spot / actions
  action/                 B2 行为：check-in / execute-action + ActionRulesService（可执行性）
  event/                  B2.4 事件引擎（权重选取 + onceOnly）
  reward/                 B2.5 奖励发放（去重 + sourceType/sourceId 可追踪）
  progress/               B2.6 进度（景点访问/动作计数 + 区域探索度）
  ai/                     B3 AI 任务：上传 / photo-generate / task / result + 进程内 worker
  me/                     B4 用户资产：collections / generated-assets / achievements
  ops/                    B5 运营与风控：feature flags / activities + RiskService
scripts/smoke.mjs         B6 主闭环冒烟验证（零依赖）
```

## 运行

```bash
# 1. 构建共享包（首次或 shared 变更后）
npm run build -w @atlas/shared
# 2. 构建并启动后端
npm run build -w @atlas/backend
node backend/dist/main.js          # 默认 http://localhost:3001
# 开发模式（watch）
npm run start:dev -w @atlas/backend
```

## 冒烟验证

服务启动后另开终端：

```bash
npm run smoke -w @atlas/backend
```

覆盖：health → world → region → spot → actions → check-in（幂等）→ execute（事件/奖励/AI 任务）
→ upload → photo-generate（幂等）→ 轮询 task/result → me 资产 → 错误码用例
（`ACTION_NOT_AVAILABLE` / `SPOT_NOT_UNLOCKED` / `RISK_BLOCKED`）。

## 接口一览

| 域 | 方法 路由 |
| --- | --- |
| 内容 | `GET /api/world`、`GET /api/regions/:id`、`GET /api/spots/:id`、`GET /api/spots/:id/actions` |
| 行为 | `POST /api/spots/:id/check-in`、`POST /api/actions/:id/execute` |
| AI | `POST /api/uploads/image`、`POST /api/ai/photo-generate`、`GET /api/ai/tasks/:id`、`GET /api/ai/results/:id` |
| 资产 | `GET /api/me/collections`、`GET /api/me/generated-assets`、`GET /api/me/achievements` |
| 运营 | `GET /api/ops/feature-flags`、`GET /api/ops/activities` |
| 健康 | `GET /health` |

## 约定

- 成功统一 `{ success:true, data }`；错误统一 `{ success:false, code, message }`，`code` 取自 `ErrorCode`。
- 登录态：请求头 `x-user-id`；缺省回落到 `user_demo`。
- 幂等：`check-in` / `execute-action` / `photo-generate` 支持 `requestId` 去重，重复请求不重复发奖/不重复建任务。
- AI 任务全异步：`pending → running → success/failed`，结果含 `outputUrl`，成功后回写生成记录。
