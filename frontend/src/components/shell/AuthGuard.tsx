'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { APP_CONFIG } from '@/config';

/** 无需登录即可访问的公开路由前缀 */
const PUBLIC_PREFIXES = ['/login', '/share'];

function isPublic(pathname: string | null): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * F1.1 - 路由保护
 * 未登录访问受保护页 → 跳转 /login。
 * Mock 模式（NEXT_PUBLIC_USE_MOCK=true）不强制登录，便于纯前端演示。
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  const needAuth = !APP_CONFIG.useMock && !user && !isPublic(pathname);

  useEffect(() => {
    if (ready && needAuth) router.replace('/login');
  }, [ready, needAuth, router]);

  // 鉴权未就绪或将要跳转时，避免闪现受保护内容
  if (!ready) return null;
  if (needAuth) return null;

  return <>{children}</>;
}
