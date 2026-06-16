import { create } from 'zustand';
import type { UserRegionProgress, UserSpotProgress } from '@atlas/shared';

/**
 * progressStore - 用户进度缓存
 * 缓存区域/景点进度，便于场景层即时反馈解锁与探索度。
 */
interface ProgressState {
  regionProgress: Record<string, UserRegionProgress>;
  spotProgress: Record<string, UserSpotProgress>;
  setRegionProgress: (p: UserRegionProgress) => void;
  setSpotProgress: (p: UserSpotProgress) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  regionProgress: {},
  spotProgress: {},
  setRegionProgress: (p) =>
    set((s) => ({ regionProgress: { ...s.regionProgress, [p.regionId]: p } })),
  setSpotProgress: (p) =>
    set((s) => ({ spotProgress: { ...s.spotProgress, [p.spotId]: p } })),
}));
