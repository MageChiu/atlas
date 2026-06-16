# 05 - NPC 对话系统 · 前端任务（独立交付）

> 交付给**前端 Agent**。依赖公共部分 `tasks/05-NPC对话-公共部分.md` 完成（`@atlas/shared` 已含 NPC/对话契约）。
> 上位设计：`docs/Atlas-路过-NPC对话系统设计.md`（实现其第 5 节）。
> 约束（`docs/Atlas-路过-前端开发规范.md` + `协作开发规范.md`）：类型取自 `@atlas/shared`；路径用 `ApiRoutes.*`；
> Mock 与真实接口结构完全一致；写操作带 `requestId`；不写死 NPC 文案（全部来自接口）。

---

## 0. 关键设计前提（已拍板）
- encounter 类型 Action 触发**多轮对话面板**（Event Layer 内 UI，**不跳页**）。
- 对话面板里输入自由文本、多轮往返；聊到知识点服务端发奖，前端收到 `grants` 用现有 `RewardPopup` 展示并提示"已收入图鉴"。
- knowledge/guardrails 不会下发，前端只渲染 NPC 公开信息（`NpcPublic`：id/name/avatar）。

---

## 1. 公共契约（已就绪，直接复用）
来自 `@atlas/shared`：`StartDialogueRequest/Data`、`SayRequest`/`SayData`、`DialogueSessionData`、
`DialogueMessage`、`DialogueRewardGrant`、`NpcPublic`、`DialogueRole`/`DialogueStatus`、
`ApiRoutes.dialogueStart/dialogueSay/dialogueSession`、错误码 `DIALOGUE_SESSION_NOT_FOUND/ENDED`、`LLM_UNAVAILABLE`、`RISK_BLOCKED`。

> 现状参考：
> - Action 执行分发：`frontend/src/hooks/useExecuteAction.ts`（当前 encounter→`openModal({type:'encounter',...})`，**本任务改为开对话**）。
> - 弹层调度：`frontend/src/stores/uiStore.ts`（`openModal` 的 typed modal）。
> - 偶遇旧 UI：`frontend/src/components/domain/EncounterPanel.tsx`（静态事件，本任务新增对话面板，二者按 event 是否存在区分）。
> - API 门面：`frontend/src/services/api.ts`；Mock：`frontend/src/services/mock/mockApi.ts`；请求 id：`@/utils/id` 的 `genRequestId()`。
> - 奖励展示：`frontend/src/components/domain/RewardPopup.tsx`。

---

## 2. 任务

### TF05-1 API 门面 + Mock（`services/api.ts` + `services/mock/mockApi.ts`）
- [ ] `api` 增三个方法（Mock 与真实双实现，结构一致）：
```ts
startDialogue(req: { spotId: string; npcId?: string }): Promise<StartDialogueData>   // 真实：POST dialogueStart，注入 requestId
say(sessionId: string, message: string): Promise<SayData>                            // 真实：POST dialogueSay，注入 requestId
getDialogueSession(sessionId: string): Promise<DialogueSessionData>                  // 真实：GET dialogueSession
```
- [ ] Mock 实现（基于 seed）：
  - `startDialogue`：按 `spot.npcIds` 选 NPC（签名优先/路人随机），返回 `NpcPublic` + 开场白桩文本。
  - `say`：返回桩回复；命中 `spot.dialogueRewards.topicHints`（匹配用户输入）且未发过 → 在 `grants` 返回对应 reward，并记录已发避免重复。
  - `getDialogueSession`：返回内存维护的消息历史与已得收获。
  - 维持内存会话态（参考 mockApi 现有 `state` 写法）。

### TF05-2 dialogueStore（`stores/dialogueStore.ts`）
- [ ] 字段：`sessionId / npc(NpcPublic) / messages(DialogueMessage[]) / status / sending / grantedTriggerIds`。
- [ ] 方法：`startSession / appendMessage / setSending / applyGrants / reset`。
- [ ] 仅存会话/交互态；不重复缓存后端实体（服务端数据由 TanStack Query/调用结果驱动）。

### TF05-3 useDialogue（`hooks/useDialogue.ts`）
- [ ] 封装 `start` 与 `say`（TanStack Query `useMutation`）：
  - `start(spotId, npcId?)`：成功写入 store（sessionId/npc/opening）。
  - `send(message)`：乐观追加用户消息→调 `say`→追加 NPC reply→`applyGrants`；命中 grants 时打开 `RewardPopup` 并 `invalidateQueries(collections)`。
  - 错误映射：`RISK_BLOCKED`→提示内容不合适；`LLM_UNAVAILABLE`→提示稍后再试并允许重发（不清空输入）；`DIALOGUE_SESSION_ENDED`→提示并关闭面板。
- [ ] 达到结束态（`status=Ended`）禁用输入。

### TF05-4 对话面板 UI（`components/domain/DialoguePanel.tsx` + `DialogueMessageList.tsx`）
- [ ] 展示 NPC 头像/名（`avatar` 走 `NEXT_PUBLIC_ASSET_BASE`，缺图占位兜底，复用现有 assets 解析风格）。
- [ ] 消息流（user/npc 区分气泡）+ 输入框 + 发送按钮；`sending` 时禁用并显示"对方正在思考…"。
- [ ] 收获到达时在消息流内插入轻提示（"获得：草堂诗卡 · 已收入图鉴"），奖励详情走 `RewardPopup`。
- [ ] 关闭面板时 `dialogueStore.reset()`；不使用页面跳转。

### TF05-5 入口分发（`hooks/useExecuteAction.ts` + `stores/uiStore.ts` + `ActionPanel`）
- [ ] encounter 类型改为**开对话**：点击 encounter Action → `useDialogue.start(spotId, action 关联的 npcId?)` → 打开 `DialoguePanel`（经 `uiStore.openModal({type:'dialogue', spotId, ...})`，新增一类 modal type）。
- [ ] 不再对 encounter 走 `executeAction`/静态 `EncounterPanel`（保留静态 EncounterPanel 仅用于仍返回 `event` 的旧数据，按需保留或标注）。
- [ ] 分发集中在统一入口，不在组件里散落 if-else（遵循前端规范第 8 节）。

### TF05-6 验证
- [ ] `npm run build:web` 通过。
- [ ] Mock 模式（`NEXT_PUBLIC_USE_MOCK=true`）下走通：在杜甫草堂点偶遇 → 开对话 → 多轮输入 → 输入含"春夜喜雨"触发收获 → RewardPopup + 图鉴可见。
- [ ] 切真实接口（`USE_MOCK=false`）零字段改动即可联通（与后端 `tasks/05-NPC对话-后端.md` 对齐）。

---

## 3. 验收
- [ ] encounter → 多轮对话面板（不跳页），NPC 公开信息与文案均来自接口、无写死。
- [ ] 收获经服务端返回的 `grants` 展示并接入图鉴；前端不自行判定发奖。
- [ ] 错误码（RISK_BLOCKED/LLM_UNAVAILABLE/SESSION_ENDED）均有合理 UI。
- [ ] Mock 与真实接口结构一致；写操作带 requestId；`npm run build:web` 通过。

> 不改动 photo/check_in/random_event 既有流程；地图层级切换仍由 Scene/Camera 管理。
