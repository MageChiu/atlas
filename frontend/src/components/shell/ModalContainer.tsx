'use client';

import { useUiStore } from '@/stores/uiStore';
import { EventModal } from '@/components/domain/EventModal';
import { RewardPopup } from '@/components/domain/RewardPopup';
import { EncounterPanel } from '@/components/domain/EncounterPanel';
import { DialoguePanel } from '@/components/domain/DialoguePanel';
import { PhotoGeneratePanel } from '@/components/domain/PhotoGeneratePanel';
import { GeneratedPhotoPreview } from '@/components/domain/GeneratedPhotoPreview';

/**
 * F1.2 / F4.1 - 全局弹窗容器（统一渲染入口）
 * 所有 Event / Reward / Encounter / Photo / AI 结果都经此处分发，
 * 对应 Scene Runtime 的 Event Layer 承载。
 */
export function ModalContainer() {
  const modal = useUiStore((s) => s.modal);
  if (!modal) return null;

  switch (modal.type) {
    case 'event':
      return <EventModal event={modal.event} rewards={modal.rewards} />;
    case 'reward':
      return <RewardPopup rewards={modal.rewards} />;
    case 'encounter':
      return <EncounterPanel event={modal.event} rewards={modal.rewards} />;
    case 'dialogue':
      return <DialoguePanel />;
    case 'photo':
      return (
        <PhotoGeneratePanel spotId={modal.spotId} templateId={modal.templateId} />
      );
    case 'aiResult':
      return <GeneratedPhotoPreview taskId={modal.taskId} />;
    case 'aiPending':
      return <GeneratedPhotoPreview taskId={modal.task.id} />;
    default:
      return null;
  }
}
