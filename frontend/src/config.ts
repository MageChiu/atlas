/** 前端运行时配置（C1.4 环境变量规范） */

export const APP_CONFIG = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  /** 是否启用 Mock 数据：公共部分阶段为 true，联调阶段切 false */
  useMock: (process.env.NEXT_PUBLIC_USE_MOCK ?? 'true') === 'true',
  /** 静态素材基址：素材不打包进服务，本地由独立素材服务托管，上线切对象存储/CDN */
  assetBase: process.env.NEXT_PUBLIC_ASSET_BASE ?? 'http://localhost:4001',
} as const;
