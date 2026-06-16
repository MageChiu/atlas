import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type {
  DialogueSessionData,
  SayData,
  SayRequest,
  StartDialogueData,
  StartDialogueRequest,
} from '@atlas/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { DialogueService } from './dialogue.service';

/**
 * TB05-5 - NPC 对话接口（对齐 ApiRoutes）。
 * Controller 只编排；userId 统一由 @CurrentUser 取，不信前端。
 */
@Controller('api/dialogue')
export class DialogueController {
  constructor(private readonly dialogue: DialogueService) {}

  @Post('start')
  start(
    @CurrentUser() userId: string,
    @Body() body: StartDialogueRequest,
  ): StartDialogueData {
    return this.dialogue.start(userId, body);
  }

  @Post(':sessionId/say')
  say(
    @CurrentUser() userId: string,
    @Param('sessionId') sessionId: string,
    @Body() body: SayRequest,
  ): Promise<SayData> {
    return this.dialogue.say(userId, sessionId, body);
  }

  @Get(':sessionId')
  getSession(
    @CurrentUser() userId: string,
    @Param('sessionId') sessionId: string,
  ): DialogueSessionData {
    return this.dialogue.getSession(userId, sessionId);
  }
}
