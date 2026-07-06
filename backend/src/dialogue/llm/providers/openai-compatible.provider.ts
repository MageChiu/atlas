import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
} from '../llm.provider';
import { LlmProviderError } from '../llm.provider';
import type { ProviderConfig } from '../llm-config';

/**
 * TB08-3 - OpenAI 兼容 provider。
 * 用原生 fetch 调 POST {baseUrl}/chat/completions，不绑死任何 SDK。
 * 错误统一归类为 LlmProviderError，交由 LlmService 决定是否切换候选。
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly endpoint: string;

  constructor(private readonly config: ProviderConfig) {
    const base = (config.baseUrl ?? '').replace(/\/+$/, '');
    this.endpoint = `${base}/chat/completions`;
  }

  async chat(req: LlmChatRequest): Promise<LlmChatResult> {
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs ?? 15000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildBody(req)),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new LlmProviderError('timeout', `请求超时（${timeoutMs}ms）`, err);
      }
      throw new LlmProviderError('network', `网络错误：${(err as Error).message}`, err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      const kind = res.status >= 500 ? '5xx' : '4xx';
      throw new LlmProviderError(
        kind,
        `provider 返回 ${res.status}：${truncate(bodyText, 200)}`,
      );
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch (err) {
      throw new LlmProviderError('invalid_response', '响应不是合法 JSON', err);
    }

    const text = extractContent(json);
    if (text === undefined) {
      throw new LlmProviderError('invalid_response', '响应缺少 choices[0].message.content');
    }
    return { text };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  private buildBody(req: LlmChatRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: req.messages,
    };
    if (this.config.temperature !== undefined) body.temperature = this.config.temperature;
    if (this.config.maxTokens !== undefined) body.max_tokens = this.config.maxTokens;
    return body;
  }
}

function extractContent(json: unknown): string | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const choices = (json as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const message = (choices[0] as Record<string, unknown>)?.message;
  if (typeof message !== 'object' || message === null) return undefined;
  const content = (message as Record<string, unknown>).content;
  return typeof content === 'string' ? content : undefined;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
