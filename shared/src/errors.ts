/**
 * C4 - 统一错误码
 * 依据 docs/Atlas-路过-API协议说明.md 第 7 节与后端技术设计第 9 节。
 */

export const ErrorCode = {
  /** 区域未开放 */
  REGION_NOT_OPEN: 'REGION_NOT_OPEN',
  /** 景点未解锁 */
  SPOT_NOT_UNLOCKED: 'SPOT_NOT_UNLOCKED',
  /** 动作不可用 */
  ACTION_NOT_AVAILABLE: 'ACTION_NOT_AVAILABLE',
  /** 动作冷却中 */
  ACTION_COOLDOWN: 'ACTION_COOLDOWN',
  /** 上传不合法 */
  UPLOAD_INVALID: 'UPLOAD_INVALID',
  /** AI 任务失败 */
  AI_TASK_FAILED: 'AI_TASK_FAILED',
  /** 风控拦截 */
  RISK_BLOCKED: 'RISK_BLOCKED',
  /** 认证：用户名已被注册 */
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  /** 认证：用户名或密码错误 */
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  /** 认证：未登录或登录态失效 */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 框架级：请求参数错误（400 兜底） */
  BAD_REQUEST: 'BAD_REQUEST',
  /** 框架级：资源/路由未找到（404 兜底） */
  NOT_FOUND: 'NOT_FOUND',
  /** 框架级：服务器内部错误（500 兜底） */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** 对话：会话不存在或无权访问 */
  DIALOGUE_SESSION_NOT_FOUND: 'DIALOGUE_SESSION_NOT_FOUND',
  /** 对话：会话已结束 */
  DIALOGUE_SESSION_ENDED: 'DIALOGUE_SESSION_ENDED',
  /** 对话：LLM 服务不可用 */
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 错误码默认提示文案（英文，前端可按需本地化） */
export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.REGION_NOT_OPEN]: 'Region is not open',
  [ErrorCode.SPOT_NOT_UNLOCKED]: 'Spot is not unlocked',
  [ErrorCode.ACTION_NOT_AVAILABLE]: 'Action is not available',
  [ErrorCode.ACTION_COOLDOWN]: 'Action is cooling down',
  [ErrorCode.UPLOAD_INVALID]: 'Upload is invalid',
  [ErrorCode.AI_TASK_FAILED]: 'AI task failed',
  [ErrorCode.RISK_BLOCKED]: 'Content blocked by risk control',
  [ErrorCode.USERNAME_TAKEN]: 'Username is already taken',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password',
  [ErrorCode.UNAUTHORIZED]: 'Not authenticated',
  [ErrorCode.BAD_REQUEST]: 'Bad request',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.DIALOGUE_SESSION_NOT_FOUND]: 'Dialogue session not found',
  [ErrorCode.DIALOGUE_SESSION_ENDED]: 'Dialogue session has ended',
  [ErrorCode.LLM_UNAVAILABLE]: 'LLM service is unavailable',
};
