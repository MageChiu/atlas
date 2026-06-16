import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { AppHeader } from '@/components/shell/AppHeader';
import { AppFooter } from '@/components/shell/AppFooter';
import { ToastContainer } from '@/components/shell/ToastContainer';
import { ModalContainer } from '@/components/shell/ModalContainer';

export const metadata: Metadata = {
  title: 'Atlas · 路过',
  description: '在线互动式虚拟旅行体验',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden bg-atlas-bg text-white">
        <Providers>
          {/* 外壳锁定为精确一屏，滚动收敛到 main 内部：
              场景页(absolute inset-0)不会整页滚动，内容页在 main 内滚动 */}
          <div className="flex h-screen flex-col overflow-hidden">
            <AppHeader />
            <main className="relative flex-1 overflow-y-auto">{children}</main>
            <AppFooter />
          </div>
          {/* 全局弹窗与通知容器（F1.2） */}
          <ModalContainer />
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
