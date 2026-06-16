/**
 * TB05-7 - NPC 对话冒烟验证（零外部依赖，mock LLM）。
 * 验证：start -> say(命中知识点得 grants) -> say 幂等不重复发奖 -> 第二个触发点
 *      -> getSession 历史正确 -> collections 能看到对话所得 reward
 *      -> 错误码：会话不存在 / 风控拦截。
 * 用法：先启动后端，再 node scripts/dialogue-smoke.mjs
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3001';
const USER = 'user_dialogue_smoke';
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

async function call(method, path, body) {
  const headers = { 'x-user-id': USER };
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  const SPOT = 'spot_dufu_thatched_cottage';

  console.log('== start dialogue ==');
  let r = await call('POST', '/api/dialogue/start', { spotId: SPOT, requestId: 'd1' });
  assert(r.data?.success && r.data.data.sessionId, `start ok sessionId=${r.data?.data?.sessionId}`);
  assert(r.data?.data?.npc?.id === 'npc_dufu', `signature NPC selected: ${r.data?.data?.npc?.id}`);
  assert(!!r.data?.data?.opening?.content, 'opening message present');
  // 公开信息不含 knowledge/guardrails
  assert(
    r.data?.data?.npc && !('knowledge' in r.data.data.npc) && !('guardrails' in r.data.data.npc),
    'npc public has no knowledge/guardrails',
  );
  const sessionId = r.data.data.sessionId;

  console.log('== start idempotency ==');
  r = await call('POST', '/api/dialogue/start', { spotId: SPOT, requestId: 'd1' });
  assert(r.data?.data?.sessionId === sessionId, 'same requestId returns same session');

  console.log('== say (hit 春夜喜雨) ==');
  r = await call('POST', `/api/dialogue/${sessionId}/say`, {
    message: '给我讲讲春夜喜雨',
    requestId: 's1',
  });
  assert(r.data?.success && r.data.data.reply?.content, `reply: ${r.data?.data?.reply?.content?.slice(0, 30)}…`);
  const grants1 = r.data?.data?.grants ?? [];
  assert(
    grants1.some((g) => g.reward?.id === 'reward_card_poem'),
    'grants include reward_card_poem',
  );

  console.log('== say idempotency (no double grant) ==');
  r = await call('POST', `/api/dialogue/${sessionId}/say`, {
    message: '给我讲讲春夜喜雨',
    requestId: 's1',
  });
  assert((r.data?.data?.grants ?? []).length === grants1.length, 'repeat requestId returns same grants (no re-grant)');

  console.log('== say again same topic, new requestId -> already granted, no new grant ==');
  r = await call('POST', `/api/dialogue/${sessionId}/say`, {
    message: '再说说好雨知时节',
    requestId: 's2',
  });
  assert((r.data?.data?.grants ?? []).length === 0, 'already-granted trigger does not re-grant');

  console.log('== say (hit 茅屋为秋风所破) ==');
  r = await call('POST', `/api/dialogue/${sessionId}/say`, {
    message: '茅屋为秋风所破歌讲的是什么',
    requestId: 's3',
  });
  assert(
    (r.data?.data?.grants ?? []).some((g) => g.reward?.id === 'reward_card_thatched_cottage'),
    'grants include reward_card_thatched_cottage',
  );

  console.log('== getSession ==');
  r = await call('GET', `/api/dialogue/${sessionId}`);
  assert(r.data?.success, 'getSession ok');
  assert(r.data?.data?.messages?.length >= 7, `history accumulated (${r.data?.data?.messages?.length} msgs)`);
  assert((r.data?.data?.grantedTriggerIds ?? []).length === 2, 'two triggers granted total');

  console.log('== collections reflect dialogue rewards ==');
  r = await call('GET', '/api/me/collections');
  const obtainedIds = (r.data?.data?.collections ?? []).filter((c) => c.obtained).map((c) => c.reward.id);
  assert(obtainedIds.includes('reward_card_poem'), 'collections include reward_card_poem');
  assert(obtainedIds.includes('reward_card_thatched_cottage'), 'collections include reward_card_thatched_cottage');

  console.log('== error: session not found ==');
  r = await call('GET', '/api/dialogue/not_exist');
  assert(r.data?.success === false && r.data.code === 'DIALOGUE_SESSION_NOT_FOUND', 'unknown session -> DIALOGUE_SESSION_NOT_FOUND');

  console.log('== error: risk blocked ==');
  r = await call('POST', `/api/dialogue/${sessionId}/say`, { message: 'blocked content', requestId: 'sx' });
  assert(r.data?.success === false && r.data.code === 'RISK_BLOCKED', 'risk text -> RISK_BLOCKED');

  console.log('== generic fallback NPC on other spot ==');
  r = await call('POST', '/api/dialogue/start', { spotId: 'spot_jinli', requestId: 'd2' });
  assert(r.data?.data?.npc?.id === 'npc_passerby', `generic NPC fallback: ${r.data?.data?.npc?.id}`);

  console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
