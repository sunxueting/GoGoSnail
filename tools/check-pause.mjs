import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { PNG } from 'pngjs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';
const root = path.resolve(import.meta.dirname, '..'), web = path.join(root, 'build/web');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions({ args: ['--autoplay-policy=no-user-gesture-required'] }));
const errors = [], checks = [];
const base = 'CameraCon/Camera/UILayer/ReleasePresentation/PauseControl';
async function point(page, name) {
  return page.evaluate(p => {
    const node = cc.find(p); let center = node.convertToWorldSpaceAR(cc.Vec2.ZERO);
    if (cc.Camera.main.containsNode(node)) center = cc.pointApplyAffineTransform(center, cc.Camera.main.viewMatrix);
    const viewport = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
    return { x: (viewport.x + center.x * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth,
      y: innerHeight - (viewport.y + center.y * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
  }, base + '/' + name);
}
async function tap(page, name) { const p = await point(page, name); await page.touchscreen.tap(p.x, p.y); }
async function snapshot(page) {
  return page.evaluate(() => {
    const p = cc.find('Player').getComponent('PlayerControl'), score = cc.find('Map').getComponent('ScoreManager');
    return { x: p.node.x, y: p.node.y, angle: p.node.rotation, center: p.currentCenter && p.currentCenter.__instanceId,
      hp: p.HP, runTime: p.runTime, invincible: p.InvincibleTime, score: score.PlayerScore,
      camera: cc.find('CameraCon/Camera').y, map: cc.find('Map').__instanceId,
      begins: __pauseTest.begins, jumps: __pauseTest.jumps };
  });
}
try {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 911 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    window.__pauseTest = { begins: 0, jumps: 0 };
    window.wx = {
      reportEvent(name) { if (name === 'snail_play_start') __pauseTest.begins++; },
      getWindowInfo() { return { windowWidth: innerWidth, windowHeight: innerHeight, safeArea: { top: 47, bottom: innerHeight - 34, left: 0, right: innerWidth } }; },
      getMenuButtonBoundingClientRect() { return { left: innerWidth - 103, right: innerWidth - 7, top: 50, bottom: 82 }; }
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__snailSceneReady);
  assert.equal(await page.evaluate(p => cc.find(p + '/PauseButton').activeInHierarchy, base), false);
  await page.evaluate(() => cc.find('Map').getComponent('GameLogic').startGame());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager').TototailUI.activeInHierarchy);
  assert.equal(await page.evaluate(p => cc.find(p + '/PauseButton').activeInHierarchy, base), false, 'No pause control over tutorial');
  await page.evaluate(() => cc.find('Map').getComponent('GameLogic').TutotailStart());
  await page.waitForFunction(p => cc.find(p + '/PauseButton').activeInHierarchy && cc.find('Player').getComponent('PlayerControl').currentCenter, base);
  await page.evaluate(() => {
    const player = cc.find('Player').getComponent('PlayerControl'); player.InvincibleTime = 100;
    const jump = player.tangentMove;
    player.tangentMove = function () { if (!this.uIManager.isPaused) __pauseTest.jumps++; return jump.apply(this, arguments); };
  });
  await page.waitForTimeout(100);
  for (const [width, height] of [[393, 911], [320, 568], [430, 932], [768, 1024]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(120);
    const button = await point(page, 'PauseButton');
    assert.ok(button.x > width * 0.7 && button.x < width - 20 && button.y > 82 + 20 && button.y < height * 0.3, 'Upper-right button avoids native capsule');
    await page.screenshot({ path: path.join(root, `artifacts/pause-button-${width}x${height}.png`) });
    await page.evaluate(() => { window.__playingBeforePause = cc.director.getScene().getComponentsInChildren(cc.AudioSource).filter(s => s.isPlaying); });
    await tap(page, 'PauseButton');
    assert.equal(await page.evaluate(() => __playingBeforePause.every(s => !s.isPlaying)), true, 'Playing audio sources pause');
    assert.equal(await page.evaluate(() => cc.director.isPaused()), true, 'Actual touch pauses director');
    const before = await snapshot(page);
    await page.waitForTimeout(400);
    await page.touchscreen.tap(width * 0.15, height * 0.55);
    await page.keyboard.press('Space');
    assert.deepEqual(await snapshot(page), before, 'Player, camera, HP, score, clocks and jump input freeze');
    const shaded = PNG.sync.read(await page.screenshot({ path: path.join(root, `artifacts/pause-${width}x${height}.png`) }));
    await page.evaluate(p => { cc.find(p + '/PausePanel').active = false; }, base);
    const clear = PNG.sync.read(await page.screenshot());
    await page.evaluate(p => { cc.find(p + '/PausePanel').active = true; }, base);
    for (const [x, y] of [[3, 3], [width - 4, 3], [3, height - 4], [width - 4, height - 4]]) {
      const i = (y * width + x) * 4, sum = png => png.data[i] + png.data[i + 1] + png.data[i + 2];
      assert.ok(sum(shaded) < sum(clear) * 0.7, 'Pause shade covers all four actual screen corners');
    }
    const resumePoint = await point(page, 'PausePanel/ResumeButton');
    let white = 0;
    for (let y = Math.floor(resumePoint.y - 14); y < resumePoint.y + 14; y++) for (let x = Math.floor(resumePoint.x - 70); x < resumePoint.x + 70; x++) {
      const i = (y * width + x) * 4;
      if (shaded.data[i] > 220 && shaded.data[i + 1] > 220 && shaded.data[i + 2] > 220) white++;
    }
    assert.ok(white > 50, 'Continue caption is visibly rendered above the green button');
    await tap(page, 'PausePanel/ResumeButton');
    assert.equal(await page.evaluate(() => cc.director.isPaused()), false, 'Resume touch works while director was paused');
    const resumed = await snapshot(page);
    assert.equal(resumed.map, before.map); assert.equal(resumed.begins, before.begins); assert.equal(resumed.jumps, before.jumps, 'Continue does not accidentally jump or start another run');
    await page.waitForTimeout(120);
    const after = await snapshot(page);
    assert.ok(Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 0.1, 'Current orbit resumes');
    checks.push({ name: '44px safe-area pause touch, simulation/input freeze and same-run continuation', width, height });
  }
  await tap(page, 'PauseButton');
  await page.setViewportSize({ width: 393, height: 911 }); await page.waitForTimeout(120);
  await tap(page, 'PausePanel/ResumeButton');
  assert.equal(await page.evaluate(() => cc.director.isPaused()), false, 'Resizing during pause preserves reachable Continue');
  await page.evaluate(() => cc.game.emit(cc.game.EVENT_HIDE));
  assert.equal(await page.evaluate(() => cc.director.isPaused()), true, 'Backgrounding auto-pauses');
  await page.evaluate(() => cc.game.emit(cc.game.EVENT_SHOW));
  assert.equal(await page.evaluate(() => cc.director.isPaused()), true, 'Returning does not resume unexpectedly');
  await tap(page, 'PausePanel/ResumeButton');
  await page.touchscreen.tap(190, 500);
  await page.waitForTimeout(30);
  assert.equal((await snapshot(page)).jumps, 1, 'Normal touch input restored');
  await page.screenshot({ path: path.join(root, 'artifacts/pause-before-airborne.png') });
  await tap(page, 'PauseButton');
  const diagnostic = await page.evaluate(p => { const c = cc.find(p)._pauseControl; return { paused: c.paused, engine: cc.director.isPaused(), playable: c.playable(), active: c.button.activeInHierarchy, uiState: c.ui._CurrentState }; }, base);
  assert.equal(diagnostic.paused, true, 'Airborne pause control receives touch');
  const airborne = await snapshot(page);
  await page.waitForTimeout(300);
  assert.deepEqual(await snapshot(page), airborne, 'Airborne physics also freezes');
  await tap(page, 'PausePanel/ResumeButton');
  await page.waitForTimeout(50);
  const flying = await snapshot(page);
  assert.ok(Math.abs(flying.x - airborne.x) + Math.abs(flying.y - airborne.y) > 0.1, 'Airborne physics resumes');
  await page.evaluate(() => cc.find('Player').getComponent('PlayerControl').missionFailed());
  assert.equal(await page.evaluate(p => cc.find(p)._pauseControl.pause(), base), false, 'Cannot pause delayed death sequence');
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2);
  assert.equal(await page.evaluate(p => cc.find(p + '/PauseButton').activeInHierarchy, base), false);
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').BackToMM());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0);
  assert.equal(await page.evaluate(() => cc.director.isPaused()), false, 'Home is not left frozen');
  checks.push({ name: 'Resize while paused, background pause, explicit continue, airborne physics freeze/resume, restored input, death and home cleanup' });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, environment: 'Actual Cocos scene/touch in desktop Chromium with synthetic capsule and lifecycle events; not phone certification', checks, errors }, null, 2));
} finally { await browser.close(); server.close(); }
