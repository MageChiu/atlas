/**
 * TB05-3 - LLM Provider 抽象。
 * DialogueService 仅依赖此接口，不得 import 任何具体 LLM SDK。
 * 真实 provider 后插，通过 LLM_PROVIDER token 注入，业务层零改动。
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

export interface LlmProvider {
  chat(req: LlmChatRequest): Promise<LlmChatResult>;
}

/** DI token */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
