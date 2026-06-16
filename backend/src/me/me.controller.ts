import { Controller, Get } from '@nestjs/common';
import type {
  AchievementsData,
  CollectionsData,
  GeneratedAssetsData,
} from '@atlas/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { MeService } from './me.service';

/**
 * B4 - 用户资产接口（C3.5）。
 */
@Controller('api/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('collections')
  getCollections(@CurrentUser() userId: string): CollectionsData {
    return this.me.getCollections(userId);
  }

  @Get('generated-assets')
  getGeneratedAssets(@CurrentUser() userId: string): GeneratedAssetsData {
    return this.me.getGeneratedAssets(userId);
  }

  @Get('achievements')
  getAchievements(@CurrentUser() userId: string): AchievementsData {
    return this.me.getAchievements(userId);
  }
}
