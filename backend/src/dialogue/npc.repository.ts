import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NpcKind } from '@atlas/shared';
import type { NpcProfile } from '@atlas/shared';
import { AppConfigService } from '../config/app-config.service';

/**
 * TB05-1 - NPC 资产仓储（读盘载入）。
 * 启动时扫描 SKILLS_DIR 下 *.skill.json，解析为 NpcProfile 存内存。
 * 容错：目录缺失或文件损坏只记日志、跳过，不致启动失败（素材缺失占位兜底哲学）。
 */
@Injectable()
export class NpcRepository implements OnModuleInit {
  private readonly logger = new Logger(NpcRepository.name);
  private readonly npcs = new Map<string, NpcProfile>();

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    this.load();
  }

  private load(): void {
    const dir = this.config.skillsDir;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.skill.json'));
    } catch (err) {
      this.logger.warn(
        `技能目录不可读，跳过 NPC 载入：${dir}（${(err as Error).message}）`,
      );
      return;
    }

    for (const file of files) {
      const path = join(dir, file);
      try {
        const raw = readFileSync(path, 'utf-8');
        const profile = JSON.parse(raw) as NpcProfile;
        if (!this.isValid(profile)) {
          this.logger.warn(`技能文件结构不完整，跳过：${file}`);
          continue;
        }
        this.npcs.set(profile.id, profile);
      } catch (err) {
        this.logger.warn(`技能文件解析失败，跳过：${file}（${(err as Error).message}）`);
      }
    }
    this.logger.log(`已载入 ${this.npcs.size} 个 NPC：${[...this.npcs.keys()].join(', ')}`);
  }

  private isValid(p: Partial<NpcProfile>): p is NpcProfile {
    return (
      typeof p?.id === 'string' &&
      typeof p?.name === 'string' &&
      (p.kind === NpcKind.Signature || p.kind === NpcKind.Generic) &&
      !!p.persona &&
      Array.isArray(p.knowledge) &&
      Array.isArray(p.guardrails)
    );
  }

  getNpc(id: string): NpcProfile | undefined {
    return this.npcs.get(id);
  }

  listNpcs(): NpcProfile[] {
    return [...this.npcs.values()];
  }
}
