import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  AITaskResultData,
  AITaskStatusData,
  PhotoGenerateData,
  PhotoGenerateRequest,
  UploadImageData,
} from '@atlas/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { AiService } from './ai.service';

/**
 * B3 - AI 接口（C3.4）。
 */
@Controller('api')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('uploads/image')
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): UploadImageData {
    return this.ai.uploadImage(userId, file);
  }

  @Post('ai/photo-generate')
  photoGenerate(
    @CurrentUser() userId: string,
    @Body() body: PhotoGenerateRequest,
  ): PhotoGenerateData {
    return this.ai.photoGenerate(userId, body);
  }

  @Get('ai/tasks/:taskId')
  getTask(
    @CurrentUser() userId: string,
    @Param('taskId') taskId: string,
  ): AITaskStatusData {
    return this.ai.getTask(userId, taskId);
  }

  @Get('ai/results/:taskId')
  getResult(
    @CurrentUser() userId: string,
    @Param('taskId') taskId: string,
  ): AITaskResultData {
    return this.ai.getResult(userId, taskId);
  }
}
