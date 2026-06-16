/**
 * 用户账户模型（认证系统）
 * 注意：仅 PublicUser 可对外返回；密码哈希等敏感字段不进契约层，仅后端内部使用。
 */

/** 对外暴露的用户信息（绝不含密码相关字段） */
export interface PublicUser {
  id: string;
  username: string;
  nickname: string;
  createdAt: string;
}
