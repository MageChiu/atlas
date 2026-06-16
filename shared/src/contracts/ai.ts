/**
 * C3.4 - AI 接口契约
 *   POST /api/uploads/image
 *   POST /api/ai/photo-generate
 *   GET  /api/ai/tasks/{taskId}
 *   GET  /api/ai/results/{taskId}
 * 依据 docs/Atlas-路过-API协议说明.md 第 5 节、后端技术设计第 7 节。
 */

import type { AITaskStatus } from '../enums.js';
import type { AITask, AITaskResult } from '../models/index.js';
import type { IdempotentRequest } from './common.js';

/** POST /api/uploads/image -> data（multipart 上传，返回标识） */
export interface UploadImageData {
  imageId: string;
  url: string;
}

/** POST /api/ai/photo-generate 请求 */
export interface PhotoGenerateRequest extends IdempotentRequest {
  templateId: string;
  imageId: string;
  spotId: string;
}

/** POST /api/ai/photo-generate -> data */
export interface PhotoGenerateData {
  taskId: string;
  status: AITaskStatus;
}

/** GET /api/ai/tasks/{taskId} -> data */
export interface AITaskStatusData {
  task: AITask;
}

/** GET /api/ai/results/{taskId} -> data */
export interface AITaskResultData {
  status: AITaskStatus;
  result: AITaskResult | null;
}
