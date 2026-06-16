/**
 * C2.1 - 内容模型
 * 依据 docs/Atlas-路过-数据模型设计.md 第 3 节。
 * 约束：字符串主键、状态枚举、扩展字段保留 JSON 能力、配置实体与用户实体分离。
 */

import type {
  ActionTriggerMode,
  ActionType,
  AITemplateType,
  RegionChildType,
  RegionStatus,
  RegionType,
  RewardType,
  SpotStatus,
} from '../enums.js';

/** 相机配置（从配置读取，不写死在组件） */
export type CameraConfig = Record<string, any>;

/** 地理经纬度（WGS84） */
export interface GeoPoint {
  lng: number;
  lat: number;
}

/** 地图底图覆盖的经纬度边界框（用于经纬度→像素投影） */
export interface GeoBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** 底图像素尺寸（投影与比例校验用） */
export interface MapSize {
  width: number;
  height: number;
}

/**
 * 区域图（DAG）的一条包含边：父 Region 直接包含的一个子节点。
 * 归属关系由父节点声明（而非子节点持 parentId），因此：
 * - 同一个子节点（refId）可出现在多个父 Region 的 children 中 → 多父挂载、跨区域归属（如一座山属于两个地区）；
 * - 子实体只存一份，不复制；约束为无环（DAG）。
 */
export interface RegionChildRef {
  refType: RegionChildType;
  refId: string;
  /** 在父区域底图上的展示坐标（可选，缺则由前端布局/投影决定） */
  coord?: SpotCoord;
  /** 在父区域内的展示顺序 */
  orderIndex?: number;
}

/** 区域 / 城市 / 主题地图 —— 区域图 DAG 的节点，可递归下钻 */
export interface Region {
  id: string;
  name: string;
  type: RegionType;
  status: RegionStatus;
  mapAsset: string;
  cameraConfig: CameraConfig;
  entryAnimation?: string;
  unlockRules?: Record<string, any>;
  /**
   * 直接包含的子节点边列表（子 Region 与/或 Spot 混合）。
   * 有子 Region → 该区域为可继续下钻的容器；有 Spot → 该区域为可进入景点的叶子。
   * 两者可并存。同一 refId 也可被其他 Region 的 children 引用（DAG 多父）。
   */
  children?: RegionChildRef[];
  /** 区域中心/代表点经纬度（WGS84）；用于在父区域底图上投影定位本区域节点 */
  geo?: GeoPoint;
  /** 地图底图覆盖的经纬度范围（方案 B：景点按真实经纬度投影定位） */
  geoBounds?: GeoBounds;
  /** 地图底图像素尺寸 */
  mapSize?: MapSize;
}

/** 景点坐标 */
export interface SpotCoord {
  x: number;
  y: number;
}

/** 景点对话收获触发点（归景点侧；聊到 topicHints 即点亮 reward，不影响主进度链） */
export interface DialogueRewardTrigger {
  /** 触发点 id（景点内唯一） */
  id: string;
  /** 命中判定关键词/主题（聊到即点亮） */
  topicHints: string[];
  /** 复用现有 Reward.id */
  rewardId: string;
  /** 给用户的引导文案 */
  hint?: string;
}

/** 景点 */
export interface Spot {
  id: string;
  /**
   * 主归属区域 id（景点的"老家"，用于资产/进度归属）。
   * 跨区域的展示挂载由各父 Region.children 边表达，不依赖此字段。
   */
  regionId: string;
  name: string;
  title: string;
  description?: string;
  /** 抽象像素坐标（无经纬度时的兜底定位） */
  coord: SpotCoord;
  /** 真实地理经纬度（方案 B：优先用此值投影到底图） */
  geo?: GeoPoint;
  coverAsset?: string;
  sceneAsset?: string;
  tags?: string[];
  status: SpotStatus;
  orderIndex?: number;
  unlockCondition?: Record<string, any>;
  /** 绑定的 NPC id（可多个，含 fallback 如 npc_passerby；对话系统） */
  npcIds?: string[];
  /** 景点专属对话收获触发点（归景点侧） */
  dialogueRewards?: DialogueRewardTrigger[];
}

/** 景点内可执行动作 */
export interface Action {
  id: string;
  spotId: string;
  type: ActionType;
  name: string;
  icon?: string;
  displayOrder?: number;
  unlockCondition?: Record<string, any>;
  /** 冷却时间（秒） */
  cooldown?: number;
  triggerMode?: ActionTriggerMode;
  /** 绑定事件池 id */
  bindEventPool?: string;
  /** 绑定 AI 模板 id */
  bindAiTemplate?: string;
  /** 奖励策略标识 */
  rewardStrategy?: string;
}

/** 事件选项分支 */
export type EventChoice = Record<string, any>;

/** 事件（Action 的结果承载体） */
export interface GameEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  triggerCondition?: Record<string, any>;
  weight?: number;
  onceOnly?: boolean;
  uiTemplate?: string;
  choices?: EventChoice[];
  resultPayload?: Record<string, any>;
  rewardPayload?: Record<string, any>;
}

/** 事件池 */
export interface EventPool {
  id: string;
  name?: string;
  eventIds: string[];
}

/** 奖励 */
export interface Reward {
  id: string;
  type: RewardType;
  name: string;
  rarity?: string;
  asset?: string;
  grantRule?: Record<string, any>;
}

/** AI 模板 */
export interface AITemplate {
  id: string;
  templateType: AITemplateType;
  name: string;
  scenePrompt?: string;
  stylePrompt?: string;
  negativePrompt?: string;
  inputRequirements?: Record<string, any>;
  outputSchema?: Record<string, any>;
  safetyRule?: Record<string, any>;
}
