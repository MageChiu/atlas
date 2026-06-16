# Atlas - 路过 后端开发规范

> 适用对象：后端开发 Agent / 工程师
> 上位依据：`Atlas-路过-MVP-技术方案.md`、`Atlas-路过-后端技术设计.md`、`Atlas-路过-API协议说明.md`、`Atlas-路过-数据模型设计.md`、`tasks/01-后端.md`
> 契约依据：`@atlas/shared`（公共部分已冻结，类型/协议/枚举/Mock 的唯一事实来源）

本规范是约束性文档。出现实现分歧时，优先级：**`@atlas/shared` 契约 > 本规范 > 个人习惯**。

---

## 1. 技术栈（锁定）

| 维度 | 选型 |
| --- | --- |
| 框架 | NestJS（TypeScript，默认）｜FastAPI（如团队选 Python，须同等遵守本规范语义） |
| 语言 | TypeScript（`strict: true`，与 NestJS 配套） |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 队列 | BullMQ（复用 Redis） |
| 对象存储 | 用于原图 / 生成图 / 场景资源 |
| 共享契约 | `@atlas/shared` |

> 本规范默认 NestJS + TS，便于直接复用 `@atlas/shared` 类型。

---

## 2. 模块划分（按域，强制）

```
backend/src/
  common/        统一响应/异常过滤器/幂等/鉴权守卫/错误码映射
  config/        env 读取（PORT/DATABASE_URL/REDIS_URL/OBJECT_STORAGE_*）
  modules/
    user/        登录态 / 用户信息
    content/     World / Region / Spot / Action / Event / Reward / Template 查询
    action/      获取可执行 Action、执行 Action、冷却与前置判断
    event/       事件池选择、权重、一次性事件
    progress/    区域/景点进度、打卡、解锁
    reward/      奖励发放、图鉴、成就
    ai/          上传、任务创建、状态、结果回写、Worker
    ops/         FeatureFlag、活动配置、风控
  database/      实体定义、migration、seed（来自 @atlas/shared seedDataset）
  queue/         BullMQ 队列与 processor
```

铁律：模块之间通过 Service 注入协作，**禁止跨模块直接访问对方的 Repository / 表**。

---

## 3. 契约与类型使用规范

- 所有对外返回的业务实体类型**必须**取自 `@atlas/shared`（`Region/Spot/Action/.../ExecuteActionData` 等），**禁止**后端另立一套返回 DTO 结构。
- 路由路径必须与 `ApiRoutes.*` 一致（同一份语义来源）。
- 入参校验后映射到契约类型；DB 实体（ORM Entity）与对外契约类型**分离**，由 mapper 转换。
- 枚举值一律用 `@atlas/shared` 枚举常量，DB 存储用其字符串值。

```ts
import { ErrorCode, AITaskStatus } from '@atlas/shared';
import type { ExecuteActionData, SpotDetailData } from '@atlas/shared';
```

---

## 4. 统一响应与错误规范

- 成功：`{ success: true, data }`（`ApiSuccess<T>`）；由全局 `TransformInterceptor` 包裹，Controller 只返回 `data`。
- 失败：`{ success: false, code, message }`（`ApiError`）；由全局 `ExceptionFilter` 统一产出。
- 业务异常**必须**抛带 `ErrorCode` 的领域异常（如 `new DomainException(ErrorCode.ACTION_COOLDOWN)`），禁止裸 `throw string`。
- 错误码仅用 `@atlas/shared` 的 7 个：`REGION_NOT_OPEN` / `SPOT_NOT_UNLOCKED` / `ACTION_NOT_AVAILABLE` / `ACTION_COOLDOWN` / `UPLOAD_INVALID` / `AI_TASK_FAILED` / `RISK_BLOCKED`。新增错误码须先改 `@atlas/shared` 与协议文档。

---

## 5. 接口实现清单（对齐协议）

| 方法 | 路径 | 返回 data 类型 |
| --- | --- | --- |
| GET | `/api/world` | `WorldData` |
| GET | `/api/regions/{id}` | `RegionDetailData` |
| GET | `/api/spots/{id}` | `SpotDetailData` |
| GET | `/api/spots/{id}/actions` | `SpotActionsData`（含 `available`/`cooldownRemaining`） |
| POST | `/api/spots/{id}/check-in` | `CheckInData` |
| POST | `/api/actions/{id}/execute` | `ExecuteActionData` |
| POST | `/api/uploads/image` | `UploadImageData` |
| POST | `/api/ai/photo-generate` | `PhotoGenerateData` |
| GET | `/api/ai/tasks/{id}` | `AITaskStatusData` |
| GET | `/api/ai/results/{id}` | `AITaskResultData` |
| GET | `/api/me/collections` | `CollectionsData` |
| GET | `/api/me/generated-assets` | `GeneratedAssetsData` |
| GET | `/api/me/achievements` | `AchievementsData` |

**`ExecuteActionData = { actionId, event, reward, aiTask, progress }` 结构已冻结，不得变更字段。**

---

## 6. 数据库规范

- 表分三类，与数据模型文档一致：
  - 配置类：`regions` `spots` `spot_actions` `events` `event_pools` `rewards` `ai_templates`
  - 用户行为类：`user_region_progress` `user_spot_progress` `user_action_records` `user_checkins` `user_rewards` `user_generated_assets`
  - AI 类：`uploaded_images` `ai_tasks` `ai_task_results`
- 约束：**主键统一字符串 ID**；状态字段存枚举字符串；扩展字段用 `jsonb`。
- **配置表与用户状态表严格分离**，禁止把用户态冗余进配置表。
- Seed 数据**必须**来自 `@atlas/shared` 的 `seedDataset`，保证与前端 Mock 同源。
- 所有结构变更走 migration，禁止手改线上表。

---

## 7. Action 执行流程（标准七步，强制顺序）

```
1. 校验用户与登录态
2. 校验 Action 是否存在
3. 校验 Spot / Region 是否开放（否则 SPOT_NOT_UNLOCKED / REGION_NOT_OPEN）
4. 校验前置条件与冷却（否则 ACTION_NOT_AVAILABLE / ACTION_COOLDOWN）
5. 写入行为记录（user_action_records）
6. 选择事件 / 结果模板（event 模块按权重 + onceOnly）
7. 发放奖励或创建 AI 任务 → 返回统一 ExecuteActionData
```

---

## 8. 幂等与一致性（强制）

- 所有写接口接收 `requestId`（`IdempotentRequest`），用唯一约束/Redis 去重保证**同一 requestId 不重复执行**。
- 打卡幂等：首次打卡发奖 + 解锁，重复打卡 `reward` 返回空数组。
- 奖励发放去重：`user_rewards` 对 `(userId, rewardId, sourceType, sourceId)` 建唯一索引。
- 首次打卡与首次解锁逻辑**分离处理**，进度更新顺序可控（事务内）。

---

## 9. AI 任务规范（全异步）

- 上传：记录 `uploaded_images`，返回 `imageId/url`；校验类型大小，失败 `UPLOAD_INVALID`；风控不过 `RISK_BLOCKED`。
- 提交：创建 `ai_tasks`(status=`pending`) → 推入 BullMQ → 返回 `taskId`。重复提交可追踪（关联 requestId）。
- Worker：消费队列，`pending→running→success/failed`，结果写 `ai_task_results`，成功回写 `user_generated_assets`。
- 查询：`tasks/{id}` 返回任务状态；`results/{id}` 返回结果或错误，失败映射 `AI_TASK_FAILED`。
- **禁止在请求线程内同步等待 AI 生成**。

---

## 10. 鉴权与安全

- 统一鉴权守卫注入 `userId`，业务层只信任守卫注入的身份，不信前端传入的 userId。
- 上传与生成内容过 `ops` 风控入口；命中风险返回 `RISK_BLOCKED` 并落审计。
- 对象存储仅返回受控 URL，敏感配置只读 env，不入库不打日志。

---

## 11. 编码与提交规范

- 遵循根目录 ESLint / Prettier / editorconfig；提交前 `lint` + `tsc --noEmit` + 单测必须通过。
- Service 承载业务逻辑，Controller 只做编排与参数；Repository 只做数据访问。
- 注释解释“为什么”；领域异常集中定义。
- **接口/类型变更先改 `@atlas/shared` 并同步 `Atlas-路过-API协议说明.md`，再改后端**，禁止私自加字段。

---

## 12. 本地启动、端口与编译

`backend/package.json` 名称须为 `@atlas/backend`，并提供标准脚本（NestJS 约定）：

```jsonc
{
  "scripts": {
    "dev": "nest start --watch",   // 监听 process.env.PORT
    "build": "nest build",
    "start": "node dist/main.js",  // 监听 process.env.PORT
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

- **端口从 `process.env.PORT` 读取，默认 `3001`，禁止硬编码**：
  `await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);`
- 环境变量复制 `.env.example` 到 `backend/.env`：`PORT` / `DATABASE_URL` / `REDIS_URL` / `QUEUE_REDIS_URL` / `OBJECT_STORAGE_*`。
- 须开启 CORS，允许前端来源（`NEXT_PUBLIC_API_BASE_URL` 对应的前端域/端口）。

根目录统一入口（基于 npm workspaces）：

| 命令（根目录） | 作用 |
| --- | --- |
| `npm run dev:backend` | 启动后端 API（开发，热更新），默认 `http://localhost:3001` |
| `npm run build:backend` | 编译后端（先构建 `@atlas/shared` 再 `nest build`） |
| `npm run start:backend` | 启动已编译后端（生产） |

---

## 13. 交付与验收（对齐 tasks/01-后端.md）

- M1：服务可运行、统一响应/错误中间件生效、DB/Redis 连接就绪。
- M2：内容查询接口（world/region/spot/actions）返回结构与契约一致，可替换前端 Mock。
- M3：check-in / execute-action 跑通，至少一类 Action 返回 event + reward，幂等可靠。
- M4：上传 → 提交 → 轮询 → 结果链路跑通（结果可为模拟）。
- M5：collections / generated-assets / achievements 接口可用。
- 联调（M6）：与前端对齐返回结构、错误码，验证图鉴/奖励/进度一致性。
