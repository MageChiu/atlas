/**
 * C3.1 - 通用返回结构
 * 依据 docs/Atlas-路过-API协议说明.md 第 2 节。
 */

import type { ErrorCode } from '../errors.js';

/** 成功响应 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** 错误响应 */
export interface ApiError {
  success: false;
  code: ErrorCode;
  message: string;
}

/** 统一响应包络 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** 幂等写请求基类：关键写操作携带 requestId */
export interface IdempotentRequest {
  requestId?: string;
}
