import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';
import { NpcRepository } from './npc.repository';
import { DialogueSessionRepository } from '../store/dialogue-session.repository';
import { LLM_SERVICE } from './llm/llm.provider';
import { loadLlmConfig } from './llm/llm-config';
import { LlmRegistry } from './llm/llm-registry';
import { LlmRouter } from './llm/llm-router';
import { LlmService } from './llm/llm-service';

/**
 * TB08-8 - 对话模块装配。
 * 从"单 provider factory"升级为：config loader -> registry -> router -> LlmService。
 * - 无 LLM_CONFIG_FILE：走 mock fallback（仅本地开发）；
 * - 配置文件非法：loadLlmConfig 抛错，启动期暴露；
 * - DialogueService 注入统一 LlmService，不感知具体 provider。
 */
const llmService: Provider = {
  provide: LLM_SERVICE,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): LlmService => {
    const { config: llmConfig } = loadLlmConfig(config.llmConfigFile, config.llmMockDelayMs);
    const registry = new LlmRegistry(llmConfig);
    const router = new LlmRouter(llmConfig);
    return new LlmService(llmConfig, registry, router);
  },
};

@Module({
  controllers: [DialogueController],
  providers: [DialogueService, NpcRepository, DialogueSessionRepository, llmService],
})
export class DialogueModule {}
