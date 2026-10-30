import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '..');
const web = path.join(root, 'build/web');
const config = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'source/assets/Script/ReleaseConfig.js'), 'utf8'), { module: config });
const release = config.exports;
const out = path.join(root, 'artifacts', 'release-' + release.version);
fs.mkdirSync(out, { recursive: true });
const errors = [], checks = [], browserWarnings = [];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/favicon.ico') { res.end(); return; }
  const file = path.resolve(web, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(web + '/') || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(browserOptions());
const top = 'CameraCon/Camera/deathboxUp/';
const layer = 'CameraCon/Camera/UILayer/';
const host = layer + 'ReleasePresentation/';
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const message = m.text();
    // The fixed legacy web engine calls preventDefault on every touchstart.
    // Chromium may make synthetic scroll-start events non-cancelable. Keep
    // that exact intervention visible as a platform warning, not a JS failure.
    if (message === 'Ignored attempt to cancel a touchstart event with cancelable=false, for example because scrolling is in progress and cannot be interrupted.') browserWarnings.push(message);
    else errors.push(message);
  });
  const tapNode = async nodePath => {
    const point = await page.evaluate(nodePath => {
      const node = cc.find(nodePath);
      if (!node || !node.activeInHierarchy) throw new Error('Hidden control: ' + nodePath);
      let rect = node.getBoundingBoxToWorld();
      if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
      const viewport = cc.view.getViewPortRect(), frame = cc.view.getFrameSize(), dpr = cc.view.getDevicePixelRatio();
      return { x: (viewport.x + (rect.x + rect.width / 2) * cc.view.getScaleX()) / (frame.width * dpr) * innerWidth, y: innerHeight - (viewport.y + (rect.y + rect.height / 2) * cc.view.getScaleY()) / (frame.height * dpr) * innerHeight };
    }, nodePath);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(80);
  };
  await page.goto(base);
  // Native WeChat canvas has no browser page scrolling; reproduce that for
  // the isolated Chromium touch-gesture check instead of starting a DOM scroll.
  await page.addStyleTag({ content: 'html, body, #GameCanvas { touch-action: none; }' });
  await page.waitForFunction(() => window.__snailSceneReady);
  await page.waitForFunction(p => !!cc.find(p).getComponent(cc.Sprite).spriteFrame, top + 'MMlogo/HomeSnailMascot');
  for (const [width, height] of [[390, 844], [430, 932], [320, 568], [375, 667], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(p => cc.find(p).getComponent(cc.Label).string, top + 'MMlogo/OfficialGameTitle'), release.displayName);
    assert.equal(await page.evaluate(p => cc.find(p).getComponent(cc.Sprite).enabled, top + 'MMlogo'), false, 'Old English image title is hidden');
    const bounds = await page.evaluate(() => {
      const paths = ['CameraCon/Camera/deathboxUp/MMlogo/OfficialGameTitle', 'CameraCon/Camera/deathboxUp/MMlogo/HomeSnailMascot', 'CameraCon/Camera/deathboxUp/MMlogo/GameTagline', 'CameraCon/Camera/UILayer/Top/TopScoreLable/best/ChineseBest', 'CameraCon/Camera/UILayer/Top/score/ChineseBestValue', 'CameraCon/Camera/deathboxBottom/Setting/ChineseCaption', 'CameraCon/Camera/deathboxBottom/Tutotail/ChineseCaption', 'CameraCon/Camera/deathboxBottom/LeaderBoard/ChineseCaption'];
      const size = cc.view.getVisibleSize();
      return paths.map(path => {
        const node = cc.find(path);
        const a = node.convertToWorldSpaceAR(cc.v2(-node.width * node.anchorX, -node.height * node.anchorY));
        const b = node.convertToWorldSpaceAR(cc.v2(node.width * (1 - node.anchorX), node.height * (1 - node.anchorY)));
        let rect = cc.rect(a.x, a.y, b.x - a.x, b.y - a.y);
        if (cc.Camera.main && cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
        return { path, x: rect.x, y: rect.y, width: rect.width, height: rect.height, inside: rect.x >= -0.001 && rect.y >= -0.001 && rect.x + rect.width <= size.width + 0.001 && rect.y + rect.height <= size.height + 0.001 };
      });
    });
    assert.ok(bounds.filter(b => !b.path.endsWith('HomeSnailMascot')).every(b => b.inside), 'All text stays inside viewport: ' + JSON.stringify(bounds));
    const [titleBounds, mascotBounds, taglineBounds, bestBounds, valueBounds] = bounds;
    const screenWidth = await page.evaluate(() => cc.view.getVisibleSize().width);
    assert.ok(Math.abs(titleBounds.x + titleBounds.width / 2 - screenWidth / 2) < 1, 'Title text itself centers on screen');
    assert.ok(Math.abs(taglineBounds.x + taglineBounds.width / 2 - screenWidth / 2) < 1, 'Subtitle centers on screen');
    assert.ok(mascotBounds.x + mascotBounds.width / 2 < screenWidth / 2, 'Mascot remains on the left');
    // Bounds of the largest alpha>=220 connected component in the unchanged
    // 1536x1024 PNG: x=440..1381, y=104..913. Exclude trailing speed strokes
    // when comparing the visible character with the user's red rectangle.
    const bodyLeft = (mascotBounds.x + mascotBounds.width * 440 / 1536) / screenWidth;
    const bodyRight = (mascotBounds.x + mascotBounds.width * 1382 / 1536) / screenWidth;
    assert.ok(bodyLeft >= 0.11 && bodyLeft <= 0.15 && bodyRight >= 0.57 && bodyRight <= 0.61, 'Visible snail body follows the marked left region, not a centered sprite canvas');
    assert.ok(Math.abs(mascotBounds.width / screenWidth - 0.75) < 0.001, 'Mascot is exactly 3x the screenshot 240/960 width');
    assert.ok(await page.evaluate(p => { const title = cc.find(p), mascot = title.parent.getChildByName('HomeSnailMascot'); return title.zIndex > mascot.zIndex; }, top + 'MMlogo/OfficialGameTitle'), 'Title is explicitly drawn above the large mascot');
    assert.ok(Math.abs(mascotBounds.width / mascotBounds.height - 1.5) < 0.01, 'Mascot keeps original proportions');
    assert.ok(titleBounds.y > taglineBounds.y + taglineBounds.height, 'Title and subtitle do not overlap');
    assert.ok(mascotBounds.y > Math.max(bestBounds.y + bestBounds.height, valueBounds.y + valueBounds.height), 'Mascot stays above record text');
    assert.ok(taglineBounds.y > Math.max(bestBounds.y + bestBounds.height, valueBounds.y + valueBounds.height), 'Subtitle stays above record text');
    await page.screenshot({ path: path.join(out, `menu-${width}x${height}.png`) });
    {
      // Compare the actual opaque outline pixels with/without the decorative
      // sprite. A reversed draw order would paint the white snail over them.
      const foreground = PNG.sync.read(await page.screenshot());
      await page.evaluate(p => { cc.find(p).getComponent(cc.Sprite).enabled = false; }, top + 'MMlogo/HomeSnailMascot');
      await page.waitForTimeout(80);
      const withoutMascot = PNG.sync.read(await page.screenshot());
      const screenHeight = await page.evaluate(() => cc.view.getVisibleSize().height);
      const samples = [];
      for (const rect of [titleBounds, taglineBounds]) {
        let outlinePixels = 0, preserved = 0, glyphBottom = 0;
        for (let y = Math.max(0, Math.floor((screenHeight - rect.y - rect.height) / screenHeight * foreground.height)); y < Math.min(foreground.height, Math.ceil((screenHeight - rect.y) / screenHeight * foreground.height)); y++) {
          for (let x = Math.max(0, Math.floor(rect.x / screenWidth * foreground.width)); x < Math.min(foreground.width, Math.ceil((rect.x + rect.width) / screenWidth * foreground.width)); x++) {
          const i = (y * foreground.width + x) * 4;
          if ([25, 53, 82].every((v, c) => Math.abs(withoutMascot.data[i + c] - v) <= 2)) {
            outlinePixels++;
            glyphBottom = Math.max(glyphBottom, y + 1);
            if ([0, 1, 2].every(c => Math.abs(foreground.data[i + c] - withoutMascot.data[i + c]) <= 3)) preserved++;
          }
          }
        }
        assert.ok(outlinePixels > 20 && preserved / outlinePixels > 0.98, 'Actual title and subtitle outline remain visible above the overlapping mascot');
        samples.push({ path: rect.path, outlinePixels, preserved });
        if (rect === titleBounds) {
          const footBottom = (screenHeight - mascotBounds.y - mascotBounds.height + mascotBounds.height * 914 / 1024) / screenHeight * foreground.height;
          assert.ok(Math.abs(footBottom - glyphBottom) <= 3, 'Visible snail foot aligns with rendered title glyph bottom within 3 screen pixels');
          checks.push({ name: 'Visible foot aligns with actual rendered title bottom', width, height, footBottom, glyphBottom });
        }
      }
      await page.evaluate(p => { cc.find(p).getComponent(cc.Sprite).enabled = true; }, top + 'MMlogo/HomeSnailMascot');
      checks.push({ name: 'Rendered title and subtitle pixels stay intact when the repositioned mascot overlaps behind them', samples });
    }
    for (const [link, expected] of [['AgePrompt', '8+ 适龄提示'], ['HealthPrompt', '健康游戏忠告']]) {
      await tapNode(host + 'ChineseSafetyLinks/' + link);
      assert.equal(await page.evaluate(p => cc.find(p).getComponent(cc.Label).string, 'CameraCon/Camera/ChineseSafetyNotice/NoticeTitle'), expected);
      assert.equal(await page.evaluate(() => cc.find('Map').getComponent('UIManager')._CurrentState), 0, 'Notice must not start gameplay');
      const image = PNG.sync.read(await page.screenshot({ path: path.join(out, `${link}-${width}x${height}.png`) }));
      for (const [x, y] of [[3, 3], [image.width - 4, 3], [3, image.height - 4], [image.width - 4, image.height - 4]]) {
        const i = (image.width * y + x) * 4;
        assert.ok(image.data[i] + image.data[i + 1] + image.data[i + 2] < 90, 'Notice backdrop covers all four corners');
      }
      await tapNode('CameraCon/Camera/ChineseSafetyNotice/NoticeClose');
      assert.equal(await page.evaluate(p => !!cc.find(p), 'CameraCon/Camera/ChineseSafetyNotice'), false);
    }
    await tapNode('CameraCon/Camera/deathboxBottom/Tutotail');
    await page.waitForFunction(p => cc.find(p).activeInHierarchy, layer + 'tut');
    await page.evaluate(p => cc.find(p).getComponent(cc.PageView).scrollToPage(0, 0), layer + 'tut');
    await page.waitForTimeout(80);
    if (width === 390) {
      const swipe = await page.evaluate(p => {
        const node = cc.find(p + '/view');
        const a = node.convertToWorldSpaceAR(cc.v2(-node.width * node.anchorX, -node.height * node.anchorY));
        const b = node.convertToWorldSpaceAR(cc.v2(node.width * (1 - node.anchorX), node.height * (1 - node.anchorY)));
        let rect = cc.rect(a.x, a.y, b.x - a.x, b.y - a.y);
        if (cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
        const size = cc.view.getVisibleSize();
        return { from: (rect.x + rect.width * 0.85) / size.width * innerWidth, to: (rect.x + rect.width * 0.15) / size.width * innerWidth,
          y: innerHeight - (rect.y + rect.height / 2) / size.height * innerHeight };
      }, layer + 'tut');
      // This test owns an isolated local Chromium, not a signed-in browser.
      // Cocos ignores mouse drags when the mobile context exposes touch input.
      const touch = await page.context().newCDPSession(page);
      for (let i = 0; i < 3; i++) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: swipe.from, y: swipe.y }] });
        for (let step = 1; step <= 12; step++) {
          await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: swipe.from + (swipe.to - swipe.from) * step / 12, y: swipe.y }] });
          await page.waitForTimeout(12);
        }
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(400);
      }
      await touch.detach();
      assert.equal(await page.evaluate(p => cc.find(p).getComponent(cc.PageView).getCurrentPageIndex(), layer + 'tut'), 3, 'Real swipe input reaches the items page: ' + JSON.stringify(swipe));
    } else {
      await page.evaluate(p => cc.find(p).getComponent(cc.PageView).scrollToPage(3, 0), layer + 'tut');
      await page.waitForTimeout(80);
    }
    const tutorialRows = await page.evaluate(p => {
      const view = cc.find(p + '/view'), panel = cc.find(p + '/view/content/page_5');
      function rect(node) {
        const a = node.convertToWorldSpaceAR(cc.v2(-node.width * node.anchorX, -node.height * node.anchorY));
        const b = node.convertToWorldSpaceAR(cc.v2(node.width * (1 - node.anchorX), node.height * (1 - node.anchorY)));
        return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
      }
      return { clip: rect(view), rows: [['bonus', 'Heal HP'], ['enemy', 'Damage HP'], ['monsterBig', 'Oni Kill']].map(([a, b]) => {
        const icon = panel.getChildByName(a), caption = panel.getChildByName(b);
        return { icon: rect(icon), text: rect(caption), caption: caption.getComponent(cc.Label).string,
          independent: caption.parent === panel, number: icon.getChildByName('numb') && rect(icon.getChildByName('numb')) };
      }) };
    }, layer + 'tut');
    const inside = (rect, clip) => rect.x >= clip.x - 0.01 && rect.y >= clip.y - 0.01 && rect.x + rect.width <= clip.x + clip.width + 0.01 && rect.y + rect.height <= clip.y + clip.height + 0.01;
    for (const row of tutorialRows.rows) {
      assert.ok(row.independent && inside(row.icon, tutorialRows.clip) && inside(row.text, tutorialRows.clip), 'Tutorial icon and independent caption stay inside the page mask');
      assert.ok(row.icon.x + row.icon.width + 10 < row.text.x, 'Tutorial icon never overlaps its caption');
      assert.ok(Math.abs(row.icon.y + row.icon.height / 2 - row.text.y - row.text.height / 2) < 0.01, 'Caption and icon share a row center');
      if (row.number) assert.ok(inside(row.number, row.icon), 'Item digit stays inside its own icon');
    }
    assert.deepEqual(tutorialRows.rows.map(row => row.caption), ['收集道具恢复生命值', '碰到障碍会损失生命值', '击中怪物，游戏失败']);
    assert.ok(tutorialRows.rows.every(row => Math.abs(row.icon.x - tutorialRows.rows[0].icon.x) < 0.01), 'All three icons align at the left edge');
    assert.ok(tutorialRows.rows.every(row => Math.abs(row.text.x - tutorialRows.rows[0].text.x) < 0.01), 'All descriptions align in a separate text column');
    await page.screenshot({ path: path.join(out, `tutorial-items-${width}x${height}.png`) });
    await tapNode(layer + 'tut/CloseButton');
    assert.equal(await page.evaluate(p => cc.find(p).activeInHierarchy, layer + 'tut'), false, 'Tutorial close button returns to homepage');
    checks.push({ name: 'Chinese item page: left aligned icons, separate complete captions, digit bounds and working close', width, height, realSwipe: width === 390 });
    checks.push({ name: 'Chinese official title and working age/health dialogs', width, height });
  }
  await page.evaluate(() => {
    window.wx = {
      getWindowInfo: () => ({ windowWidth: innerWidth, windowHeight: innerHeight }),
      getMenuButtonBoundingClientRect: () => ({ bottom: 82 })
    };
  });
  await page.setViewportSize({ width: 393, height: 911 });
  await page.waitForTimeout(300);
  const titleTop = await page.evaluate(p => {
      const node = cc.find(p);
      let rect = node.getBoundingBoxToWorld();
      if (cc.Camera.main.containsNode(node)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
      const size = cc.view.getVisibleSize();
      return (size.height - rect.y - rect.height) / size.height * innerHeight;
  }, top + 'MMlogo/OfficialGameTitle');
  assert.ok(titleTop >= 93, 'Centered foreground title stays below the native capsule');
  await page.screenshot({ path: path.join(out, 'menu-393x911-capsule.png') });
  await page.evaluate(() => { delete window.wx; });
  checks.push({ name: 'Foreground title avoids the native WeChat capsule on a tall phone' });
  await page.setViewportSize({ width: 390, height: 844 });
  const share = await page.evaluate(() => {
    let captured;
    window.wx = { shareAppMessage: data => { captured = data; } };
    cc.find('Map').getComponent('GameLogic').ShareGame();
    delete window.wx;
    return captured;
  });
  assert.equal(share.title, release.shareTitle);
  const project = JSON.parse(fs.readFileSync(path.join(root, 'build/wechat/project.config.json')));
  assert.equal(project.projectname, release.displayName);
  assert.equal(project.appid, release.appId);
  for (const platform of ['web', 'wechat']) {
    const bundle = fs.readFileSync(path.join(root, 'build', platform, 'src/project.js'), 'utf8');
    assert.ok(bundle.includes(release.shareTitle) && bundle.includes(release.displayName));
    assert.ok(!bundle.includes('蜗牛向前冲软件'), 'Old display name does not remain in the game bundle');
    const mascotFile = path.join(root, 'build', platform, platform === 'wechat' ? 'assets/brand' : 'brand', 'home-snail-rush.png');
    assert.ok(fs.readFileSync(mascotFile).equals(fs.readFileSync(path.join(root, 'source/assets/resources/home-snail-rush.png'))), 'Both builds contain the approved standalone mascot');
  }
  checks.push({ name: 'Actual share call and both build identities match release configuration' });

  // Delay the real prefab fetch, then use real touch input before it is ready.
  // Closing while pending must cancel the UI; opening again must recover.
  let delayedRequests = 0;
  await page.route('**/res/import/0f/0fb6bed7e*.json', async route => {
    delayedRequests++;
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.reload();
  await page.waitForFunction(() => window.__snailSceneReady);
  assert.equal(await page.evaluate(() => !!cc.find('MapDataManager').getComponent('UtilManager')._LdEntry), false);
  await page.touchscreen.tap(320, 760);
  await page.waitForFunction(p => !!cc.find(p), layer + 'Leaderboard/RecordLoadingStatus');
  assert.match(await page.evaluate(p => cc.find(p).getComponent(cc.Label).string, layer + 'Leaderboard/RecordLoadingStatus'), /正在准备/);
  await page.screenshot({ path: path.join(out, 'records-loading.png') });
  await page.evaluate(() => cc.find('Map').getComponent('UIManager').SubBackMM());
  await page.waitForFunction(() => !!cc.find('MapDataManager').getComponent('UtilManager')._LdEntry);
  assert.equal(await page.evaluate(p => !!cc.find(p), layer + 'Leaderboard/PlayerProfilePanel'), false, 'No delayed profile popup after leaving');
  await page.touchscreen.tap(320, 760);
  await page.waitForFunction(p => !!cc.find(p), layer + 'Leaderboard/PlayerProfilePanel');
  assert.equal(await page.evaluate(p => cc.find(p).getComponent('LeaderBoardManager').ldArray.length, layer + 'Leaderboard'), 1);
  await page.screenshot({ path: path.join(out, 'records-recovered.png') });
  assert.equal(delayedRequests, 1);
  checks.push({ name: 'Real delayed prefab fetch: loading message, safe close, reopen with record and profile' });

  // Also exercise the pending-open update path without closing the board.
  await page.unroute('**/res/import/0f/0fb6bed7e*.json');
  await page.route('**/res/import/0f/0fb6bed7e*.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 2500));
    await route.continue();
  });
  await page.reload();
  await page.waitForFunction(() => window.__snailSceneReady);
  await page.touchscreen.tap(320, 760);
  await page.waitForFunction(p => !!cc.find(p), layer + 'Leaderboard/PlayerProfilePanel');
  assert.equal(await page.evaluate(p => cc.find(p).getComponent('LeaderBoardManager').ldArray.length, layer + 'Leaderboard'), 1);
  assert.equal(await page.evaluate(p => cc.find(p).active, layer + 'Leaderboard/RecordLoadingStatus'), false);
  checks.push({ name: 'Open record page automatically recovers when delayed resource completes' });
  await page.evaluate(() => {
    cc.find('Map').getComponent('UIManager').SubBackMM();
    localStorage.setItem('TutorailFinished', 'true');
  });
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(300);
  await tapNode(layer + 'startGame');
  await page.waitForFunction(() => cc.find('Map').getComponent('UIManager')._CurrentState === 1);
  assert.equal(await page.evaluate(p => cc.find(p).activeInHierarchy, top + 'MMlogo/HomeSnailMascot'), false, 'Homepage mascot is hidden during gameplay');
  checks.push({ name: 'Mascot moved into marked left title region, size retained, centered foreground text, record separation and gameplay hiding across five sizes' });
  checks.push({ name: 'Compact tablet layout still starts gameplay with a real touch on the resized play button' });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), version: release.version, displayName: release.displayName, passed: errors.length === 0, environment: 'Desktop Chromium, actual Cocos scene and delayed local resource fetch; not WeChat phone validation', checks, browserWarnings, errors };
  fs.writeFileSync(path.join(out, 'release-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
