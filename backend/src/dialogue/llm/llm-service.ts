import { Logger } from '@nestjs/common';
import { ErrorCode } from '@atlas/shared';
import { BusinessException } from '../../common/business.exception';
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmErrorKind,
  LlmRouteContext,
} from './llm.provider';
import { LlmProviderError } from './llm.provider';
import type { LlmConfig } from './llm-config';
import { LlmRegistry } from './llm-registry';
import { LlmRouter } from './llm-router';

/**
 * TB08-6 - 统一 LLM 服务门面 + failover 骨架。
 * 业务层只调 chat(ctx, req)，不感知池内 provider 数量。
 * 流程：router 选候选 -> 依序尝试 -> switchOnErrors 切换 -> 全失败抛 LLM_UNAVAILABLE。
 * 预留 provider 状态缓存位（lastError/lastFailureAt），一期不做主动健康探测。
 */
interface ProviderRuntimeState {
  lastErrorKind?: LlmErrorKind;
  lastFailureAt?: number;
  consecutiveFailures: number;
}

export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  /** 预留：provider 运行时状态缓存（一期仅记录，不参与决策） */
  private readonly state = new Map<string, ProviderRuntimeState>();

  constructor(
    private readonly config: LlmConfig,
    private readonly registry: LlmRegistry,
    private readonly router: LlmRouter,
  ) {}

  async chat(ctx: LlmRouteContext, req: LlmChatRequest): Promise<LlmChatResult> {
    const candidateIds = this.router.selectCandidates(ctx, this.registry.list());
    const { maxAttempts, switchOnErrors } = this.config.failoverPolicy;

    let lastError: LlmProviderError | undefined;
    let attempts = 0;

    for (const id of candidateIds) {
      if (attempts >= maxAttempts) break;
      const entry = this.registry.get(id);
      if (!entry) continue;
      attempts++;

      const startedAt = Date.now();
      try {
        const result = await entry.instance.chat(req);
        this.recordSuccess(id);
        this.logger.log(
          `LLM 命中 provider=${id} attempt=${attempts} cost=${Date.now() - startedAt}ms`,
        );
        return result;
      } catch (err) {
        const kind = err instanceof LlmProviderError ? err.kind : 'unknown';
        this.recordFailure(id, kind);
        lastError = err instanceof LlmProviderError ? err : new LlmProviderError('unknown', String(err), err);
        this.logger.warn(
          `LLM 失败 provider=${id} attempt=${attempts} kind=${kind} cost=${Date.now() - startedAt}ms msg=${lastError.message}`,
        );
        if (!switchOnErrors.includes(kind)) break;
      }
    }

    this.logger.error(
      `LLM 全部候选失败：attempts=${attempts} candidates=[${candidateIds.join(', ')}] lastKind=${lastError?.kind}`,
    );
    throw new BusinessException(ErrorCode.LLM_UNAVAILABLE, 'LLM service is unavailable');
  }

  private recordSuccess(id: string): void {
    this.state.set(id, { consecutiveFailures: 0 });
  }

  private recordFailure(id: string, kind: LlmErrorKind): void {
    const prev = this.state.get(id);
    this.state.set(id, {
      lastErrorKind: kind,
      lastFailureAt: Date.now(),
      consecutiveFailures: (prev?.consecutiveFailures ?? 0) + 1,
    });
  }
}
