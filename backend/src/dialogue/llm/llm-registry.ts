import { Logger } from '@nestjs/common';
import type { LlmProvider } from './llm.provider';
import type { LlmConfig, ProviderConfig } from './llm-config';
import { MockLlmProvider } from './providers/mock.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

/**
 * TB08-4 - Provider Registry。
 * 根据配置实例化 provider，建立 id->instance 与 id->meta 索引。
 * - enabled=false 的 provider 跳过；
 * - 未知 type 抛清晰错误（启动期暴露，不拖到请求期）。
 */
export interface ProviderEntry {
  instance: LlmProvider;
  meta: ProviderConfig;
}

export class LlmRegistry {
  private readonly logger = new Logger(LlmRegistry.name);
  private readonly entries = new Map<string, ProviderEntry>();

  constructor(config: LlmConfig) {
    for (const meta of config.providers) {
      if (meta.enabled === false) {
        this.logger.log(`provider 已禁用，跳过：${meta.id}`);
        continue;
      }
      const instance = this.instantiate(meta);
      this.entries.set(meta.id, { instance, meta });
    }
    if (this.entries.size === 0) {
      throw new Error('LLM registry 无可用 provider（全部禁用或为空）');
    }
    this.logger.log(`已装配 ${this.entries.size} 个 provider：${[...this.entries.keys()].join(', ')}`);
  }

  get(id: string): ProviderEntry | undefined {
    return this.entries.get(id);
  }

  list(): ProviderEntry[] {
    return [...this.entries.values()];
  }

  private instantiate(meta: ProviderConfig): LlmProvider {
    switch (meta.type) {
      case 'mock':
        return new MockLlmProvider(meta.mockDelayMs ?? 0);
      case 'openai-compatible':
        return new OpenAiCompatibleProvider(meta);
      default:
        throw new Error(`未知 provider type：${(meta as ProviderConfig).type}（id=${meta.id}）`);
    }
  }
}
