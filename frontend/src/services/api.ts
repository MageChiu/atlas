import { ApiRoutes } from '@atlas/shared';
import type {
  AchievementsData,
  AITaskResultData,
  AITaskStatusData,
  CheckInData,
  CollectionsData,
  DialogueSessionData,
  ExecuteActionData,
  GeneratedAssetsData,
  PhotoGenerateData,
  PhotoGenerateRequest,
  RegionDetailData,
  SayData,
  SpotActionsData,
  SpotDetailData,
  StartDialogueData,
  UploadImageData,
  WorldData,
} from '@atlas/shared';
import { APP_CONFIG } from '@/config';
import { httpClient } from './httpClient';
import { mockApi } from './mock/mockApi';
import { genRequestId } from '@/utils/id';

/**
 * F0.5 / F7.1 - API 门面
 * 统一对外暴露领域接口；根据 NEXT_PUBLIC_USE_MOCK 在 Mock 与真实 HTTP 间切换，
 * 两端结构保持一致（依据 C3 协议契约），联调阶段切换无需改调用方。
 */
const useMock = APP_CONFIG.useMock;

export const api = {
  // ---- 内容查询 ----
  getWorld: (): Promise<WorldData> =>
    useMock ? mockApi.getWorld() : httpClient.get(ApiRoutes.world()),

  getRegion: (regionId: string): Promise<RegionDetailData> =>
    useMock ? mockApi.getRegion(regionId) : httpClient.get(ApiRoutes.region(regionId)),

  getSpot: (spotId: string): Promise<SpotDetailData> =>
    useMock ? mockApi.getSpot(spotId) : httpClient.get(ApiRoutes.spot(spotId)),

  getSpotActions: (spotId: string): Promise<SpotActionsData> =>
    useMock
      ? mockApi.getSpotActions(spotId)
      : httpClient.get(ApiRoutes.spotActions(spotId)),

  // ---- 行为 ----
  checkIn: (spotId: string): Promise<CheckInData> =>
    useMock
      ? mockApi.checkIn(spotId)
      : httpClient.post(ApiRoutes.checkIn(spotId), { requestId: genRequestId() }),

  executeAction: (actionId: string): Promise<ExecuteActionData> =>
    useMock
      ? mockApi.executeAction(actionId)
      : httpClient.post(ApiRoutes.executeAction(actionId), {
          requestId: genRequestId(),
        }),

  // ---- AI ----
  uploadImage: (file: File): Promise<UploadImageData> => {
    if (useMock) return mockApi.uploadImage();
    const form = new FormData();
    form.append('file', file);
    return httpClient.upload(ApiRoutes.uploadImage(), form);
  },

  photoGenerate: (req: PhotoGenerateRequest): Promise<PhotoGenerateData> =>
    useMock
      ? mockApi.photoGenerate(req)
      : httpClient.post(ApiRoutes.photoGenerate(), {
          ...req,
          requestId: genRequestId(),
        }),

  getTask: (taskId: string): Promise<AITaskStatusData> =>
    useMock ? mockApi.getTask(taskId) : httpClient.get(ApiRoutes.aiTask(taskId)),

  getResult: (taskId: string): Promise<AITaskResultData> =>
    useMock ? mockApi.getResult(taskId) : httpClient.get(ApiRoutes.aiResult(taskId)),

  // ---- 用户资产 ----
  getCollections: (): Promise<CollectionsData> =>
    useMock ? mockApi.getCollections() : httpClient.get(ApiRoutes.collections()),

  getGeneratedAssets: (): Promise<GeneratedAssetsData> =>
    useMock
      ? mockApi.getGeneratedAssets()
      : httpClient.get(ApiRoutes.generatedAssets()),

  getAchievements: (): Promise<AchievementsData> =>
    useMock ? mockApi.getAchievements() : httpClient.get(ApiRoutes.achievements()),

  // ---- NPC 对话 ----
  startDialogue: (req: {
    spotId: string;
    npcId?: string;
  }): Promise<StartDialogueData> =>
    useMock
      ? mockApi.startDialogue(req)
      : httpClient.post(ApiRoutes.dialogueStart(), {
          ...req,
          requestId: genRequestId(),
        }),

  say: (sessionId: string, message: string): Promise<SayData> =>
    useMock
      ? mockApi.say(sessionId, message)
      : httpClient.post(ApiRoutes.dialogueSay(sessionId), {
          message,
          requestId: genRequestId(),
        }),

  getDialogueSession: (sessionId: string): Promise<DialogueSessionData> =>
    useMock
      ? mockApi.getDialogueSession(sessionId)
      : httpClient.get(ApiRoutes.dialogueSession(sessionId)),
};

export type Api = typeof api;
