/**
 * API 路由常量（前后端共用，避免硬编码路径漂移）
 * 依据 docs/Atlas-路过-API协议说明.md。
 */

export const ApiRoutes = {
  // 认证
  register: () => '/api/auth/register',
  login: () => '/api/auth/login',
  logout: () => '/api/auth/logout',
  authMe: () => '/api/auth/me',
  // 内容查询
  world: () => '/api/world',
  region: (regionId: string) => `/api/regions/${regionId}`,
  spot: (spotId: string) => `/api/spots/${spotId}`,
  spotActions: (spotId: string) => `/api/spots/${spotId}/actions`,
  // 行为
  checkIn: (spotId: string) => `/api/spots/${spotId}/check-in`,
  executeAction: (actionId: string) => `/api/actions/${actionId}/execute`,
  // AI
  uploadImage: () => '/api/uploads/image',
  photoGenerate: () => '/api/ai/photo-generate',
  aiTask: (taskId: string) => `/api/ai/tasks/${taskId}`,
  aiResult: (taskId: string) => `/api/ai/results/${taskId}`,
  // NPC 对话
  dialogueStart: () => '/api/dialogue/start',
  dialogueSay: (sessionId: string) => `/api/dialogue/${sessionId}/say`,
  dialogueSession: (sessionId: string) => `/api/dialogue/${sessionId}`,
  // 用户资产
  collections: () => '/api/me/collections',
  generatedAssets: () => '/api/me/generated-assets',
  achievements: () => '/api/me/achievements',
} as const;
