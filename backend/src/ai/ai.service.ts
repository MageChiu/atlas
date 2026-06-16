import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  AITaskStatus,
  AITaskType,
  GeneratedAssetType,
  UploadedImageStatus,
} from '@atlas/shared';
import type {
  AITask,
  AITaskResult,
  AITaskResultData,
  AITaskStatusData,
  PhotoGenerateData,
  PhotoGenerateRequest,
  UploadImageData,
  UploadedImage,
  UserGeneratedAsset,
} from '@atlas/shared';
import { BusinessException } from '../common/business.exception';
import { ErrorCode } from '@atlas/shared';
import { AppConfigService } from '../config/app-config.service';
import { StateRepository } from '../store/state.repository';
import { ConfigRepository } from '../store/config.repository';
import { RiskService } from '../ops/risk.service';

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * B3 - AI 任务模块（异步化）。
 * 上传记录 -> 创建任务 -> 推入进程内队列（worker） -> 回写结果。
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly state: StateRepository,
    private readonly config: ConfigRepository,
    private readonly appConfig: AppConfigService,
    private readonly risk: RiskService,
  ) {}

  /** B3.2 上传图片：校验类型/大小，记录 uploaded_images */
  uploadImage(
    userId: string,
    file: { originalname: string; mimetype: string; size: number } | undefined,
  ): UploadImageData {
    if (!file) {
      throw new BusinessException(ErrorCode.UPLOAD_INVALID, 'No file provided');
    }
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BusinessException(ErrorCode.UPLOAD_INVALID, 'Unsupported image type');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BusinessException(ErrorCode.UPLOAD_INVALID, 'Image too large');
    }
    // 风控壳：图片审核入口
    if (!this.risk.checkImage(file)) {
      throw new BusinessException(ErrorCode.RISK_BLOCKED, 'Image blocked by risk control');
    }

    const id = uuid();
    const record: UploadedImage = {
      id,
      userId,
      fileUrl: `${this.appConfig.assetBaseUrl}/uploads/${id}/${file.originalname}`,
      mimeType: file.mimetype,
      status: UploadedImageStatus.Uploaded,
      createdAt: new Date().toISOString(),
    };
    this.state.uploadedImages.set(id, record);
    return { imageId: id, url: record.fileUrl };
  }

  /** B3.3 提交生成任务：创建 ai_tasks，推入队列，requestId 幂等可追踪 */
  photoGenerate(userId: string, body: PhotoGenerateRequest): PhotoGenerateData {
    const existingId = this.state.getIdempotent(userId, 'photo-generate', body.requestId);
    if (existingId) {
      const existing = this.state.aiTasks.get(existingId);
      if (existing) return { taskId: existing.id, status: existing.status };
    }

    const template = this.config.getAiTemplate(body.templateId);
    if (!template) {
      throw new BusinessException(ErrorCode.ACTION_NOT_AVAILABLE, 'AI template not found');
    }
    if (body.imageId && !this.state.uploadedImages.has(body.imageId)) {
      throw new BusinessException(ErrorCode.UPLOAD_INVALID, 'Uploaded image not found');
    }

    const task = this.createTask(userId, body.templateId, body.imageId);
    this.state.setIdempotent(userId, 'photo-generate', body.requestId, task.id);
    this.enqueue(task.id);
    return { taskId: task.id, status: task.status };
  }

  /** 供 Action 模块复用：执行 photo/encounter Action 时直接创建并入队任务 */
  createTask(userId: string, templateId: string, inputImageId?: string): AITask {
    const now = new Date().toISOString();
    const task: AITask = {
      id: uuid(),
      userId,
      templateId,
      inputImageId,
      taskType: AITaskType.PhotoGenerate,
      status: AITaskStatus.Pending,
      createdAt: now,
      updatedAt: now,
    };
    this.state.aiTasks.set(task.id, task);
    return task;
  }

  enqueue(taskId: string): void {
    // 进程内异步队列：用 setTimeout 模拟队列消费与 AI 处理耗时
    setTimeout(() => this.processTask(taskId), 0);
  }

  /** B3.4 查询任务状态 */
  getTask(userId: string, taskId: string): AITaskStatusData {
    const task = this.requireOwnedTask(userId, taskId);
    return { task };
  }

  /** B3.5 获取任务结果 */
  getResult(userId: string, taskId: string): AITaskResultData {
    const task = this.requireOwnedTask(userId, taskId);
    const result = this.state.aiResults.get(taskId) ?? null;
    return { status: task.status, result };
  }

  private requireOwnedTask(userId: string, taskId: string): AITask {
    const task = this.state.aiTasks.get(taskId);
    if (!task || task.userId !== userId) {
      throw new BusinessException(ErrorCode.AI_TASK_FAILED, 'Task not found');
    }
    return task;
  }

  /** B3.6 Worker：消费队列、调用 AI 能力（Mock 结果）、回写 ai_task_results */
  private processTask(taskId: string): void {
    const task = this.state.aiTasks.get(taskId);
    if (!task) return;

    this.updateStatus(task, AITaskStatus.Running);

    setTimeout(() => {
      const current = this.state.aiTasks.get(taskId);
      if (!current) return;
      try {
        const result = this.mockGenerate(current);
        this.state.aiResults.set(taskId, result);
        this.updateStatus(current, AITaskStatus.Success);
        this.recordGeneratedAsset(current, result);
        this.logger.log(`AI task ${taskId} success`);
      } catch (err) {
        const result: AITaskResult = {
          id: uuid(),
          taskId,
          errorMessage: err instanceof Error ? err.message : 'AI task failed',
          createdAt: new Date().toISOString(),
        };
        this.state.aiResults.set(taskId, result);
        this.updateStatus(current, AITaskStatus.Failed);
      }
    }, this.appConfig.aiMockDelayMs);
  }

  private mockGenerate(task: AITask): AITaskResult {
    const outputId = uuid();
    return {
      id: uuid(),
      taskId: task.id,
      outputUrl: `${this.appConfig.assetBaseUrl}/generated/${outputId}.png`,
      outputMeta: { templateId: task.templateId, mock: true },
      createdAt: new Date().toISOString(),
    };
  }

  private recordGeneratedAsset(task: AITask, result: AITaskResult): void {
    if (!result.outputUrl) return;
    const asset: UserGeneratedAsset = {
      id: uuid(),
      userId: task.userId,
      taskId: task.id,
      assetType: GeneratedAssetType.Photo,
      assetUrl: result.outputUrl,
      createdAt: new Date().toISOString(),
    };
    this.state.generatedAssets.push(asset);
  }

  private updateStatus(task: AITask, status: AITaskStatus): void {
    const next: AITask = { ...task, status, updatedAt: new Date().toISOString() };
    this.state.aiTasks.set(task.id, next);
  }
}
