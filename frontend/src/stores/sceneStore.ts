import { create } from 'zustand';
import { SceneLevel } from '@atlas/shared';
import type { CameraConfig } from '@atlas/shared';

/**
 * F3.2 / TF04-2 - sceneStore
 * 统一管理地图层级、区域下钻栈、相机状态与转场状态。
 * 区域图为 DAG，可多级下钻（World → 亚洲 → 中国 → 四川 → 成都 → Spot），
 * 因此用 regionStack 表达层级路径；currentRegionId 派生为栈顶。
 * 层级切换由 Scene Runtime 管理，不以页面跳转替代（F3.4）。
 */

/** 相机运行时状态 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  /** 来自配置的相机参数（不写死在组件） */
  config?: CameraConfig;
}

/** 转场状态 */
export interface TransitionState {
  /** 是否处于转场动画中 */
  active: boolean;
  /** 转场方向：enter（下钻）/ back（回退） */
  direction: 'enter' | 'back' | null;
  /** 目标层级 */
  toLevel: SceneLevel | null;
}

interface SceneState {
  currentLevel: SceneLevel;
  /** 区域下钻栈（栈底为顶层区域，栈顶为当前区域） */
  regionStack: string[];
  /** 区域 id → 名称缓存（用于面包屑展示，下钻时累积） */
  regionNames: Record<string, string>;
  /** 当前区域 id（派生：栈顶） */
  currentRegionId: string | null;
  currentSpotId: string | null;
  cameraState: CameraState;
  transitionState: TransitionState;

  setLevel: (level: SceneLevel) => void;
  enterRegion: (regionId: string, name?: string) => void;
  /** 仅登记区域名到缓存（不改变层级/栈），供面包屑补名 */
  setRegionName: (regionId: string, name: string) => void;
  enterSpot: (spotId: string) => void;
  /** 深链入口：把区域栈重置为单一区域（无祖先上下文时） */
  resetToRegion: (regionId: string, name?: string) => void;
  /** 回退一级：Spot→栈顶 Region；Region→出栈一级（空栈回 World） */
  backOneLevel: () => void;
  /** 跳到区域栈指定深度（面包屑点击），depth 为保留的区域层数 */
  goToRegionDepth: (depth: number) => void;
  backToWorld: () => void;
  setCamera: (camera: Partial<CameraState>) => void;
  beginTransition: (direction: 'enter' | 'back', toLevel: SceneLevel) => void;
  endTransition: () => void;
}

const initialCamera: CameraState = { x: 0, y: 0, zoom: 1 };

const top = (stack: string[]): string | null =>
  stack.length > 0 ? stack[stack.length - 1] : null;

const mergeName = (
  names: Record<string, string>,
  id: string,
  name?: string,
): Record<string, string> => (name ? { ...names, [id]: name } : names);

export const useSceneStore = create<SceneState>((set) => ({
  currentLevel: SceneLevel.World,
  regionStack: [],
  regionNames: {},
  currentRegionId: null,
  currentSpotId: null,
  cameraState: initialCamera,
  transitionState: { active: false, direction: null, toLevel: null },

  setLevel: (level) => set({ currentLevel: level }),

  enterRegion: (regionId, name) =>
    set((s) => {
      // 已在栈顶则不重复压栈（幂等，避免 effect 抖动）
      const stack =
        top(s.regionStack) === regionId
          ? s.regionStack
          : [...s.regionStack, regionId];
      return {
        currentLevel: SceneLevel.Region,
        regionStack: stack,
        regionNames: mergeName(s.regionNames, regionId, name),
        currentRegionId: regionId,
        currentSpotId: null,
      };
    }),

  enterSpot: (spotId) =>
    set({ currentLevel: SceneLevel.Spot, currentSpotId: spotId }),

  setRegionName: (regionId, name) =>
    set((s) => ({ regionNames: mergeName(s.regionNames, regionId, name) })),

  resetToRegion: (regionId, name) =>
    set((s) => ({
      currentLevel: SceneLevel.Region,
      regionStack: [regionId],
      regionNames: mergeName(s.regionNames, regionId, name),
      currentRegionId: regionId,
      currentSpotId: null,
    })),

  backOneLevel: () =>
    set((s) => {
      // Spot 层：回到栈顶区域
      if (s.currentLevel === SceneLevel.Spot) {
        return { currentLevel: SceneLevel.Region, currentSpotId: null };
      }
      // Region 层：出栈一级
      const stack = s.regionStack.slice(0, -1);
      if (stack.length === 0) {
        return {
          currentLevel: SceneLevel.World,
          regionStack: [],
          currentRegionId: null,
          currentSpotId: null,
        };
      }
      return {
        currentLevel: SceneLevel.Region,
        regionStack: stack,
        currentRegionId: top(stack),
        currentSpotId: null,
      };
    }),

  goToRegionDepth: (depth) =>
    set((s) => {
      if (depth <= 0) {
        return {
          currentLevel: SceneLevel.World,
          regionStack: [],
          currentRegionId: null,
          currentSpotId: null,
        };
      }
      const stack = s.regionStack.slice(0, depth);
      return {
        currentLevel: SceneLevel.Region,
        regionStack: stack,
        currentRegionId: top(stack),
        currentSpotId: null,
      };
    }),

  backToWorld: () =>
    set({
      currentLevel: SceneLevel.World,
      regionStack: [],
      currentRegionId: null,
      currentSpotId: null,
    }),

  setCamera: (camera) =>
    set((s) => ({ cameraState: { ...s.cameraState, ...camera } })),

  beginTransition: (direction, toLevel) =>
    set({ transitionState: { active: true, direction, toLevel } }),

  endTransition: () =>
    set({ transitionState: { active: false, direction: null, toLevel: null } }),
}));
