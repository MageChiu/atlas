'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { AuthGuard } from '@/components/shell/AuthGuard';

/** 全局 Provider：TanStack Query + 登录态初始化（F0.5 / F1.1） */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  useAuthBootstrap();
  return <AuthGuard>{children}</AuthGuard>;
}
