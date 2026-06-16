import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** 默认体验用户：MVP 阶段未带 token 时回落，保证旧接口可匿名体验 */
export const DEMO_USER_ID = 'user_demo';

/** 从 Authorization 头解析 Bearer token */
export function extractBearerToken(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const [scheme, value] = authorization.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && value?.trim()) return value.trim();
  return undefined;
}

/**
 * B0.4 - 登录态解析：
 * 1. 优先用 AuthContextMiddleware 通过 token 解析并写入的 req.userId；
 * 2. 兼容旧的 x-user-id 头；
 * 3. 仍缺省则回落 DEMO_USER_ID。
 * 真实鉴权接入后业务层无需改动。
 */
export function resolveUserId(req: Request): string {
  const fromToken = (req as Request & { userId?: string }).userId;
  if (fromToken && fromToken.trim().length > 0) return fromToken;

  const header = req.headers['x-user-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.trim().length > 0 ? value.trim() : DEMO_USER_ID;
}

/** 注入当前用户 id 到 Controller 方法参数 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return resolveUserId(req);
  },
);
