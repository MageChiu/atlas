import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ErrorCode } from '@atlas/shared';
import type { AuthData, MeData, PublicUser } from '@atlas/shared';
import { BusinessException } from '../common/business.exception';
import { UserRepository, type UserRecord } from './user.repository';
import { TokenService } from './token.service';

const scryptAsync = promisify(scrypt);
const KEY_LEN = 64;

/**
 * 认证服务：注册 / 登录 / 登出 / 取当前用户。
 * 密码用 scrypt + 每用户随机 salt 哈希，绝不存明文；账户落地 cache 目录（UserRepository）。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  async register(username: string, password: string, nickname?: string): Promise<AuthData> {
    const name = (username ?? '').trim();
    if (name.length < 3 || name.length > 32) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '用户名需 3-32 个字符');
    }
    if (!password || password.length < 6) {
      throw new BusinessException(ErrorCode.BAD_REQUEST, '密码至少 6 位');
    }
    if (this.users.findByUsername(name)) {
      throw new BusinessException(ErrorCode.USERNAME_TAKEN, '用户名已被注册');
    }

    const salt = randomBytes(16).toString('hex');
    const hash = await this.hash(password, salt);
    const record: UserRecord = {
      id: `user_${randomUUID()}`,
      username: name,
      usernameLower: name.toLowerCase(),
      nickname: (nickname ?? '').trim() || name,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };
    await this.users.create(record);
    const token = await this.tokens.issue(record.id);
    return { token, user: toPublicUser(record) };
  }

  async login(username: string, password: string): Promise<AuthData> {
    const record = this.users.findByUsername((username ?? '').trim());
    if (!record) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS, '用户名或密码错误');
    }
    const ok = await this.verify(password ?? '', record);
    if (!ok) {
      throw new BusinessException(ErrorCode.INVALID_CREDENTIALS, '用户名或密码错误');
    }
    const token = await this.tokens.issue(record.id);
    return { token, user: toPublicUser(record) };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.tokens.revoke(token);
  }

  getMe(userId: string): MeData {
    const record = this.users.findById(userId);
    if (!record) {
      throw new BusinessException(ErrorCode.UNAUTHORIZED, '登录态失效，请重新登录');
    }
    return { user: toPublicUser(record) };
  }

  private async hash(password: string, salt: string): Promise<string> {
    const buf = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
    return buf.toString('hex');
  }

  private async verify(password: string, record: UserRecord): Promise<boolean> {
    const candidate = (await scryptAsync(password, record.passwordSalt, KEY_LEN)) as Buffer;
    const expected = Buffer.from(record.passwordHash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  }
}

/** 内部记录 → 对外用户（剥离敏感字段） */
function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    username: record.username,
    nickname: record.nickname,
    createdAt: record.createdAt,
  };
}
