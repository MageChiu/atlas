/**
 * TB05-3 / TB08-2 - LLM Provider 抽象。
 * 业务层（DialogueService）仅依赖统一 LlmService，不直接 import 任何具体 LLM SDK，
 * 也不感知池内有几个 provider。单个 provider 只负责"怎么请求某个模型服务"。
 */

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatRequest {
  messages: LlmChatMessage[];
}

export interface LlmChatResult {
  text: string;
}

/** 单个 provider 的调用接口：构造请求、鉴权、解析响应、上报错误类型 */
export interface LlmProvider {
  chat(req: LlmChatRequest): Promise<LlmChatResult>;
}

/**
 * 路由上下文（后端内部类型，不导出到 @atlas/shared）。
 * 一期由后端从鉴权上下文 / spotId / seed 反查推导，不要求前端透传。
 */
export interface LlmRouteContext {
  userId: string;
  feature: 'dialogue';
  spotId?: string;
  npcId?: string;
  regionId?: string;
  cityId?: string;
}

/** provider 调用错误分类（用于 failover 判定与统计） */
export type LlmErrorKind =
  | 'timeout'
  | 'network'
  | '4xx'
  | '5xx'
  | 'invalid_response'
  | 'unknown';

/** provider 调用失败的统一错误：携带分类，供 router/service 决定是否切换候选 */
export class LlmProviderError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

/** 统一 LLM 服务门面 DI token：DialogueService 注入它而非具体 provider */
export const LLM_SERVICE = Symbol('LLM_SERVICE');
