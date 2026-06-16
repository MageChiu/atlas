'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

/**
 * F2 / 9.1 - 内容查询 hooks（TanStack Query）
 * query 维度：world / regionDetail / spotDetail / spotActions。
 */

export const queryKeys = {
  world: ['world'] as const,
  region: (id: string) => ['region', id] as const,
  spot: (id: string) => ['spot', id] as const,
  spotActions: (id: string) => ['spotActions', id] as const,
  collections: ['collections'] as const,
  generatedAssets: ['generatedAssets'] as const,
  achievements: ['achievements'] as const,
};

export function useWorld() {
  return useQuery({ queryKey: queryKeys.world, queryFn: () => api.getWorld() });
}

export function useRegion(regionId: string | null) {
  return useQuery({
    queryKey: regionId ? queryKeys.region(regionId) : ['region', 'none'],
    queryFn: () => api.getRegion(regionId as string),
    enabled: !!regionId,
  });
}

export function useSpot(spotId: string | null) {
  return useQuery({
    queryKey: spotId ? queryKeys.spot(spotId) : ['spot', 'none'],
    queryFn: () => api.getSpot(spotId as string),
    enabled: !!spotId,
  });
}

export function useSpotActions(spotId: string | null) {
  return useQuery({
    queryKey: spotId ? queryKeys.spotActions(spotId) : ['spotActions', 'none'],
    queryFn: () => api.getSpotActions(spotId as string),
    enabled: !!spotId,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: queryKeys.collections,
    queryFn: () => api.getCollections(),
  });
}

export function useGeneratedAssets() {
  return useQuery({
    queryKey: queryKeys.generatedAssets,
    queryFn: () => api.getGeneratedAssets(),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => api.getAchievements(),
  });
}
