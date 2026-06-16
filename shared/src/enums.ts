/**
 * C4 - 状态枚举集中定义
 * 依据 docs/Atlas-路过-数据模型设计.md 与 API 协议说明。
 * 约束：所有状态值使用枚举，前后端共用。
 */

/** 地图层级（World → Region → Spot → Event Layer） */
export const SceneLevel = {
  World: 'world',
  Region: 'region',
  Spot: 'spot',
  Event: 'event',
} as const;
export type SceneLevel = (typeof SceneLevel)[keyof typeof SceneLevel];

/**
 * Region 类型。
 * 区域是可递归下钻的节点（区域图 DAG），类型不强制对应行政区划，
 * 可按需混用行政层级（continent/country/province/city）与非行政分组（theme，如主题路线/世界遗产线）。
 */
export const RegionType = {
  /** 根/世界层 */
  World: 'world',
  Continent: 'continent',
  Country: 'country',
  Province: 'province',
  City: 'city',
  /** 非行政分组：主题/路线/遗产线等 */
  Theme: 'theme',
} as const;
export type RegionType = (typeof RegionType)[keyof typeof RegionType];

/** Region.children 边指向的子节点类型（区域图 DAG 的边） */
export const RegionChildType = {
  Region: 'region',
  Spot: 'spot',
} as const;
export type RegionChildType = (typeof RegionChildType)[keyof typeof RegionChildType];

/** Region 开放状态 */
export const RegionStatus = {
  Open: 'open',
  ComingSoon: 'coming_soon',
  Hidden: 'hidden',
} as const;
export type RegionStatus = (typeof RegionStatus)[keyof typeof RegionStatus];

/** Spot 状态 */
export const SpotStatus = {
  Open: 'open',
  Locked: 'locked',
  Hidden: 'hidden',
} as const;
export type SpotStatus = (typeof SpotStatus)[keyof typeof SpotStatus];

/** Action 类型（一期支持 4 类） */
export const ActionType = {
  CheckIn: 'check_in',
  Photo: 'photo',
  Encounter: 'encounter',
  RandomEvent: 'random_event',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

/** Action 触发模式 */
export const ActionTriggerMode = {
  Manual: 'manual',
  Auto: 'auto',
} as const;
export type ActionTriggerMode = (typeof ActionTriggerMode)[keyof typeof ActionTriggerMode];

/** 奖励类型 */
export const RewardType = {
  Badge: 'badge',
  Item: 'item',
  Card: 'card',
  Photo: 'photo',
  Frame: 'frame',
} as const;
export type RewardType = (typeof RewardType)[keyof typeof RewardType];

/** AI 模板类型 */
export const AITemplateType = {
  Photo: 'photo',
  Encounter: 'encounter',
  Postcard: 'postcard',
} as const;
export type AITemplateType = (typeof AITemplateType)[keyof typeof AITemplateType];

/** AI 任务类型 */
export const AITaskType = {
  PhotoGenerate: 'photo_generate',
  EncounterGenerate: 'encounter_generate',
} as const;
export type AITaskType = (typeof AITaskType)[keyof typeof AITaskType];

/** AI 任务状态 */
export const AITaskStatus = {
  Pending: 'pending',
  Running: 'running',
  Success: 'success',
  Failed: 'failed',
} as const;
export type AITaskStatus = (typeof AITaskStatus)[keyof typeof AITaskStatus];

/** 上传图片状态 */
export const UploadedImageStatus = {
  Uploaded: 'uploaded',
  Blocked: 'blocked',
  Expired: 'expired',
} as const;
export type UploadedImageStatus =
  (typeof UploadedImageStatus)[keyof typeof UploadedImageStatus];

/** 生成资产类型 */
export const GeneratedAssetType = {
  Photo: 'photo',
  Postcard: 'postcard',
} as const;
export type GeneratedAssetType = (typeof GeneratedAssetType)[keyof typeof GeneratedAssetType];

/** NPC 类型：签名(真实人物，史实红线高) / 通用(虚构路人，无史实包袱) */
export const NpcKind = {
  Signature: 'signature',
  Generic: 'generic',
} as const;
export type NpcKind = (typeof NpcKind)[keyof typeof NpcKind];

/** 对话会话状态 */
export const DialogueStatus = {
  Active: 'active',
  Ended: 'ended',
} as const;
export type DialogueStatus = (typeof DialogueStatus)[keyof typeof DialogueStatus];

/** 对话消息角色 */
export const DialogueRole = {
  Npc: 'npc',
  User: 'user',
} as const;
export type DialogueRole = (typeof DialogueRole)[keyof typeof DialogueRole];
