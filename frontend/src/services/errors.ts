import { ErrorCode, ErrorMessage } from '@atlas/shared';
import type { ApiResponse } from '@atlas/shared';

/**
 * 统一 API 错误（F1.3 / C4 错误码处理）
 * 持有 code 与本地化文案，供全局错误处理消费。
 */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';

  constructor(code: ApiRequestError['code'], message?: string) {
    super(message ?? defaultMessage(code));
    this.name = 'ApiRequestError';
    this.code = code;
  }
}

function defaultMessage(code: ApiRequestError['code']): string {
  if (code === 'NETWORK_ERROR') return '网络异常，请稍后重试';
  if (code === 'UNKNOWN') return '未知错误';
  return ERROR_MESSAGE_CN[code] ?? ErrorMessage[code] ?? code;
}

/** 错误码中文文案（前端本地化，覆盖 shared 英文默认值） */
export const ERROR_MESSAGE_CN: Record<ErrorCode, string> = {
  [ErrorCode.REGION_NOT_OPEN]: '该区域尚未开放',
  [ErrorCode.SPOT_NOT_UNLOCKED]: '该景点尚未解锁',
  [ErrorCode.ACTION_NOT_AVAILABLE]: '当前动作不可用',
  [ErrorCode.ACTION_COOLDOWN]: '动作冷却中，请稍后再试',
  [ErrorCode.UPLOAD_INVALID]: '图片不合法，请更换后重试',
  [ErrorCode.AI_TASK_FAILED]: 'AI 生成失败，请重试',
  [ErrorCode.RISK_BLOCKED]: '内容被风控拦截',
  [ErrorCode.USERNAME_TAKEN]: '该用户名已被注册',
  [ErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.UNAUTHORIZED]: '登录态失效，请重新登录',
  [ErrorCode.BAD_REQUEST]: '请求参数有误',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.INTERNAL_ERROR]: '服务器开小差了，请稍后重试',
  [ErrorCode.DIALOGUE_SESSION_NOT_FOUND]: '对话会话不存在或已失效',
  [ErrorCode.DIALOGUE_SESSION_ENDED]: '对话已结束',
  [ErrorCode.LLM_UNAVAILABLE]: '对方走神了，请稍后再试',
};

/** 从统一响应包络中解包 data，错误则抛出 ApiRequestError */
export function unwrap<T>(res: ApiResponse<T>): T {
  if (res.success) return res.data;
  throw new ApiRequestError(res.code, ERROR_MESSAGE_CN[res.code] ?? res.message);
}
