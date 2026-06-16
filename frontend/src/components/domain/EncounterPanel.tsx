'use client';

import { ModalShell } from '@/components/ui/ModalShell';
import { RewardCard } from '@/components/ui/RewardCard';
import { useUiStore } from '@/stores/uiStore';
import type { GameEvent, Reward, EventChoice } from '@atlas/shared';

/** F4.5 - EncounterPanel：偶遇事件，支持选项分支 */
export function EncounterPanel({
  event,
  rewards,
}: {
  event: GameEvent;
  rewards: Reward[];
}) {
  const closeModal = useUiStore((s) => s.closeModal);
  const pushToast = useUiStore((s) => s.pushToast);
  const choices: EventChoice[] = event.choices ?? [];

  const handleChoice = (choice: EventChoice) => {
    pushToast('info', `你选择了「${choice.label ?? choice.id}」`);
    closeModal();
  };

  return (
    <ModalShell
      title={event.title}
      onClose={closeModal}
      footer={
        choices.length === 0 ? (
          <button
            className="rounded-lg bg-atlas-primary px-4 py-1.5 text-sm font-medium text-black"
            onClick={closeModal}
          >
            离开
          </button>
        ) : undefined
      }
    >
      {event.description && (
        <p className="mb-4 text-sm leading-relaxed text-atlas-muted">
          {event.description}
        </p>
      )}

      {rewards.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {rewards.map((r) => (
            <RewardCard key={r.id} reward={r} />
          ))}
        </div>
      )}

      {choices.length > 0 && (
        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <button
              key={choice.id}
              className="rounded-lg border border-atlas-border bg-atlas-bg/60 px-4 py-2 text-left text-sm transition-colors hover:border-atlas-primary hover:text-atlas-primary"
              onClick={() => handleChoice(choice)}
            >
              {choice.label ?? choice.id}
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
