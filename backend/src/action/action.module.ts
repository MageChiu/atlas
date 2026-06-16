import { Global, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ActionController } from './action.controller';
import { ActionService } from './action.service';
import { ActionRulesService } from './action-rules.service';

/**
 * B2 - Action 模块。
 * 导出 ActionRulesService 供内容模块（actions 列表）复用可执行性判定。
 */
@Global()
@Module({
  imports: [AiModule],
  controllers: [ActionController],
  providers: [ActionService, ActionRulesService],
  exports: [ActionRulesService],
})
export class ActionModule {}
