import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';
import { PNG } from 'pngjs';
import { memoryStore } from './check-cloud-ranking.mjs';
const require = createRequire(import.meta.url);
const { createService, APP_ID, CONSENT_VERSION } = require('../cloudfunctions/snailLeaderboard/service.js');
const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'build/web');
const store = memoryStore();
const handle = createService({ store, moderate: async () => true });
const identity = user => ({ appId: APP_ID, openId: user });
for (let i = 0; i < 25; i++) {
  await handle({ action: 'join', consentVersion: CONSENT_VERSION }, identity('fixture-' + i));
  const run = await handle({ action: 'start' }, identity('fixture-' + i));
  await handle({ action: 'submit', score: 100 + i, runId: run.runId }, identity('fixture-' + i));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/cloud') {
    const chunks = []; for await (const part of req) chunks.push(part);
    const data = JSON.parse(Buffer.concat(chunks));
    try { res.end(JSON.stringify({ ok: true, data: await handle(data, identity('current-player')) })); }
    catch (error) { res.end(JSON.stringify({ ok: false, code: error.code || error.message })); }
    return;
  }
  if (url.pathname === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  let content = fs.readFileSync(file);
  if (url.pathname === '/src/project.js') {
    // Enable ONLY in this test's HTTP response, never in a production artifact.
    content = content.toString().replace("environmentId: ''", "environmentId: 'local-ranking-test'");
  }
  res.end(content);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions());
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__rankingTest = { calls: [], modals: [], offline: false, infoButtons: [], permission: true };
    window.wx = {
      cloud: { init() {}, callFunction(options) {
        __rankingTest.calls.push(options.data);
        if (__rankingTest.offline) { setTimeout(() => options.fail({}), 0); return; }
        fetch('/cloud', { method: 'POST', body: JSON.stringify(options.data) }).then(r => r.json()).then(result => options.success({ result })).catch(options.fail);
      } },
      showModal(options) { __rankingTest.modals.push(options); },
      getPrivacySetting(options) { options.success({ needAuthorization: !__rankingTest.permission }); },
      getSetting(options) { options.success({ authSetting: { 'scope.userInfo': __rankingTest.permission } }); },
      getWindowInfo() { return { windowWidth: innerWidth, windowHeight: innerHeight, safeArea: { top: 47, bottom: innerHeight - 34 } }; },
      getMenuButtonBoundingClientRect() { return { left: innerWidth - 103, right: innerWidth - 7, top: 50, bottom: 82, width: 96, height: 32 }; },
      createUserInfoButton(options) { const button = { style: options.style, destroy() {}, hide() {}, show() {}, onTap(fn) { this.tap = fn; } }; __rankingTest.infoButtons.push(button); return button; },
      onNeedPrivacyAuthorization() {}, openPrivacyContract() {}, showToast() {},
      createImage() {
        const image = document.createElement('canvas'); image.width = image.height = 16;
        image.getContext('2d').fillStyle = '#22aa77'; image.getContext('2d').fillRect(0, 0, 16, 16);
        Object.defineProperty(image, 'src', { set() { setTimeout(() => image.onload(), 0); } }); return image;
      },
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  // Model WeChat's native capsule: touches in this rectangle never reach Cocos.
  await page.evaluate(() => {
    const capsule = document.createElement('div'); capsule.id = 'wechat-native-capsule';
    capsule.style.cssText = 'position:fixed;right:7px;top:50px;width:96px;height:32px;z-index:2147483647;border-radius:16px;background:#182532;color:white;text-align:center;line-height:32px';
    capsule.textContent = '•••　◉'; document.body.appendChild(capsule);
  });
  await page.waitForFunction(() => window.__snailSceneReady && cc.find('CameraCon/Camera/UILayer/Top/score/ChineseBestValue').getComponent(cc.Label).string === '124');
  assert.equal(store.players.size, 25, 'Startup does not silently enroll current player');
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
  const panel = 'CameraCon/Camera/GlobalRankingPanel/';
  const text = name => page.evaluate(p => cc.find(p).getComponent(cc.Label).string, panel + name);
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('25'), panel + 'Summary');
  const tap = async name => {
    const point = await page.evaluate(p => {
      const node = cc.find(p); let rect = node.getBoundingBoxToWorld();
      if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
      const viewport = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
      return { x: (viewport.x + (rect.x + rect.width / 2) * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (viewport.y + (rect.y + rect.height / 2) * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
    }, name.includes('/') ? name : panel + name);
    const viewport = page.viewportSize();
    assert.ok(point.x >= 0 && point.y >= 0 && point.x <= viewport.width && point.y <= viewport.height, name + ' stays in viewport: ' + JSON.stringify(point));
    await page.touchscreen.tap(point.x, point.y);
  };
  await tap('Close');
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0 && !cc.find('CameraCon/Camera/GlobalRankingPanel'), null, { timeout: 1500 });
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('25'), panel + 'Summary');
  await tap('Join');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: false }));
  assert.equal(store.players.size, 25);
  await tap('Join');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: true }));
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string === '已参加全服排名', panel + 'Join');
  assert.equal(store.players.size, 26);
  await tap('Close');
  await page.evaluate(() => cc.find('Map').getComponent('GameLogic').GamePlayStart());
  await page.waitForFunction(() => __rankingTest.calls.some(c => c.action === 'start'));
  await page.evaluate(() => { const score = cc.find('Map').getComponent('ScoreManager'); score.PlayerScore = 210; score.UploadScore(); });
  await page.waitForFunction(() => __rankingTest.calls.some(c => c.action === 'submit'));
  await page.waitForFunction(() => cc.find('CameraCon/Camera/UILayer/Top/score/ChineseBestValue').getComponent(cc.Label).string === '210');
  // Return to the menu in the actual new scene; a board cannot be opened from
  // normal gameplay. This also verifies cached cloud state survives scene load.
  await page.evaluate(() => cc.director.loadScene('level1'));
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0 && cc.find('Map').getComponent('ScoreManager').PlayerScore === 0);
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('我的名次：1'), panel + 'Mine');
  assert.match(await text('Summary'), /全服最高 210/);
  await tap('Next');
  await page.waitForFunction(() => __rankingTest.calls.some(c => c.action === 'list' && c.offset === 20));
  await page.waitForFunction(p => cc.find(p).children.length === 1 && cc.find(p).children[0].getChildByName('Content').children.length === 18, panel + 'Rows');
  await tap('Refresh');
  await page.waitForFunction(p => cc.find(p).children[0].getChildByName('Content').getChildByName('Score0').getComponent(cc.Label).string === '210', panel + 'Rows');
  await page.screenshot({ path: path.join(root, 'artifacts/global-ranking-local.png') });
  await tap('Publish');
  assert.match(await text('Status'), /本机资料/);
  await tap('LocalProfile');
  await page.waitForFunction(() => __rankingTest.infoButtons.length > 0);
  await page.evaluate(() => __rankingTest.infoButtons.at(-1).tap({ userInfo: { nickName: '云榜测试蜗牛', avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/test/132' } }));
  assert.equal(await page.evaluate(() => __rankingTest.calls.filter(c => c.action === 'publishProfile').length), 0, 'Device-only authorization never uploads identity');
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('26'), panel + 'Summary');
  await tap('Publish');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  assert.equal(await page.evaluate(() => __rankingTest.calls.filter(c => c.action === 'publishProfile').length), 0, 'Opening consent is not consent');
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: true }));
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string === '更新公开资料', panel + 'Publish');
  await page.evaluate(() => { __rankingTest.permission = false; });
  const publications = await page.evaluate(() => __rankingTest.calls.filter(c => c.action === 'publishProfile').length);
  await tap('Publish');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: true }));
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('重新确认'), panel + 'Status');
  assert.equal(await page.evaluate(() => __rankingTest.calls.filter(c => c.action === 'publishProfile').length), publications, 'Revoked permission blocks sending profile');
  await page.evaluate(() => { __rankingTest.permission = true; });
  await page.screenshot({ path: path.join(root, 'artifacts/global-ranking-profile-local.png') });
  await tap('Close');
  for (const [width, height] of [[390, 844], [430, 932], [375, 667], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
    await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('26'), panel + 'Summary');
    await page.waitForTimeout(150);
    const bounds = await page.evaluate(p => {
      const size = cc.view.getVisibleSize();
      return ['Join', 'Publish', 'LocalProfile', 'Leave', 'Next', 'Close', 'ReturnHome', 'Refresh'].map(name => {
        const node = cc.find(p + name); let rect = node.getBoundingBoxToWorld();
        if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
        return { name, inside: rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size.width && rect.y + rect.height <= size.height };
      });
    }, panel);
    assert.ok(bounds.every(b => b.inside), JSON.stringify(bounds));
    const png = PNG.sync.read(await page.screenshot({ path: path.join(root, `artifacts/global-ranking-${width}x${height}.png`) }));
    for (const [x, y] of [[3, 3], [png.width - 4, 3], [3, png.height - 4], [png.width - 4, png.height - 4]]) {
      const pixel = (png.width * y + x) * 4;
      assert.ok(png.data[pixel] + png.data[pixel + 1] + png.data[pixel + 2] < 100, 'Ranking backdrop covers every corner');
    }
    await tap('ReturnHome');
    await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0 && !cc.find('CameraCon/Camera/GlobalRankingPanel'));
    assert.ok(await page.evaluate(() => cc.find('CameraCon/Camera/UILayer/startGame').activeInHierarchy), 'Returning restores the main menu start button');
  }
  await tap('CameraCon/Camera/UILayer/startGame');
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 1);
  await page.evaluate(() => cc.director.loadScene('level1'));
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('26'), panel + 'Summary');
  await page.evaluate(() => { __rankingTest.offline = true; });
  await tap('Refresh');
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('无法连接'), panel + 'Status');
  assert.equal(await page.evaluate(p => cc.find(p).children.length, panel + 'Rows'), 0, 'Offline does not present stale rankings as current');
  await tap('Close');
  assert.equal(await page.evaluate(() => cc.find('Map').getComponent('UIManager')._CurrentState), 0);
  await page.evaluate(() => { __rankingTest.offline = false; cc.find('Map').getComponent('UIManager').EnterLeaderBoard(); });
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('26'), panel + 'Summary');
  await tap('ClearProfile');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: true }));
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string === '公开头像昵称', panel + 'Publish');
  assert.ok(!JSON.stringify(await handle({ action: 'list' }, identity('viewer'))).includes('云榜测试蜗牛'));
  await tap('Leave');
  await page.waitForFunction(() => __rankingTest.modals.length === 1);
  await page.evaluate(() => __rankingTest.modals.pop().success({ confirm: true }));
  await page.waitForFunction(p => cc.find(p).getComponent(cc.Label).string.includes('未参加'), panel + 'Mine');
  assert.equal(store.players.size, 25);
  assert.equal(await page.evaluate(() => Number(localStorage.getItem('TopScore'))), 210, 'Cloud deletion preserves local best');
  await tap('Close');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, environment: 'Actual Cocos UI, mocked wx transport + production service with memory transactions; not cloud/phone certification', checks: ['startup read only', 'highest from all users', 'join decline/agree', 'run upload and personal rank', 'pagination', 'local profile never auto-published', 'separate public consent', 'revoked permission blocks upload', 'cloud profile withdrawal', 'cloud deletion preserves local best', 'four viewport layouts', 'offline clears stale rows', 'native capsule does not cover return controls', 'footer return restores usable menu in four viewports', 'game starts after return', 'close remains usable'], errors }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
