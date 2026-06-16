/**
 * C2.2 - NPC 模型（对话系统）
 * 依据 docs/Atlas-路过-NPC对话系统设计.md 第 3 节。
 * 软硬分离：persona 可演绎；knowledge(硬事实) + guardrails(护栏) 锁死，只可引用不可编造。
 * NpcProfile 同时是资产文件 resources/skills/{id}.skill.json 的结构契约（后端读盘解析）。
 */

import type { NpcKind } from '../enums.js';

/** 知识锚条目（grounding，须人工校对） */
export interface NpcKnowledgeEntry {
  topic: string;
  facts: string;
}

/** NPC 档案（.skill.json 结构契约） */
export interface NpcProfile {
  id: string;
  name: string;
  kind: NpcKind;
  /** 头像资产相对路径（走素材服务），可选 */
  avatar?: string;
  /** 软：可演绎的人格 */
  persona: {
    voice: string;
    setting: string;
    opening: string;
  };
  /** 硬：知识锚（只可引用不可编造） */
  knowledge: NpcKnowledgeEntry[];
  /** 护栏：可聊范围 / 不可编造 / 不确定如何圆场 */
  guardrails: string[];
}

/** 对外暴露的 NPC 公开信息（knowledge/guardrails 绝不下发前端） */
export interface NpcPublic {
  id: string;
  name: string;
  avatar?: string;
}
