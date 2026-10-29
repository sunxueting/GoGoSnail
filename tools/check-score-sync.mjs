import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../source/assets/Script/CloudRanking.js', import.meta.url), 'utf8');
function fixture() {
  const module = { exports: {} }, calls = [], timers = new Set();
  let failSubmits = 0, startFailures = 0, joined = true, highest = 167, runId = 0, gate;
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms < 10000 ? 1 : 1000);
    timers.add(id); return id;
  };
  const wx = { cloud: { init() {}, callFunction(options) {
    const event = options.data; calls.push(event);
    const respond = () => {
      if ((event.action === 'submit' && failSubmits-- > 0) || (event.action === 'start' && startFailures-- > 0)) { options.fail({}); return; }
      let data = {};
      if (event.action === 'start') {
        if (!joined) { options.success({ result: { ok: false, code: 'JOIN_REQUIRED' } }); return; }
        data = { runId: String(++runId) };
      }
      if (event.action === 'submit') {
        assert.equal(event.runId, String(runId), 'Old score is submitted before issuing a replacement run token');
        highest = Math.max(highest, event.score); data = { best: highest };
      }
      if (event.action === 'leave') joined = false;
      if (event.action === 'list') data = { joined, highest, entries: [], total: 1, mine: { score: highest } };
      options.success({ result: { ok: true, data } });
    };
    if (gate && event.action === 'submit') gate.push(respond); else queueMicrotask(respond);
  } } };
  vm.runInNewContext(source, { module, require: () => ({ environmentId: 'synthetic', functionName: 'test' }), wx,
    Promise, setTimeout: later, clearTimeout: id => { clearTimeout(id); timers.delete(id); }, isFinite });
  return { api: module.exports, calls, fail: n => { failSubmits = n; }, failStart: n => { startFailures = n; },
    hold: () => { gate = []; }, release: () => { const waiting = gate; gate = null; waiting.forEach(fn => fn()); },
    unjoined: () => { joined = false; }, highest: () => highest,
    close: () => timers.forEach(clearTimeout) };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const checks = [];
{
  const f = fixture();
  assert.equal(f.api.state().data, null);
  f.api.beginRun(); await f.api.submit(240);
  assert.equal(f.highest(), 240, 'Cold-start participation/list race does not discard an enrolled score');
  assert.equal(f.api.state().data.highest, 240);
  assert.match(f.api.submission(), /已同步/);
  checks.push('Enrolled cold start without cached list uploads 240 and refreshes cloud highest from 167 to 240');
  f.close();
}
{
  const f = fixture(); f.fail(2); f.api.beginRun(); await f.api.submit(240);
  assert.equal(f.calls.filter(x => x.action === 'submit').length, 3);
  assert.equal(f.highest(), 240); assert.match(f.api.submission(), /已同步/);
  checks.push('Two transient failures retry and only report success after acknowledgement'); f.close();
}
{
  const f = fixture(); f.fail(3); f.api.beginRun(); await f.api.submit(240);
  assert.equal(f.highest(), 167); assert.match(f.api.submission(), /未同步/);
  await f.api.retryScore(); assert.equal(f.highest(), 240);
  checks.push('Exhausted retries retain current score; explicit retry sends it without importing historical best'); f.close();
}
{
  const f = fixture(); f.failStart(3); f.api.beginRun(); await f.api.submit(240);
  assert.equal(f.highest(), 167);
  await f.api.retryScore(); assert.equal(f.highest(), 240);
  checks.push('Failed server start can be retried for the current run'); f.close();
}
{
  const f = fixture(); f.hold(); f.api.beginRun(); const first = f.api.submit(240); await tick();
  f.api.beginRun(); const second = f.api.submit(180); await tick();
  assert.equal(f.calls.filter(x => x.action === 'start').length, 1);
  f.release(); await Promise.all([first, second]);
  assert.equal(f.calls.filter(x => x.action === 'start').length, 2);
  assert.equal(f.highest(), 240);
  checks.push('Immediate restart waits for the previous score acknowledgement; lower next score cannot reduce highest'); f.close();
}
{
  const f = fixture(); f.hold(); f.api.beginRun(); const sending = f.api.submit(200); await tick();
  const update = f.api.submit(240); f.release(); await Promise.all([sending, update]);
  assert.equal(f.highest(), 240);
  checks.push('Revived run or concurrent higher submission is serialized and preserves the maximum'); f.close();
}
{
  const f = fixture(); f.unjoined(); f.api.beginRun(); await f.api.submit(240);
  assert.equal(f.calls.filter(x => x.action === 'submit').length, 0);
  assert.match(f.api.submission(), /未参加/);
  checks.push('Server participation remains authoritative; no implicit enrollment or historical-score upload'); f.close();
}
{
  const f = fixture(); f.fail(1); f.api.beginRun(); const sending = f.api.submit(240);
  await f.api.leave(); await sending;
  assert.equal(f.api.state().data.joined, false);
  assert.equal(f.api.submission(), '');
  checks.push('Opt-out cancels queued retry and stale completion cannot restore sync status'); f.close();
}
console.log(JSON.stringify({ passed: true, environment: 'Client module with synthetic transport, no production account/data changes', checks }, null, 2));
