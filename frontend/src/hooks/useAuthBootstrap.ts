'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/authApi';
import { getToken, clearToken } from '@/services/token';
import { APP_CONFIG } from '@/config';

/**
 * F1.1 - 登录态初始化
 * 有本地 token：拉 /auth/me 恢复用户；失败则清 token。
 * Mock 模式无法跨刷新校验 token（内存账户），仅标记 ready，由登录页驱动。
 */
export function useAuthBootstrap() {
  const setUser = useAuthStore((s) => s.setUser);
  const setReady = useAuthStore((s) => s.setReady);
  const ready = useAuthStore((s) => s.ready);

  useEffect(() => {
    if (ready) return;
    const token = getToken();
    if (!token || APP_CONFIG.useMock) {
      setReady(true);
      return;
    }
    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, [ready, setUser, setReady]);
}
