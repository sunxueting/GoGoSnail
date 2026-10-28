import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createService, CONSENT_VERSION, APP_ID } = require('../cloudfunctions/snailLeaderboard/service.js');

// Transaction-shaped store: concurrent operations for one user are serialized.
// The service under test is the same code deployed with wx-server-sdk.
export function memoryStore() {
  const players = new Map(), locks = new Map();
  const publicRows = () => [...players.values()].filter(p => p.participating && p.hasScore).sort((a, b) => b.best - a.best || a._id.localeCompare(b._id));
  return {
    players,
    get: async id => structuredClone(players.get(id) || null),
    change: async (id, transform) => {
      const previous = locks.get(id) || Promise.resolve();
      const next = previous.catch(() => {}).then(() => {
        const value = transform(structuredClone(players.get(id) || null));
        if (value) players.set(id, { ...value, _id: id }); else players.delete(id);
      });
      locks.set(id, next); return next;
    },
    list: async (offset, limit) => structuredClone(publicRows().slice(offset, offset + limit)),
    count: async () => publicRows().length,
    countAbove: async score => publicRows().filter(p => p.best > score).length,
  };
}

export async function checkService() {
  const store = memoryStore();
  let time = 100000, approved = true, pendingModeration = null;
  const handle = createService({ store, now: () => time, moderate: async () => pendingModeration ? await pendingModeration : approved });
  const user = openId => ({ appId: APP_ID, openId });
  const run = (who, event) => handle(event, user(who));
  await assert.rejects(handle({ action: 'list' }, { appId: 'another-app', openId: 'a' }), /UNAUTHENTICATED/);
  await assert.rejects(handle({ action: 'list' }, { appId: APP_ID }), /UNAUTHENTICATED/);
  assert.equal((await run('a', { action: 'list' })).total, 0);
  assert.equal(store.players.size, 0, 'Viewing never silently joins or creates identity records');
  await assert.rejects(run('a', { action: 'join' }), /CONSENT_REQUIRED/);
  await assert.rejects(run('a', { action: 'start' }), /JOIN_REQUIRED/);
  const score = async (who, points) => {
    await run(who, { action: 'join', consentVersion: CONSENT_VERSION });
    const { runId } = await run(who, { action: 'start' });
    await run(who, { action: 'submit', score: points, runId });
    return runId;
  };
  const runId = await score('a', 100);
  await score('b', 200); await score('c', 200);
  let list = await run('a', { action: 'list', openId: 'b' });
  assert.deepEqual(list.entries.map(p => [p.rank, p.score]), [[1, 200], [1, 200], [3, 100]]);
  assert.equal(list.mine.score, 100, 'Client-supplied identity is ignored');
  assert.equal(list.highest, 200); assert.equal(list.total, 3);
  assert.ok(!JSON.stringify(list).includes('"_id"') && !JSON.stringify(list).includes('openId'), 'No platform identity returned to viewers');
  await assert.rejects(run('b', { action: 'submit', runId, score: 101 }), /INVALID_RUN/);
  for (const points of [-1, 0.5, '100', Infinity, 10000001, 501]) await assert.rejects(run('a', { action: 'submit', runId, score: points }), /INVALID_SCORE/);
  await Promise.all([75, 300, 20, 250].map(points => run('a', { action: 'submit', score: points, runId })));
  assert.equal((await run('a', { action: 'list' })).mine.score, 300, 'Concurrent and delayed lower submissions never reduce best');
  await assert.rejects(run('a', { action: 'start' }), /TOO_FREQUENT/);
  time += 3000;
  const nextRun = await run('a', { action: 'start' });
  await assert.rejects(run('a', { action: 'submit', score: 301, runId }), /INVALID_RUN/);
  await run('a', { action: 'submit', score: 301, runId: nextRun.runId });
  time += 2 * 60 * 60 * 1000 + 1;
  await assert.rejects(run('a', { action: 'submit', score: 302, runId: nextRun.runId }), /EXPIRED_RUN/);
  const profile = { nickName: '测试蜗牛', avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/test/132' };
  await assert.rejects(run('a', { action: 'publishProfile', profile }), /CONSENT_REQUIRED/);
  for (const avatarUrl of ['http://thirdwx.qlogo.cn/a', 'https://localhost/a', 'https://thirdwx.qlogo.cn.evil.test/a', 'https://u:p@thirdwx.qlogo.cn/a', 'https://thirdwx.qlogo.cn:9999/a']) {
    await assert.rejects(run('a', { action: 'publishProfile', profile: { ...profile, avatarUrl }, consentVersion: CONSENT_VERSION }), /INVALID_PROFILE/);
  }
  approved = false;
  await assert.rejects(run('a', { action: 'publishProfile', profile, consentVersion: CONSENT_VERSION }), /PROFILE_NOT_APPROVED/);
  assert.equal((await run('a', { action: 'list' })).profilePublished, false);
  approved = true;
  await run('a', { action: 'publishProfile', profile, consentVersion: CONSENT_VERSION });
  assert.equal((await run('b', { action: 'list' })).entries[0].nickName, profile.nickName);
  let releaseCheck;
  pendingModeration = new Promise(resolve => { releaseCheck = resolve; });
  const publishing = run('a', { action: 'publishProfile', profile, consentVersion: CONSENT_VERSION });
  await new Promise(resolve => setImmediate(resolve));
  await run('a', { action: 'clearProfile' });
  releaseCheck(true);
  await assert.rejects(publishing, /PROFILE_CANCELLED/, 'Late moderation cannot restore a withdrawn identity');
  assert.equal((await run('a', { action: 'list' })).profilePublished, false);
  pendingModeration = null;
  for (let i = 0; i < 22; i++) await score('extra-' + i, i);
  assert.equal((await run('a', { action: 'list' })).entries.length, 20);
  assert.equal((await run('a', { action: 'list', offset: 20 })).entries.length, 5);
  for (const offset of [-1, 1, '20', 1000020]) await assert.rejects(run('a', { action: 'list', offset }), /INVALID_PAGE/);
  await run('a', { action: 'leave' });
  list = await run('a', { action: 'list' });
  assert.equal(list.joined, false); assert.equal(list.mine, null); assert.equal(list.total, 24);
  await assert.rejects(run('a', { action: 'submit', runId: nextRun.runId, score: 302 }), /JOIN_REQUIRED/);
  await run('a', { action: 'join', consentVersion: CONSENT_VERSION });
  assert.equal((await run('a', { action: 'list' })).mine, null, 'Deleted scores never reappear on rejoin');
  const tiedStore = memoryStore();
  const tiedService = createService({ store: tiedStore });
  for (let i = 0; i < 22; i++) {
    await tiedService({ action: 'join', consentVersion: CONSENT_VERSION }, user('tie-' + i));
    const game = await tiedService({ action: 'start' }, user('tie-' + i));
    await tiedService({ action: 'submit', runId: game.runId, score: i < 21 ? 200 : 100 }, user('tie-' + i));
  }
  const secondPage = await tiedService({ action: 'list', offset: 20 }, user('tie-21'));
  assert.deepEqual(secondPage.entries.map(e => e.rank), [1, 22], 'A tie crossing the pagination boundary keeps its competition rank');
  return { passed: true, usersTested: 25, checks: ['trusted identity', 'explicit join', 'highest and ties', 'atomic maximum', 'run ownership/expiry', 'invalid score rejection', 'profile consent and moderation', 'avatar URL restrictions', 'late-response cancellation', 'pagination', 'withdrawal and deletion'] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await checkService(), null, 2));
