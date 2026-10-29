import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { browserOptions } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..'), web = path.join(root, 'build/web');
const checks = [], errors = [];
// A physical screen and the drawable window need not be the same size.
const adapter = await build({ entryPoints: [path.join(root, 'tools/wechat-window-properties.js')], bundle: true, format: 'cjs', write: false });
for (const legacy of [false, true]) {
  let resize;
  const host = { screencanvas: { style: {} }, document: { dispatchEvent: event => assert.equal(event.type, 'resize') } };
  host.window = host;
  const module = { exports: {} };
  const info = { screenWidth: 393, screenHeight: 911, windowWidth: 393, windowHeight: 844, pixelRatio: 3 };
  vm.runInNewContext(adapter.outputFiles[0].text, { module, exports: module.exports, GameGlobal: host, wx: { ...(legacy ? {} : { getWindowInfo: () => info }), getSystemInfoSync: () => info, onWindowResize: fn => { resize = fn; } } });
  assert.equal(module.exports.innerHeight, 844);
  assert.equal(module.exports.devicePixelRatio, 3);
  resize({ size: { windowWidth: 430, windowHeight: 932 } });
  assert.equal(module.exports.innerHeight, 932);
  assert.equal(host.innerWidth, 430);
  assert.equal(host.screencanvas.style.height, '932px');
}
checks.push('Adapter uses window instead of physical screen, correct pixel ratio, legacy fallback and resize');

// This prelude is served only by this test, never included in a game package.
const prelude = `(function(){
 ['loadRes','loadResDir'].forEach(function(method){var original=cc.loader[method];cc.loader[method]=function(){
  var args=Array.prototype.slice.call(arguments),dir=args[0],index=args.length-1,callback=args[index],state=window.__streamTest;
  if(!state||typeof callback!=='function')return original.apply(this,args);
  state.calls[dir]=(state.calls[dir]||0)+1;
  if(state.failures[dir]>0){state.failures[dir]--;setTimeout(function(){callback(new Error('synthetic resource failure'));},0);return;}
  args[index]=function(error,value){setTimeout(function(){callback(error,value);},state.delays[dir]||0);};
  return original.apply(this,args);
 };});
})();\n`;
const server = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (p === '/' ? '/index.html' : p));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  res.end(p === '/src/project.js' ? prelude + fs.readFileSync(file, 'utf8') : fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch(browserOptions());
const url = `http://127.0.0.1:${server.address().port}`;
async function open(faults) {
  const page = await browser.newPage({ viewport: { width: 393, height: 911 }, hasTouch: true, isMobile: true });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(faults => { window.__streamTest = { calls: {}, failures: faults.failures || {}, delays: faults.delays || {} }; }, faults);
  await page.goto(url);
  await page.waitForFunction(() => window.__snailSceneReady);
  return page;
}
async function start(page) {
  await page.evaluate(() => { localStorage.setItem('TutorailFinished', 'true'); cc.find('Map').getComponent('GameLogic').startGame(); });
}
async function ready(page) {
  await page.waitForFunction(() => cc.find('MapDataManager').getComponent('UtilManager').GetMapFinished(), null, { timeout: 12000 });
  await page.waitForFunction(() => cc.find('Player').getComponent('PlayerControl').currentCenter);
}
async function tap(page, name) {
  const point = await page.evaluate(name => {
    const node = cc.find(name);
    let p = node.convertToWorldSpaceAR(cc.Vec2.ZERO);
    p = cc.pointApplyAffineTransform(p, cc.Camera.main.viewMatrix);
    const viewport = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
    return { x: (viewport.x + p.x * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (viewport.y + p.y * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
  }, name);
  await page.touchscreen.tap(point.x, point.y);
}
try {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const page = await open({ delays: { 'Level/LV1Map': 1800, 'Prefab/GoodFood': 2300, 'Texture/BG': 5500 }, failures: { 'Level/LV2Map': 1 } });
  await start(page);
  await page.waitForTimeout(250);
  const early = await page.evaluate(() => {
    const util = cc.find('MapDataManager').getComponent('UtilManager');
    return { ready: util.GetMapFinished(), late: !!util.MemoryMapArray[10], delayed: !!util.MemoryMapArray[1], center: !!cc.find('Player').getComponent('PlayerControl').currentCenter };
  });
  assert.equal(early.ready, false, 'Completing the last CSV row does not mean all maps are ready');
  assert.equal(early.late, true);
  assert.equal(early.delayed, false);
  assert.equal(early.center, false, 'Gameplay does not start before critical resources');
  await ready(page);
  const loaded = await page.evaluate(() => {
    const util = cc.find('MapDataManager').getComponent('UtilManager');
    return { arrays: util.MemoryMapArray.map(a => a && a.length), same: util.MemoryMapArray[1] === util.MemoryMapArray[3], requests: __streamTest.calls };
  });
  assert.ok(loaded.arrays.every(n => n > 0));
  assert.equal(loaded.same, true, 'Repeated difficulty directories share their loaded prefabs');
  assert.equal(loaded.requests['Level/LV1Map'], 1);
  assert.equal(loaded.requests['Level/LV2Map'], 2, 'Transient load failure retries');
  checks.push({ name: 'Out-of-order resources, critical prefab gating, duplicate directory and transient failure', early, loaded });

  await page.evaluate(() => {
    cc.find('Player').getComponent('PlayerControl').InvincibleTime = 1000;
    cc.find('CameraCon/Camera').getComponent('cameraControl').CameraPause = true;
    cc.find('Map').getComponent('ScoreManager').PlayerScore = 650;
  });
  assert.equal(await page.evaluate(() => cc.find('Canvas').getComponent('BgChangeInstance')._loadFinished), false);
  for (let i = 0; i < 30; i++) {
    const background = await page.evaluate(() => {
      const node = cc.find('Canvas/bg');
      return { opacity: node.opacity, frame: !!node.getComponent(cc.Sprite).spriteFrame };
    });
    assert.equal(background.opacity, 255, 'The underlying background stays opaque while resources/transition are pending');
    assert.equal(background.frame, true, 'Delayed background never replaces the current frame with null');
    await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => cc.find('Canvas').getComponent('BgChangeInstance')._loadFinished);
  for (const score of [50, 150, 650, 1600]) {
    await page.evaluate(score => { cc.find('Map').getComponent('ScoreManager').PlayerScore = score; }, score);
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => cc.find('Canvas/bg').opacity), 255);
  }
  await page.waitForFunction(() => cc.find('Canvas/bg').getComponent(cc.Sprite).spriteFrame.name === 'back05', null, { timeout: 5000 });
  await page.evaluate(() => cc.find('Player').getComponent('PlayerControl').missionFailed());
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 2);
  await page.waitForTimeout(100);
  const shade = await page.evaluate(() => ({ graphic: !!cc.find('CameraCon/Camera/deathboxUp/OverGameBg/FullScreenShade'), legacy: cc.find('CameraCon/Camera/deathboxUp/OverGameBg').getComponent(cc.Sprite).enabled }));
  assert.equal(shade.graphic, true);
  assert.equal(shade.legacy, false);
  const screenshot = PNG.sync.read(await page.screenshot({ path: path.join(root, 'artifacts/gameover-after-background-switch.png') }));
  for (const y of [3, screenshot.height - 4]) {
    let nonBlack = 0;
    for (let x = 3; x < screenshot.width - 3; x++) {
      const at = (y * screenshot.width + x) * 4;
      if (screenshot.data[at] + screenshot.data[at + 1] + screenshot.data[at + 2] > 15) nonBlack++;
    }
    assert.ok(nonBlack > screenshot.width * 0.95, 'Changed background and drawn shade still cover both screen edges');
  }
  checks.push('Delayed background, rapid score thresholds, crossfade and actual game-over edge pixels');
  await page.close();

  const streaming = await open({});
  await start(streaming); await ready(streaming);
  await streaming.evaluate(() => { cc.find('Player').getComponent('PlayerControl').InvincibleTime = 1000; });
  const landings = [];
  for (let jump = 0; jump < 8; jump++) {
    await streaming.waitForFunction(() => {
      const player = cc.find('Player').getComponent('PlayerControl'), current = player.currentCenter;
      if (!current || player.lsDead) return false;
      const center = player.circlePosition(current), position = player.node.getPosition();
      const delta = cc.pSub(position, center);
      const tangent = cc.pNormalize(player.lsClockWise ? cc.pPerp(delta) : cc.pRPerp(delta));
      const target = cc.find('Map').getComponentsInChildren('Bonus').find(candidate => {
        if (candidate.node.groupIndex !== 9) return false;
        const goal = player.circlePosition(candidate.node), direction = cc.pSub(goal, position);
        if (goal.y <= center.y + 80 || cc.pLength(direction) > 1000) return false;
        const along = tangent.x * direction.x + tangent.y * direction.y;
        const across = Math.abs(tangent.x * direction.y - tangent.y * direction.x);
        return along > 50 && across < candidate.node.width * Math.abs(candidate.node.scaleX) * 0.15;
      });
      if (!target) return false;
      window.__launchCircle = current.__instanceId;
      window.__launchHeight = center.y;
      return true;
    }, null, { polling: 'raf', timeout: 8000 });
    await streaming.touchscreen.tap(196, 500);
    await streaming.waitForFunction(() => {
      const player = cc.find('Player').getComponent('PlayerControl');
      return player.currentCenter && player.currentCenter.__instanceId !== __launchCircle && !player.lsDead;
    }, null, { timeout: 4000 });
    const landed = await streaming.evaluate(() => {
      const player = cc.find('Player').getComponent('PlayerControl');
      return { from: __launchHeight, to: player.circlePosition(player.currentCenter).y, chunks: cc.find('MapDataManager').getComponent('MapDataManager').currentMapCount };
    });
    assert.ok(landed.to > landed.from, 'A real touch/physics jump lands on a higher circle');
    landings.push(landed);
  }
  checks.push({ name: 'Eight real touchscreen launches and physics landings across chunk seams; invincibility isolates map continuity', landings });
  await streaming.evaluate(() => {
    cc.find('Player').active = false; // Synthetic camera stress, not a claim of natural human play.
    cc.find('CameraCon/Camera').getComponent('cameraControl').CameraPause = true;
  });
  let final;
  for (let i = 0; i < 60; i++) {
    const before = await streaming.evaluate(() => {
      const map = cc.find('Map'), data = cc.find('MapDataManager').getComponent('MapDataManager');
      const triggers = map.getComponentsInChildren('LoadNextMap').filter(c => c.node.activeInHierarchy && !c._consumed && c.node.getComponent(cc.BoxCollider).enabled);
      if (!triggers.length) throw new Error('No next-map trigger remains');
      const frontier = Math.max(...triggers.map(c => c.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y));
      const camera = cc.find('CameraCon/Camera');
      camera.y = camera.parent.convertToNodeSpaceAR(cc.v2(camera.convertToWorldSpaceAR(cc.Vec2.ZERO).x, frontier + cc.view.getVisibleSize().height)).y;
      return data.currentMapCount;
    });
    await streaming.waitForFunction(count => cc.find('MapDataManager').getComponent('MapDataManager').currentMapCount > count, before, { timeout: 2000 });
    await streaming.waitForTimeout(40);
    final = await streaming.evaluate(() => {
      const map = cc.find('Map'), data = cc.find('MapDataManager').getComponent('MapDataManager');
      const triggers = map.getComponentsInChildren('LoadNextMap').filter(c => c.node.activeInHierarchy && !c._consumed);
      const newest = triggers.sort((a, b) => b.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y - a.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y)[0];
      if (!newest) throw new Error('Generated chunk has no continuation');
      // Remove passed fixture chunks so an artificial camera teleport does not
      // accumulate old colliders that natural scrolling would have removed.
      const keep = newest.node.parent;
      map.children.slice().forEach(n => { if (n !== keep && n.getComponent('BonusCreator')) n.destroy(); });
      const circles = keep.getComponentsInChildren('Bonus');
      const top = cc.find('CameraCon/Camera').convertToWorldSpaceAR(cc.v2(0, cc.view.getVisibleSize().height / 2)).y;
      return { count: data.currentMapCount, level: data.currentLevel, circles: circles.length, top, frontier: newest.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y, highestCircle: Math.max(...circles.map(c => c.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y)), ahead: circles.some(c => c.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y > top), finite: circles.every(c => Number.isFinite(c.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y)) };
    });
    assert.ok(final.circles > 0 && final.finite, 'Every continuation includes real circles at finite world positions');
    assert.equal(final.ahead, true, 'New circles exist ahead of the viewport: ' + JSON.stringify(final));
  }
  assert.ok(final.count >= 60);
  assert.equal(final.level, 10, 'Progression reaches the final difficulty and keeps going');
  await streaming.evaluate(() => {
    const c = cc.find('Map').getComponentsInChildren('LoadNextMap').find(c => c.node.activeInHierarchy && !c._consumed);
    const data = cc.find('MapDataManager').getComponent('MapDataManager');
    const before = data.currentMapCount;
    c.onCollisionEnter(); c.onCollisionEnter();
    if (data.currentMapCount !== before + 1) throw new Error('Repeated collision duplicated a chunk');
  });
  checks.push({ name: '60 fast camera skips across every difficulty, live circles and idempotent collision', final });
  await streaming.close();

  const retry = await open({ failures: { 'Level/LV2Map': 99 } });
  await start(retry);
  await retry.waitForFunction(() => cc.find('MapDataManager').getComponent('UtilManager').loadError);
  assert.equal(await retry.evaluate(() => cc.find('MapDataManager').getComponent('UtilManager').GetMapFinished()), false);
  assert.match(await retry.evaluate(() => cc.find('CameraCon/Camera/UILayer/ReleasePresentation/ResourceStatus').getComponent(cc.Label).string), /点此重试/);
  await retry.evaluate(() => { __streamTest.failures['Level/LV2Map'] = 0; });
  await tap(retry, 'CameraCon/Camera/UILayer/ReleasePresentation/ResourceStatus');
  await ready(retry);
  checks.push('Persistent resource failure shows retry; actual touch resumes loading and playable start');
  await retry.close();
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message); process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), environment: 'Actual Cocos scene with synthetic loader delays/failures and camera stress; adapter tested with synthetic native window metrics, not phone certification', checks, errors };
  fs.writeFileSync(path.join(root, 'artifacts/progression-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close(); server.close();
}
