# Atlas - 路过 LLM 多 Provider 路由设计（讨论稿）

> 状态：**讨论稿，待评审**。评审通过后，再拆对应的后端 / 配置 / 运维任务文档。
> 背景：现有 NPC 对话后端已抽象 `LlmProvider`，但当前仅有 `MockLlmProvider`，无法支撑真实模型调用、容灾、差异化效果与后续负载调度。
>
> 本文目标不是直接落实现，而是先把**整体构想**锁定：
> - 多 Provider 池，而不是单一 LLM 配置
> - 后端内部调度，而不是前端直接选模型
> - 一期先完成多组配置 + 路由框架 + 失败切换骨架
> - 动态健康检查 / 熔断 / 负载优化后置

---

## 1. 问题与目标

### 1.1 当前问题
- 现有对话后端虽然有 `LlmProvider` 抽象，但 `dialogue.module.ts` 只装配 `MockLlmProvider`。
- 现有配置模型是单实例思路：
  - `LLM_PROVIDER`
  - `LLM_API_BASE`
  - `LLM_API_KEY`
  - `LLM_MODEL`
- 该模型天然无法表达：
  - 多组服务容灾
  - 不同 provider 的差异化效果
  - 基于城市 / 景点 / 用户的路由策略
  - 后续负载均衡与失败切换

### 1.2 设计目标
1. 支持**多 provider 池**配置，不锁死单实例。
2. 路由策略在**后端内部**完成，前端不直接决定调哪个 provider。
3. 一期优先支持：
   - 多组配置
   - 路由器抽象
   - provider 失败后的切换框架
4. 二期再做：
   - 动态健康检查
   - 熔断 / 恢复
   - 更细粒度的负载均衡
5. 保持与现有 `DialogueService` 边界兼容：业务层仍只依赖统一 `LlmService` / `LlmProvider` 抽象。

### 1.3 一期明确不做
- 不要求前端立刻新增复杂调度字段。
- 不在一期强制接入 SSE / 流式输出。
- 不做复杂实时监控平台。
- 不把 provider 选择逻辑散落到业务代码中。

---

## 2. 核心结论（本轮讨论后的拍板点）

### 2.1 配置模型：多 Provider 池
“主备”只是多 provider 池的一个特例。

也就是说，系统面对的不是：

```ts
{ provider, apiBase, apiKey, model }
```

而是：

```ts
{
  providers: ProviderConfig[];
  routes: RouteRule[];
  failoverPolicy: FailoverPolicy;
}
```

通过 `priority / weight / enabled / tags` 等字段，可以自然表达：
- 主备
- 多活
- 权重分流
- 场景差异化

### 2.2 路由策略：后端内部调度
前端仍然只请求“对话”能力，不直接传“请使用哪个模型服务”。

后端根据业务上下文做调度：
- 用户维度
- 景点 / 城市维度
- NPC 类型维度
- 业务场景维度

因此，路由器是后端的统一能力，而不是前端参数开关。

### 2.3 一期故障切换：框架先有，动态健康检查后做
一期先支持：
- provider 调用失败后的候选切换
- 静态优先级 / 权重选择
- 可配置的失败重试与回退策略

后续再补：
- 主动健康探测
- 失败率统计
- 自动摘流 / 恢复
- 动态负载

### 2.4 失败处理：直接报错，不静默回退 Mock
真实 LLM 调用失败时：
- 直接返回 `LLM_UNAVAILABLE`
- Mock 代码保留，但不作为生产失败时的静默降级路径

这样更符合真实体验，也避免线上问题被伪装成“还能聊，只是质量差”。

---

## 3. 整体架构

建议把现有 `dialogue/llm/` 扩成四层：

```text
dialogue/llm/
  llm.provider.ts             # 单个 provider 的调用接口（已存在）
  providers/
    openai-compatible.ts      # 具体 provider 实现
    ...                       # 其他实现可后插
  llm-registry.ts             # 根据配置实例化 provider 集合
  llm-router.ts               # 根据上下文选择候选 provider
  llm-service.ts              # 对业务层暴露统一 chat() 能力
  llm-config.ts               # 结构化配置读取与校验
```

分层职责如下：

### 3.1 Provider
只负责“怎么请求某个模型服务”：
- 构造 HTTP 请求
- 处理鉴权
- 解析响应
- 上报错误类型

不负责：
- 选谁来调
- 业务路由
- 容灾策略

### 3.2 Registry
把配置里的 provider 列表实例化为可调用对象：
- 读配置
- 校验
- 构造 provider 实例
- 建立 `providerId -> provider instance` 映射

### 3.3 Router
根据上下文选“候选 provider 列表”：
- 输入：请求上下文 + 路由配置 + provider 元数据
- 输出：有序候选集

### 3.4 LlmService
对业务层暴露一个统一入口，例如：

```ts
chat(ctx, req): Promise<LlmChatResult>
```

其内部流程是：
1. Router 选出候选 provider
2. 逐个尝试调用
3. 根据失败策略切换
4. 成功则返回
5. 全失败则抛 `LLM_UNAVAILABLE`

业务层（如 `DialogueService`）不需要知道池内有几个 provider。

---

## 4. 配置模型

### 4.1 配置载体
使用**结构化配置文件**，由 Secret 挂载到容器内。

只保留一个环境变量用于指向配置文件路径：

```bash
LLM_CONFIG_FILE=/etc/atlas/llm/config.json
```

不再依赖一组零散的 `LLM_API_BASE/KEY/MODEL` 作为主配置事实来源。

原因：
- 私有化部署必须显式配置服务地址，不能依赖默认 URL
- Secret 挂载文件比散装 env 更易组织多组配置
- 后续 provider 池 / 路由规则 / 故障策略都需要结构化表达

### 4.2 建议配置结构（一期）

```json
{
  "providers": [
    {
      "id": "deepseek-primary",
      "type": "openai-compatible",
      "baseUrl": "https://llm-a.internal/v1",
      "apiKey": "secret://deepseek-primary",
      "model": "deepseek-chat",
      "enabled": true,
      "priority": 100,
      "weight": 80,
      "tags": ["dialogue", "chengdu", "low_cost"],
      "timeoutMs": 15000,
      "temperature": 0.8,
      "maxTokens": 1024
    },
    {
      "id": "ark-backup",
      "type": "openai-compatible",
      "baseUrl": "https://llm-b.internal/v1",
      "apiKey": "secret://ark-backup",
      "model": "ep-xxx",
      "enabled": true,
      "priority": 90,
      "weight": 20,
      "tags": ["dialogue", "backup"],
      "timeoutMs": 12000,
      "temperature": 0.7,
      "maxTokens": 1024
    }
  ],
  "routes": [
    {
      "id": "default-dialogue",
      "match": {
        "feature": "dialogue"
      },
      "candidateTags": ["dialogue"],
      "strategy": "weighted"
    },
    {
      "id": "chengdu-dialogue",
      "match": {
        "feature": "dialogue",
        "cityId": "chengdu"
      },
      "candidateTags": ["dialogue", "chengdu"],
      "strategy": "priority"
    }
  ],
  "failoverPolicy": {
    "maxAttempts": 2,
    "retryableErrors": ["timeout", "5xx", "network"],
    "switchOnErrors": ["timeout", "5xx", "network"]
  }
}
```

### 4.3 字段说明

#### ProviderConfig
- `id`: provider 唯一标识
- `type`: provider 类型（一期可统一用 `openai-compatible`）
- `baseUrl`: 服务地址，**必须显式配置**
- `apiKey`: 密钥引用或明文占位
- `model`: 模型名 / 接入点
- `enabled`: 是否启用
- `priority`: 静态优先级
- `weight`: 加权分流权重
- `tags`: 用于路由筛选候选集
- `timeoutMs` / `temperature` / `maxTokens`: 调用参数

#### RouteRule
- `match`: 命中条件
- `candidateTags`: 命中后从哪些 provider 中选
- `strategy`: 候选选择策略

#### FailoverPolicy
- `maxAttempts`: 最大尝试次数
- `retryableErrors`: 可重试错误
- `switchOnErrors`: 触发 provider 切换的错误集合

---

## 5. 路由上下文

### 5.1 一期上下文来源
一期尽量复用现有接口，不强行改前端协议。

路由器可使用的上下文：
- `userId`：后端从鉴权上下文获取，不由前端显式传
- `feature`：由服务端写死为 `dialogue`
- `spotId`：现有 `StartDialogueRequest` 已有
- `npcId`：现有对话链路已有
- `region/city`：后端可由 `spotId` 反查推导

也就是说，一期不需要为了路由先改对话 API。

### 5.2 为什么不立刻加 `sceneId`
前端 UI 场景 ID 容易与业务语义耦合不清。

若后续确实需要补充业务场景字段，更推荐增加类似：
- `scenario`
- `businessScene`
- `dialogueMode`

而不是一个语义模糊的 `sceneId`。

### 5.3 一期建议的路由上下文结构

```ts
interface LlmRouteContext {
  userId: string;
  feature: 'dialogue';
  spotId?: string;
  npcId?: string;
  regionId?: string;
  cityId?: string;
}
```

---

## 6. 路由策略

### 6.1 一期支持的策略

#### `priority`
按优先级从高到低选择，失败再切下一个。

适合：
- 主备
- 高质量 provider 优先

#### `weighted`
在候选集里按权重分配流量。

适合：
- 同能力 provider 之间做分流
- 成本控制

### 6.2 二期再考虑的策略
- 基于实时健康度的动态路由
- 基于响应时延 / 错误率的自适应调度
- 基于用户分群 / 业务分层的实验路由

---

## 7. 故障切换策略

### 7.1 一期行为
1. Router 返回候选 provider 列表
2. 先调第一个候选
3. 若错误属于 `switchOnErrors`，切下一个
4. 若候选耗尽，抛 `LLM_UNAVAILABLE`

### 7.2 一期不做
- 不做后台主动健康探测
- 不做 provider 状态机持久化
- 不做自动摘流 / 半开恢复

### 7.3 框架预留
即便一期不做动态健康检查，也要在抽象上预留：
- provider 调用结果统计
- 错误分类
- provider 暂时不可用状态缓存

避免后续要推倒重来。

---

## 8. 与现有 NPC 对话系统的衔接

### 8.1 保持不变的部分
- `DialogueService` 继续只关心：
  - 组装 system prompt
  - 管理会话历史
  - 收获判定
- `knowledge/guardrails` 继续只留在服务端
- 前端接口结构保持不变
- `MockLlmProvider` 代码保留

### 8.2 需要替换/新增的部分
- 用统一 `LlmService` 替代直接注入单个 provider
- 把单实例 `LLM_PROVIDER/LLM_API_BASE/LLM_API_KEY/LLM_MODEL` 方案升级为结构化配置文件
- 在 `dialogue.module.ts` 中从“装配单个 provider”升级为“装配 registry + router + service”

### 8.3 兼容策略
开发环境可继续显式配置 `mock` provider 作为一个特殊 provider 条目，
但生产失败时不静默切回 mock。

---

## 9. 实施边界（一期）

### 9.1 一期必须完成
- 多 provider 配置文件读取与校验
- provider registry
- router 抽象
- 基于 `priority/weighted` 的候选选择
- 基于错误分类的 failover 骨架
- `DialogueService` 接入统一 `LlmService`

### 9.2 一期可先简化
- provider 类型可先只支持 `openai-compatible`
- 路由规则可先只支持少量字段：`feature / cityId / npcId`
- 失败统计先打日志，不做监控平台

### 9.3 一期明确不做
- 动态健康检查
- 熔断器
- 自动恢复
- 前端协议大改
- 复杂 AB 实验平台

---

## 10. 后续拆任务时的角色划分建议（这里只定边界，不展开任务）

后续若确认本设计，可以拆为至少三个角色：

1. **后端核心 Agent**
   - provider 抽象升级
   - registry / router / failover / module 装配

2. **配置与部署 Agent**
   - `LLM_CONFIG_FILE`
   - Secret 挂载规范
   - 本地样例配置 / 生产配置说明

3. **联调与验证 Agent**
   - mock / real provider 切换验证
   - 错误注入与 failover 验证
   - 不同城市 / 景点的路由命中验证

---

## 11. 当前结论

本轮设计先锁以下结论：

1. 后端 LLM 接入采用**多 provider 池 + 内部路由 + 可扩展失败切换**架构。
2. 配置使用**结构化文件**，由 Secret 挂载到容器内；不再以单组 env 变量表达主配置。
3. 一期不锁死单 provider，不前置动态健康检查。
4. 一期路由上下文以**服务端可推导信息**为主，不强制前端新增 `userId/sceneId` 透传。
5. Mock 保留，但真实 provider 失败时**直接报错**，不静默回退。

> 以上结论确认后，再生成 08 的开发任务文档。
