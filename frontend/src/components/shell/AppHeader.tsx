'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/services/authApi';

/** F1.2 - 页头：全局导航与登录态展示 */
const NAV = [
  { href: '/world', label: '世界' },
  { href: '/collections', label: '图鉴' },
  { href: '/generated', label: '生成记录' },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      signOut();
      router.push('/login');
    }
  };

  return (
    <header className="z-20 flex h-14 items-center justify-between border-b border-atlas-border bg-atlas-surface/80 px-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
        <span className="text-atlas-primary">Atlas</span>
        <span className="text-atlas-muted">·</span>
        <span className="text-sm text-atlas-muted">路过</span>
      </Link>

      <nav className="flex items-center gap-1 text-sm">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-1.5 transition-colors ${
                active
                  ? 'bg-atlas-primary/15 text-atlas-primary'
                  : 'text-atlas-muted hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-atlas-muted">{user.nickname}</span>
            <button
              onClick={handleLogout}
              className="rounded px-2 py-1 text-atlas-muted transition-colors hover:text-white"
            >
              退出
            </button>
          </>
        ) : (
          <Link href="/login" className="text-atlas-primary hover:underline">
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
