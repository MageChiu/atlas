import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ErrorCode } from '@atlas/shared';
import type { AuthData, LoginRequest, MeData, RegisterRequest } from '@atlas/shared';
import { BusinessException } from '../common/business.exception';
import { extractBearerToken } from '../common/current-user.decorator';
import { AuthService } from './auth.service';

/**
 * 认证接口：注册 / 登录 / 登出 / 当前用户。
 * 返回经全局拦截器包成 { success, data }。
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterRequest): Promise<AuthData> {
    return this.auth.register(body?.username, body?.password, body?.nickname);
  }

  @Post('login')
  login(@Body() body: LoginRequest): Promise<AuthData> {
    return this.auth.login(body?.username, body?.password);
  }

  @Post('logout')
  async logout(@Headers('authorization') authorization?: string): Promise<{ ok: true }> {
    await this.auth.logout(extractBearerToken(authorization));
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request): MeData {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '未登录');
    }
    return this.auth.getMe(userId);
  }
}
