import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { TokenService } from './token.service';

/**
 * 认证模块：注册/登录/登出/me。
 * 用户与会话持久化到本地 cache 目录（无数据库）。
 * 导出 TokenService 供全局鉴权中间件解析请求身份。
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, UserRepository, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
