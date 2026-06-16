import { Controller, Get, Param } from '@nestjs/common';
import type {
  RegionDetailData,
  SpotActionsData,
  SpotDetailData,
  WorldData,
} from '@atlas/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { ContentService } from './content.service';

/**
 * B1 - 内容查询接口（C3.2）。
 * 路由与 ApiRoutes 常量保持一致。
 */
@Controller('api')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('world')
  getWorld(@CurrentUser() userId: string): WorldData {
    return this.content.getWorld(userId);
  }

  @Get('regions/:regionId')
  getRegion(
    @CurrentUser() userId: string,
    @Param('regionId') regionId: string,
  ): RegionDetailData {
    return this.content.getRegionDetail(userId, regionId);
  }

  @Get('spots/:spotId')
  getSpot(
    @CurrentUser() userId: string,
    @Param('spotId') spotId: string,
  ): SpotDetailData {
    return this.content.getSpotDetail(userId, spotId);
  }

  @Get('spots/:spotId/actions')
  getSpotActions(
    @CurrentUser() userId: string,
    @Param('spotId') spotId: string,
  ): SpotActionsData {
    return this.content.getSpotActions(userId, spotId);
  }
}
