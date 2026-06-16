import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode } from '@atlas/shared';
import type { ApiError } from '@atlas/shared';
import { BusinessException } from './business.exception';

/**
 * C3.1 / C4 - 统一错误返回结构：{ success:false, code, message }。
 * - BusinessException：使用业务 ErrorCode。
 * - 其他 HttpException：按 HTTP 状态映射框架级 code（400/404/...）。
 * - 未知异常：归一为 500 / INTERNAL_ERROR 兜底。
 */
@Catch()
export class BusinessExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(BusinessExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = this.mapHttpStatusToCode(status);
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message as string) ?? exception.message;
      if (Array.isArray(message)) message = message.join('; ');
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = exception.message;
    }

    const body: ApiError = { success: false, code, message };
    response.status(status).json(body);
  }

  /** 框架级 HTTP 状态 → 通用 ErrorCode 兜底 */
  private mapHttpStatusToCode(status: number): ErrorCode {
    if (status === HttpStatus.NOT_FOUND) return ErrorCode.NOT_FOUND;
    if (status >= 400 && status < 500) return ErrorCode.BAD_REQUEST;
    return ErrorCode.INTERNAL_ERROR;
  }
}
