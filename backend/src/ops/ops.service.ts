import { Injectable } from '@nestjs/common';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
}

export interface ActivityConfig {
  id: string;
  name: string;
  enabled: boolean;
  payload?: Record<string, any>;
}

/**
 * B5.1 - 运营开关与活动配置（内存实现）。
 * 提供开关读取，控制活动/模板可用性；后续可由配置中心驱动。
 */
@Injectable()
export class OpsService {
  private readonly featureFlags = new Map<string, FeatureFlag>([
    ['ai_photo_generate', { key: 'ai_photo_generate', enabled: true, description: 'AI 写真生成' }],
    ['encounter_events', { key: 'encounter_events', enabled: true, description: '偶遇事件' }],
  ]);

  private readonly activities = new Map<string, ActivityConfig>([
    ['kyoto_launch', { id: 'kyoto_launch', name: '京都开城', enabled: true }],
  ]);

  isFeatureEnabled(key: string): boolean {
    return this.featureFlags.get(key)?.enabled ?? false;
  }

  listFeatureFlags(): FeatureFlag[] {
    return [...this.featureFlags.values()];
  }

  getActivity(id: string): ActivityConfig | undefined {
    return this.activities.get(id);
  }

  listActivities(): ActivityConfig[] {
    return [...this.activities.values()];
  }
}
