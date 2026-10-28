'use strict';
const cloud = require('wx-server-sdk');
const https = require('node:https');
const { createService, APP_ID } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const name = 'snail_players';
const publicPlayers = () => db.collection(name).where({ participating: true, hasScore: true });

function absent(error) {
  return /document.*(?:not exist|not found)|文档不存在|document\.get:fail.*不存在/i.test(String(error && (error.errMsg || error.message)));
}
async function read(ref) {
  try { const result = await ref.get(); return result.data || null; }
  catch (error) { if (absent(error)) return null; throw error; }
}
const store = {
  get: id => read(db.collection(name).doc(id)),
  change: (id, transform) => db.runTransaction(async transaction => {
    const ref = transaction.collection(name).doc(id);
    const before = await read(ref);
    const after = transform(before);
    if (after) {
      // _id is supplied by doc(), never copied into a set payload.
      const { _id, ...data } = after;
      await ref.set({ data });
    } else if (before) await ref.remove();
  }),
  list: async (offset, limit) => (await publicPlayers().orderBy('best', 'desc').orderBy('_id', 'asc').skip(offset).limit(limit).get()).data,
  count: async () => (await publicPlayers().count()).total,
  countAbove: async score => (await db.collection(name).where({ participating: true, hasScore: true, best: db.command.gt(score) }).count()).total,
};

// Never follow redirects or fetch arbitrary profile URLs. Input is restricted
// to WeChat's HTTPS avatar hosts; size and time are bounded before moderation.
function avatarBytes(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      const type = String(response.headers['content-type'] || '').split(';')[0];
      if (response.statusCode !== 200 || !['image/jpeg', 'image/png'].includes(type)) {
        response.resume(); reject(new Error('AVATAR_UNAVAILABLE')); return;
      }
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) { response.destroy(); reject(new Error('AVATAR_TOO_LARGE')); }
        else chunks.push(chunk);
      });
      response.on('end', () => resolve({ contentType: type, value: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.setTimeout(5000, () => request.destroy(new Error('AVATAR_TIMEOUT')));
    request.on('error', reject);
  });
}
async function moderate(profile, openid) {
  try {
    const text = await cloud.openapi.security.msgSecCheck({ version: 2, scene: 1, openid, content: profile.nickName });
    if (text.errCode !== 0 || !text.result || text.result.suggest !== 'pass') return false;
    const image = await cloud.openapi.security.imgSecCheck({ media: await avatarBytes(profile.avatarUrl) });
    return image.errCode === 0;
  } catch (_) { return false; }
}
const handle = createService({ store, moderate });
exports.main = async event => {
  const context = cloud.getWXContext();
  try {
    if (context.APPID !== APP_ID) return { ok: false, code: 'UNAUTHENTICATED' };
    return { ok: true, data: await handle(event, { appId: context.APPID, openId: context.OPENID }) };
  } catch (error) {
    const allowed = ['UNAUTHENTICATED', 'CONSENT_REQUIRED', 'JOIN_REQUIRED', 'INVALID_PROFILE', 'INVALID_SCORE', 'INVALID_RUN', 'EXPIRED_RUN', 'INVALID_PAGE', 'INVALID_ACTION', 'TOO_FREQUENT', 'PROFILE_NOT_APPROVED', 'PROFILE_CANCELLED'];
    return { ok: false, code: allowed.includes(error.code) ? error.code : 'SERVICE_UNAVAILABLE' };
  }
};
