import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { browserOptions } from './browser.mjs';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '..'), web = path.join(root, 'build/web');
const errors = [], checks = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions());
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => window.__snailSceneReady);
  for (const [width, height] of [[390, 844], [430, 932], [375, 667], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    const png = PNG.sync.read(await page.screenshot({ path: path.join(root, `artifacts/fullscreen-${width}x${height}.png`) }));
    for (const y of [2, png.height - 3]) {
      let colored = 0;
      for (let x = 2; x < png.width - 2; x++) {
        const i = (png.width * y + x) * 4;
        if (png.data[i] + png.data[i + 1] + png.data[i + 2] > 30) colored++;
      }
      assert.ok(colored / (png.width - 4) > 0.95, `Artwork covers ${width}x${height}, row ${y}`);
    }
    checks.push({ name: 'Rendered artwork covers top and bottom after resize', width, height, passed: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const bg = cc.find('Canvas/bg').getComponent(cc.Sprite);
    window.__originalBackground = bg.spriteFrame;
    window.__replacementBackground = new cc.SpriteFrame(bg.spriteFrame.getTexture());
    bg.spriteFrame = __replacementBackground;
  });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => cc.find('Canvas/bg')._coverFrame === __replacementBackground), true, 'Background replacement invalidates cached coverage even at the same viewport size');
  await page.evaluate(() => { cc.find('Canvas/bg').getComponent(cc.Sprite).spriteFrame = __originalBackground; });
  await page.waitForTimeout(80);
  checks.push({ name: 'Background layout cache responds to texture replacement', passed: true });
  await page.evaluate(() => {
    window.wx = {
      reportEvent() {},
      getWindowInfo() { return { windowWidth: innerWidth, windowHeight: innerHeight, safeArea: { top: 47, bottom: innerHeight - 34 } }; },
      getMenuButtonBoundingClientRect() { return { left: innerWidth - 103, right: innerWidth - 7, top: 50, bottom: 82 }; },
      cloud: { init() {}, callFunction(options) { setTimeout(() => options.success({ result: { ok: true, data: { highest: 240, joined: false, rows: [], total: 0, offset: 0 } } }), 0); } }
    };
    window.__responsiveScene = false;
    cc.director.loadScene('level1', () => { __responsiveScene = true; });
  });
  await page.waitForFunction(() => __responsiveScene);
  await page.evaluate(() => {
    localStorage.setItem('TutorailFinished', 'true');
    cc.find('Map').getComponent('GameLogic').startGame();
  });
  await page.waitForFunction(() => cc.find('Player').getComponent('PlayerControl').currentCenter);
  await page.evaluate(() => cc.find('Player').getComponent('PlayerControl').missionFailed());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2);
  await page.evaluate(() => {
    cc.find('Map').getComponent('UIManager').countDownTime = 60;
    cc.find('Map').getComponent('ScoreManager')._lsNewRecord = true;
    cc.find('CameraCon/Camera/UILayer/OverGame/CurrentScore').getComponent(cc.Label).string = '10000000';
    cc.find('CameraCon/Camera/UILayer/OverGame/Top/score').getComponent(cc.Label).string = '10000000';
  });
  for (const [width, height] of [[393, 911], [320, 568], [360, 800], [375, 667], [390, 844], [430, 932], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(180);
    const bounds = await page.evaluate(() => {
      const base = 'CameraCon/Camera/UILayer/OverGame/';
      function rect(path) {
        const node = cc.find(path);
        const points = [[-node.width * node.anchorX, -node.height * node.anchorY], [node.width * (1 - node.anchorX), node.height * (1 - node.anchorY)]].map(p => cc.pointApplyAffineTransform(node.convertToWorldSpaceAR(cc.v2(...p)), cc.Camera.main.viewMatrix));
        return { path, x: Math.min(points[0].x, points[1].x), y: Math.min(points[0].y, points[1].y), width: Math.abs(points[1].x - points[0].x), height: Math.abs(points[1].y - points[0].y) };
      }
      const paths = ['Top/Score', 'CurrentScore', 'Top/TopScoreLable/best/ChineseBest', 'Top/score', 'AgainButton', 'TapToRestart/ChineseRestart', 'Top/Share', 'Top/Share/ChineseCaption', 'GlobalScoreStatus'];
      return { size: cc.view.getVisibleSize(), overlay: rect('CameraCon/Camera/deathboxUp/OverGameBg'), controls: paths.map(p => rect(base + p)), back: rect('CameraCon/Camera/deathboxUp/BackMM'), hpVisible: cc.find('Canvas/HP').activeInHierarchy, progressVisible: cc.find('CameraCon/Camera/deathboxUp/progressBar').activeInHierarchy };
    });
    const { overlay, size, controls, back } = bounds;
    assert.ok(overlay.x <= 1 && overlay.y <= 1 && overlay.x + overlay.width >= size.width - 1 && overlay.y + overlay.height >= size.height - 1, 'Game-over shade covers entire viewport after resize');
    for (const r of controls.concat(back)) assert.ok(r.x >= -1 && r.y >= -1 && r.x + r.width <= size.width + 1 && r.y + r.height <= size.height + 1, 'Control fits screen: ' + JSON.stringify({ width, height, r, size }));
    const [title, current, best, value, again, restart, share, caption, status] = controls;
    assert.ok(best.x + best.width <= value.x + 1, 'Personal record caption and number are separate');
    assert.ok(Math.abs(best.y + best.height / 2 - value.y - value.height / 2) < 1, 'Personal record caption and number align');
    const rows = [title, current, best, again, restart, share, caption, status];
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].y >= rows[i].y + rows[i].height - 1, 'Game-over rows do not overlap: ' + JSON.stringify({ width, height, above: rows[i - 1], below: rows[i] }));
    assert.equal(bounds.hpVisible, false, 'Gameplay HP cannot show through the revive control');
    assert.equal(bounds.progressVisible, false);
    const shaded = PNG.sync.read(await page.screenshot({ path: path.join(root, `artifacts/gameover-responsive-${width}x${height}.png`) }));
    await page.evaluate(() => { cc.find('CameraCon/Camera/deathboxUp/OverGameBg').active = false; });
    await page.waitForTimeout(60);
    const clear = PNG.sync.read(await page.screenshot());
    for (const [x, y] of [[3, 3], [width - 4, 3], [3, height - 4], [width - 4, height - 4]]) {
      const at = (y * width + x) * 4;
      const before = shaded.data[at] + shaded.data[at + 1] + shaded.data[at + 2];
      const after = clear.data[at] + clear.data[at + 1] + clear.data[at + 2];
      assert.ok(before < after * 0.85, `All four image corners are shaded (${width}x${height}, ${x},${y}): ${before}/${after}`);
    }
    await page.evaluate(() => { cc.find('CameraCon/Camera/deathboxUp/OverGameBg').active = true; });
    checks.push({ name: 'Responsive full-screen game-over shade, separated/aligned rows, hidden gameplay HUD and cloud status', width, height, passed: true });
  }
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').BackToMM());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 0 && cc.find('CameraCon/Camera/UILayer/OverGame/GlobalScoreStatus'));
  assert.equal(await page.evaluate(() => cc.find('CameraCon/Camera/UILayer/OverGame/GlobalScoreStatus').activeInHierarchy), false, 'Game-over cloud submission text cannot leak into the home screen');
  checks.push({ name: 'Returning home hides game-over submission text', passed: true });
  for (const mode of ['empty-map', 'nearest-nested-circle']) {
    await page.reload();
    await page.waitForFunction(() => window.__snailSceneReady);
    await page.evaluate(() => {
      localStorage.setItem('TutorailFinished', 'true');
      cc.find('Map').getComponent('GameLogic').startGame();
    });
    await page.waitForFunction(() => cc.find('Player').activeInHierarchy && cc.find('Player').getComponent('PlayerControl').currentCenter);
    await page.evaluate(() => {
      const player = cc.find('Player').getComponent('PlayerControl');
      player.missionFailed();
      player.missionFailed(); // duplicate collision must not schedule a second failure
    });
    await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2);
    const result = await page.evaluate(mode => {
      const map = cc.find('Map'), player = cc.find('Player').getComponent('PlayerControl');
      map.destroyAllChildren();
      const camera = player.cameraControl, cameraY = camera.node.y;
      player.node.setPosition(480, cameraY - 600);
      map.getComponent('ScoreManager').PlayerScore = 37;
      if (mode === 'nearest-nested-circle') {
        const parent = new cc.Node('TranslatedPattern');
        map.addChild(parent);
        parent.setPosition(90, 350);
        for (const [name, y] of [['FarCircle', cameraY + 200], ['NearestCircle', cameraY - 100], ['MiddleCircle', cameraY + 50]]) {
          const node = new cc.Node(name);
          node.setContentSize(80, 80);
          node.setPosition(390, y - 350);
          node.groupIndex = 9;
          parent.addChild(node);
          const sprite = node.addComponent(cc.Sprite);
          sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
          sprite.spriteFrame = player._reviveSpriteFrame;
          node.addComponent('Bonus');
        }
      }
      map.getComponent('GameLogic').CheckContinueGame();
      const current = player.currentCenter;
      return { target: current && current.name, hp: player.HP, initialHP: player.initHp, score: map.getComponent('ScoreManager').PlayerScore, invincible: player.InvincibleTime, dead: player.lsDead, uiState: map.getComponent('UIManager')._CurrentState, lives: cc.director.getScene().getComponentsInChildren('FacebookInstant')[0].MoreLiftCount, bodyActive: player.RBody.active, cameraEnabled: camera.enabled, cameraOffset: camera.node.y - player.node.y, viewHeight: cc.view.getVisibleSize().height, distance: current && cc.pDistance(player.node.getPosition(), player.circlePosition(current)), radius: player.currentRadius };
    }, mode);
    assert.equal(result.target, mode === 'empty-map' ? 'RevivePlatform' : 'NearestCircle');
    assert.equal(result.hp, result.initialHP);
    assert.equal(result.score, 37);
    assert.ok(result.invincible > 0);
    assert.equal(result.dead, false);
    assert.equal(result.uiState, 1);
    assert.equal(result.lives, 0);
    assert.equal(result.bodyActive, false);
    assert.equal(result.cameraEnabled, true);
    assert.ok(Math.abs(result.distance - result.radius) < 1);
    assert.ok(Math.abs(result.cameraOffset - result.viewHeight * 0.15) < 1);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => cc.find('Player').getComponent('PlayerControl').lsDead), false, 'No immediate death after revive');
    assert.equal(await page.evaluate(() => cc.find('Map').getComponent('UIManager')._CurrentState), 1, 'No delayed duplicate gameover after revive');
    await page.screenshot({ path: path.join(root, `artifacts/revive-${mode}.png`) });
    await page.touchscreen.tap(195, 420);
    await page.waitForTimeout(80);
    const jump = await page.evaluate(() => {
      const player = cc.find('Player').getComponent('PlayerControl');
      cc.find('Map').getComponent('GameLogic').CheckContinueGame();
      return { airborne: !player.currentCenter && player.RBody.active, speed: player.RBody.linearVelocity.mag(), score: cc.find('Map').getComponent('ScoreManager').PlayerScore };
    });
    assert.equal(jump.airborne, true, 'Touch works after revival');
    assert.ok(jump.speed > 0);
    assert.ok(jump.score > 37, 'A successful jump earns points without resetting the run');
    checks.push({ name: 'Safe revive, no second revive, preserved score, restored camera and touch input', mode, passed: true, result, jump });
  }
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), passed: errors.length === 0, environment: 'Desktop Chromium, actual Cocos scene and synthetic revive edge cases; not a physical phone test', checks, errors };
  fs.writeFileSync(path.join(root, 'artifacts/layout-revive-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
