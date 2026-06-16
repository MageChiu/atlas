import { Controller, Get } from '@nestjs/common';

/**
 * B0 - 健康检查。
 */
@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
