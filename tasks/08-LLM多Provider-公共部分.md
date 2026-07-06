# 08 - LLM 多 Provider 路由 · 公共部分（边界冻结 / 文档对齐）

> 交付给**公共 Agent / 架构师**。
> 上位设计：`docs/Atlas-路过-LLM多Provider路由设计.md`。
> 本任务的重点不是“大改 shared”，而是先把**一期边界冻结**：多 Provider 是后端内部能力，前端协议本期不被强制改动。
>
> 约束（`docs/Atlas-路过-协作开发规范.md`）：
> - 只有公共 Agent 能改 `shared/**` 与协议/数据模型文档；
> - 如评审未要求新增前端透传字段，则本期**不应制造无谓的 shared 变更**；
> - 一旦决定新增契约字段，必须先在本任务完成 shared 冻结，再允许前后端各自实现。

---

## 0. 本期已拍板前提

- LLM 接入采用**多 Provider 池 + 后端内部路由 + 可扩展失败切换**架构。
- 配置使用**结构化配置文件**，由 `LLM_CONFIG_FILE` 指向挂载路径。
- 一期不前置动态健康检查。
- 一期不强制前端新增 `userId/sceneId` 透传；`userId` 继续由后端从鉴权上下文获取。
- 真实 LLM 调用失败 → 直接 `LLM_UNAVAILABLE`，不静默回退到 Mock。

---

## 1. 任务

### TC08-1 冻结“本期 API 不变”的公共边界
- [x] 明确记录：一期 **`ApiRoutes.dialogueStart / dialogueSay / dialogueSession` 路径不变**。
- [x] 明确记录：现有 `StartDialogueRequest` / `SayRequest` / `SayData` / `DialogueSessionData` 本期默认**不新增必填字段**。
- [x] 明确记录：LLM provider 选择、路由、失败切换均为**后端内部能力**，不外露给前端。

> 说明：这一步的价值是防止前后端在实现期各自脑补“是不是要加 `sceneId` / `providerId` / `routeHint`”。

### TC08-2 若无新增业务字段需求，则 shared 代码保持不动
- [x] 自检当前 `@atlas/shared` 是否已足够承载一期方案：
  - 错误码：`LLM_UNAVAILABLE` 已存在
  - 对话契约：已可承载现有链路
  - 路由：现有 `ApiRoutes.dialogue*` 已存在
- [x] 若判断无缺口，则**不修改** `shared/**`，只在本任务文件和设计文档中明确“本期无 shared 代码变更”。

### TC08-3 为后续“可选业务场景字段”预留升级路径（只写规则，不先实现）
- [x] 在本任务中写明：若后续确实需要补充前端透传的业务场景字段，应优先考虑：
  - `businessScene`
  - `dialogueMode`
  - `scenario`
- [x] 明确：在没有明确业务场景之前，**不要先把 `sceneId` 写进 shared 契约**。
- [x] 明确：若后续决定新增该字段，必须先由公共 Agent 在 `@atlas/shared` 修改，再由前后端跟进。

### TC08-4 文档对齐
- [x] 更新 `docs/Atlas-路过-API协议说明.md`：
  - 标注 NPC 对话接口本期**无路径和必填请求字段变更**
  - 标注 `LLM_UNAVAILABLE` 仍为统一错误语义
- [x] 更新 `docs/Atlas-路过-NPC对话系统设计.md`：
  - 把原本“单 LLM provider 配置”的描述修正为“多 Provider 池 + 内部路由”
  - 标注本期不强制改前端请求协议
- [x] 若 `docs/Atlas-路过-数据模型设计.md` 中有相关对话配置假设，也同步说明“路由与 provider 池属后端内部能力，不入 shared 模型”。
  - 本次自检结果：`docs/Atlas-路过-数据模型设计.md` 中无相关 LLM/provider 约束段落，故无需改动该文档。

### TC08-5 验收与出口
- [x] 本任务完成后，给出一句清晰结论：
  - “08 一期公共层不改 shared 代码，只冻结边界与文档”
  - 或
  - “08 一期公共层新增了某个可选字段，前后端需按新契约实现”

---

## 2. 本任务默认不改

- `frontend/**`
- `backend/**`
- `resources/skills/**`

> 若后端实现阶段反向要求改 shared，而本任务未先冻结，则说明拆分顺序错了，应回到本任务补齐。

---

## 3. 验收

- [x] 一期公共边界清晰：是否改 shared、是否改 API、是否加前端字段都有明确结论。
- [x] 文档与设计稿对齐，不再保留“单 provider 配置”的旧表述。
- [x] 前后端拿到本任务结论后，无需再争论“前端要不要传 provider/sceneId”。

---

## 4. 结论模板（供完成后回填）

```md
结论：
- 08 一期公共层【不改】shared 契约；
- 对话 API 路径【不变】；
- 前端请求字段【不新增】；
- 多 Provider 路由完全由后端内部实现。
```
