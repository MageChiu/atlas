/**
 * C2.3 - AI 任务模型
 * 依据 docs/Atlas-路过-数据模型设计.md 第 5 节。
 * 约束：AI 任务与主业务解耦，全部异步化。
 */

import type { AITaskStatus, AITaskType, UploadedImageStatus } from '../enums.js';

/** 上传图片记录 */
export interface UploadedImage {
  id: string;
  userId: string;
  fileUrl: string;
  mimeType: string;
  status: UploadedImageStatus;
  createdAt: string;
}

/** AI 异步任务 */
export interface AITask {
  id: string;
  userId: string;
  templateId: string;
  inputImageId?: string;
  taskType: AITaskType;
  status: AITaskStatus;
  createdAt: string;
  updatedAt: string;
}

/** AI 任务结果 */
export interface AITaskResult {
  id: string;
  taskId: string;
  outputUrl?: string;
  outputMeta?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
}
