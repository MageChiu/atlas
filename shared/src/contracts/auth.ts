/**
 * 认证接口契约
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *
 * MVP：无数据库，用户持久化到后端本地 cache 目录；token 为不透明字符串。
 */

import type { PublicUser } from '../models/auth.js';

/** 注册请求 */
export interface RegisterRequest {
  username: string;
  password: string;
  nickname?: string;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 注册 / 登录成功返回：token + 用户信息 */
export interface AuthData {
  token: string;
  user: PublicUser;
}

/** GET /api/auth/me 返回当前用户 */
export interface MeData {
  user: PublicUser;
}
