# 08 - LLM 多 Provider 路由 · 前端任务（独立交付）

> 交付给**前端 Agent**。
> 前置：`tasks/08-LLM多Provider-公共部分.md` 已冻结“一期对话 API 本期不强制变更”的边界；
> 后端将按 `docs/Atlas-路过-LLM多Provider路由设计.md` 升级为多 Provider 池与内部路由。
>
> 本任务不是让前端感知 provider 池，而是确保前端：
> - 对后端内部路由保持透明
> - 对错误语义和开发模式兼容
> - 为后续可选业务场景字段保留干净接入点

---

## 0. 已拍板前提

- 一期前端**不直接选择 provider**。
- 一期不强制新增 `userId/sceneId` 透传。
- 一期默认对话 API 路径与返回结构保持不变。
- `LLM_UNAVAILABLE` 继续是前端需要感知和友好提示的核心错误。

---

## 1. 现状（需要确认的点）

- 现有对话前端已具备：
  - `api.startDialogue / say / getDialogueSession`
  - `useDialogue`
  - `dialogueStore`
  - `DialoguePanel`
- 现有错误提示已覆盖 `LLM_UNAVAILABLE`，但需要确保在真实 provider 模式下交互仍然成立。
- 现有请求体只包含：
  - `spotId`
  - `npcId?`
  - `requestId`
  - `message`

本期重点是**保持这些现状在多 Provider 后端下仍然成立**。

---

## 2. 任务

### TF08-1 对话请求层保持“provider 无感知”
- [ ] 检查 `services/api.ts` / `services/mock/mockApi.ts`：
  - 不新增 `providerId`
  - 不新增 `routeHint`
  - 不新增“选模型”相关前端字段
- [ ] 确保对话请求仍只表达业务语义，而非路由意图。

### TF08-2 错误语义与交互确认
- [ ] 复核 `useDialogue` 中 `LLM_UNAVAILABLE` 的处理：
  - 提示用户“稍后再试”
  - 不造成会话状态紊乱
  - 用户可以继续重发
- [ ] 确保后端切换 provider / failover 的实现对前端来说是透明的；
  前端只关心成功回复或统一错误，不展示内部 provider 信息。

### TF08-3 Mock 与真实模式兼容
- [ ] 确认前端 Mock 模式仍可继续工作：
  - `NEXT_PUBLIC_USE_MOCK=true` 时，不依赖真实后端路由能力
  - Mock 返回结构与真实结构一致
- [ ] 确认切换到真实后端后：
  - 不需要额外改前端数据结构
  - 只通过环境切换即可联调

### TF08-4 为可选业务场景字段预留接入点（不强制启用）
- [ ] 在请求构造层预留一个干净的扩展点（注释或轻量封装即可）：
  - 若未来公共任务引入 `businessScene` / `dialogueMode` 之类可选字段，前端应从请求层统一追加，而不是散落在组件中
- [ ] 本期默认**不启用该字段**，除非公共契约明确新增。

> 这一项的目标不是现在加字段，而是避免以后真的要加时，需要在多个组件里到处改。

### TF08-5 UI 与观测最小补充
- [ ] 若当前提示语过于“Mock 味”或不适合真实 provider，统一调整为中性提示文案：
  - 如“对方暂时走神了，请稍后再试”
- [ ] 不在 UI 层暴露“当前使用的是哪个 provider”。

### TF08-6 验证
- [ ] `npm run build:web` 通过。
- [ ] 在 Mock 模式下，对话主链路不回归。
- [ ] 在真实后端模式下：
  - 正常回复可展示
  - `LLM_UNAVAILABLE` 能正确提示
  - 不需要前端新增 provider 选择逻辑

---

## 3. 本任务默认不改

- `backend/**`
- `shared/**`
- `resources/skills/**`

---

## 4. 验收

- [ ] 前端对多 Provider 后端保持透明，不承担路由决策。
- [ ] 接口结构本期无感升级，不因后端多 Provider 改造而大面积改前端调用代码。
- [ ] `LLM_UNAVAILABLE` 的用户体验清晰、稳定。
- [ ] 后续若公共契约新增可选业务场景字段，前端已有统一接入位，不需要再返工大范围重构。
