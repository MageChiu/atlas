'use client';

import { useEffect } from 'react';
import { useUiStore, type Toast } from '@/stores/uiStore';

/** F1.2 - 全局通知容器 */
export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUiStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 2600);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const color =
    toast.kind === 'success'
      ? 'border-emerald-500/40 text-emerald-200'
      : toast.kind === 'error'
        ? 'border-red-500/40 text-red-200'
        : 'border-atlas-border text-white';

  return (
    <div
      className={`pointer-events-auto rounded-lg border bg-atlas-surface px-4 py-2 text-sm shadow-lg ${color}`}
    >
      {toast.message}
    </div>
  );
}
