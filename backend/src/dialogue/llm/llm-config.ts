import { readFileSync } from 'node:fs';
import type { LlmErrorKind } from './llm.provider';

/**
 * TB08-1 - 结构化 LLM 配置读取与校验（后端内部类型，不放 @atlas/shared）。
 * 由 LLM_CONFIG_FILE 指向挂载的 JSON 文件。
 * - 文件缺失：显式回退到 mock provider（便于本地开发）。
 * - 文件存在但结构非法：启动时抛错，不拖到请求期。
 */

/** provider 类型：一期支持 openai-compatible 与 mock */
export type LlmProviderType = 'openai-compatible' | 'mock';

export interface ProviderConfig {
  id: string;
  type: LlmProviderType;
  /** openai-compatible 必填；mock 可空 */
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
  priority?: number;
  weight?: number;
  tags?: string[];
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
  /** mock 专用：模拟耗时 */
  mockDelayMs?: number;
}

/** 路由命中条件（一期支持 feature / cityId / npcId） */
export interface RouteMatch {
  feature?: string;
  cityId?: string;
  npcId?: string;
}

export type RouteStrategy = 'priority' | 'weighted';

export interface RouteRule {
  id: string;
  match: RouteMatch;
  candidateTags: string[];
  strategy: RouteStrategy;
}

export interface FailoverPolicy {
  maxAttempts: number;
  retryableErrors: LlmErrorKind[];
  switchOnErrors: LlmErrorKind[];
}

export interface LlmConfig {
  providers: ProviderConfig[];
  routes: RouteRule[];
  failoverPolicy: FailoverPolicy;
}

const VALID_TYPES: LlmProviderType[] = ['openai-compatible', 'mock'];
const VALID_STRATEGIES: RouteStrategy[] = ['priority', 'weighted'];
const VALID_ERROR_KINDS: LlmErrorKind[] = [
  'timeout',
  'network',
  '4xx',
  '5xx',
  'invalid_response',
  'unknown',
];

const DEFAULT_FAILOVER: FailoverPolicy = {
  maxAttempts: 2,
  retryableErrors: ['timeout', '5xx', 'network'],
  switchOnErrors: ['timeout', '5xx', 'network'],
};

/** 加载结果：real（来自配置文件）或 mock-fallback（无配置文件时的开发兜底） */
export interface LoadedLlmConfig {
  config: LlmConfig;
  source: 'file' | 'mock-fallback';
}

/**
 * 开发兜底配置：无配置文件时使用单个 mock provider + 默认对话路由。
 * 生产环境应显式提供 LLM_CONFIG_FILE。
 */
function buildMockFallback(mockDelayMs: number): LlmConfig {
  return {
    providers: [
      {
        id: 'mock-default',
        type: 'mock',
        enabled: true,
        priority: 100,
        weight: 100,
        tags: ['dialogue'],
        mockDelayMs,
      },
    ],
    routes: [
      {
        id: 'default-dialogue',
        match: { feature: 'dialogue' },
        candidateTags: ['dialogue'],
        strategy: 'priority',
      },
    ],
    failoverPolicy: { ...DEFAULT_FAILOVER },
  };
}

/**
 * 读取并校验 LLM 配置。
 * @param configFile LLM_CONFIG_FILE 路径（空字符串表示未配置）
 * @param mockDelayMs 兜底 mock provider 的模拟耗时
 */
export function loadLlmConfig(
  configFile: string,
  mockDelayMs: number,
): LoadedLlmConfig {
  if (!configFile) {
    return { config: buildMockFallback(mockDelayMs), source: 'mock-fallback' };
  }

  let raw: string;
  try {
    raw = readFileSync(configFile, 'utf-8');
  } catch (err) {
    throw new Error(
      `LLM 配置文件不可读：${configFile}（${(err as Error).message}）`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `LLM 配置文件不是合法 JSON：${configFile}（${(err as Error).message}）`,
    );
  }

  const config = validateConfig(parsed, configFile);
  return { config, source: 'file' };
}

function validateConfig(input: unknown, file: string): LlmConfig {
  const fail = (msg: string): never => {
    throw new Error(`LLM 配置非法（${file}）：${msg}`);
  };

  if (typeof input !== 'object' || input === null) {
    fail('根节点必须是对象');
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.providers) || obj.providers.length === 0) {
    fail('providers 必须为非空数组');
  }
  const providers = (obj.providers as unknown[]).map((p, i) =>
    validateProvider(p, i, fail),
  );

  const ids = new Set<string>();
  for (const p of providers) {
    if (ids.has(p.id)) fail(`provider id 重复：${p.id}`);
    ids.add(p.id);
  }

  const routesInput = Array.isArray(obj.routes) ? obj.routes : [];
  const routes = routesInput.map((r, i) => validateRoute(r, i, fail));

  const failoverPolicy = validateFailover(obj.failoverPolicy, fail);

  return { providers, routes, failoverPolicy };
}

function validateProvider(
  input: unknown,
  index: number,
  fail: (msg: string) => never,
): ProviderConfig {
  if (typeof input !== 'object' || input === null) {
    fail(`providers[${index}] 必须是对象`);
  }
  const p = input as Record<string, unknown>;
  const at = `providers[${index}]`;

  if (typeof p.id !== 'string' || !p.id) fail(`${at}.id 必填且为字符串`);
  if (typeof p.type !== 'string' || !VALID_TYPES.includes(p.type as LlmProviderType)) {
    fail(`${at}.type 必须是 ${VALID_TYPES.join(' | ')}`);
  }

  const type = p.type as LlmProviderType;
  if (type === 'openai-compatible') {
    if (typeof p.baseUrl !== 'string' || !p.baseUrl) {
      fail(`${at}.baseUrl 对 openai-compatible 必填`);
    }
    if (typeof p.model !== 'string' || !p.model) {
      fail(`${at}.model 对 openai-compatible 必填`);
    }
  }

  assertOptionalNumber(p.priority, `${at}.priority`, fail);
  assertOptionalNumber(p.weight, `${at}.weight`, fail);
  assertOptionalNumber(p.timeoutMs, `${at}.timeoutMs`, fail);
  assertOptionalNumber(p.temperature, `${at}.temperature`, fail);
  assertOptionalNumber(p.maxTokens, `${at}.maxTokens`, fail);
  assertOptionalNumber(p.mockDelayMs, `${at}.mockDelayMs`, fail);

  if (p.tags !== undefined && !isStringArray(p.tags)) {
    fail(`${at}.tags 必须是字符串数组`);
  }

  return {
    id: p.id as string,
    type,
    baseUrl: p.baseUrl as string | undefined,
    apiKey: p.apiKey as string | undefined,
    model: p.model as string | undefined,
    enabled: p.enabled === undefined ? true : Boolean(p.enabled),
    priority: (p.priority as number | undefined) ?? 0,
    weight: (p.weight as number | undefined) ?? 1,
    tags: (p.tags as string[] | undefined) ?? [],
    timeoutMs: (p.timeoutMs as number | undefined) ?? 15000,
    temperature: p.temperature as number | undefined,
    maxTokens: p.maxTokens as number | undefined,
    mockDelayMs: p.mockDelayMs as number | undefined,
  };
}

function validateRoute(
  input: unknown,
  index: number,
  fail: (msg: string) => never,
): RouteRule {
  if (typeof input !== 'object' || input === null) {
    fail(`routes[${index}] 必须是对象`);
  }
  const r = input as Record<string, unknown>;
  const at = `routes[${index}]`;

  if (typeof r.id !== 'string' || !r.id) fail(`${at}.id 必填且为字符串`);
  if (!isStringArray(r.candidateTags) || (r.candidateTags as string[]).length === 0) {
    fail(`${at}.candidateTags 必须是非空字符串数组`);
  }
  if (typeof r.strategy !== 'string' || !VALID_STRATEGIES.includes(r.strategy as RouteStrategy)) {
    fail(`${at}.strategy 必须是 ${VALID_STRATEGIES.join(' | ')}`);
  }
  if (r.match !== undefined && (typeof r.match !== 'object' || r.match === null)) {
    fail(`${at}.match 必须是对象`);
  }
  const match = (r.match as Record<string, unknown> | undefined) ?? {};

  return {
    id: r.id as string,
    match: {
      feature: match.feature as string | undefined,
      cityId: match.cityId as string | undefined,
      npcId: match.npcId as string | undefined,
    },
    candidateTags: r.candidateTags as string[],
    strategy: r.strategy as RouteStrategy,
  };
}

function validateFailover(
  input: unknown,
  fail: (msg: string) => never,
): FailoverPolicy {
  if (input === undefined) return { ...DEFAULT_FAILOVER };
  if (typeof input !== 'object' || input === null) {
    fail('failoverPolicy 必须是对象');
  }
  const f = input as Record<string, unknown>;

  const maxAttempts =
    f.maxAttempts === undefined ? DEFAULT_FAILOVER.maxAttempts : f.maxAttempts;
  if (typeof maxAttempts !== 'number' || !Number.isInteger(maxAttempts) || maxAttempts < 1) {
    fail('failoverPolicy.maxAttempts 必须是 ≥1 的整数');
  }

  const retryableErrors = validateErrorKinds(
    f.retryableErrors,
    'failoverPolicy.retryableErrors',
    DEFAULT_FAILOVER.retryableErrors,
    fail,
  );
  const switchOnErrors = validateErrorKinds(
    f.switchOnErrors,
    'failoverPolicy.switchOnErrors',
    DEFAULT_FAILOVER.switchOnErrors,
    fail,
  );

  return { maxAttempts: maxAttempts as number, retryableErrors, switchOnErrors };
}

function validateErrorKinds(
  input: unknown,
  at: string,
  fallback: LlmErrorKind[],
  fail: (msg: string) => never,
): LlmErrorKind[] {
  if (input === undefined) return [...fallback];
  if (!Array.isArray(input)) fail(`${at} 必须是数组`);
  for (const k of input as unknown[]) {
    if (typeof k !== 'string' || !VALID_ERROR_KINDS.includes(k as LlmErrorKind)) {
      fail(`${at} 含非法错误分类：${String(k)}`);
    }
  }
  return input as LlmErrorKind[];
}

function assertOptionalNumber(
  v: unknown,
  at: string,
  fail: (msg: string) => never,
): void {
  if (v !== undefined && (typeof v !== 'number' || Number.isNaN(v))) {
    fail(`${at} 必须是合法数值`);
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
