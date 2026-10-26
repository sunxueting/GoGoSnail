import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { browserOptions } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'build/web');
const errors = [], results = [];
const server = http.createServer((req, res) => {
  const relative = new URL(req.url, 'http://localhost').pathname;
  if (relative === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (relative === '/' ? '/index.html' : relative));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(file);
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[ext] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions());
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__profileMock = { buttons: [], avatarRequests: 0, privacyEvents: [], contractOpened: 0 };
    window.wx = {
      getWindowInfo: () => ({ windowWidth: innerWidth, windowHeight: innerHeight }),
      createUserInfoButton: options => {
        const button = { options, style: { ...options.style }, destroyed: false, hide() { this.hidden = true; }, show() { this.hidden = false; }, destroy() { this.destroyed = true; }, onTap(fn) { this.tap = fn; } };
        window.__profileMock.buttons.push(button);
        return button;
      },
      createImage: () => {
        const picture = document.createElement('canvas');
        picture.width = picture.height = 16;
        picture.getContext('2d').fillRect(0, 0, 16, 16);
        Object.defineProperty(picture, 'src', { set() { window.__profileMock.avatarRequests++; setTimeout(() => picture.onload(), 5); } });
        return picture;
      },
      showToast() {},
      openPrivacyContract() { __profileMock.contractOpened++; },
      onNeedPrivacyAuthorization(listener) { __profileMock.privacyListener = listener; },
    };
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const open = async () => {
    await page.goto(base);
    await page.waitForFunction(() => window.__snailSceneReady);
    await page.waitForTimeout(300);
  };
  const enter = async () => {
    await page.evaluate(() => cc.find('Map').getComponent('UIManager').EnterLeaderBoard());
    await page.waitForTimeout(350);
  };
  const snapshot = () => page.evaluate(() => {
    const board = cc.find('CameraCon/Camera/UILayer/Leaderboard');
    return {
      stored: localStorage.getItem('SnailPlayerProfile'),
      name: board.getComponent('LeaderBoardManager').ldArray[0].getChildByName('name').getComponent(cc.Label).string,
      text: board.getChildByName('PlayerProfilePanel').getChildByName('ProfileStatus').getComponent(cc.Label).string,
      buttons: window.__profileMock.buttons.length,
      last: window.__profileMock.buttons.length ? { ...window.__profileMock.buttons.slice(-1)[0].style, destroyed: window.__profileMock.buttons.slice(-1)[0].destroyed } : null,
      avatarRequests: window.__profileMock.avatarRequests,
    };
  });
  await open();
  assert.equal(await page.evaluate(() => __profileMock.buttons.length), 0, 'No identity button on startup');
  await enter();
  let state = await snapshot();
  assert.equal(state.stored, null);
  assert.equal(state.buttons, 1);
  assert.ok(state.last.top >= 0 && state.last.top + state.last.height <= 844 && state.last.left >= 0 && state.last.left + state.last.width <= 390, 'Native button stays inside viewport');
  assert.ok(state.last.width > 150 && state.last.height > 30, 'Native button matches visible control, not a tiny label');
  results.push({ name: 'Explicit native authorization button only on record page; retina layout', passed: true, rect: state.last });
  const tapPrivacy = async name => {
    const point = await page.evaluate(name => {
      const node = cc.find('CameraCon/Camera/UILayer/Leaderboard/PrivacyConsentPanel/' + name);
      let rect = node.getBoundingBoxToWorld();
      if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
      const viewport = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
      return { x: (viewport.x + (rect.x + rect.width / 2) * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (viewport.y + (rect.y + rect.height / 2) * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
    }, name);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(50);
  };
  const requestPrivacy = () => page.evaluate(() => __profileMock.privacyListener(result => __profileMock.privacyEvents.push(result.event)));
  await requestPrivacy();
  assert.deepEqual(await page.evaluate(() => __profileMock.privacyEvents), ['exposureAuthorization'], 'Never silently agree');
  assert.equal(await page.evaluate(() => __profileMock.buttons.slice(-1)[0].hidden), true, 'Native identity button cannot cover consent controls');
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(root, 'artifacts/privacy-consent.png') });
  await tapPrivacy('PrivacyContract');
  assert.equal(await page.evaluate(() => __profileMock.contractOpened), 1);
  assert.deepEqual(await page.evaluate(() => __profileMock.privacyEvents), ['exposureAuthorization'], 'Viewing policy does not imply consent');
  await tapPrivacy('PrivacyDecline');
  assert.deepEqual(await page.evaluate(() => __profileMock.privacyEvents), ['exposureAuthorization', 'disagree']);
  assert.equal((await snapshot()).stored, null);
  await requestPrivacy();
  await tapPrivacy('PrivacyAgree');
  assert.deepEqual(await page.evaluate(() => __profileMock.privacyEvents), ['exposureAuthorization', 'disagree', 'exposureAuthorization', 'agree']);
  assert.equal((await snapshot()).stored, null, 'Privacy consent alone never creates a profile');
  results.push({ name: 'Custom privacy gate: exposure, policy link, explicit decline/agree, no profile saved by privacy consent alone', passed: true });
  await requestPrivacy();
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').SubBackMM());
  assert.equal(await page.evaluate(() => __profileMock.privacyEvents.slice(-1)[0]), 'disagree', 'Leaving cancels pending request');
  await enter();
  await page.evaluate(() => __profileMock.buttons.slice(-1)[0].tap({ errMsg: 'getUserInfo:fail please go to mp to announce your privacy usage' }));
  assert.match((await snapshot()).text, /后台隐私指引未声明头像昵称/);
  results.push({ name: 'Missing backend declaration shown distinctly; leaving closes pending consent', passed: true });
  await page.evaluate(() => __profileMock.buttons.slice(-1)[0].tap({ errMsg: 'getUserInfo:fail auth deny' }));
  state = await snapshot();
  assert.equal(state.stored, null);
  assert.match(state.text, /仍可正常游戏/);
  results.push({ name: 'Denied authorization stores nothing', passed: true });
  await page.evaluate(() => __profileMock.buttons.slice(-1)[0].tap({ userInfo: { nickName: '测试玩家', avatarUrl: 'https://thirdwx.qlogo.cn/synthetic-avatar/132', gender: 1, city: 'do-not-store', encryptedData: 'do-not-store' }, encryptedData: 'do-not-store' }));
  await page.waitForTimeout(350);
  state = await snapshot();
  assert.deepEqual(Object.keys(JSON.parse(state.stored)).sort(), ['avatarUrl', 'nickName']);
  assert.equal(state.name, '测试玩家');
  assert.equal(state.avatarRequests, 1);
  assert.ok(await page.evaluate(() => !!cc.find('CameraCon/Camera/UILayer/Leaderboard').getComponent('LeaderBoardManager').ldArray[0].getChildByName('image').getComponent(cc.Sprite).spriteFrame));
  results.push({ name: 'Only nickname and avatar URL saved; avatar rendered', passed: true });
  await page.screenshot({ path: path.join(root, 'artifacts/profile-record.png') });
  await page.touchscreen.tap(320, 190);
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).last.destroyed, true, 'Native authorization control removed on exit');
  await enter();
  assert.equal((await snapshot()).name, '测试玩家');
  await page.evaluate(() => {
    cc.find('Map').getComponent('UIManager').SubBackMM();
    wx.getSetting = options => options.success({ authSetting: { 'scope.userInfo': false } });
  });
  await enter();
  assert.equal((await snapshot()).stored, null);
  assert.equal((await snapshot()).name, '本机最高纪录');
  results.push({ name: 'Revoked platform authorization clears saved identity on records entry', passed: true });
  await page.evaluate(() => { delete wx.getSetting; __profileMock.buttons.slice(-1)[0].tap({ userInfo: { nickName: '测试玩家', avatarUrl: 'https://thirdwx.qlogo.cn/synthetic-avatar/132' } }); });
  await page.waitForTimeout(350);
  await open();
  await enter();
  assert.equal((await snapshot()).name, '测试玩家');
  results.push({ name: 'Profile survives restart and records reopen', passed: true });
  await page.evaluate(() => localStorage.setItem('TopScore', '123'));
  await page.touchscreen.tap(195, 462);
  await page.evaluate(() => __profileMock.buttons.slice(-1)[0].tap({ userInfo: { nickName: '迟到回调', avatarUrl: '' } }));
  assert.equal((await snapshot()).stored, null, 'Stale callback must not restore deleted data');
  assert.equal(await page.evaluate(() => localStorage.getItem('TopScore')), '123');
  results.push({ name: 'Delete removes profile, preserves best, rejects stale authorization callback', passed: true });
  await page.screenshot({ path: path.join(root, 'artifacts/profile-deleted.png') });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), passed: errors.length === 0, environment: 'Desktop Chromium mobile viewport with mocked WeChat APIs and synthetic identity; not a phone authorization test', checks: results, errors };
  fs.writeFileSync(path.join(root, 'artifacts/profile-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
