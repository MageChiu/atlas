import { Body, Controller, Param, Post } from '@nestjs/common';
import type {
  CheckInData,
  CheckInRequest,
  ExecuteActionData,
  ExecuteActionRequest,
} from '@atlas/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { ActionService } from './action.service';

/**
 * B2 - 行为接口（C3.3 / C3.6）。
 *   POST /api/spots/{spotId}/check-in
 *   POST /api/actions/{actionId}/execute
 */
@Controller('api')
export class ActionController {
  constructor(private readonly action: ActionService) {}

  @Post('spots/:spotId/check-in')
  checkIn(
    @CurrentUser() userId: string,
    @Param('spotId') spotId: string,
    @Body() body: CheckInRequest,
  ): CheckInData {
    return this.action.checkIn(userId, spotId, body?.requestId);
  }

  @Post('actions/:actionId/execute')
  execute(
    @CurrentUser() userId: string,
    @Param('actionId') actionId: string,
    @Body() body: ExecuteActionRequest,
  ): ExecuteActionData {
    return this.action.execute(userId, actionId, body ?? {});
  }
}
