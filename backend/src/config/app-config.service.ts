import { Injectable } from '@nestjs/common';
import { join } from 'node:path';

/**
 * B0.3 - 运行时配置读取（环境变量规范见 .env.example / C1.4）。
 * 内存仓储方案下，DB/Redis/对象存储仅作占位，便于后续切换真实实现。
 */
@Injectable()
export class AppConfigService {
  readonly port = Number(process.env.PORT ?? 3001);
  /** 绑定地址：本地默认 0.0.0.0（云上 pod 内需对外可达；如需仅本机可设 127.0.0.1） */
  readonly host = process.env.HOST ?? process.env.BACKEND_HOST ?? '0.0.0.0';
  readonly databaseUrl = process.env.DATABASE_URL ?? '';
  readonly redisUrl = process.env.REDIS_URL ?? '';
  readonly queueRedisUrl = process.env.QUEUE_REDIS_URL ?? '';
  readonly objectStorageEndpoint = process.env.OBJECT_STORAGE_ENDPOINT ?? '';
  readonly objectStorageBucket = process.env.OBJECT_STORAGE_BUCKET ?? 'atlas-assets';

  /** 对象存储未配置时，用本地占位 URL 拼接生成/上传资源地址 */
  readonly assetBaseUrl = process.env.ASSET_BASE_URL ?? 'https://assets.atlas.local';

  /** AI worker 模拟处理耗时（毫秒），便于联调演示异步流转 */
  readonly aiMockDelayMs = Number(process.env.AI_MOCK_DELAY_MS ?? 1500);

  /**
   * 本地缓存目录（未接入数据库时的持久化落点，如用户账户）。
   * 默认 backend/cache（相对当前工作目录）。
   */
  readonly cacheDir = process.env.CACHE_DIR ?? join(process.cwd(), 'cache');

  // ---- 05 NPC 对话系统 ----
  /** NPC 技能资产目录（读盘载入 *.skill.json），默认 ./resources/skills */
  readonly skillsDir = process.env.SKILLS_DIR ?? join(process.cwd(), '..', 'resources', 'skills');
  /**
   * 08 LLM 多 Provider 结构化配置文件路径（由 Secret 挂载）。
   * 为空时走 mock fallback（仅本地开发）；生产应显式提供。
   */
  readonly llmConfigFile = process.env.LLM_CONFIG_FILE ?? '';
  /** Mock LLM 模拟耗时（毫秒），用于无配置文件时的 mock fallback */
  readonly llmMockDelayMs = Number(process.env.LLM_MOCK_DELAY_MS ?? 200);
  /** 单会话最大轮次，达上限后会话结束 */
  readonly dialogueMaxTurns = Number(process.env.DIALOGUE_MAX_TURNS ?? 20);
}
