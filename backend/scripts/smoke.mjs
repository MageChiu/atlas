/**
 * B6 - 主闭环冒烟验证脚本（零外部依赖）。
 * 依次验证：health -> world -> region -> spot -> actions -> check-in(幂等)
 *          -> execute(随机事件/奖励) -> upload -> photo-generate -> 轮询 task/result
 *          -> me/collections / generated-assets / achievements -> 错误码用例。
 * 用法：先 npm run start，再 node scripts/smoke.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const USER = 'user_smoke';
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

async function call(method, path, { body, json, raw } = {}) {
  const headers = { 'x-user-id': USER };
  let payload;
  if (raw) {
    payload = raw;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('== health ==');
  let r = await call('GET', '/health');
  assert(r.data?.success && r.data.data.status === 'ok', 'health ok');

  console.log('== world (DAG roots) ==');
  r = await call('GET', '/api/world');
  assert(r.data?.success && Array.isArray(r.data.data.regions), 'world returns regions');
  const rootIds = r.data.data.regions.map((x) => x.id);
  assert(rootIds.length === 1 && rootIds[0] === 'region_asia', `world roots = ['region_asia'] (got ${JSON.stringify(rootIds)})`);

  console.log('== region DAG drill-down ==');
  // 沿 childRegions 下钻到含景点的叶子区域
  let regionId = rootIds[0];
  let spots = [];
  let guard = 0;
  while (guard++ < 10) {
    r = await call('GET', `/api/regions/${regionId}`);
    assert(r.data?.success && r.data.data.region.id === regionId, `region detail ok (${regionId})`);
    assert(Array.isArray(r.data.data.childRegions), 'region detail has childRegions');
    spots = r.data.data.spots ?? [];
    if (spots.length > 0) break;
    const child = r.data.data.childRegions[0];
    assert(!!child, `container ${regionId} has child region`);
    regionId = child.id;
  }
  assert(spots.length > 0, `drilled down to leaf region ${regionId} with ${spots.length} spots`);

  console.log('== multi-parent mount (heritage shares chengdu spots) ==');
  r = await call('GET', '/api/regions/region_sichuan');
  const sichuanChildren = (r.data?.data?.childRegions ?? []).map((x) => x.id);
  assert(
    sichuanChildren.includes('region_chengdu') && sichuanChildren.includes('region_qingcheng_dujiangyan_heritage'),
    `sichuan childRegions = [chengdu, heritage] (got ${JSON.stringify(sichuanChildren)})`,
  );
  assert((r.data?.data?.spots ?? []).length === 0, 'container region_sichuan has no direct spots');
  r = await call('GET', '/api/regions/region_qingcheng_dujiangyan_heritage');
  const heritageSpots = (r.data?.data?.spots ?? []).map((x) => x.id);
  assert(
    heritageSpots.includes('spot_dujiangyan') && heritageSpots.includes('spot_qingcheng_mountain'),
    `heritage spots include dujiangyan & qingcheng (multi-parent) (got ${JSON.stringify(heritageSpots)})`,
  );

  console.log('== spot detail + actions ==');
  const openSpot = spots.find((s) => s.status === 'open') ?? spots[0];
  assert(!!openSpot, `open spot = ${openSpot?.id}`);
  r = await call('GET', `/api/spots/${openSpot.id}`);
  assert(r.data?.success && r.data.data.spot.id === openSpot.id, 'spot detail ok');
  r = await call('GET', `/api/spots/${openSpot.id}/actions`);
  assert(r.data?.success && r.data.data.actions.length > 0, 'spot actions ok');
  const actions = r.data.data.actions;
  const checkinAction = actions.find((a) => a.type === 'check_in');
  const randomAction = actions.find((a) => a.type === 'random_event');
  const photoAction = actions.find((a) => a.type === 'photo');

  console.log('== check-in idempotency ==');
  r = await call('POST', `/api/spots/${openSpot.id}/check-in`, {
    body: { requestId: 'req_checkin_1' },
  });
  assert(r.data?.success && r.data.data.checkedIn, 'first check-in ok');
  const firstReward = r.data.data.reward.length;
  assert(firstReward >= 1, `first check-in granted ${firstReward} reward`);
  r = await call('POST', `/api/spots/${openSpot.id}/check-in`, {
    body: { requestId: 'req_checkin_1' },
  });
  assert(r.data?.success && r.data.data.reward.length === 0, 'repeat check-in grants no reward (idempotent)');

  console.log('== execute random_event ==');
  if (randomAction) {
    r = await call('POST', `/api/actions/${randomAction.id}/execute`, {
      body: { requestId: 'req_exec_random_1' },
    });
    assert(r.data?.success && r.data.data.actionId === randomAction.id, 'execute returns unified structure');
    assert('event' in r.data.data && 'reward' in r.data.data && 'aiTask' in r.data.data && 'progress' in r.data.data, 'execute has {event,reward,aiTask,progress}');
  } else {
    console.log('  (no random_event action on this spot)');
  }

  console.log('== execute photo -> AI task ==');
  let taskId;
  if (photoAction) {
    r = await call('POST', `/api/actions/${photoAction.id}/execute`, {
      body: { requestId: 'req_exec_photo_1' },
    });
    assert(r.data?.success && r.data.data.aiTask, 'photo action creates aiTask');
    taskId = r.data.data.aiTask?.id;
  }

  console.log('== upload + photo-generate ==');
  // 构造 multipart 上传
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), 'photo.png');
  r = await call('POST', '/api/uploads/image', { raw: form });
  assert(r.data?.success && r.data.data.imageId, `upload ok imageId=${r.data?.data?.imageId}`);
  const imageId = r.data.data.imageId;

  r = await call('POST', '/api/ai/photo-generate', {
    body: { templateId: 'tpl_photo_chengdu', imageId, spotId: openSpot.id, requestId: 'req_gen_1' },
  });
  assert(r.data?.success && r.data.data.taskId, `photo-generate taskId=${r.data?.data?.taskId}`);
  const genTaskId = r.data.data.taskId;

  // 幂等：相同 requestId 返回同一 task
  r = await call('POST', '/api/ai/photo-generate', {
    body: { templateId: 'tpl_photo_chengdu', imageId, spotId: openSpot.id, requestId: 'req_gen_1' },
  });
  assert(r.data?.data?.taskId === genTaskId, 'photo-generate idempotent (same taskId)');

  console.log('== poll AI task/result ==');
  let status = 'pending';
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    r = await call('GET', `/api/ai/tasks/${genTaskId}`);
    status = r.data?.data?.task?.status;
    if (status === 'success' || status === 'failed') break;
  }
  assert(status === 'success', `AI task reached success (got ${status})`);
  r = await call('GET', `/api/ai/results/${genTaskId}`);
  assert(r.data?.success && r.data.data.result?.outputUrl, 'AI result has outputUrl');

  console.log('== me assets ==');
  r = await call('GET', '/api/me/collections');
  assert(r.data?.success && r.data.data.collections.length > 0, 'collections ok');
  const obtained = r.data.data.collections.filter((c) => c.obtained).length;
  assert(obtained >= 1, `obtained ${obtained} collection(s)`);
  r = await call('GET', '/api/me/generated-assets');
  assert(r.data?.success && r.data.data.assets.length >= 1, 'generated-assets ok');
  r = await call('GET', '/api/me/achievements');
  assert(r.data?.success && r.data.data.achievements.some((a) => a.unlocked), 'at least one achievement unlocked');

  console.log('== error codes ==');
  r = await call('POST', `/api/actions/not_exist/execute`, { body: {} });
  assert(r.data?.success === false && r.data.code === 'ACTION_NOT_AVAILABLE', 'unknown action -> ACTION_NOT_AVAILABLE');

  const lockedSpot = spots.find((s) => s.status === 'locked');
  if (lockedSpot) {
    const lr = await call('GET', `/api/spots/${lockedSpot.id}/actions`);
    const lockedAction = lr.data?.data?.actions?.[0];
    if (lockedAction) {
      r = await call('POST', `/api/actions/${lockedAction.id}/execute`, { body: {} });
      assert(r.data?.success === false && r.data.code === 'SPOT_NOT_UNLOCKED', 'locked spot -> SPOT_NOT_UNLOCKED');
    }
  }

  // risk blocked upload
  const badForm = new FormData();
  badForm.append('file', new Blob([new Uint8Array([1])], { type: 'image/png' }), 'blocked.png');
  r = await call('POST', '/api/uploads/image', { raw: badForm });
  assert(r.data?.success === false && r.data.code === 'RISK_BLOCKED', 'risk image -> RISK_BLOCKED');

  console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
