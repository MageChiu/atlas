# 07 - NPC 内容扩充 · skills 资产任务（独立交付）

> 本文件交付给**NPC 内容 worker**，目标是专门扩充 `resources/skills/*.skill.json`。
> 上位依据：`docs/Atlas-路过-NPC对话系统设计.md` 第 3.2 / 第 6 节、`tasks/05-NPC对话-{公共部分,后端}.md`。
> 本任务**不讨论也不改动 LLM 后端接入方案**；只负责 NPC 内容资产与样例沉淀。
>
> 约束（`docs/Atlas-路过-协作开发规范.md`）：
> - `.skill.json` 的结构以 `@atlas/shared` 中 `NpcProfile` 为唯一事实来源；
> - 只扩内容，不私自变更 schema / API / 错误码 / 路由；
> - `knowledge` / `guardrails` 只供服务端组 prompt 使用，前端不可见。

---

## 0. 任务定位（先讲清边界）

这个 worker 的职责是：
- 扩充 NPC 的**人设/知识锚/护栏**内容资产；
- 为后续批量引入名人 NPC、随机游客 NPC 建立统一写法与样例；
- 为后续景点绑定提供可直接落地的 `npcId` 方案。

这个 worker **不负责**：
- 不改 `shared/src/models/npc.ts`、`contracts/`、`errors.ts`、`routes.ts`；
- 不改前端对话面板、后端会话编排、收获判定逻辑；
- 不决定真实 LLM 服务如何接入；
- 不在 `.skill.json` 内配置 `rewardId` 或发奖规则。

> 核心原则：**NPC 内容归 skills，收获归景点侧。**
> 也就是：角色内容放 `resources/skills/*.skill.json`；景点要遇见谁、聊到什么给奖励，仍由 `seedDataset` 的 `Spot.npcIds` / `dialogueRewards` 承载。

---

## 1. 现有基线（直接复用）

### 1.1 现有 schema（不得改）
沿用 `NpcProfile`：

```ts
interface NpcProfile {
  id: string;
  name: string;
  kind: 'signature' | 'generic';
  avatar?: string;
  persona: {
    voice: string;
    setting: string;
    opening: string;
  };
  knowledge: Array<{
    topic: string;
    facts: string;
  }>;
  guardrails: string[];
}
```

### 1.2 现有资产（风格参考）
- `resources/skills/npc_dufu.skill.json`
- `resources/skills/npc_passerby.skill.json`

### 1.3 现有后端载入方式（不得破坏）
- 后端 `NpcRepository` 启动时扫描 `SKILLS_DIR` 下 `*.skill.json`；
- 结构合法则载入内存，不合法文件只记日志并跳过；
- 因此本任务产出的文件必须保持**纯 JSON、字段完整、可被直接读盘解析**。

---

## 2. 内容设计规范（必须遵守）

### TS07-1 命名与分类规范
- [x] 文件命名：`resources/skills/{npcId}.skill.json`
- [x] `npcId` 统一 `npc_{slug}`，只用小写字母/数字/下划线。
- [x] `kind` 只允许两类：
  - `signature`：真实历史人物 / 地标性名人，史实红线高
  - `generic`：虚构游客 / 本地人 / 路人 / 讲解员，无历史人物包袱

### TS07-2 软硬分离规范
- [x] `persona` 负责“怎么说”：
  - `voice`：语气、修辞、节奏
  - `setting`：角色出现的场景与视角
  - `opening`：开场白，可直接用于 `dialogue/start`
- [x] `knowledge` 负责“能说什么硬事实”：
  - `topic` 要短、可检索、可对应主题
  - `facts` 必须是完整事实句，不写成零散词条
  - 史实名人必须可人工校对，不得编造
- [x] `guardrails` 负责“不能怎么说”：
  - 明确可聊范围
  - 明确不可编造什么
  - 明确不确定时怎么回应

### TS07-3 签名 NPC 规则（`signature`）
- [x] 只用于真实人物或高辨识度名人，如杜甫、诸葛亮。
- [x] `knowledge.facts` 必须可回溯到常识史实 / 存世作品 / 已知地标背景。
- [x] `guardrails` 必须显式包含：
  - 不得杜撰诗句/史实/生平
  - 不确定则承认“不记得/不敢妄言”
  - 不谈明显时代错位内容，必要时以角色口吻回避

### TS07-4 通用 NPC 规则（`generic`）
- [x] 可扩为“游客”“本地人”“茶馆讲闲人”“街头摊主”等。
- [x] 可以有地方趣味和生活感，但不得冒充真实历史人物。
- [x] 涉及严肃史实时，应引导用户去找对应名人 NPC 或景点信息。

### TS07-5 禁止事项
- [x] 不在 `.skill.json` 内新增私有字段。
- [x] 不把 `rewardId`、`dialogueRewards`、`spotId` 写进 skill 文件。
- [x] 不把前端展示态、后端实现态字段混进角色资产。
- [x] 不写无法校验的大而空文案，如“他知道很多很多历史”。

---

## 3. 本轮交付（先做规范 + 样例）

> 本轮不追求一次性覆盖全部景点，先沉淀可复制模板。
> 交付物 = **1 份规范 + 3 个样例 NPC**。

### TS07-6 新增 1 个签名 NPC 样例
- [x] 新增：`resources/skills/npc_zhugeliang.skill.json`
- [x] 角色定位：武侯祠场景可用的“诸葛亮”签名 NPC。
- [x] 最少包含 4 个知识锚，建议主题：
  - 武侯祠与诸葛亮纪念
  - 《出师表》
  - 蜀汉治政 / 北伐
  - 历史形象与“鞠躬尽瘁”
- [x] 护栏需明确：
  - 不引用虚构桥段当作正史
  - 不混淆《三国演义》演绎与史实
  - 不确定时坦言不可妄断

### TS07-7 新增 2 个通用 NPC 样例
- [x] 新增：`resources/skills/npc_foodie_local.skill.json`
  - 定位：热情本地人，偏吃喝风物，适合锦里 / 宽窄巷子 / 春熙路
  - 知识锚建议：成都小吃、茶馆文化、慢生活、市井体验
- [x] 新增：`resources/skills/npc_young_traveler.skill.json`
  - 定位：外地年轻游客，偏体验分享与路线交流，适合多数景点随机出现
  - 知识锚建议：游客视角的城市体验、常见路线、拍照打卡、旅行比较
- [x] 两者都必须保持 `generic` 边界，不冒充历史人物、不输出硬史实断言。

### TS07-8 产出“绑定建议清单”（写在本任务文件末尾即可）
- [x] 给出样例 NPC 的推荐景点绑定，不直接实现 seed 改动：
  - `npc_zhugeliang` → `spot_wuhou_shrine`
  - `npc_foodie_local` → `spot_jinli` / `spot_kuanzhai_alley` / `spot_chunxi_road`
  - `npc_young_traveler` → 作为多景点通用游客 fallback
- [x] 明确写明：真正的 `Spot.npcIds` 绑定与 `dialogueRewards` 配置应交给公共/配置 Agent 在 `shared/src/seed/dataset.ts` 中完成。

---

## 4. 文件范围

### 允许改动
- `resources/skills/*.skill.json`
- `tasks/07-NPC内容扩充-skills.md`（勾选与回填）
- `tasks/README.md`（补索引）

### 本任务默认不改
- `shared/src/models/npc.ts`
- `shared/src/seed/dataset.ts`
- `backend/src/dialogue/**`
- `frontend/src/**`
- `docs/Atlas-路过-NPC对话系统设计.md`（除非本任务真的引入了规范性变化）

> 若执行者认为必须改 schema / seed / 后端逻辑，说明任务越界，应先提出新任务，不要直接改。

---

## 5. 执行顺序
1. 复用现有 `npc_dufu` / `npc_passerby` 风格，固化写法
2. 完成 `npc_zhugeliang.skill.json`
3. 完成两个 `generic` 样例
4. 做 JSON 自检（字段齐全、可读、无注释、无尾逗号）
5. 在本文件中补“绑定建议清单”
6. 勾选完成项

---

## 6. 验收
- [x] 新增的 `.skill.json` 均符合 `NpcProfile` 结构，可被 `NpcRepository` 直接读盘解析。
- [x] `signature` 样例具备明确史实护栏，不把演义当正史。
- [x] `generic` 样例具备鲜明口吻，但不冒充真实历史人物。
- [x] 未新增任何脱离 `@atlas/shared` 的私有字段。
- [x] 未把奖励规则、景点绑定、前后端实现细节塞进 skill 文件。
- [x] 样例足以作为后续批量扩 NPC 的模板。

---

## 7. 绑定建议清单（交接给公共 / 配置 Agent）

> 本节是交接输出，不要求本任务直接改 seed。

- 建议为 `spot_wuhou_shrine` 增加 `npc_zhugeliang`
- 建议为 `spot_jinli` / `spot_kuanzhai_alley` / `spot_chunxi_road` 增加 `npc_foodie_local`
- 建议将 `npc_young_traveler` 作为多个景点的通用 fallback NPC
- 若后续新增“景点专属收获”，仍放在 `Spot.dialogueRewards`，不要迁入 skill 文件

> 后续可继续扩的方向：
> - 签名 NPC：李白、苏轼、薛涛、李冰父子
> - 通用 NPC：茶馆常客、博物馆讲解员、亲子游客、摄影爱好者
