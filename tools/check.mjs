import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { browserOptions } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'build/web');
const errors = [], externalRequests = [];
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(publicRoot + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch(browserOptions({ args: ['--autoplay-policy=no-user-gesture-required'] }));
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(`http://127.0.0.1:${port}/`) && !r.url().startsWith('data:')) externalRequests.push(r.url()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__snailSceneReady, { timeout: 20000 });
  await page.waitForTimeout(1000);
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts/menu.png') });
  await page.touchscreen.tap(195, 520);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(root, 'artifacts/tutorial.png') });
  await page.touchscreen.tap(318, 255);
  await page.waitForTimeout(250);
  const playerBefore = await page.evaluate(() => ({ x: cc.find('Player').x, y: cc.find('Player').y }));
  await page.touchscreen.tap(195, 420);
  await page.waitForTimeout(350);
  const playerAfter = await page.evaluate(() => ({ x: cc.find('Player').x, y: cc.find('Player').y }));
  if (Math.abs(playerAfter.x-playerBefore.x) + Math.abs(playerAfter.y-playerBefore.y) < 1) errors.push('Player did not move after tutorial and touch');
  await page.screenshot({ path: path.join(root, 'artifacts/gameplay.png') });
  const scoreCaption = await page.evaluate(() => {
    const node = cc.find('CameraCon/Camera/deathboxUp/scoreName');
    const caption = node.getChildByName('ChineseScoreCaption');
    const value = node.getChildByName('Score');
    const captionBounds = caption.getBoundingBoxToWorld();
    const valueBounds = value.getBoundingBoxToWorld();
    return {
      oldPictureEnabled: node.getComponent(cc.Sprite).enabled,
      text: caption.getComponent(cc.Label).string,
      visible: caption.activeInHierarchy,
      value: Number(value.getComponent(cc.Label).string),
      score: cc.find('Map').getComponent('ScoreManager').PlayerScore,
      separate: captionBounds.x + captionBounds.width <= valueBounds.x,
      aligned: Math.abs(captionBounds.y + captionBounds.height / 2 - valueBounds.y - valueBounds.height / 2) < 1,
    };
  });
  if (scoreCaption.oldPictureEnabled || scoreCaption.text !== '得分' || !scoreCaption.visible || scoreCaption.value !== scoreCaption.score || !scoreCaption.separate || !scoreCaption.aligned) errors.push('Gameplay score localization or numeric display failed: ' + JSON.stringify(scoreCaption));
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2, { timeout: 25000 });
  await page.screenshot({ path: path.join(root, 'artifacts/gameover.png') });
  const mapBeforeRevive = await page.evaluate(() => cc.find('Map').__instanceId);
  const revivePoint = await page.evaluate(() => {
    const node = cc.find('CameraCon/Camera/UILayer/OverGame/AgainButton');
    let rect = node.getBoundingBoxToWorld();
    rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
    const vp = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
    return { x: (vp.x + (rect.x + rect.width / 2) * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (vp.y + (rect.y + rect.height / 2) * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
  });
  await page.touchscreen.tap(revivePoint.x, revivePoint.y);
  await page.waitForTimeout(300);
  const revive = await page.evaluate(() => ({
    state: cc.find('Map').getComponent('UIManager')._CurrentState,
    mapInstance: cc.find('Map').__instanceId,
    lives: cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].MoreLiftCount,
  }));
  if (revive.state !== 1 || revive.lives !== 0 || revive.mapInstance !== mapBeforeRevive) errors.push('Free revive did not resume the same run: '+JSON.stringify(revive));
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2, { timeout: 25000 });
  const secondReviveHidden = await page.evaluate(() => !cc.find('CameraCon/Camera/UILayer/OverGame/AgainButton').activeInHierarchy);
  if (!secondReviveHidden) errors.push('A second free revive is visible');
  await page.touchscreen.tap(195, 540);
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 1, { timeout: 15000 });
  await page.waitForTimeout(300);
  const restartLives = await page.evaluate(() => cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].MoreLiftCount);
  if (restartLives !== 1) errors.push('New run did not restore its single free revive');
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2, { timeout: 25000 });
  await page.touchscreen.tap(35, 55);
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0, { timeout: 15000 });
  await page.waitForTimeout(300);
  const highScoreBeforeReload = await page.evaluate(() => cc.find('Map').getComponent('ScoreManager').GetTopScore());
  await page.touchscreen.tap(320, 760);
  await page.waitForTimeout(300);
  const localRecords = await page.evaluate(() => ({
    state: cc.find('Map').getComponent('UIManager')._CurrentState,
    text: cc.director.getScene().getComponentsInChildren(cc.Label).filter(l => l.node.activeInHierarchy).map(l => String(l.string)),
  }));
  if (localRecords.state !== 3 || !localRecords.text.includes('本机最高纪录')) errors.push('Local records screen did not show personal best');
  await page.screenshot({ path: path.join(root, 'artifacts/records.png') });
  await page.reload();
  await page.waitForFunction(() => window.__snailSceneReady, { timeout: 20000 });
  const highScoreAfterReload = await page.evaluate(() => cc.find('Map').getComponent('ScoreManager').GetTopScore());
  if (highScoreBeforeReload !== highScoreAfterReload || !Number.isFinite(highScoreAfterReload)) errors.push('Best score did not persist across reload');
  const state = await page.evaluate(() => {
    const map = cc.find('Map');
    return {
      scene: cc.director.getScene().name,
      player: !!cc.find('Player').getComponent('PlayerControl'),
      scoreManager: !!map.getComponent('ScoreManager'),
      uiState: map.getComponent('UIManager')._CurrentState,
      tutorialActive: cc.find('CameraCon/Camera/UILayer/tut').activeInHierarchy,
      activeButtons: cc.director.getScene().getComponentsInChildren(cc.Button).filter(b => b.node.activeInHierarchy).map(b => ({node:b.node.name, events:b.clickEvents.map(e => e.handler)})),
      labels: cc.director.getScene().getComponentsInChildren(cc.Label).map(l => ({ text: l.string, node: l.node.name, active: l.node.activeInHierarchy })),
    };
  });
  const report = { checkedAt: new Date().toISOString(), environment: 'Desktop Chromium, mobile viewport; not WeChat or phone validation', checks: { realTouchStart: true, tutorial: true, jumpMoved: true, naturalGameover: true, revive, secondReviveHidden, restartLives, localRecords, highScoreBeforeReload, highScoreAfterReload }, state, errors, externalRequests };
  fs.writeFileSync(path.join(root, 'artifacts/local-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, state: { ...report.state, labels: undefined } }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
