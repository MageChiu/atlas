import { Global, Module } from '@nestjs/common';
import { ConfigRepository } from './config.repository';
import { StateRepository } from './state.repository';

/**
 * 数据层：内存仓储（配置只读 + 用户态可变）。
 * 设为 Global，供各域模块直接注入；后续可替换为 Postgres/Redis 实现。
 */
@Global()
@Module({
  providers: [ConfigRepository, StateRepository],
  exports: [ConfigRepository, StateRepository],
})
export class StoreModule {}
