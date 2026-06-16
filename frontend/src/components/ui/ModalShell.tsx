'use client';

import type { ReactNode } from 'react';

/** 通用弹层骨架（F4.5 展示组件共用） */
export function ModalShell({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-atlas-border bg-atlas-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-atlas-border px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            className="text-atlas-muted transition-colors hover:text-white"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-atlas-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
