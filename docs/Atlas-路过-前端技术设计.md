# Atlas - 路过 前端技术设计

## 1. 文档目标

本文档定义“路过（Atlas）”项目的前端实现方案，作为前端 Agent 与工程开发的直接执行依据。目标包括：

- 明确前端技术选型与工程结构
- 规范地图分层、场景渲染、状态管理方式
- 约束 Action / Event 的前端承载方式
- 支持 MVP 快速落地与后续可扩展演进

---

## 2. 技术选型

### 2.1 推荐栈

- 框架：React / Next.js
- 场景渲染：PixiJS
- 动画：GSAP
- 状态管理：Zustand
- 数据请求：TanStack Query
- 样式：Tailwind CSS 或 CSS Modules
- 类型系统：TypeScript

### 2.2 选择原则

1. 页面型能力与场景型能力分层处理
2. 产品 UI 与互动场景解耦
3. 不把景点逻辑写死在组件中
4. 所有核心场景由配置驱动
5. 地图层次切换统一由 Scene Runtime 管理

---

## 3. 前端总体架构

建议拆成三层：

### 3.1 App Shell 层
负责：
- 登录态
- 路由
- 页头页尾
- 图鉴 / 分享 / 我的页面
- 全局弹窗与通知

### 3.2 Scene Runtime 层
负责：
- World Map 场景
- Region 场景
- Spot 场景
- Event Layer

### 3.3 Domain UI 层
负责：
- Action 面板
- Reward 弹层
- Event 卡片
- Encounter 卡片
- 生成结果页

---

## 4. 页面与场景划分

### 4.1 页面建议

- `/`：首页 / 登录后跳转
- `/world`：世界地图页
- `/region/[id]`：区域页
- `/spot/[id]`：景点页
- `/collections`：图鉴页
- `/generated`：生成记录页
- `/share/[id]`：分享页

### 4.2 场景结构

- `WorldScene`
- `RegionScene`
- `SpotScene`
- `EventLayer`

场景内部使用 Pixi 容器管理渲染树。

---

## 5. 状态管理设计

### 5.1 全局状态

建议用 Zustand 拆 store：

- `authStore`
- `sceneStore`
- `progressStore`
- `actionStore`
- `uiStore`

### 5.2 sceneStore 关键字段

- `currentLevel`：world / region / spot / event
- `currentRegionId`
- `currentSpotId`
- `cameraState`
- `transitionState`

### 5.3 actionStore 关键字段

- `availableActions`
- `executingActionId`
- `lastActionResult`
- `cooldownMap`

---

## 6. 渲染与交互规范

### 6.1 World Map

职责：
- 展示世界概貌
- 展示开放区域
- 响应点击进入 Region

### 6.2 Region Scene

职责：
- 展示 Spot 节点
- 展示路径 / 解锁状态
- 支持点击进入 Spot

### 6.3 Spot Scene

职责：
- 展示景点主视觉
- 渲染 Action 入口
- 接收 Action 结果并展示 Event Layer

### 6.4 Event Layer

职责：
- 展示事件结果
- 展示奖励
- 展示 AI 结果
- 完成后回到 Spot Scene

---

## 7. 相机与转场设计

### 7.1 相机能力

统一抽象：

- `zoomTo(target)`
- `panTo(target)`
- `focusOn(target)`
- `transitionTo(level)`
- `resetView()`

### 7.2 转场原则

1. 不允许页面级硬切替代地图层级转场
2. 进入 Region / Spot 时必须有统一过渡动画
3. 回退动画应与进入动画形成镜像逻辑
4. 相机参数从配置读取，不写死在组件

---

## 8. Action / Event 前端承载

### 8.1 Action 渲染

Action 展示为统一结构：

- icon
- title
- subtitle（可选）
- status
- click handler

### 8.2 Action 执行流程

1. 点击 Action
2. 调用执行接口
3. 展示 loading / 处理中状态
4. 接收结果
5. 渲染 Event / Reward / AI 任务状态

### 8.3 Event 展示组件

建议组件：

- `EventModal`
- `RewardPopup`
- `EncounterPanel`
- `PhotoGeneratePanel`

---

## 9. 数据请求与缓存

### 9.1 Query 维度

建议查询：

- `world`
- `regionDetail(regionId)`
- `spotDetail(spotId)`
- `spotActions(spotId)`
- `collections`
- `generatedAssets`

### 9.2 Mutation 维度

- `checkInSpot`
- `executeAction`
- `uploadImage`
- `submitGenerateTask`
- `pollTaskStatus`

---

## 10. 工程目录建议

```text
src/
  app/
  components/
  scenes/
    world/
    region/
    spot/
    event/
  stores/
  services/
  hooks/
  types/
  utils/
  assets/
```

---

## 11. MVP 开发顺序

1. 搭建 App Shell
2. 搭建 World / Region / Spot 场景骨架
3. 接入 Scene Store 与 Camera 管理
4. 完成 Action 面板
5. 完成 Event / Reward 展示
6. 接入 AI 结果页
7. 接入图鉴 / 分享页

---

## 12. 前端约束

- 不要把业务配置写死在 JSX 中
- 所有地图节点从接口或 mock 配置读取
- 所有 Action 类型必须经过统一渲染入口
- Scene 与 UI 分层必须清晰
- 不以页面跳转代替场景切换
- 优先保证结构稳定，再优化动画细节

---

## 13. 交付结果

前端最终应交付：

- 可运行的地图层级体验
- 可进入的景点场景
- 可执行的 Action 面板
- 可展示的 Event / Reward / AI 结果
- 可继续扩内容的前端骨架
