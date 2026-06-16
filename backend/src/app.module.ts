import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { StoreModule } from './store/store.module';
import { ProgressModule } from './progress/progress.module';
import { RewardModule } from './reward/reward.module';
import { EventModule } from './event/event.module';
import { OpsModule } from './ops/ops.module';
import { AiModule } from './ai/ai.module';
import { ActionModule } from './action/action.module';
import { ContentModule } from './content/content.module';
import { MeModule } from './me/me.module';
import { DialogueModule } from './dialogue/dialogue.module';
import { AuthModule } from './auth/auth.module';
import { AuthContextMiddleware } from './common/auth-context.middleware';
import { HealthController } from './health.controller';

/**
 * B0.2 - 应用根模块，按域聚合各模块。
 * 基础设施模块（Config/Store/Progress/Reward/Event/Ops/Action）为 Global，
 * 业务模块（Auth/Content/Action/Ai/Me）承载各域接口。
 * 全局应用 AuthContextMiddleware：从 Bearer token 解析 req.userId。
 */
@Module({
  imports: [
    ConfigModule,
    StoreModule,
    AuthModule,
    ProgressModule,
    RewardModule,
    EventModule,
    OpsModule,
    AiModule,
    ActionModule,
    ContentModule,
    MeModule,
    DialogueModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthContextMiddleware).forRoutes('*');
  }
}
