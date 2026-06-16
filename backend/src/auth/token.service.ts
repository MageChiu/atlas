import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { AppConfigService } from '../config/app-config.service';

/** token → userId 的会话映射（不透明 token；MVP 无过期） */
@Injectable()
export class TokenService implements OnModuleInit {
  private readonly logger = new Logger(TokenService.name);
  private readonly tokenToUser = new Map<string, string>();
  private filePath = '';

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    this.filePath = join(this.config.cacheDir, 'sessions.json');
    await mkdir(this.config.cacheDir, { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const obj = JSON.parse(raw) as Record<string, string>;
      for (const [t, uid] of Object.entries(obj)) this.tokenToUser.set(t, uid);
      this.logger.log(`已加载 ${this.tokenToUser.size} 个会话`);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`加载会话失败：${String(e)}`);
      }
    }
  }

  private async persist(): Promise<void> {
    const obj = Object.fromEntries(this.tokenToUser);
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    await rename(tmp, this.filePath);
  }

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    this.tokenToUser.set(token, userId);
    await this.persist();
    return token;
  }

  resolve(token: string): string | undefined {
    return this.tokenToUser.get(token);
  }

  async revoke(token: string): Promise<void> {
    if (this.tokenToUser.delete(token)) await this.persist();
  }
}
