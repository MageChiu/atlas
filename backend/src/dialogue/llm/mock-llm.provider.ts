import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import type {
  LlmChatRequest,
  LlmChatResult,
  LlmProvider,
} from './llm.provider';

/**
 * TB05-3 - Mock LLM Provider（默认实现）。
 * 无真实 LLM 也能跑通联调：基于 system prompt 内的知识锚行，
 * 复述命中用户提问的知识点，便于收获触发演示。
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  constructor(private readonly config: AppConfigService) {}

  async chat(req: LlmChatRequest): Promise<LlmChatResult> {
    if (this.config.llmMockDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.config.llmMockDelayMs));
    }

    const system = req.messages.find((m) => m.role === 'system')?.content ?? '';
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    const knowledgeLines = system
      .split('\n')
      .filter((line) => line.startsWith(KNOWLEDGE_PREFIX))
      .map((line) => line.slice(KNOWLEDGE_PREFIX.length).trim());

    const hits = knowledgeLines.filter((line) => sharesSubstring(line, lastUser));

    if (hits.length > 0) {
      return { text: `（捋须）你问起这个——${hits.join(' ')}` };
    }
    if (knowledgeLines.length > 0) {
      return {
        text: `你说的『${truncate(lastUser, 20)}』，老夫一时记不真切，不敢妄言。不如换个话题，譬如${truncate(knowledgeLines[0], 24)}`,
      };
    }
    return { text: `听你说『${truncate(lastUser, 20)}』，倒是有趣，再与我多讲讲？` };
  }
}

/** 知识锚行前缀：DialogueService 组 system prompt 时用此前缀逐条标注 */
export const KNOWLEDGE_PREFIX = '#KN# ';

/** 中文友好的子串重合判定：用户输入中存在长度≥2的片段被知识行包含 */
function sharesSubstring(knowledge: string, user: string): boolean {
  const u = user.replace(/\s/g, '');
  for (let len = Math.min(6, u.length); len >= 2; len--) {
    for (let i = 0; i + len <= u.length; i++) {
      const frag = u.slice(i, i + len);
      if (knowledge.includes(frag)) return true;
    }
  }
  return false;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
