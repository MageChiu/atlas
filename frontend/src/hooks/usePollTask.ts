'use client';

import { useEffect, useRef, useState } from 'react';
import { AITaskStatus } from '@atlas/shared';
import type { AITaskResult, AITaskStatus as AITaskStatusT } from '@atlas/shared';
import { api } from '@/services/api';

/**
 * F5.4 - 任务轮询（pollTaskStatus）
 * 轮询任务状态直到 success/failed，成功后拉取结果。
 */
export function usePollTask(taskId: string | null, intervalMs = 1200) {
  const [status, setStatus] = useState<AITaskStatusT | null>(null);
  const [result, setResult] = useState<AITaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    setStatus(null);
    setResult(null);
    setError(null);

    const poll = async () => {
      try {
        const { task } = await api.getTask(taskId);
        if (cancelled) return;
        setStatus(task.status);

        if (task.status === AITaskStatus.Success) {
          const res = await api.getResult(taskId);
          if (cancelled) return;
          setResult(res.result);
          return;
        }
        if (task.status === AITaskStatus.Failed) {
          setError('AI 生成失败');
          return;
        }
        timer.current = setTimeout(poll, intervalMs);
      } catch {
        if (!cancelled) setError('轮询任务失败');
      }
    };
    poll();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [taskId, intervalMs]);

  return { status, result, error };
}
