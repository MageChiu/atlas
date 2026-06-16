'use client';

import { useState, useRef } from 'react';
import { ModalShell } from '@/components/ui/ModalShell';
import { useUiStore } from '@/stores/uiStore';
import { api } from '@/services/api';
import { ApiRequestError } from '@/services/errors';

/**
 * F5.1~F5.3 - PhotoGeneratePanel
 * photo Action 入口：上传图片(uploads/image) → 提交生成(ai/photo-generate) →
 * 切换为 AI 结果轮询弹层。
 */
export function PhotoGeneratePanel({
  spotId,
  templateId,
}: {
  spotId: string;
  templateId: string;
}) {
  const closeModal = useUiStore((s) => s.closeModal);
  const openModal = useUiStore((s) => s.openModal);
  const pushToast = useUiStore((s) => s.pushToast);

  const [preview, setPreview] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const data = await api.uploadImage(file);
      setImageId(data.imageId);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : '上传失败';
      pushToast('error', msg);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!imageId) {
      pushToast('error', '请先上传图片');
      return;
    }
    setSubmitting(true);
    try {
      const data = await api.photoGenerate({ templateId, imageId, spotId });
      openModal({ type: 'aiResult', taskId: data.taskId });
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : '提交失败';
      pushToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="生成旅行写真"
      onClose={closeModal}
      footer={
        <>
          <button
            className="rounded-lg border border-atlas-border px-4 py-1.5 text-sm text-atlas-muted"
            onClick={closeModal}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black disabled:opacity-50"
            disabled={!imageId || uploading || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '提交中…' : '生成'}
          </button>
        </>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <button
        className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-atlas-border text-atlas-muted transition-colors hover:border-atlas-primary"
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="预览"
            className="h-full w-full rounded-lg object-cover"
          />
        ) : (
          <>
            <span className="text-3xl">＋</span>
            <span className="text-sm">点击上传一张人像照片</span>
          </>
        )}
      </button>
      {uploading && (
        <div className="mt-2 text-center text-xs text-atlas-muted">上传中…</div>
      )}
    </ModalShell>
  );
}
