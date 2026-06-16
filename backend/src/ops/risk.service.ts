import { Injectable } from '@nestjs/common';

/**
 * B5.2 - 审核与风控壳。
 * MVP 阶段为占位实现：基于简单规则判定；命中规则返回 false（上层抛 RISK_BLOCKED）。
 * 真实接入时替换为图片/文本审核服务调用。
 */
@Injectable()
export class RiskService {
  /** 图片审核入口：返回 true 表示通过 */
  checkImage(file: { originalname: string; mimetype: string; size: number }): boolean {
    // 占位规则：文件名包含 blocked 视为风险样例，便于联调验证拦截。
    return !/blocked/i.test(file.originalname);
  }

  /** 文本审核入口：返回 true 表示通过 */
  checkText(text: string): boolean {
    return !/blocked/i.test(text);
  }
}
