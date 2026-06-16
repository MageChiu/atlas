'use client';

import { AITaskStatus } from '@atlas/shared';
import { ModalShell } from '@/components/ui/ModalShell';
import { useUiStore } from '@/stores/uiStore';
import { usePollTask } from '@/hooks/usePollTask';

/**
 * F5.4~F5.5 - GeneratedPhotoPreview
 * 轮询 AI 任务，展示 pending/running 进度与最终结果图。
 */
export function GeneratedPhotoPreview({ taskId }: { taskId: string }) {
  const closeModal = useUiStore((s) => s.closeModal);
  const { status, result, error } = usePollTask(taskId);

  const done = status === AITaskStatus.Success && result?.outputUrl;
  const failed = status === AITaskStatus.Failed || !!error;

  return (
    <ModalShell
      title="AI 生成结果"
      onClose={closeModal}
      footer={
        done ? (
          <button
            className="rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black"
            onClick={closeModal}
          >
            收入相册
          </button>
        ) : undefined
      }
    >
      {failed ? (
        <div className="py-10 text-center text-sm text-red-300">
          {error ?? 'AI 生成失败，请重试'}
        </div>
      ) : done ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result!.outputUrl}
          alt="生成结果"
          className="w-full rounded-xl object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-atlas-border border-t-atlas-primary" />
          <div className="text-sm text-atlas-muted">
            {status === AITaskStatus.Running ? '正在生成画面…' : '任务排队中…'}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
