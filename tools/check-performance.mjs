import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserOptions } from './browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const web = path.resolve(process.env.SNAIL_PERF_WEB || path.join(root, 'build/web'));
const out = path.resolve(process.env.SNAIL_PERF_REPORT || path.join(root, 'artifacts/performance-check.json'));
const recordOnly = process.argv.includes('--record-only');
const errors = [], samples = [];
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
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.__snailSceneReady);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.__perf = { topScoreReads: 0, layoutCalls: 0, layoutMs: 0, worldConversions: 0 };
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) { if (key === 'TopScore') __perf.topScoreReads++; return getItem.call(this, key); };
    const host = cc.find('CameraCon/Camera/UILayer/ReleasePresentation');
    const presenter = host.getComponents(cc.Component).find(c => c.bindings);
    const update = presenter.lateUpdate;
    presenter.lateUpdate = function () {
      const start = performance.now();
      try { return update.apply(this, arguments); }
      finally { __perf.layoutCalls++; __perf.layoutMs += performance.now() - start; }
    };
    const convert = cc.Node.prototype.convertToWorldSpaceAR;
    cc.Node.prototype.convertToWorldSpaceAR = function () { __perf.worldConversions++; return convert.apply(this, arguments); };
  });
  const sample = async name => {
    const result = await page.evaluate(async () => {
      Object.keys(__perf).forEach(k => { __perf[k] = 0; });
      const times = [], start = performance.now();
      let previous;
      while (performance.now() - start < 2200) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const now = performance.now();
        if (previous) times.push(now - previous);
        previous = now;
      }
      times.sort((a, b) => a - b);
      return { ...__perf, frames: times.length + 1, medianFrameMs: times[Math.floor(times.length * 0.5)], p95FrameMs: times[Math.floor(times.length * 0.95)] };
    });
    samples.push({ name, ...result });
    return result;
  };
  const idle = await sample('idle-home');
  if (!recordOnly) {
    assert.equal(idle.topScoreReads, 0, 'Idle UI never polls synchronous storage');
    assert.ok(idle.worldConversions < 10, 'Idle UI must not recalculate static transforms each frame');
  }
  await page.evaluate(() => {
    localStorage.setItem('TutorailFinished', 'true');
    cc.find('Map').getComponent('GameLogic').startGame();
  });
  await page.waitForFunction(() => cc.find('Player').activeInHierarchy && cc.find('Player').getComponent('PlayerControl').currentCenter);
  const gameplay = await sample('gameplay-with-home-hidden');
  if (!recordOnly) assert.equal(gameplay.topScoreReads, 0, 'Hidden UI never polls synchronous storage during play');
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(error.stack || error.message);
  process.exitCode = 1;
} finally {
  const report = { checkedAt: new Date().toISOString(), environment: 'Independent desktop Chromium; counters use actual Cocos calls. Frame times are observational, not WeChat simulator or phone measurements.', recordOnly, samples, errors };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
}
