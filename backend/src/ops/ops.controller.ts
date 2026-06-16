import { Controller, Get } from '@nestjs/common';
import { OpsService } from './ops.service';
import type { ActivityConfig, FeatureFlag } from './ops.service';

/**
 * B5.1 - 运营开关读取接口。
 */
@Controller('api/ops')
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('feature-flags')
  getFeatureFlags(): { flags: FeatureFlag[] } {
    return { flags: this.ops.listFeatureFlags() };
  }

  @Get('activities')
  getActivities(): { activities: ActivityConfig[] } {
    return { activities: this.ops.listActivities() };
  }
}
