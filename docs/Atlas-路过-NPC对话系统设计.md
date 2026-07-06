# Atlas - 路过 NPC 对话系统设计（整体方案）

> 状态：**设计稿，待评审**。评审通过后再拆 `tasks/05-NPC对话-{公共,后端,前端}.md` 分工开发。
> 定位：在景点内通过与 NPC 的多轮对话，自然地了解在地文化（如在杜甫草堂遇见杜甫），
> 聊到特定知识点可点亮该景点专属收获（诗卡 / 图鉴轶事）。
>
> 上位依据：`docs/Atlas-路过-数据模型设计.md`、`API协议说明.md`、`素材资源方案.md`、`协作开发规范.md`。
> 契约唯一事实来源：`@atlas/shared`。

---

## 1. 设计目标与边界

### 1.1 目标
- 在 `Action`（`encounter` 类型）入口触发，开启与某 NPC 的**多轮对话**。
- NPC 分两类：**签名 NPC**（真实历史人物，如杜甫）与**通用路人**（虚构，给没有标志性人物的景点兜底 + 随机趣味）。
- 对话中聊到景点配置的**知识点**即点亮**景点专属收获**，接入现有 reward / 图鉴系统。

### 1.2 不做（一期边界）
- 不做跨景点的长期记忆 / 角色养成。
- 不做语音、不做实时流式（MVP 整段返回，SSE 后置）。
- 不做对话决定"是否解锁下一景点"等强游戏化判定（收获仅限点亮收藏，不改主进度链）。

### 1.3 两条贯穿原则
1. **软硬分离**：NPC 的「知识锚（硬事实）」锁死，只可引用不可编造；「人格演绎（软）」放开。
2. **配置先行 + 服务端权威**：NPC 内容是可校对的资产；system prompt 在**服务端**组装、收获在**服务端**判定，前端与模型都无权决定发奖。

---

## 2. 三层职责划分（沿用既有边界）

| 层 | 承载物 | 类比现有 |
| --- | --- | --- |
| `@atlas/shared` | NPC/对话的**类型、枚举、契约、错误码、路由** | 同 content/ai 契约 |
| 资产文件 `resources/skills/*.skill.json` | **具体 NPC 的内容**（人设/知识锚/护栏） | 同 `resources/assets`（不入服务镜像） |
| `seedDataset`（轻量） | 景点↔NPC **绑定关系** + 景点侧**收获触发点** | 同 region/spot 配置 |

> 改一句杜甫话术 → 只动一个 `.skill.json`；改绑定/收获 → 动 seed；改结构 → 动 shared。三者解耦。

---

## 3. 公共部分（@atlas/shared）

### 3.1 新增枚举
```ts
// NPC 类型
export const NpcKind = { Signature: 'signature', Generic: 'generic' } as const;
// 对话会话状态
export const DialogueStatus = { Active: 'active', Ended: 'ended' } as const;
// 对话消息角色
export const DialogueRole = { Npc: 'npc', User: 'user' } as const;
```

### 3.2 NPC Profile（资产文件的结构契约）
```ts
export interface NpcKnowledgeEntry {
  topic: string;          // 知识点主题，如 "春夜喜雨"
  facts: string;          // 硬事实文本（grounding，校对过）
}
export interface NpcProfile {
  id: string;             // npc_dufu / npc_passerby
  name: string;           // 杜甫 / 路人
  kind: NpcKind;
  avatar?: string;        // 资产相对路径（走素材服务），可选
  persona: {              // 软：可演绎
    voice: string;        // 口吻/性格
    setting: string;      // 出场设定，如"草堂月夜偶遇的诗魂"
    opening: string;      // 开场白（或开场白生成提示）
  };
  knowledge: NpcKnowledgeEntry[];  // 硬：知识锚
  guardrails: string[];            // 护栏：能聊什么/不可编造/不确定如何圆场
}
```

### 3.3 景点侧扩展（`Spot` 增可选字段）
```ts
export interface DialogueRewardTrigger {
  id: string;             // 触发点 id
  topicHints: string[];   // 命中判定关键词/主题（聊到即点亮）
  rewardId: string;       // 复用现有 Reward
  hint?: string;          // 给用户的引导（"试着问问他的茅屋故事"）
}
export interface Spot {
  // ...现有字段
  npcIds?: string[];               // 绑定的 NPC（可多个；含 fallback 如 npc_passerby）
  dialogueRewards?: DialogueRewardTrigger[];  // 景点专属收获（归景点侧，已定）
}
```

### 3.4 对话契约（contracts/dialogue.ts）
```ts
export interface DialogueMessage { role: DialogueRole; content: string; at: string; }

// POST /api/dialogue/start
export interface StartDialogueRequest { spotId: string; npcId?: string; requestId: string; }
export interface StartDialogueData {
  sessionId: string;
  npc: { id: string; name: string; avatar?: string };  // 仅公开信息，knowledge/guardrails 不下发
  opening: DialogueMessage;
}

// POST /api/dialogue/{sessionId}/say
export interface SayRequest { message: string; requestId: string; }
export interface DialogueRewardGrant { triggerId: string; reward: Reward; }
export interface SayData {
  reply: DialogueMessage;
  grants: DialogueRewardGrant[];   // 本轮点亮的收获（可空）
  status: DialogueStatus;
}

// GET /api/dialogue/{sessionId}
export interface DialogueSessionData {
  sessionId: string; npcId: string; spotId: string;
  status: DialogueStatus; messages: DialogueMessage[];
  grantedTriggerIds: string[];
}
```

> 08 一期公共边界补充：
> - 对话三条路由 `dialogueStart / dialogueSay / dialogueSession` 路径不变；
> - `StartDialogueRequest / SayRequest / SayData / DialogueSessionData` 本期不新增必填字段；
> - 若未来确实需要前端透传业务场景信息，应优先考虑 `businessScene / dialogueMode / scenario` 这类业务语义字段，而不是直接塞入模糊的 `sceneId`。

### 3.5 新增错误码
```
DIALOGUE_SESSION_NOT_FOUND   // 会话不存在/无权访问
DIALOGUE_SESSION_ENDED       // 会话已结束
LLM_UNAVAILABLE              // LLM 服务不可用（区别于 AI_TASK_FAILED）
// 内容安全复用现有 RISK_BLOCKED
```

### 3.6 路由（ApiRoutes 增）
```ts
dialogueStart: () => '/api/dialogue/start',
dialogueSay: (sessionId: string) => `/api/dialogue/${sessionId}/say`,
dialogueSession: (sessionId: string) => `/api/dialogue/${sessionId}`,
```

### 3.7 种子数据
- 新增 NPC 绑定：`spot_dufu_thatched_cottage.npcIds = ['npc_dufu', 'npc_passerby']`；其余景点至少绑 `npc_passerby`。
- 新增 `dialogueRewards`（杜甫草堂示例）：聊到《春夜喜雨》/《茅屋为秋风所破歌》→ 解锁对应诗卡（复用/新增 reward）。
- NPC 内容本身**不进 seed**，放 `resources/skills/`（见第 6 节）。

---

## 4. 后端设计

### 4.1 模块结构（新增 `dialogue/` 模块）
```
backend/src/
  dialogue/
    dialogue.module.ts
    dialogue.controller.ts     # 3 个路由
    dialogue.service.ts        # 会话编排 + 收获判定（服务端权威）
    npc.repository.ts          # 载入 resources/skills/*.skill.json，按 id 提供 NpcProfile
    llm/
      llm.provider.ts          # 单个 provider 调用接口
      providers/
        openai-compatible.provider.ts
        mock.provider.ts
      llm-config.ts            # 结构化配置读取与校验
      llm-registry.ts          # provider 实例化与索引
      llm-router.ts            # 根据上下文选择候选 provider
      llm-service.ts           # 对业务层暴露统一 chat(ctx, req)
  store/
    dialogue-session.repository.ts  # 内存会话仓储（已定：先内存）
```

### 4.2 内存会话仓储（沿用 StateRepository 风格）
```ts
interface DialogueSession {
  id: string; userId: string; spotId: string; npcId: string;
  status: DialogueStatus;
  messages: DialogueMessage[];
  grantedTriggerIds: Set<string>;
  createdAt: string; updatedAt: string;
}
```
- key 仍用 `userId|...` 维度；与 `StateRepository` 同源（内存、进程内）。
- 幂等：start/say 接收 `requestId`，复用 `StateRepository` 幂等表风格（`scope='dialogue-start'|'dialogue-say'`），避免重复发奖。

### 4.3 会话编排流程（DialogueService）
```
start:
  1. 校验 spot 存在、open；userId 来自鉴权（不信前端传入）
  2. 选 NPC：入参 npcId 优先；否则从 spot.npcIds 选（签名优先 or 随机路人，策略可配）
  3. NpcRepository 取 NpcProfile；组开场白（persona.opening）
  4. 建 DialogueSession（内存），返回 sessionId + npc 公开信息 + opening
say:
  1. 取会话，校验存在/归属/未结束（否则 DIALOGUE_SESSION_*）
  2. 内容安全：用户输入过 RiskService（命中 RISK_BLOCKED）
  3. 服务端组 system prompt = persona(软) + knowledge(硬, grounding) + guardrails
     —— knowledge/guardrails 绝不下发前端
  4. 调统一 LlmService.chat(ctx, req)：
     - 由后端内部路由决定候选 provider
     - provider 失败时按策略切换
     - 对业务层仍只暴露统一回复结果
     不可用 → LLM_UNAVAILABLE
  5. 追加消息到会话历史
  6. 收获判定：对照 spot.dialogueRewards.topicHints 命中且未发过 → 复用 reward 发放(幂等)，
     计入 grantedTriggerIds，返回 grants
  7. 返回 reply + grants + status
```

### 4.4 关键约束
- **system prompt 服务端组装、永不下发**（防注入泄露/篡改、保证史实锚定只在服务端）。
- **收获判定服务端权威**，前端/模型无权发奖；发奖走现有 reward 通道并幂等去重。
- **LLM 多 Provider 池 + 内部路由**：provider 选择、权重、失败切换均属于后端内部能力，前端不直接感知。
- **LlmProvider 抽象**：禁止把任何具体 LLM SDK 直接 import 进 `DialogueService`；具体 provider 通过 registry / router / 统一 `LlmService` 间接接入。
- 复用现有 `RiskService`、`BusinessException`、统一响应/错误过滤器。

### 4.5 配置（app-config.service.ts 增，env 读取）
```
LLM_CONFIG_FILE=/etc/atlas/llm/config.json  # 指向结构化配置文件（Secret 挂载）
SKILLS_DIR=./resources/skills               # NPC 资产目录
DIALOGUE_MAX_TURNS=20                       # 单会话上限（成本/滥用兜底）
```

结构化配置文件承载：
- 多 provider 池（主备 / 多活 / 加权）
- 路由规则（按 feature / city / npc 等）
- failover 策略（最大尝试次数、可切换错误集合）

> 一期不前置动态健康检查，但框架需要为后续健康探测和摘流留扩展位。

---

## 5. 前端设计

### 5.1 入口
- `encounter` 类型 Action 点击 → 调 `dialogue/start` → 打开**对话面板**（Event Layer 内的新 UI，不跳页）。
- 与现有 `executeAction` 的区别：encounter 走对话流程，其余 Action 不变。需在 Action 分发表里把 encounter 指向对话面板（前端规范第 8 节的分发表，新增一类，不散落 if-else）。

### 5.2 新增组件 / 服务
```
scenes 或 components/dialogue/
  DialoguePanel.tsx        # 对话窗：消息流 + 输入框 + NPC 头像/名
  DialogueMessageList.tsx
services/api.ts            # 增 startDialogue / say / getDialogueSession（Mock + 真实双实现）
services/mock/mockApi.ts   # Mock 对话：基于 seed 的 NPC 公开信息 + 桩回复 + 命中关键词发奖
stores/dialogueStore.ts    # 当前 sessionId / 消息列表 / 发送中 / 已得收获
hooks/useDialogue.ts       # start/say 封装（TanStack Query useMutation）
```

### 5.3 交互与契约约束
- 写操作（start/say）带 `requestId`（幂等），同现有 `genRequestId()`。
- 收获 `grants` 到达 → 复用现有 `RewardPopup` 展示，并提示"已收入图鉴"。
- 错误：`RISK_BLOCKED` 提示内容不合适；`LLM_UNAVAILABLE` 提示稍后再试并允许重发；`DIALOGUE_SESSION_ENDED` 引导关闭面板。
- Mock 与真实接口**结构完全一致**，联调零字段改动（前端规范铁律）。
- 不写死 NPC 文案：开场白/回复均来自接口；前端只渲染。
- 一期前端**不直接传 providerId / routeHint / sceneId**；如未来确需补充业务场景字段，须先经公共契约冻结。

---

## 6. 资产方案（NPC `.skill.json`）

- 位置：仓库根 `resources/skills/{npcId}.skill.json`（与 `resources/assets` 同级，**不打包进服务**）。
- 由现有素材服务（`asset-server.mjs`）或后端 `NpcRepository` 直接读盘载入——**倾向后端读盘**（NPC 是后端逻辑依赖，需在服务端组 prompt），素材服务只托管 `avatar` 图片。
- 上云：`SKILLS_DIR` 指向挂载卷/对象存储路径即可，代码零改动（同素材方案）。
- MVP 资产：`npc_dufu.skill.json`（签名，含杜甫草堂相关知识锚 + 护栏）、`npc_passerby.skill.json`（通用，无史实包袱）。
- 史实护栏写进 `guardrails`，例：「只可引用真实存世的杜诗，不得杜撰诗句或生平；不确定则坦言记不真切」。

---

## 7. 与现有系统的衔接 / 影响面

| 现有系统 | 衔接方式 | 是否改动 |
| --- | --- | --- |
| Action(encounter) | 作为对话入口 | 前端分发新增一类；后端 execute 不变 |
| Reward / 图鉴 | 收获复用 reward 发放 + collections 展示 | 不改结构，可能新增 reward 数据 |
| 风控 RiskService | 用户输入审核 | 复用 |
| 统一响应/错误/幂等 | 全部复用 | 复用 |
| AITask 图片链路 | **不复用**（对话是多轮会话，另起） | 不影响 |
| 主进度链(解锁/成就) | 对话收获**不影响**主进度 | 不改 |

---

## 8. MVP 切片（评审后第一刀）

只做：**杜甫草堂**接入 `npc_dufu` + 全局 `npc_passerby`，先用 mock / 最小真实 provider 骨架，1~2 个收获触发点（诗卡），跑通：
```
encounter Action → dialogue/start → 多轮 say（服务端组 prompt + mock 回复）
  → 命中知识点 → 服务端发奖(幂等) → RewardPopup + 图鉴
```
验证体验与链路后，再：①完善多 Provider 路由与 failover；②扩 NPC/景点；③评估 SSE 流式；④补动态健康检查。

---

## 9. 待评审确认点
1. 三层职责划分（契约/资产/seed）与 `NpcProfile`/`Spot` 扩展字段是否认可。
2. 后端 `dialogue/` 模块 + `LlmProvider` 抽象 + 内存会话仓储结构是否认可。
3. 新增错误码（`DIALOGUE_*` / `LLM_UNAVAILABLE`）与 3 个路由是否认可。
4. NPC 资产由**后端读盘**（而非素材服务）载入是否认可。
5. MVP 切片范围（单景点 + mock provider）是否认可。

> 以上确认后，拆分为 `tasks/05-NPC对话-公共部分.md`（先行）、`tasks/05-NPC对话-后端.md`、`tasks/05-NPC对话-前端.md` 三份独立任务文件。
