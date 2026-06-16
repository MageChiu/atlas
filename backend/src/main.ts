import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { BusinessExceptionFilter } from './common/business-exception.filter';
import { AppConfigService } from './config/app-config.service';

/**
 * B0 - 应用启动入口。
 * 全局生效：统一成功包络拦截器 + 统一错误码过滤器 + CORS。
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new BusinessExceptionFilter());

  const config = app.get(AppConfigService);
  await app.listen(config.port, config.host);
  const shown = config.host === '0.0.0.0' ? 'localhost' : config.host;
  new Logger('Bootstrap').log(
    `Atlas backend listening on http://${shown}:${config.port} (bind ${config.host}:${config.port})`,
  );
}

void bootstrap();
