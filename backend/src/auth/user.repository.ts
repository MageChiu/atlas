import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { AppConfigService } from '../config/app-config.service';

/**
 * 用户账户记录（内部存储结构，含敏感字段，绝不对外返回）。
 * passwordHash/passwordSalt 用于 scrypt 校验。
 */
export interface UserRecord {
  id: string;
  username: string;
  usernameLower: string;
  nickname: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

/**
 * 用户仓储：MVP 无数据库，账户持久化到本地 cache 目录的 JSON 文件。
 * - 内存维护索引（username → record），启动时从文件加载。
 * - 写操作先写临时文件再原子 rename，避免半写损坏。
 * 后续接入 Postgres 时仅替换本类实现，AuthService 不变。
 */
@Injectable()
export class UserRepository implements OnModuleInit {
  private readonly logger = new Logger(UserRepository.name);
  private readonly byUsername = new Map<string, UserRecord>(); // key: usernameLower
  private readonly byId = new Map<string, UserRecord>();
  private filePath = '';

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    this.filePath = join(this.config.cacheDir, 'users.json');
    await mkdir(this.config.cacheDir, { recursive: true });
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const list = JSON.parse(raw) as UserRecord[];
      for (const u of list) {
        this.byUsername.set(u.usernameLower, u);
        this.byId.set(u.id, u);
      }
      this.logger.log(`已从缓存加载 ${list.length} 个用户：${this.filePath}`);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.log(`用户缓存不存在，将在首次注册时创建：${this.filePath}`);
      } else {
        this.logger.error(`加载用户缓存失败：${String(e)}`);
      }
    }
  }

  /** 原子持久化全量用户到文件 */
  private async persist(): Promise<void> {
    const list = [...this.byId.values()];
    const tmp = `${this.filePath}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2), 'utf-8');
    await rename(tmp, this.filePath);
  }

  findByUsername(username: string): UserRecord | undefined {
    return this.byUsername.get(username.trim().toLowerCase());
  }

  findById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  async create(record: UserRecord): Promise<UserRecord> {
    this.byUsername.set(record.usernameLower, record);
    this.byId.set(record.id, record);
    await this.persist();
    return record;
  }
}
