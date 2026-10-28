'use strict';

const crypto = require('node:crypto');
const APP_ID = 'wx60136090bb46174f';
const CONSENT_VERSION = 'global-ranking-v1';

function failure(code) { const error = new Error(code); error.code = code; throw error; }
function profileInput(value) {
  if (!value || typeof value.nickName !== 'string') failure('INVALID_PROFILE');
  const nickName = value.nickName.trim();
  if (!nickName || Array.from(nickName).length > 40 || /[\u0000-\u001f\u007f]/.test(nickName)) failure('INVALID_PROFILE');
  const avatarUrl = value.avatarUrl;
  if (typeof avatarUrl !== 'string' || avatarUrl.length > 2048 || !/^https:\/\/(?:[a-z0-9-]+\.)*qlogo\.cn\//i.test(avatarUrl)) failure('INVALID_PROFILE');
  const parsed = new URL(avatarUrl);
  if (parsed.username || parsed.password || parsed.port) failure('INVALID_PROFILE');
  return { nickName, avatarUrl };
}

// The store serializes changes to one player's document. CloudBase transactions
// prevent delayed lower scores and concurrent profile operations overwriting it.
function createService({ store, now = Date.now, randomId = () => crypto.randomUUID(), moderate }) {
  return async function handle(event, identity) {
    if (!identity || identity.appId !== APP_ID || !identity.openId) failure('UNAUTHENTICATED');
    const id = crypto.createHash('sha256').update(APP_ID + ':' + identity.openId).digest('hex');
    const action = event && event.action;
    if (action === 'join') {
      if (event.consentVersion !== CONSENT_VERSION) failure('CONSENT_REQUIRED');
      await store.change(id, player => player || {
        alias: '玩家' + id.slice(0, 6), participating: true, hasScore: false,
        best: 0, joinedAt: now(), consentVersion: CONSENT_VERSION, profile: null,
      });
      return { joined: true };
    }
    if (action === 'leave') {
      await store.change(id, () => null);
      return { deleted: true };
    }
    if (action === 'start') {
      let runId;
      await store.change(id, player => {
        if (!player || !player.participating) failure('JOIN_REQUIRED');
        if (player.run && now() - player.run.startedAt < 2000) failure('TOO_FREQUENT');
        runId = randomId();
        player.run = { id: runId, startedAt: now(), score: 0 };
        return player;
      });
      return { runId };
    }
    if (action === 'submit') {
      const score = event.score;
      if (!Number.isSafeInteger(score) || score < 0 || score > 10000000) failure('INVALID_SCORE');
      let best;
      await store.change(id, player => {
        if (!player || !player.participating) failure('JOIN_REQUIRED');
        const run = player.run;
        if (!run || typeof event.runId !== 'string' || run.id !== event.runId) failure('INVALID_RUN');
        const elapsed = now() - run.startedAt;
        if (elapsed < 0 || elapsed > 2 * 60 * 60 * 1000) failure('EXPIRED_RUN');
        // A generous plausibility bound, not authoritative physics replay.
        if (score > 500 + Math.floor(elapsed / 1000) * 100) failure('INVALID_SCORE');
        run.score = Math.max(run.score, score);
        player.best = Math.max(player.best, run.score);
        player.hasScore = true;
        best = player.best;
        return player;
      });
      return { best };
    }
    if (action === 'clearProfile') {
      await store.change(id, player => {
        if (!player) failure('JOIN_REQUIRED');
        player.profile = null;
        player.profileRequest = randomId();
        return player;
      });
      return { cleared: true };
    }
    if (action === 'publishProfile') {
      if (event.consentVersion !== CONSENT_VERSION) failure('CONSENT_REQUIRED');
      const profile = profileInput(event.profile);
      const request = randomId();
      await store.change(id, player => {
        if (!player || !player.participating) failure('JOIN_REQUIRED');
        player.profileRequest = request;
        return player;
      });
      // Fail closed: no identity is public until BOTH checks pass.
      if (!moderate || !await moderate(profile, identity.openId)) failure('PROFILE_NOT_APPROVED');
      await store.change(id, player => {
        if (!player || player.profileRequest !== request) failure('PROFILE_CANCELLED');
        player.profile = profile;
        return player;
      });
      return { published: true };
    }
    if (action === 'list') {
      const offset = event.offset === undefined ? 0 : event.offset;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000 || offset % 20 !== 0) failure('INVALID_PAGE');
      const [rows, total, mine, highest] = await Promise.all([
        store.list(offset, 20), store.count(), store.get(id), offset ? store.list(0, 1) : Promise.resolve(null),
      ]);
      // Count only the first score when a tie spans a page boundary. Within a
      // page, the sorted position determines the next competition rank.
      let rank = rows.length && offset ? 1 + await store.countAbove(rows[0].best) : 1;
      const entry = (player, rank) => ({ rank, score: player.best,
        nickName: player.profile ? player.profile.nickName : player.alias,
        avatarUrl: player.profile ? player.profile.avatarUrl : '',
      });
      return {
        entries: rows.map((player, index) => {
          if (index && player.best !== rows[index - 1].best) rank = offset + index + 1;
          return entry(player, rank);
        }),
        total, offset, hasMore: offset + rows.length < total,
        highest: (highest || rows).length ? (highest || rows)[0].best : null,
        joined: !!mine,
        mine: mine && mine.hasScore ? entry(mine, 1 + await store.countAbove(mine.best)) : null,
        profilePublished: !!(mine && mine.profile),
      };
    }
    failure('INVALID_ACTION');
  };
}

module.exports = { createService, profileInput, CONSENT_VERSION, APP_ID };
