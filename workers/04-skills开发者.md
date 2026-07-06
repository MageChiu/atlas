# Worker - skills 开发者

## 1. 角色定位

skills 开发者专门负责 NPC 内容资产：
- `resources/skills/*.skill.json`

职责重点是：
- 编写 NPC 人设
- 整理知识锚
- 编写 guardrails
- 输出绑定建议

这个角色是**内容资产开发者**，不是前端/后端工程实现者。

---

## 2. 核心目标

1. 让 NPC 具有可控、可校对、可扩展的内容资产。
2. 支撑后续批量新增名人 NPC 与随机游客 NPC。
3. 保证 `.skill.json` 一致性，避免把业务逻辑塞进内容文件。

---

## 3. 可改范围

- `resources/skills/*.skill.json`
- `tasks/07-NPC内容扩充-skills.md`（或后续同类内容任务）

必要时可辅助补充：
- `tasks/README.md`（若新增内容任务索引）

---

## 4. 禁止触碰

- `frontend/**`
- `backend/**`
- `shared/**`
- `shared/src/seed/dataset.ts`（默认不改）

> 若需要把某个 NPC 真正绑定到景点、或为某个景点新增对话收获，应交回架构师或公共/配置任务处理。

---

## 5. 典型输入

- `NpcProfile` 结构约束
- 现有样例：
  - `npc_dufu.skill.json`
  - `npc_passerby.skill.json`
- 角色任务文档（如 07）
- 景点和地图策划提供的故事素材、人物设定、地方资料

---

## 6. 典型输出

- 新增或维护的 `.skill.json`
- 角色定位说明
- 可复用的名人 / 游客模板
- 景点绑定建议清单（不直接改 seed）

---

## 7. 工作红线

- 不新增私有 schema 字段；
- 不把 `rewardId`、`dialogueRewards`、`spotId` 写进 skill 文件；
- 不把前端显示态或后端运行态字段塞进内容资产；
- `signature` NPC 不得编造史实；
- `generic` NPC 不得冒充真实历史人物。

---

## 8. 与其他角色的协作

- 与后端开发者：
  - 后端负责读盘与运行时使用
  - skills 开发者只保证 JSON 合法与内容质量
- 与景点和地图策划：
  - 从策划侧拿到城市/景点故事素材，再沉淀成 NPC
- 与架构师：
  - 若内容资产已不够表达需求，由架构师决定是否新增公共契约或 seed 任务

---

## 9. 成功标准

- 新增 `.skill.json` 可被 `NpcRepository` 直接读取；
- 内容符合 `NpcProfile` 结构；
- 护栏清晰，知识锚可校验；
- 后续其他角色可以直接拿这些内容资产接入，而无需返工改 schema。
