# 05 - NPC 对话系统 · 后端任务（独立交付）

> 交付给**后端 Agent**。依赖公共部分 `tasks/05-NPC对话-公共部分.md` 完成（`@atlas/shared` 已含 NPC/对话契约）。
> 上位设计：`docs/Atlas-路过-NPC对话系统设计.md`（实现其第 4、6 节）。
> 约束（`docs/Atlas-路过-后端开发规范.md` + `协作开发规范.md`）：返回类型取自 `@atlas/shared`，不另立结构；
> Service 承载逻辑、Controller 只编排；模块间经 Service 协作，不跨模块访问 Repository。

---

## 0. 关键设计前提（已拍板）
- **NPC 资产由后端读盘载入**（不走素材服务）；素材服务只托管 `avatar` 图片。
- **会话态用内存仓储**（进程内，与现有 `StateRepository` 同源风格）。
- **system prompt 在服务端组装、永不下发前端**；`knowledge`/`guardrails` 不出服务端。
- **收获判定服务端权威 + 幂等发奖**；前端/模型无权发奖。收获不影响主进度链。
- **LlmProvider 抽象**：默认 `MockLlmProvider`（无真实 LLM 也能跑通联调）；禁止把任何具体 LLM SDK import 进 `DialogueService`。

---

## 1. 公共契约（已就绪，直接复用）
来自 `@atlas/shared`：`NpcProfile` / `NpcKnowledgeEntry` / `NpcPublic` / `NpcKind`、
`DialogueStatus` / `DialogueRole` / `DialogueMessage`、
`StartDialogueRequest/Data` / `SayRequest`/`SayData` / `DialogueSessionData` / `DialogueRewardGrant`、
`Spot.npcIds` / `Spot.dialogueRewards`（`DialogueRewardTrigger`）、
错误码 `DIALOGUE_SESSION_NOT_FOUND` / `DIALOGUE_SESSION_ENDED` / `LLM_UNAVAILABLE`（安全复用 `RISK_BLOCKED`）、
路由 `ApiRoutes.dialogueStart/dialogueSay/dialogueSession`。

> 参考既有实现风格：`backend/src/ai/ai.service.ts`（异步/mock/幂等）、`backend/src/store/state.repository.ts`（内存仓储+幂等表）、
> `backend/src/store/config.repository.ts`（seed 载入）、`backend/src/ops/risk.service.ts`（风控）、`backend/src/common/business.exception.ts`。

---

## 2. 模块结构（新增 `dialogue/` 与会话仓储）
```
backend/src/
  dialogue/
    dialogue.module.ts
    dialogue.controller.ts
    dialogue.service.ts
    npc.repository.ts
    llm/
      llm.provider.ts          # 抽象接口 + DI token
      mock-llm.provider.ts     # 默认实现
  store/
    dialogue-session.repository.ts
```

## 3. 任务

### TB05-1 NpcRepository（读盘载入 `.skill.json`）
- [x] 启动时扫描 `SKILLS_DIR`（默认 `./resources/skills`）下 `*.skill.json`，解析为 `NpcProfile` 存内存 Map。
- [x] 提供 `getNpc(id): NpcProfile | undefined`、`listNpcs(): NpcProfile[]`。
- [x] 容错：目录不存在或文件损坏只记日志、跳过该文件，不致启动失败（参考"素材缺失占位兜底"哲学）。
- [x] 产出 MVP 资产文件（放仓库 `resources/skills/`）：
  - `npc_dufu.skill.json`：`kind=signature`，含杜甫草堂相关 `knowledge`（《春夜喜雨》《茅屋为秋风所破歌》等真迹事实），
    `guardrails` 含「只可引用真实存世杜诗，不得杜撰诗句或生平；不确定则坦言记不真切」。
  - `npc_passerby.skill.json`：`kind=generic`，虚构路人，无史实包袱，可聊当地风物。

### TB05-2 DialogueSessionRepository（内存会话仓储）
- [x] 内存结构（参考 StateRepository 的 `userId|...` key 与 Set/Map 用法）：
```ts
interface DialogueSession {
  id: string; userId: string; spotId: string; npcId: string;
  status: DialogueStatus;
  messages: DialogueMessage[];
  grantedTriggerIds: Set<string>;
  createdAt: string; updatedAt: string;
}
```
- [x] 提供 create / getById / appendMessage / markGranted / endSession 等方法；按 `userId` 校验归属。

### TB05-3 LlmProvider 抽象 + Mock 实现
- [x] `llm.provider.ts`：定义接口与注入 token：
```ts
export interface LlmChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface LlmChatRequest { messages: LlmChatMessage[]; }
export interface LlmChatResult { text: string; }
export interface LlmProvider { chat(req: LlmChatRequest): Promise<LlmChatResult>; }
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
```
- [x] `mock-llm.provider.ts`：基于传入 messages（system 含 knowledge）返回桩文本，
  尽量复述命中到的知识点，便于联调与收获触发演示；可读 `LLM_MOCK_DELAY_MS` 模拟耗时。
- [x] 通过 `LLM_PROVIDER` token 按 `LLM_PROVIDER` env（`mock|<real>`）选择实现；真实 provider 后插，业务层零改动。
- [x] **`DialogueService` 仅依赖 `LlmProvider` 接口，不得 import 任何具体 SDK。**

### TB05-4 DialogueService（会话编排 + 收获判定）
- [x] `start(userId, body: StartDialogueRequest): StartDialogueData`
  1. 校验 spot 存在且 open（否则 `SPOT_NOT_UNLOCKED` / `NOT_FOUND`）；userId 取自鉴权，不信前端。
  2. 选 NPC：`body.npcId` 优先；否则从 `spot.npcIds` 选（签名优先，多个 generic 可随机）；取不到 → `NOT_FOUND`。
  3. 幂等：`requestId` 走幂等表（scope `dialogue-start`），重复请求返回同一 session。
  4. 建会话，开场白取 `npc.persona.opening`，返回 `sessionId + NpcPublic + opening`。
- [x] `say(userId, sessionId, body: SayRequest): SayData`
  1. 取会话校验归属/存在/未结束（否则 `DIALOGUE_SESSION_NOT_FOUND` / `DIALOGUE_SESSION_ENDED`）。
  2. 幂等：`requestId`（scope `dialogue-say`），重复请求返回上次结果，**不重复发奖**。
  3. 内容安全：用户输入过 `RiskService`，命中 → `RISK_BLOCKED`。
  4. **服务端组 system prompt** = `persona`（软）+ `knowledge`（硬 grounding）+ `guardrails`；拼历史消息 + 用户输入调 `LlmProvider.chat`；不可用 → `LLM_UNAVAILABLE`。
  5. 追加 user/npc 两条消息到会话历史。
  6. **收获判定**：遍历 `spot.dialogueRewards`，命中 `topicHints`（匹配用户输入或 NPC 回复）且未在 `grantedTriggerIds` → 发奖。
  7. 达 `DIALOGUE_MAX_TURNS` 上限 → `status=Ended`。
  8. 返回 `reply + grants + status`。
- [x] `getSession(userId, sessionId): DialogueSessionData`：返回会话快照（messages、grantedTriggerIds、status）。
- [x] **收获发奖复用现有 reward 通道**（与 check-in/execute 一致的发放+去重逻辑，写 `userRewards`，可被 collections 接口读到）；查不到 reward 配置则跳过该触发点并记日志。

### TB05-5 DialogueController（3 路由，对齐 ApiRoutes）
- [x] `POST /api/dialogue/start` → `StartDialogueData`
- [x] `POST /api/dialogue/:sessionId/say` → `SayData`
- [x] `GET /api/dialogue/:sessionId` → `DialogueSessionData`
- [x] 统一 `@CurrentUser()` 取 userId；返回 data 由全局 `ResponseInterceptor` 包络。

### TB05-6 配置与模块装配
- [x] `app-config.service.ts` 增（env 读取，默认值见下）：
  `skillsDir`(`SKILLS_DIR`=`./resources/skills`)、`llmProvider`(`LLM_PROVIDER`=`mock`)、
  `llmApiBase/llmApiKey/llmModel`（真实 provider 用，可空）、`dialogueMaxTurns`(`DIALOGUE_MAX_TURNS`=20)。
- [x] `.env.example` 追加上述变量及注释（mock 阶段 key 留空）。
- [x] `DialogueModule` 装配 controller/service/npc repo/session repo/llm provider，并在 `AppModule` 注册；
  复用 `OpsModule` 的 `RiskService`、reward 发放所在模块（经 Service 注入，不跨模块访问 Repository）。

### TB05-7 验证
- [x] `npm run build:backend` 通过。
- [x] 在 `backend/scripts/` 加最小冒烟（或扩 `smoke.mjs`）：start → 多轮 say（含命中知识点）→ 校验 `grants` 非空且重复 say 幂等不重复发奖 → getSession 历史正确 → collections 能看到新 reward。（`scripts/smoke-dialogue.mjs`，18/18 通过）
- [x] 实测（端口按实际）：
```
curl -s .../api/dialogue/start -d '{"spotId":"spot_dufu_thatched_cottage","requestId":"r1"}' ...
curl -s .../api/dialogue/{sessionId}/say -d '{"message":"给我讲讲春夜喜雨","requestId":"s1"}' ...
# 期望 reply 非空，命中后 grants 含 reward_card_poem
```

---

## 4. 验收
- [x] encounter 入口可 start 会话、多轮 say 得到 NPC 回复（mock provider 下可跑）。
- [x] system prompt 服务端组装，响应中**不含** knowledge/guardrails。
- [x] 命中知识点服务端发奖、幂等不重复；收获进 `userRewards`、collections 可见；不影响主进度/成就。
- [x] 用户输入过风控；LLM 不可用返回 `LLM_UNAVAILABLE`。
- [x] 未引入脱离 `@atlas/shared` 的返回结构；未把 LLM SDK 焊进 DialogueService；`npm run build:backend` 通过。

> 不改动 AITask 图片链路与现有 Action execute；`Spot.regionId`/进度链语义不变。
