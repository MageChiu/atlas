# 08 - LLM 多 Provider 路由 · 后端任务（独立交付）

> 交付给**后端 Agent**。
> 前置：`tasks/08-LLM多Provider-公共部分.md` 已冻结本期边界；`docs/Atlas-路过-LLM多Provider路由设计.md` 已确认。
> 目标：把当前 NPC 对话后端从“单 Mock Provider”升级为“多 Provider 池 + 后端内部路由 + 失败切换骨架”。
>
> 约束（`docs/Atlas-路过-后端开发规范.md` + `协作开发规范.md`）：
> - `DialogueService` 不直接感知具体 provider；
> - provider 选择逻辑不散落在业务 Service 中；
> - 失败时直接抛 `LLM_UNAVAILABLE`，不静默回退 mock。

---

## 0. 已拍板前提

- 一期使用**结构化配置文件**，由 `LLM_CONFIG_FILE` 指向挂载路径。
- 一期支持**多 provider 池**、`priority` / `weighted` 两种候选策略。
- 一期不做动态健康检查，但要预留统计 / 错误分类 / provider 状态位。
- 一期不要求前端新增复杂透传字段；路由上下文先由后端从 `userId` / `spotId` / `npcId` / `city/region` 推导。
- `MockLlmProvider` 保留，用于开发与本地联调；生产真实 provider 失败时不回退到它。

---

## 1. 现状（要改的）

- 现有 `dialogue.module.ts` 只按单个 `LLM_PROVIDER` env 装配 `MockLlmProvider`。
- 现有 `AppConfigService` 只有：
  - `llmProvider`
  - `llmApiBase`
  - `llmApiKey`
  - `llmModel`
- `DialogueService` 直接注入 `LlmProvider`，缺少：
  - provider registry
  - router
  - failover 流程
  - 结构化配置读取

---

## 2. 目标结构

建议新增 / 调整为：

```text
backend/src/dialogue/llm/
  llm.provider.ts
  providers/
    openai-compatible.provider.ts
    mock.provider.ts               # 可复用现有 mock-llm.provider.ts，按需迁移
  llm-config.ts                    # 配置文件读取与校验
  llm-registry.ts                  # provider 实例化与索引
  llm-router.ts                    # 候选 provider 选择
  llm-service.ts                   # 统一 chat(ctx, req)
```

> 命名可微调，但职责分层必须保留。

---

## 3. 任务

### TB08-1 结构化配置读取（`llm-config.ts`）
- [x] 新增 `LLM_CONFIG_FILE` 读取逻辑，加载 JSON 配置文件。
- [x] 定义配置结构（后端内部类型，不放 shared）：
  - `providers: ProviderConfig[]`
  - `routes: RouteRule[]`
  - `failoverPolicy`
- [x] 对配置做最小校验：
  - `providers` 非空（若走真实模式）
  - provider `id/baseUrl/model/type` 必填（openai-compatible 强制 baseUrl/model）
  - `priority/weight` 为合法数值
  - `routes` 中 `candidateTags/strategy` 合法
- [x] 明确开发模式：
  - 若配置文件缺失，显式走 mock provider（`buildMockFallback`，便于本地）
  - 若配置文件存在但结构非法，启动时 `loadLlmConfig` 抛错，不拖到请求期

> 实现：[`backend/src/dialogue/llm/llm-config.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/llm-config.ts)（`loadLlmConfig` + `validateConfig`，provider id 去重校验）。

### TB08-2 Provider 抽象升级（`llm.provider.ts`）
- [x] 在保留现有 `LlmChatMessage / LlmChatRequest / LlmChatResult / LlmProvider` 的基础上，补充内部需要的上下文与错误分类类型，例如：
```ts
interface LlmRouteContext {
  userId: string;
  feature: 'dialogue';
  spotId?: string;
  npcId?: string;
  regionId?: string;
  cityId?: string;
}
type LlmErrorKind = 'timeout' | 'network' | '4xx' | '5xx' | 'invalid_response' | 'unknown';
```
- [x] 不要求把这些内部类型导出到 `@atlas/shared`。
- [x] 保持 `DialogueService` 面向统一抽象调用。

> 实现：[`backend/src/dialogue/llm/llm.provider.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/llm.provider.ts)（`LlmRouteContext` / `LlmErrorKind` / `LlmProviderError` / `LLM_SERVICE` token，未进 shared）。

### TB08-3 OpenAI Compatible Provider（`providers/openai-compatible.provider.ts`）
- [x] 新增一个真实 provider，实现对 OpenAI 兼容接口的调用。
- [x] 使用原生 `fetch`，避免把业务层绑死在某个 SDK。
- [x] 请求路径：
  - `POST {baseUrl}/chat/completions`
- [x] 至少支持：
  - `model`
  - `messages`
  - `temperature`
  - `max_tokens`
  - 超时控制（`AbortController` + `timeoutMs`）
- [x] 响应解析为统一 `LlmChatResult`。
- [x] 对错误做分类：
  - 网络/超时（network / timeout）
  - 4xx
  - 5xx
  - 响应结构异常（invalid_response）

> 实现：[`backend/src/dialogue/llm/providers/openai-compatible.provider.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/providers/openai-compatible.provider.ts)。

### TB08-4 Registry（`llm-registry.ts`）
- [x] 根据配置文件中的 `providers[]` 实例化 provider 对象。
- [x] 建立：
  - `providerId -> instance`
  - `providerId -> config/meta`（`ProviderEntry`）
- [x] 支持 `enabled=false` 的 provider 被跳过。
- [x] 对未知 `type` 报清晰错误（启动期暴露）。

> 实现：[`backend/src/dialogue/llm/llm-registry.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/llm-registry.ts)（空池抛错兜底）。

### TB08-5 Router（`llm-router.ts`）
- [x] 输入：`LlmRouteContext + routes + provider metas`
- [x] 输出：有序候选 provider 列表
- [x] 一期至少支持两种策略：
  - `priority`
  - `weighted`
- [x] 候选筛选基于 `candidateTags`
- [x] 上下文匹配一期先支持：
  - `feature`
  - `cityId`
  - `npcId`
- [x] 若无路由命中，回落到全局默认（全部启用 provider 按优先级）

> 实现：[`backend/src/dialogue/llm/llm-router.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/llm-router.ts)（最具体规则优先 `matchScore`；weighted 无放回加权抽样）。

### TB08-6 LlmService（统一入口 + failover 骨架）
- [x] 新增统一 `LlmService.chat(ctx, req)`：
  1. 调 router 得到候选 provider 列表
  2. 依序尝试调用
  3. 若错误属于 `switchOnErrors`，切下一个 provider
  4. 若全部失败，抛 `LLM_UNAVAILABLE`
- [x] 按 `failoverPolicy.maxAttempts` 控制尝试次数
- [x] 记录每次尝试的 provider id、错误分类、耗时日志
- [x] 预留 provider 状态缓存位（`ProviderRuntimeState`），一期不实现主动健康探测

> 实现：[`backend/src/dialogue/llm/llm-service.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/llm/llm-service.ts)。

### TB08-7 对接 DialogueService
- [x] 将 `DialogueService` 从直接注入 `LlmProvider` 改为注入统一 `LlmService`（`@Inject(LLM_SERVICE)`）。
- [x] `DialogueService` 负责构造 `LlmRouteContext`：
  - `userId`
  - `feature='dialogue'`
  - `spotId`
  - `npcId`
  - `cityId/regionId`（由 `spotId` 经 `ConfigRepository.getCityIdForSpot` 反查）
- [x] 保持其余业务逻辑不变：
  - system prompt 组装
  - 会话历史
  - 风控
  - 收获判定

> 实现：[`backend/src/dialogue/dialogue.service.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/dialogue.service.ts)（`buildRouteContext`）。

### TB08-8 模块装配与配置迁移
- [x] `dialogue.module.ts` 从"单 provider factory"升级为：
  - config loader
  - registry
  - router
  - llm service
- [x] `AppConfigService` 增：
  - `llmConfigFile`（及 `llmMockDelayMs`）
- [x] 明确旧配置兼容策略：
  - 本期不再以 `LLM_API_BASE/KEY/MODEL` 作为主配置来源（`.env.example` 已标注废弃）
- [x] `.env.example` 增加：
  - `LLM_CONFIG_FILE`
  - 配置文件示例说明

> 实现：[`dialogue.module.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/dialogue/dialogue.module.ts)、[`app-config.service.ts`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/src/config/app-config.service.ts)、[`.env.example`](file:///Users/zhaopeng.charles/code/magechiu/atlas/.env.example)。

### TB08-9 开发 / 联调模式
- [x] 提供本地开发的最小样例配置：[`backend/config/llm.example.json`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/config/llm.example.json)
- [x] 明确 mock 模式如何启用：
  - 无 `LLM_CONFIG_FILE` 时自动走内置单 mock provider（`buildMockFallback`）
  - 或在配置文件里显式加 `type:"mock"` provider 条目
- [x] 明确生产模式失败不切 mock（失败直接抛 `LLM_UNAVAILABLE`，不静默降级）

### TB08-10 验证
- [x] `npm run build:backend` 通过
- [x] 最小冒烟脚本 [`scripts/smoke-llm.mjs`](file:///Users/zhaopeng.charles/code/magechiu/atlas/backend/scripts/smoke-llm.mjs)（6/6）：
  - 路由命中默认 provider（priority 降序 / cityId 更具体规则优先）
  - 主 provider 失败（network/5xx）后切换到 backup provider
  - 所有候选失败返回 `LLM_UNAVAILABLE`
  - 4xx 不在 switchOnErrors 时不切换；maxAttempts 限制尝试次数
- [x] 验证 `DialogueService` 链路在模拟 provider 下走通：启动服务后 `smoke.mjs`（42/42）、`smoke-dialogue.mjs`（18/18）全通过

---

## 4. 本任务默认不改

- `frontend/**`
- `shared/**`（除非公共任务已先冻结新契约）
- `resources/skills/**`

---

## 5. 验收

- [x] 后端具备多 provider 池、内部路由、失败切换骨架。
- [x] `DialogueService` 不直接感知具体 provider 实现（仅注入 `LlmService` 门面）。
- [x] 结构化配置文件可以表达多组 provider、路由与 failover 策略。
- [x] 真实 provider 失败直接报 `LLM_UNAVAILABLE`，不静默降级到 mock。
- [x] 一期未实现动态健康检查，但框架未把后续优化路径堵死（预留 `ProviderRuntimeState` 状态位）。
