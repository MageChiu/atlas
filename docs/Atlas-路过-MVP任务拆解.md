# Atlas - 路过 MVP 任务拆解

## 1. 文档目标

本文档用于将“路过（Atlas）”MVP 拆解为可由 Agent、前端与后端并行执行的任务清单。

---

## 2. 里程碑划分

### M1：项目初始化
目标：搭建仓库与基础骨架

### M2：地图与场景骨架
目标：跑通 World / Region / Spot 基础层级

### M3：Action / Event 闭环
目标：用户可在 Spot 内执行动作并看到结果

### M4：AI 图片链路
目标：跑通上传、生成、查询与展示

### M5：资产与分享
目标：完成图鉴、生成记录、分享页

### M6：联调与发布准备
目标：完成测试、埋点与优化

---

## 3. 前端任务清单

### 3.1 初始化
- 初始化 Next.js + TypeScript 项目
- 接入 Tailwind
- 搭建基础目录结构
- 搭建 Zustand Store
- 搭建 API 请求层

### 3.2 地图层级
- 实现 World 地图页面
- 实现 Region 页面
- 实现 Spot 页面
- 实现基础 Camera 管理
- 实现场景切换动画

### 3.3 Action / Event
- 实现 Action 面板
- 接入 check-in Action
- 接入 random_event Action
- 接入 encounter Action
- 接入 photo Action 入口
- 实现 EventModal / RewardPopup

### 3.4 AI 结果
- 实现图片上传组件
- 实现生成任务提交
- 实现任务轮询
- 实现结果页展示

### 3.5 用户资产
- 实现图鉴页
- 实现生成记录页
- 实现分享页

---

## 4. 后端任务清单

### 4.1 初始化
- 初始化服务框架
- 建立基础目录结构
- 配置 PostgreSQL / Redis
- 配置基础鉴权中间件

### 4.2 配置与内容
- 建立 Region / Spot / Action / Event 表
- 提供 world 查询接口
- 提供 region 查询接口
- 提供 spot 查询接口
- 提供 actions 查询接口

### 4.3 行为逻辑
- 实现 check-in 接口
- 实现 execute-action 接口
- 实现事件选择逻辑
- 实现奖励发放逻辑
- 实现用户进度记录

### 4.4 AI 任务
- 实现图片上传接口
- 实现 photo-generate 接口
- 实现 task status 接口
- 实现 result 查询接口

### 4.5 用户资产
- 实现 collections 接口
- 实现 generated-assets 接口
- 实现 achievements 接口

---

## 5. 联调任务清单

- 对齐 world / region / spot 返回结构
- 对齐 actions 返回结构
- 对齐 execute-action 返回结构
- 对齐 AI task 状态结构
- 对齐错误码
- 验证图鉴与奖励一致性

---

## 6. 优先级建议

### P0
- World / Region / Spot 基础链路
- check-in / execute-action
- Event 展示
- 图片上传与 AI task

### P1
- 图鉴
- 生成记录
- 分享页

### P2
- 埋点
- 活动开关
- 动画细节优化

---

## 7. Agent 执行建议

### Agent A：前端基础骨架
负责页面、状态、基础组件

### Agent B：场景与动画
负责 Pixi 场景、转场与交互表现

### Agent C：后端内容与行为
负责配置接口、Action / Event 与进度逻辑

### Agent D：AI 链路
负责上传、任务、状态与结果对接

---

## 8. 完成标准

MVP 完成应满足：

- 用户可从地图进入景点
- 用户可在景点执行至少 2 类 Action
- 后端可返回事件与奖励
- AI 图片生成链路可运行
- 用户可在“图鉴 / 记录 / 分享”中看到结果
