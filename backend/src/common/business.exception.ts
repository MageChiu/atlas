import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessage } from '@atlas/shared';

/**
 * C3.1 / C4 - 业务异常：携带统一 ErrorCode。
 * 由 BusinessExceptionFilter 转换为 { success:false, code, message }。
 */
export class BusinessException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message ?? ErrorMessage[code], status);
    this.code = code;
  }
}
