import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const configModule = { exports: {} };
vm.runInNewContext(read('source/assets/Script/ReleaseConfig.js'), { module: configModule });
const release = configModule.exports;
const events = [], checks = [], errors = [];
const module = { exports: {} };
const context = { module, require: () => release, wx: { reportEvent: (name, data) => events.push({ name, data }) } };
vm.runInNewContext(read('source/assets/Script/ReviveOffer.js'), context);
const offer = module.exports.create();
offer.beginRun();
assert.equal(offer.claim(() => true), false, 'No click/reward without exposure');
offer.show(); offer.show();
let grants = 0;
assert.equal(offer.claim(() => {
  grants++;
  assert.equal(offer.claim(() => { grants++; return true; }), false, 'Reentrant tap is locked');
  offer.hide();
  return true;
}), true);
assert.equal(offer.claim(() => { grants++; return true; }), false);
assert.equal(grants, 1);
assert.deepEqual(events.map(e => e.name), ['snail_play_start', 'snail_revive_show', 'snail_revive_click', 'snail_revive_success']);
assert.deepEqual(Object.keys(events[0].data).sort(), ['experiment', 'placement', 'reward_mode', 'version']);
offer.beginRun(); offer.show(); offer.hide();
assert.equal(offer.claim(() => { grants++; return true; }), false, 'Expired exposure cannot be claimed');
offer.beginRun(); offer.show();
assert.equal(offer.claim(() => false), false);
assert.equal(events.at(-1).name, 'snail_revive_click', 'Failed reward never reports success');
assert.equal(offer.claim(() => true), true, 'Failed revive permits a retry');
context.wx.reportEvent = () => { throw new Error('synthetic reporting failure'); };
offer.beginRun(); offer.show();
assert.equal(offer.claim(() => true), true, 'Reporting failure never blocks reward');
delete context.wx;
offer.beginRun(); offer.show();
assert.equal(offer.claim(() => true), true, 'Browser/unsupported API still grants reward');
checks.push('Controller: exposure, expiry, duplicate/reentrant clicks, failed revive and unavailable/throwing analytics');

const web = path.join(root, 'build/web');
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions());
const observations = [];
const againPath = 'CameraCon/Camera/UILayer/OverGame/AgainButton';
const metrics = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
async function load(mode = 'normal', width = 390, height = 844) {
  const page = await metrics.newPage();
  await page.setViewportSize({ width, height });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__snailSceneReady);
  await page.evaluate(mode => {
    window.__reviveEvents = [];
    window.__adCalls = 0;
    window.wx = {
      reportEvent: mode === 'missing' ? undefined : (name, data) => {
        if (mode === 'throw') throw new Error('synthetic analytics unavailable');
        __reviveEvents.push({ name, data });
      },
      createRewardedVideoAd: () => { __adCalls++; throw new Error('Ad SDK must not be called'); },
      createInterstitialAd: () => { __adCalls++; throw new Error('Ad SDK must not be called'); }
    };
    localStorage.setItem('TutorailFinished', 'true');
  }, mode);
  return page;
}
async function start(page) {
  await page.evaluate(() => cc.find('Map').getComponent('GameLogic').startGame());
  await page.waitForFunction(() => cc.find('Player').activeInHierarchy && cc.find('Player').getComponent('PlayerControl').currentCenter);
}
async function fail(page) {
  await page.evaluate(() => cc.find('Player').getComponent('PlayerControl').missionFailed());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2);
  await page.waitForTimeout(80);
}
async function tapNode(page, nodePath) {
  const point = await page.evaluate(nodePath => {
    const node = cc.find(nodePath);
    assertVisible(node);
    function assertVisible(node) { if (!node || !node.activeInHierarchy) throw new Error('Hidden tap target'); }
    let rect = node.getBoundingBoxToWorld();
    if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
    const vp = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
    return { x: (vp.x + (rect.x + rect.width / 2) * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (vp.y + (rect.y + rect.height / 2) * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
  }, nodePath);
  await page.touchscreen.tap(point.x, point.y);
  await page.waitForTimeout(80);
}
async function verifyReward(page) {
  const result = await page.evaluate(() => {
    const map = cc.find('Map'), player = cc.find('Player').getComponent('PlayerControl');
    return { state: map.getComponent('UIManager')._CurrentState, hp: player.HP, initialHP: player.initHp, score: map.getComponent('ScoreManager').PlayerScore, dead: player.lsDead, lives: cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].MoreLiftCount, adCalls: __adCalls, notice: cc.find('CameraCon/Camera/UILayer/ReleasePresentation/ChineseReviveNotice').activeInHierarchy };
  });
  assert.equal(result.state, 1);
  assert.equal(result.hp, result.initialHP);
  assert.equal(result.dead, false);
  assert.equal(result.lives, 0);
  assert.equal(result.adCalls, 0);
  assert.equal(result.notice, true);
  return result;
}
try {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const playerA = await load();
  await start(playerA); await fail(playerA);
  await playerA.evaluate(() => {
    cc.find('Map').getComponent('ScoreManager').PlayerScore = 37;
    cc.find('Map').getComponent('UIManager').EnterOverGame(); // repeated state callback
  });
  assert.equal(await playerA.evaluate(() => __reviveEvents.filter(e => e.name === 'snail_revive_show').length), 1);
  await playerA.screenshot({ path: path.join(root, 'artifacts/revive-offer-390x844.png') });
  await tapNode(playerA, againPath);
  const reward = await verifyReward(playerA);
  assert.equal(reward.score, 37, 'Revive preserves this run score');
  await playerA.screenshot({ path: path.join(root, 'artifacts/revive-free-notice.png') });
  assert.equal(await playerA.evaluate(() => cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].showAD()), false, 'Late duplicate handler cannot reward/report again');
  await fail(playerA);
  assert.equal(await playerA.evaluate(p => cc.find(p).activeInHierarchy, againPath), false, 'No second offer after revive');
  await playerA.touchscreen.tap(195, 540); // existing restart gesture
  await playerA.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 1 && cc.find('Player').getComponent('PlayerControl').currentCenter);
  await fail(playerA); await tapNode(playerA, againPath); await verifyReward(playerA);
  observations.push({ player: 'synthetic-A', events: await playerA.evaluate(() => __reviveEvents) });
  await playerA.close();

  const playerB = await load();
  await start(playerB); await fail(playerB);
  await playerB.evaluate(() => { cc.find('Map').getComponent('UIManager').countDownTime = 0.03; });
  await playerB.waitForTimeout(200);
  assert.equal(await playerB.evaluate(() => cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].showAD()), false, 'Expired button handler cannot report a click or revive');
  observations.push({ player: 'synthetic-B', events: await playerB.evaluate(() => __reviveEvents) });
  await playerB.close();
  const playerC = await load();
  await start(playerC);
  observations.push({ player: 'synthetic-C', events: await playerC.evaluate(() => __reviveEvents) });
  await playerC.close();
  const uv = name => observations.filter(p => p.events.some(e => e.name === name)).length;
  const pv = name => observations.flatMap(p => p.events).filter(e => e.name === name).length;
  assert.equal(uv('snail_play_start'), 3);
  assert.equal(uv('snail_revive_show'), 2);
  assert.equal(uv('snail_revive_click'), 1);
  assert.equal(pv('snail_revive_show'), 3);
  assert.equal(pv('snail_revive_click'), 2);
  assert.equal(pv('snail_revive_success'), 2);
  checks.push({ name: 'Synthetic 3-player cohort: click UV / exposure UV differs from PV; all-player denominator retained', exposedPlayerClickRate: uv('snail_revive_click') / uv('snail_revive_show'), allPlayerClickRate: uv('snail_revive_click') / uv('snail_play_start'), impressionClickRate: pv('snail_revive_click') / pv('snail_revive_show') });

  for (const [width, height, mode] of [[430, 932, 'throw'], [375, 667, 'missing'], [768, 1024, 'normal']]) {
    const page = await load(mode, width, height);
    await start(page); await fail(page);
    await page.screenshot({ path: path.join(root, `artifacts/revive-offer-${width}x${height}.png`) });
    await tapNode(page, againPath); await verifyReward(page);
    checks.push({ name: 'Actual Cocos touch grants once without ad SDK, including analytics failure', width, height, analytics: mode });
    await page.close();
  }
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), version: release.version, environment: 'Desktop Chromium with actual Cocos scene and synthetic WeChat analytics; not proof of WeChat ingestion or real-player rates', checks, observations, errors };
  fs.writeFileSync(path.join(root, 'artifacts/revive-offer-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, observations: undefined }, null, 2));
  await browser.close();
  server.close();
}
