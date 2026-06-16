# 05 - NPC 对话系统 · 公共部分（@atlas/shared）—— 必须先完成

> 交付给**公共 Agent**，无需阅读其他任务文件即可执行。
> 上位设计：`docs/Atlas-路过-NPC对话系统设计.md`（本任务实现其第 3 节）。
> 本任务是 NPC 对话特性的**契约打底**，完成并 `npm run build:shared` 通过后，**解锁后端与前端并行**。
>
> 约束（`docs/Atlas-路过-协作开发规范.md`）：本特性的所有类型/枚举/契约/错误码/路由/种子的唯一事实来源是 `@atlas/shared`；
> 前后端只读引用，禁止各自重声明。改契约必先改此处并同步文档。

---

## 0. 关键设计前提（已拍板）
- **软硬分离**：NPC 的 `knowledge`（硬事实）+ `guardrails`（护栏）锁死，只可引用不可编造；`persona`（人格）可演绎。
- **收获归景点侧**：对话收获触发点配在 `Spot` 上，不在 NPC 上。
- **收获不影响主进度链**：只点亮收藏（reward/图鉴），不改解锁/成就。
- NPC 内容本身（人设/知识文本）**不进 seed**，放 `resources/skills/*.skill.json`（后端读盘，见后端任务）。本任务只定 `NpcProfile` 的**类型契约**。

---

## 1. 任务

### TC05-1 新增枚举（`shared/src/enums.ts`）
- [x] 追加并导出：
```ts
/** NPC 类型：签名(真实人物，史实红线高) / 通用(虚构路人，无史实包袱) */
export const NpcKind = { Signature: 'signature', Generic: 'generic' } as const;
export type NpcKind = (typeof NpcKind)[keyof typeof NpcKind];

/** 对话会话状态 */
export const DialogueStatus = { Active: 'active', Ended: 'ended' } as const;
export type DialogueStatus = (typeof DialogueStatus)[keyof typeof DialogueStatus];

/** 对话消息角色 */
export const DialogueRole = { Npc: 'npc', User: 'user' } as const;
export type DialogueRole = (typeof DialogueRole)[keyof typeof DialogueRole];
```

### TC05-2 NpcProfile 契约（新增 `shared/src/models/npc.ts`，并从 `models/index.ts` 导出）
- [ ] 定义 `.skill.json` 的结构契约（资产文件按此结构，后端读盘解析）：
```ts
import type { NpcKind } from '../enums.js';

export interface NpcKnowledgeEntry {
  topic: string;   // 知识点主题，如 "春夜喜雨"
  facts: string;   // 硬事实文本（grounding，须人工校对）
}
export interface NpcProfile {
  id: string;            // npc_dufu / npc_passerby
  name: string;          // 杜甫 / 路人
  kind: NpcKind;
  avatar?: string;       // 头像资产相对路径（走素材服务），可选
  persona: {             // 软：可演绎
    voice: string;       // 口吻 / 性格
    setting: string;     // 出场设定，如"草堂月夜偶遇的诗魂"
    opening: string;     // 开场白
  };
  knowledge: NpcKnowledgeEntry[];  // 硬：知识锚
  guardrails: string[];            // 护栏：可聊范围 / 不可编造 / 不确定如何圆场
}
/** 对外暴露的 NPC 公开信息（knowledge/guardrails 绝不下发前端） */
export interface NpcPublic {
  id: string;
  name: string;
  avatar?: string;
}
```

### TC05-3 Spot 扩展（`shared/src/models/content.ts`）
- [ ] `Spot` 增两个可选字段（保持向后兼容，不破坏既有数据）：
```ts
export interface DialogueRewardTrigger {
  id: string;            // 触发点 id（景点内唯一）
  topicHints: string[];  // 命中判定关键词/主题（聊到即点亮）
  rewardId: string;      // 复用现有 Reward.id
  hint?: string;         // 给用户的引导文案
}
// Spot 内追加：
//   npcIds?: string[];                       // 绑定 NPC（可多个，含 fallback 如 npc_passerby）
//   dialogueRewards?: DialogueRewardTrigger[]; // 景点专属收获（归景点侧）
```
- [ ] `DialogueRewardTrigger` 从 `models/index.ts` 导出。

### TC05-4 对话契约（新增 `shared/src/contracts/dialogue.ts`，从 `contracts/index.ts` 导出）
- [ ] 定义请求/响应类型：
```ts
import type { DialogueRole, DialogueStatus } from '../enums.js';
import type { NpcPublic } from '../models/npc.js';
import type { Reward } from '../models/content.js';

export interface DialogueMessage { role: DialogueRole; content: string; at: string; }

// POST /api/dialogue/start
export interface StartDialogueRequest { spotId: string; npcId?: string; requestId: string; }
export interface StartDialogueData { sessionId: string; npc: NpcPublic; opening: DialogueMessage; }

// POST /api/dialogue/{sessionId}/say
export interface SayRequest { message: string; requestId: string; }
export interface DialogueRewardGrant { triggerId: string; reward: Reward; }
export interface SayData { reply: DialogueMessage; grants: DialogueRewardGrant[]; status: DialogueStatus; }

// GET /api/dialogue/{sessionId}
export interface DialogueSessionData {
  sessionId: string; npcId: string; spotId: string;
  status: DialogueStatus; messages: DialogueMessage[]; grantedTriggerIds: string[];
}
```

### TC05-5 错误码（`shared/src/errors.ts`）
- [ ] `ErrorCode` 与 `ErrorMessage` 各追加（内容安全复用现有 `RISK_BLOCKED`，不新增）：
```
DIALOGUE_SESSION_NOT_FOUND  -> 'Dialogue session not found'
DIALOGUE_SESSION_ENDED      -> 'Dialogue session has ended'
LLM_UNAVAILABLE             -> 'LLM service is unavailable'
```

### TC05-6 路由（`shared/src/contracts/routes.ts`）
- [ ] `ApiRoutes` 追加：
```ts
dialogueStart: () => '/api/dialogue/start',
dialogueSay: (sessionId: string) => `/api/dialogue/${sessionId}/say`,
dialogueSession: (sessionId: string) => `/api/dialogue/${sessionId}`,
```

### TC05-7 种子数据（`shared/src/seed/dataset.ts`）
- [x] `spot_dufu_thatched_cottage`：`npcIds = ['npc_dufu', 'npc_passerby']`。
- [x] 其余景点：至少 `npcIds = ['npc_passerby']`（保证每个景点都能触发对话）。
- [x] `spot_dufu_thatched_cottage.dialogueRewards`（MVP 示例，2 个触发点）：
  - 聊到《春夜喜雨》(`topicHints: ['春夜喜雨','好雨知时节']`) → `rewardId: reward_card_poem`（复用现有诗卡）。
  - 聊到《茅屋为秋风所破歌》(`topicHints: ['茅屋为秋风所破','秋风']`) → 新增 `reward_card_thatched_cottage`（草堂诗卡，type=card，补到 `rewards`）。
- [x] 如新增 reward，按现有 reward 结构补全（id/type/name/rarity/asset）。

### TC05-8 验证
- [x] `npm run build:shared` 通过。
- [x] 自检：`NpcProfile`/`Spot.npcIds`/对话契约/错误码/路由均可从 `@atlas/shared` 顶层 import。

---

## 2. 出口
- shared 构建通过、上述符号可导出 → **解锁** `tasks/05-NPC对话-后端.md` 与 `tasks/05-NPC对话-前端.md` 并行开发。
- 同步：本任务若对设计文档字段有调整，回写 `docs/Atlas-路过-NPC对话系统设计.md` 与 `docs/Atlas-路过-数据模型设计.md`、`API协议说明.md`。
