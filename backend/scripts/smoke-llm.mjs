/**
 * TB08-10 - LLM 多 Provider 路由 / failover 冒烟（零外部依赖，直测 LLM 层）。
 * 不经 HTTP，直接装配 LlmRouter + LlmService，用桩 provider 验证：
 *   1. 路由命中：按 candidateTags + priority/weighted 选出候选
 *   2. failover：主 provider 抛 switchOnErrors 错误后切到 backup
 *   3. 全部候选失败 -> 抛 LLM_UNAVAILABLE
 *   4. 非 switchOnErrors 错误（如 4xx）不切换，直接失败
 * 用法：先 npm run build:backend，再 node scripts/smoke-llm.mjs
 */
import { LlmRouter } from '../dist/dialogue/llm/llm-router.js';
import { LlmService } from '../dist/dialogue/llm/llm-service.js';
import { LlmProviderError } from '../dist/dialogue/llm/llm.provider.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

/** 桩 provider：可配置成功返回或按分类抛错 */
function okProvider(tag) {
  return { async chat() { return { text: `reply-from-${tag}` }; } };
}
function failProvider(kind) {
  return {
    async chat() {
      throw new LlmProviderError(kind, `stub ${kind} failure`);
    },
  };
}

/** 桩 registry：duck-typing 满足 LlmService 依赖（list/get） */
function fakeRegistry(entries) {
  const map = new Map(entries.map((e) => [e.meta.id, e]));
  return {
    list: () => entries,
    get: (id) => map.get(id),
  };
}

const baseFailover = {
  maxAttempts: 3,
  retryableErrors: ['timeout', '5xx', 'network'],
  switchOnErrors: ['timeout', '5xx', 'network'],
};

const ctx = { userId: 'u1', feature: 'dialogue', spotId: 'spot_x', npcId: 'npc_x', cityId: 'region_chengdu' };

async function main() {
  console.log('== 路由命中：priority 降序 ==');
  {
    const config = {
      providers: [],
      routes: [{ id: 'r', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' }],
      failoverPolicy: baseFailover,
    };
    const router = new LlmRouter(config);
    const entries = [
      { meta: { id: 'low', priority: 10, weight: 1, tags: ['dialogue'] }, instance: okProvider('low') },
      { meta: { id: 'high', priority: 100, weight: 1, tags: ['dialogue'] }, instance: okProvider('high') },
    ];
    const ids = router.selectCandidates(ctx, entries);
    assert(ids[0] === 'high' && ids[1] === 'low', `priority 候选有序：[${ids.join(', ')}]`);
  }

  console.log('== 路由命中：cityId 更具体规则优先 ==');
  {
    const config = {
      providers: [],
      routes: [
        { id: 'default', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' },
        { id: 'cd', match: { feature: 'dialogue', cityId: 'region_chengdu' }, candidateTags: ['chengdu'], strategy: 'priority' },
      ],
      failoverPolicy: baseFailover,
    };
    const router = new LlmRouter(config);
    const entries = [
      { meta: { id: 'generic', priority: 100, weight: 1, tags: ['dialogue'] }, instance: okProvider('generic') },
      { meta: { id: 'cd-only', priority: 10, weight: 1, tags: ['chengdu'] }, instance: okProvider('cd-only') },
    ];
    const ids = router.selectCandidates(ctx, entries);
    assert(ids.length === 1 && ids[0] === 'cd-only', `命中 chengdu 规则，候选=[${ids.join(', ')}]`);
  }

  console.log('== failover：主失败(network)切到 backup ==');
  {
    const config = {
      providers: [],
      routes: [{ id: 'r', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' }],
      failoverPolicy: baseFailover,
    };
    const router = new LlmRouter(config);
    const entries = [
      { meta: { id: 'primary', priority: 100, weight: 1, tags: ['dialogue'] }, instance: failProvider('network') },
      { meta: { id: 'backup', priority: 50, weight: 1, tags: ['dialogue'] }, instance: okProvider('backup') },
    ];
    const service = new LlmService(config, fakeRegistry(entries), router);
    const res = await service.chat(ctx, { messages: [] });
    assert(res.text === 'reply-from-backup', `切换到 backup 成功：${res.text}`);
  }

  console.log('== 全部候选失败 -> LLM_UNAVAILABLE ==');
  {
    const config = {
      providers: [],
      routes: [{ id: 'r', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' }],
      failoverPolicy: baseFailover,
    };
    const router = new LlmRouter(config);
    const entries = [
      { meta: { id: 'p1', priority: 100, weight: 1, tags: ['dialogue'] }, instance: failProvider('5xx') },
      { meta: { id: 'p2', priority: 50, weight: 1, tags: ['dialogue'] }, instance: failProvider('timeout') },
    ];
    const service = new LlmService(config, fakeRegistry(entries), router);
    let code;
    try {
      await service.chat(ctx, { messages: [] });
    } catch (err) {
      code = err.code;
    }
    assert(code === 'LLM_UNAVAILABLE', `全失败抛 LLM_UNAVAILABLE（实际 code=${code}）`);
  }

  console.log('== 非 switchOnErrors（4xx）不切换，直接失败 ==');
  {
    const config = {
      providers: [],
      routes: [{ id: 'r', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' }],
      failoverPolicy: baseFailover,
    };
    const router = new LlmRouter(config);
    let backupCalled = false;
    const entries = [
      { meta: { id: 'primary', priority: 100, weight: 1, tags: ['dialogue'] }, instance: failProvider('4xx') },
      {
        meta: { id: 'backup', priority: 50, weight: 1, tags: ['dialogue'] },
        instance: { async chat() { backupCalled = true; return { text: 'should-not-happen' }; } },
      },
    ];
    const service = new LlmService(config, fakeRegistry(entries), router);
    let code;
    try {
      await service.chat(ctx, { messages: [] });
    } catch (err) {
      code = err.code;
    }
    assert(code === 'LLM_UNAVAILABLE' && backupCalled === false, `4xx 不切换 backup（backupCalled=${backupCalled}）`);
  }

  console.log('== maxAttempts 限制尝试次数 ==');
  {
    const config = {
      providers: [],
      routes: [{ id: 'r', match: { feature: 'dialogue' }, candidateTags: ['dialogue'], strategy: 'priority' }],
      failoverPolicy: { maxAttempts: 1, retryableErrors: ['network'], switchOnErrors: ['network'] },
    };
    const router = new LlmRouter(config);
    let secondCalled = false;
    const entries = [
      { meta: { id: 'first', priority: 100, weight: 1, tags: ['dialogue'] }, instance: failProvider('network') },
      {
        meta: { id: 'second', priority: 50, weight: 1, tags: ['dialogue'] },
        instance: { async chat() { secondCalled = true; return { text: 'x' }; } },
      },
    ];
    const service = new LlmService(config, fakeRegistry(entries), router);
    let code;
    try {
      await service.chat(ctx, { messages: [] });
    } catch (err) {
      code = err.code;
    }
    assert(code === 'LLM_UNAVAILABLE' && secondCalled === false, `maxAttempts=1 后不再尝试第二个（secondCalled=${secondCalled}）`);
  }

  console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
