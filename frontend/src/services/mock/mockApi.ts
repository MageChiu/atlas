import {
  ActionType,
  AITaskStatus,
  AITaskType,
  DialogueRole,
  DialogueStatus,
  GeneratedAssetType,
  RegionChildType,
  SpotStatus,
  seedDataset,
} from '@atlas/shared';
import type {
  AchievementsData,
  Action,
  ActionWithState,
  AITask,
  AITaskResult,
  AITaskResultData,
  AITaskStatusData,
  CheckInData,
  CollectionEntry,
  CollectionsData,
  DialogueMessage,
  DialogueRewardGrant,
  DialogueSessionData,
  ExecuteActionData,
  GameEvent,
  GeneratedAssetsData,
  NpcPublic,
  PhotoGenerateData,
  PhotoGenerateRequest,
  Region,
  RegionDetailData,
  Reward,
  SayData,
  Spot,
  SpotActionsData,
  SpotDetailData,
  StartDialogueData,
  UploadImageData,
  UserGeneratedAsset,
  UserSpotProgress,
  WorldData,
} from '@atlas/shared';

/**
 * F0.5 / C5 - Mock 服务
 * 基于 shared 种子数据返回 world/region/spot/actions，
 * 并以内存维护用户态（进度、冷却、奖励、生成资产、AI 任务）。
 * 与后端真实接口结构保持一致，阶段 C 可平滑切换。
 */

const MOCK_USER_ID = 'mock-user';

interface MockDialogueSession {
  id: string;
  spotId: string;
  npcId: string;
  status: DialogueStatus;
  messages: DialogueMessage[];
  grantedTriggerIds: string[];
}

interface MockState {
  spotProgress: Record<string, UserSpotProgress>;
  actionLastExecAt: Record<string, number>; // actionId -> timestamp(ms)
  obtainedRewards: Record<string, string>; // rewardId -> obtainedAt(iso)
  generatedAssets: UserGeneratedAsset[];
  tasks: Record<string, AITask>;
  taskResults: Record<string, AITaskResult>;
  onceFiredEvents: Record<string, boolean>;
  dialogues: Record<string, MockDialogueSession>;
}

const state: MockState = {
  spotProgress: {},
  actionLastExecAt: {},
  obtainedRewards: {},
  generatedAssets: [],
  tasks: {},
  taskResults: {},
  onceFiredEvents: {},
  dialogues: {},
};

/**
 * Mock NPC 公开信息 + 开场白。
 * 真实后端从 resources/skills/{id}.skill.json 读盘；Mock 内置等价的公开字段
 * （knowledge/guardrails 不下发，保持与契约一致）。
 */
const MOCK_NPCS: Record<string, NpcPublic & { opening: string }> = {
  npc_dufu: {
    id: 'npc_dufu',
    name: '杜甫',
    avatar: 'npc/npc_dufu/avatar.png',
    opening:
      '客从远方来，浣花溪畔风正清。老夫杜甫，流寓于此草堂，闲来煮茶论诗。足下若有兴致，且坐下聊聊。',
  },
  npc_passerby: {
    id: 'npc_passerby',
    name: '路人',
    avatar: 'npc/npc_passerby/avatar.png',
    opening:
      '哎，巴适得很嘛！你也是来耍的撒？这个地方我熟得很，想晓得啥子尽管问我噻。',
  },
};

const delay = (ms = 240) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

function findSpot(spotId: string): Spot | undefined {
  return seedDataset.spots.find((s) => s.id === spotId);
}
function findAction(actionId: string): Action | undefined {
  return seedDataset.actions.find((a) => a.id === actionId);
}
function findReward(rewardId: string): Reward | undefined {
  return seedDataset.rewards.find((r) => r.id === rewardId);
}

function ensureSpotProgress(spotId: string): UserSpotProgress {
  if (!state.spotProgress[spotId]) {
    state.spotProgress[spotId] = {
      userId: MOCK_USER_ID,
      spotId,
      unlocked: findSpot(spotId)?.status !== SpotStatus.Locked,
      visitCount: 0,
      actionCount: 0,
      updatedAt: now(),
    };
  }
  return state.spotProgress[spotId];
}

function cooldownRemaining(action: Action): number {
  if (!action.cooldown) return 0;
  const last = state.actionLastExecAt[action.id];
  if (!last) return 0;
  const passed = (Date.now() - last) / 1000;
  return Math.max(0, Math.ceil(action.cooldown - passed));
}

function toActionWithState(action: Action): ActionWithState {
  const remaining = cooldownRemaining(action);
  return {
    ...action,
    available: remaining === 0,
    cooldownRemaining: remaining,
  };
}

function grantReward(rewardId: string): Reward | null {
  const reward = findReward(rewardId);
  if (!reward) return null;
  if (!state.obtainedRewards[rewardId]) {
    state.obtainedRewards[rewardId] = now();
  }
  return reward;
}

/** 从事件池按权重挑一个事件 */
function pickEvent(poolId: string): GameEvent | null {
  const pool = seedDataset.eventPools.find((p) => p.id === poolId);
  if (!pool) return null;
  const candidates = pool.eventIds
    .map((id) => seedDataset.events.find((e) => e.id === id))
    .filter((e): e is GameEvent => !!e)
    .filter((e) => !(e.onceOnly && state.onceFiredEvents[e.id]));
  if (candidates.length === 0) return null;
  const total = candidates.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const e of candidates) {
    roll -= e.weight ?? 1;
    if (roll <= 0) {
      if (e.onceOnly) state.onceFiredEvents[e.id] = true;
      return e;
    }
  }
  return candidates[0];
}

/** 选取 NPC：指定优先；否则 spot.npcIds 中签名(非 passerby)优先，回退 passerby/首个 */
function pickNpcId(spot: Spot, preferred?: string): string {
  const ids = spot.npcIds ?? [];
  if (preferred && (ids.length === 0 || ids.includes(preferred))) return preferred;
  const signature = ids.find((id) => id !== 'npc_passerby');
  return signature ?? ids[0] ?? 'npc_passerby';
}

/** Mock NPC 回复：尽量复述命中知识点，便于演示收获触发 */
function mockNpcReply(
  npcId: string,
  message: string,
  grants: DialogueRewardGrant[],
): string {
  if (grants.length > 0) {
    if (npcId === 'npc_dufu') {
      return `（捻须微笑）足下也读过此篇。老夫这首诗，正是当年在这草堂所作，承蒙记得。${grants
        .map((g) => `〔${g.reward.name}〕`)
        .join('')}`;
    }
    return `嘿，你这个话题安逸！算你识货，这个给你耍噻。${grants
      .map((g) => `〔${g.reward.name}〕`)
      .join('')}`;
  }
  if (npcId === 'npc_dufu') {
    return `（沉吟片刻）「${message}」……老夫漂泊半生，所见所感皆入诗中。足下不妨细问草堂旧事、或老夫所作诗篇。`;
  }
  return `「${message}」啊，这个嘛……成都好耍的多得很，吃的喝的耍的，你想晓得啥子尽管问噻。`;
}

export const mockApi = {
  async getWorld(): Promise<WorldData> {
    await delay();
    // World 入口只展示顶层区域（区域图 DAG 根集合），不再平铺所有区域
    const rootIds = seedDataset.worldRootRegionIds;
    const regions = rootIds
      .map((id) => seedDataset.regions.find((r) => r.id === id))
      .filter((r): r is Region => !!r);
    return { regions };
  },

  async getRegion(regionId: string): Promise<RegionDetailData> {
    await delay();
    const region = seedDataset.regions.find((r) => r.id === regionId);
    if (!region) throw new Error(`region not found: ${regionId}`);

    // children 边按 orderIndex 排序后，分别解析子区域与景点（DAG）
    const edges = [...(region.children ?? [])].sort(
      (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
    );
    const childRegions = edges
      .filter((c) => c.refType === RegionChildType.Region)
      .map((c) => seedDataset.regions.find((r) => r.id === c.refId))
      .filter((r): r is Region => !!r);
    const spotEdges = edges.filter((c) => c.refType === RegionChildType.Spot);
    const spots =
      spotEdges.length > 0
        ? spotEdges
            .map((c) => seedDataset.spots.find((s) => s.id === c.refId))
            .filter((s): s is Spot => !!s)
        : // 无显式 spot 边时回退：按主归属 regionId 过滤
          seedDataset.spots.filter((s) => s.regionId === regionId);

    return { region, childRegions, spots };
  },

  async getSpot(spotId: string): Promise<SpotDetailData> {
    await delay();
    const spot = findSpot(spotId);
    if (!spot) throw new Error(`spot not found: ${spotId}`);
    const actions = seedDataset.actions.filter((a) => a.spotId === spotId);
    const progress = ensureSpotProgress(spotId);
    progress.visitCount += 1;
    progress.firstVisitedAt = progress.firstVisitedAt ?? now();
    progress.updatedAt = now();
    return { spot, actions, progress };
  },

  async getSpotActions(spotId: string): Promise<SpotActionsData> {
    await delay(120);
    const actions = seedDataset.actions
      .filter((a) => a.spotId === spotId)
      .map(toActionWithState);
    return { actions };
  },

  async checkIn(spotId: string): Promise<CheckInData> {
    await delay();
    const progress = ensureSpotProgress(spotId);
    const firstTime = !state.obtainedRewards['reward_badge_first_visit'];
    const reward: Reward[] = [];
    if (firstTime) {
      const r = grantReward('reward_badge_first_visit');
      if (r) reward.push(r);
    }
    progress.actionCount += 1;
    progress.updatedAt = now();
    return { spotId, checkedIn: true, reward, progress };
  },

  async executeAction(actionId: string): Promise<ExecuteActionData> {
    await delay();
    const action = findAction(actionId);
    if (!action) throw new Error(`action not found: ${actionId}`);

    const progress = ensureSpotProgress(action.spotId);
    progress.actionCount += 1;
    progress.updatedAt = now();
    state.actionLastExecAt[actionId] = Date.now();

    let event: GameEvent | null = null;
    const reward: Reward[] = [];
    let aiTask: AITask | null = null;

    // check_in：发放首次徽章
    if (action.type === ActionType.CheckIn) {
      if (!state.obtainedRewards['reward_badge_first_visit']) {
        const r = grantReward('reward_badge_first_visit');
        if (r) reward.push(r);
      }
    }

    // random_event / encounter：抽事件池
    if (action.bindEventPool) {
      event = pickEvent(action.bindEventPool);
      const rewardIds: string[] = event?.rewardPayload?.rewardIds ?? [];
      for (const id of rewardIds) {
        const r = grantReward(id);
        if (r) reward.push(r);
      }
    }

    // photo / encounter 绑定 AI 模板：创建异步任务
    if (action.bindAiTemplate && action.type !== ActionType.RandomEvent) {
      aiTask = this.createTask(action.bindAiTemplate, AITaskType.EncounterGenerate);
    }

    return { actionId, event, reward, aiTask, progress };
  },

  async uploadImage(): Promise<UploadImageData> {
    await delay(400);
    const imageId = `img_${Date.now()}`;
    return {
      imageId,
      url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=uploaded%20portrait%20placeholder&image_size=square',
    };
  },

  async photoGenerate(req: PhotoGenerateRequest): Promise<PhotoGenerateData> {
    await delay();
    const task = this.createTask(req.templateId, AITaskType.PhotoGenerate, req.imageId);
    return { taskId: task.id, status: task.status };
  },

  async getTask(taskId: string): Promise<AITaskStatusData> {
    await delay(150);
    const task = this.advanceTask(taskId);
    return { task };
  },

  async getResult(taskId: string): Promise<AITaskResultData> {
    await delay(150);
    const task = this.advanceTask(taskId);
    return {
      status: task.status,
      result: state.taskResults[taskId] ?? null,
    };
  },

  async getCollections(): Promise<CollectionsData> {
    await delay();
    const collections: CollectionEntry[] = seedDataset.rewards.map((reward) => ({
      reward,
      obtained: !!state.obtainedRewards[reward.id],
      obtainedAt: state.obtainedRewards[reward.id],
    }));
    return { collections };
  },

  async getGeneratedAssets(): Promise<GeneratedAssetsData> {
    await delay();
    return { assets: [...state.generatedAssets].reverse() };
  },

  async getAchievements(): Promise<AchievementsData> {
    await delay();
    const checkedInCount = Object.values(state.spotProgress).filter(
      (p) => p.actionCount > 0,
    ).length;
    return {
      achievements: [
        {
          id: 'ach_first_step',
          name: '初次启程',
          description: '完成第一次景点动作',
          unlocked: checkedInCount > 0,
          unlockedAt: checkedInCount > 0 ? now() : undefined,
        },
        {
          id: 'ach_explorer',
          name: '成都漫游者',
          description: '在 3 个以上景点留下足迹',
          unlocked: checkedInCount >= 3,
        },
      ],
    };
  },

  // ---- NPC 对话（与后端 dialogue 接口结构一致；knowledge/guardrails 不下发）----
  async startDialogue(req: {
    spotId: string;
    npcId?: string;
  }): Promise<StartDialogueData> {
    await delay();
    const spot = findSpot(req.spotId);
    if (!spot) throw new Error(`spot not found: ${req.spotId}`);
    const npcId = pickNpcId(spot, req.npcId);
    const npc = MOCK_NPCS[npcId];
    if (!npc) throw new Error(`npc not found: ${npcId}`);

    const sessionId = `dlg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const opening: DialogueMessage = {
      role: DialogueRole.Npc,
      content: npc.opening,
      at: now(),
    };
    state.dialogues[sessionId] = {
      id: sessionId,
      spotId: req.spotId,
      npcId,
      status: DialogueStatus.Active,
      messages: [opening],
      grantedTriggerIds: [],
    };
    return {
      sessionId,
      npc: { id: npc.id, name: npc.name, avatar: npc.avatar },
      opening,
    };
  },

  async say(sessionId: string, message: string): Promise<SayData> {
    await delay(600);
    const session = state.dialogues[sessionId];
    if (!session) throw new Error(`dialogue session not found: ${sessionId}`);

    const userMsg: DialogueMessage = {
      role: DialogueRole.User,
      content: message,
      at: now(),
    };
    session.messages.push(userMsg);

    // 收获判定：命中 spot.dialogueRewards.topicHints（匹配用户输入）且未发过 → 发奖
    const spot = findSpot(session.spotId);
    const grants: DialogueRewardGrant[] = [];
    for (const trigger of spot?.dialogueRewards ?? []) {
      if (session.grantedTriggerIds.includes(trigger.id)) continue;
      const hit = trigger.topicHints.some((h) => message.includes(h));
      if (!hit) continue;
      const reward = grantReward(trigger.rewardId);
      if (reward) {
        session.grantedTriggerIds.push(trigger.id);
        grants.push({ triggerId: trigger.id, reward });
      }
    }

    const reply: DialogueMessage = {
      role: DialogueRole.Npc,
      content: mockNpcReply(session.npcId, message, grants),
      at: now(),
    };
    session.messages.push(reply);

    return { reply, grants, status: session.status };
  },

  async getDialogueSession(sessionId: string): Promise<DialogueSessionData> {
    await delay(120);
    const session = state.dialogues[sessionId];
    if (!session) throw new Error(`dialogue session not found: ${sessionId}`);
    return {
      sessionId: session.id,
      npcId: session.npcId,
      spotId: session.spotId,
      status: session.status,
      messages: session.messages,
      grantedTriggerIds: session.grantedTriggerIds,
    };
  },

  // ---- 内部：AI 任务模拟 ----
  createTask(templateId: string, taskType: AITaskType, inputImageId?: string): AITask {
    const id = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const task: AITask = {
      id,
      userId: MOCK_USER_ID,
      templateId,
      inputImageId,
      taskType,
      status: AITaskStatus.Pending,
      createdAt: now(),
      updatedAt: now(),
    };
    state.tasks[id] = task;
    // 记录创建时间用于模拟推进
    taskCreatedAt[id] = Date.now();
    return task;
  },

  /** 根据创建时长推进任务状态：0~1s pending，1~3s running，>3s success */
  advanceTask(taskId: string): AITask {
    const task = state.tasks[taskId];
    if (!task) throw new Error(`task not found: ${taskId}`);
    if (task.status === AITaskStatus.Success || task.status === AITaskStatus.Failed) {
      return task;
    }
    const elapsed = Date.now() - (taskCreatedAt[taskId] ?? Date.now());
    if (elapsed < 1000) {
      task.status = AITaskStatus.Pending;
    } else if (elapsed < 3000) {
      task.status = AITaskStatus.Running;
    } else {
      task.status = AITaskStatus.Success;
      const outputUrl =
        'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=traditional%20chengdu%20sichuan%20portrait%20cinematic%20warm%20light&image_size=portrait_4_3';
      state.taskResults[taskId] = {
        id: `result_${taskId}`,
        taskId,
        outputUrl,
        outputMeta: { templateId: task.templateId },
        createdAt: now(),
      };
      state.generatedAssets.push({
        id: `asset_${taskId}`,
        userId: MOCK_USER_ID,
        taskId,
        assetType:
          task.taskType === AITaskType.PhotoGenerate
            ? GeneratedAssetType.Photo
            : GeneratedAssetType.Postcard,
        assetUrl: outputUrl,
        createdAt: now(),
      });
    }
    task.updatedAt = now();
    return task;
  },
};

const taskCreatedAt: Record<string, number> = {};

export type MockApi = typeof mockApi;
