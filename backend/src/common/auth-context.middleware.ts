import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { extractBearerToken } from './current-user.decorator';
import { TokenService } from '../auth/token.service';

/**
 * 全局鉴权上下文中间件：
 * 解析 Authorization: Bearer <token> → userId，写入 req.userId。
 * 不阻断请求（无 token 时由 resolveUserId 回落匿名/demo），
 * 受保护接口自行校验 req.userId 是否存在。
 */
@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(private readonly tokens: TokenService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const token = extractBearerToken(req.headers['authorization']);
    if (token) {
      const userId = this.tokens.resolve(token);
      if (userId) (req as Request & { userId?: string }).userId = userId;
    }
    next();
  }
}
