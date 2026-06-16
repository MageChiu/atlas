import { Module, Provider } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { DialogueController } from './dialogue.controller';
import { DialogueService } from './dialogue.service';
import { NpcRepository } from './npc.repository';
import { DialogueSessionRepository } from '../store/dialogue-session.repository';
import { LLM_PROVIDER, type LlmProvider } from './llm/llm.provider';
import { MockLlmProvider } from './llm/mock-llm.provider';

/**
 * TB05-6 - 对话模块装配。
 * LLM provider 按 LLM_PROVIDER env 选择；默认 mock。
 * 真实 provider 后插：在此 factory 增分支即可，DialogueService 零改动。
 */
const llmProvider: Provider = {
  provide: LLM_PROVIDER,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService): LlmProvider => {
    switch (config.llmProvider) {
      case 'mock':
      default:
        return new MockLlmProvider(config);
    }
  },
};

@Module({
  controllers: [DialogueController],
  providers: [DialogueService, NpcRepository, DialogueSessionRepository, llmProvider],
})
export class DialogueModule {}
