import { APP_CONFIG } from '@/config';
import { ApiRequestError, unwrap } from './errors';
import { getToken } from './token';
import type { ApiResponse } from '@atlas/shared';

/** 组装鉴权头：有 token 则带 Bearer */
function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * F1.3 - 全局请求封装
 * 统一拼接 base、自动附带 token、解包 ApiResponse、转换错误码为 ApiRequestError。
 */
async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR');
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError('UNKNOWN', '响应解析失败');
  }
  return unwrap(payload);
}

export const httpClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, json?: unknown) =>
    request<T>(path, { method: 'POST', json }),
  /** multipart 上传（绕过 JSON 包装） */
  async upload<T>(path: string, form: FormData): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { ...authHeader() },
        body: form,
      });
    } catch {
      throw new ApiRequestError('NETWORK_ERROR');
    }
    const payload = (await res.json()) as ApiResponse<T>;
    return unwrap(payload);
  },
};
