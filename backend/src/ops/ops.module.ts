import { Global, Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { RiskService } from './risk.service';

/**
 * B5 - 运营与风控模块。Global 以便 AI/Action 模块复用风控与开关。
 */
@Global()
@Module({
  controllers: [OpsController],
  providers: [OpsService, RiskService],
  exports: [OpsService, RiskService],
})
export class OpsModule {}
