'use client';

import { useEffect, useRef } from 'react';
import { DialogueRole } from '@atlas/shared';
import type { DialogueMessage, NpcPublic } from '@atlas/shared';

/**
 * TF05-4 - 对话消息流：user / npc 区分气泡。
 * sending 时在末尾显示"对方正在思考…"。
 */
export function DialogueMessageList({
  messages,
  npc,
  sending,
}: {
  messages: DialogueMessage[];
  npc: NpcPublic | null;
  sending: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  return (
    <div className="flex max-h-[48vh] min-h-[200px] flex-col gap-3 overflow-y-auto px-1 py-2">
      {messages.map((m, i) => {
        const isUser = m.role === DialogueRole.User;
        return (
          <div
            key={`${m.at}-${i}`}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                isUser
                  ? 'rounded-br-sm bg-atlas-primary text-black'
                  : 'rounded-bl-sm bg-atlas-bg/70 text-white'
              }`}
            >
              {!isUser && npc && (
                <div className="mb-0.5 text-xs font-medium text-atlas-primary">
                  {npc.name}
                </div>
              )}
              {m.content}
            </div>
          </div>
        );
      })}
      {sending && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-sm bg-atlas-bg/70 px-3.5 py-2 text-sm text-atlas-muted">
            对方正在思考…
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
