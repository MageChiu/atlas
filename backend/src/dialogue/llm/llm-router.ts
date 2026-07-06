import { Logger } from '@nestjs/common';
import type { LlmRouteContext } from './llm.provider';
import type { LlmConfig, RouteRule } from './llm-config';
import type { ProviderEntry } from './llm-registry';

/**
 * TB08-5 - Router：根据上下文选出有序候选 provider 列表。
 * 输入：LlmRouteContext + routes + provider metas。
 * - 命中条件一期支持 feature / cityId / npcId（更具体的规则优先）；
 * - 候选筛选基于 candidateTags；
 * - 策略支持 priority（优先级降序）与 weighted（按权重随机排序）；
 * - 无路由命中时回落到全部启用 provider（按优先级），保证链路不断。
 */
export class LlmRouter {
  private readonly logger = new Logger(LlmRouter.name);

  constructor(private readonly config: LlmConfig) {}

  /** 返回去重后的有序候选 provider id 列表 */
  selectCandidates(ctx: LlmRouteContext, all: ProviderEntry[]): string[] {
    const route = this.matchRoute(ctx);
    if (!route) {
      this.logger.warn(`无路由命中，回落全局默认（feature=${ctx.feature}）`);
      return orderByPriority(all).map((e) => e.meta.id);
    }

    const candidates = all.filter((e) =>
      route.candidateTags.some((tag) => (e.meta.tags ?? []).includes(tag)),
    );
    if (candidates.length === 0) {
      this.logger.warn(
        `路由 ${route.id} 的 candidateTags 未匹配到任何 provider，回落全局默认`,
      );
      return orderByPriority(all).map((e) => e.meta.id);
    }

    const ordered =
      route.strategy === 'weighted'
        ? orderByWeight(candidates)
        : orderByPriority(candidates);
    return ordered.map((e) => e.meta.id);
  }

  /** 命中最具体的路由：匹配字段越多优先级越高，平局取配置靠前者 */
  private matchRoute(ctx: LlmRouteContext): RouteRule | undefined {
    let best: { route: RouteRule; score: number } | undefined;
    for (const route of this.config.routes) {
      const score = this.matchScore(route, ctx);
      if (score < 0) continue;
      if (!best || score > best.score) best = { route, score };
    }
    return best?.route;
  }

  /** -1 表示不命中；否则返回命中的字段数（越大越具体） */
  private matchScore(route: RouteRule, ctx: LlmRouteContext): number {
    const m = route.match;
    let score = 0;
    if (m.feature !== undefined) {
      if (m.feature !== ctx.feature) return -1;
      score++;
    }
    if (m.cityId !== undefined) {
      if (m.cityId !== ctx.cityId) return -1;
      score++;
    }
    if (m.npcId !== undefined) {
      if (m.npcId !== ctx.npcId) return -1;
      score++;
    }
    return score;
  }
}

function orderByPriority(entries: ProviderEntry[]): ProviderEntry[] {
  return [...entries].sort((a, b) => (b.meta.priority ?? 0) - (a.meta.priority ?? 0));
}

/**
 * 加权排序：按权重做一次无放回随机抽样得到顺序，
 * 既实现了首选的权重分流，又给出失败后的确定性候选序列。
 */
function orderByWeight(entries: ProviderEntry[]): ProviderEntry[] {
  const pool = entries.map((e) => ({ entry: e, weight: Math.max(0, e.meta.weight ?? 1) }));
  const result: ProviderEntry[] = [];
  while (pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    if (total <= 0) {
      // 权重均为 0：退化为优先级序
      result.push(...orderByPriority(pool.map((p) => p.entry)));
      break;
    }
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    result.push(pool[idx].entry);
    pool.splice(idx, 1);
  }
  return result;
}
