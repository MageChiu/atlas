import { ApiRoutes } from '@atlas/shared';
import type { AuthData, LoginRequest, MeData, RegisterRequest } from '@atlas/shared';
import { APP_CONFIG } from '@/config';
import { httpClient } from './httpClient';
import { ApiRequestError } from './errors';

/**
 * 认证 API：注册 / 登录 / 登出 / 取当前用户。
 * Mock 模式下用内存账户，保证纯前端也能体验登录闭环；
 * 真实模式走后端 /api/auth/*（账户落 cache 目录）。
 */

const useMock = APP_CONFIG.useMock;

// ---- Mock：内存账户表（仅当 NEXT_PUBLIC_USE_MOCK=true 时使用）----
interface MockAccount {
  id: string;
  username: string;
  nickname: string;
  password: string;
  createdAt: string;
}
const mockAccounts = new Map<string, MockAccount>(); // key: username lower
const mockTokens = new Map<string, string>(); // token -> userId

function mockPublic(a: MockAccount): AuthData['user'] {
  return { id: a.id, username: a.username, nickname: a.nickname, createdAt: a.createdAt };
}

const mockAuth = {
  async register(req: RegisterRequest): Promise<AuthData> {
    const key = req.username.trim().toLowerCase();
    if (key.length < 3) throw new ApiRequestError('BAD_REQUEST', '用户名需 3-32 个字符');
    if (req.password.length < 6) throw new ApiRequestError('BAD_REQUEST', '密码至少 6 位');
    if (mockAccounts.has(key)) throw new ApiRequestError('USERNAME_TAKEN');
    const acc: MockAccount = {
      id: `user_mock_${Date.now()}`,
      username: req.username.trim(),
      nickname: req.nickname?.trim() || req.username.trim(),
      password: req.password,
      createdAt: new Date().toISOString(),
    };
    mockAccounts.set(key, acc);
    const token = `mock_${acc.id}`;
    mockTokens.set(token, acc.id);
    return { token, user: mockPublic(acc) };
  },
  async login(req: LoginRequest): Promise<AuthData> {
    const acc = mockAccounts.get(req.username.trim().toLowerCase());
    if (!acc || acc.password !== req.password) {
      throw new ApiRequestError('INVALID_CREDENTIALS');
    }
    const token = `mock_${acc.id}`;
    mockTokens.set(token, acc.id);
    return { token, user: mockPublic(acc) };
  },
};

export const authApi = {
  register: (req: RegisterRequest): Promise<AuthData> =>
    useMock ? mockAuth.register(req) : httpClient.post(ApiRoutes.register(), req),

  login: (req: LoginRequest): Promise<AuthData> =>
    useMock ? mockAuth.login(req) : httpClient.post(ApiRoutes.login(), req),

  logout: (): Promise<{ ok: true }> =>
    useMock ? Promise.resolve({ ok: true }) : httpClient.post(ApiRoutes.logout()),

  me: (): Promise<MeData> => httpClient.get(ApiRoutes.authMe()),
};
