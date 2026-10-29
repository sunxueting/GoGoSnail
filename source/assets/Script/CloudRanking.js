var config = require('CloudRankingConfig');
var listeners = [];
var state = { status: 'idle', data: null, message: '' };
var initialized = false;
var generation = 0;
var run = null;
var submission = '';
var pageRequest = 0;
var membershipEpoch = 0;
var leaving = false;
var CONSENT = 'global-ranking-v1';

function enabled() { return !!config.environmentId && typeof wx !== 'undefined' && !!wx.cloud && typeof wx.cloud.callFunction === 'function'; }
function emit() { listeners.slice().forEach(function (fn) { fn(state); }); }
function call(action, data) {
    return new Promise(function (resolve, reject) {
        if (!enabled() || typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) { reject(new Error('CLOUD_UNAVAILABLE')); return; }
        var settled = false;
        var timer = setTimeout(function () { finish(new Error('TIMEOUT')); }, 25000);
        function finish(error, value) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error); else resolve(value);
        }
        try {
            if (!initialized) { wx.cloud.init({ env: config.environmentId, traceUser: false }); initialized = true; }
            var request = wx.cloud.callFunction({ name: config.functionName, data: Object.assign({ action: action }, data || {}),
                success: function (response) {
                    var result = response && response.result;
                    if (!result || result.ok !== true) finish(new Error(result && result.code || 'SERVICE_UNAVAILABLE'));
                    else finish(null, result.data);
                }, fail: function () { finish(new Error('SERVICE_UNAVAILABLE')); }
            });
            if (request && request.catch) request.catch(function () { finish(new Error('SERVICE_UNAVAILABLE')); });
        } catch (error) { finish(error); }
    });
}
function refresh(offset) {
    var request = ++pageRequest;
    state.status = 'loading'; state.message = ''; emit();
    return call('list', { offset: offset || 0 }).then(function (data) {
        if (request !== pageRequest) return;
        state = { status: 'ready', data: data, message: '' }; emit();
    }, function () {
        if (request !== pageRequest) return;
        state.status = 'error'; state.message = '排行榜暂时无法连接，请点击重试'; emit();
    });
}
// Retry only transport/rate-limit failures. Never turn an invalid run or an
// opt-out into a new, implicitly enrolled score.
function retry(action, data, context, attempt) {
    if (context.cancelled || context.membership !== membershipEpoch) return Promise.reject(new Error('CANCELLED'));
    return call(action, data).catch(function (error) {
        if (!/^(TIMEOUT|SERVICE_UNAVAILABLE|TOO_FREQUENT)$/.test(error.message) || (attempt || 0) >= 2) throw error;
        if (context === run) { submission = '网络暂时不稳，正在重试同步…'; emit(); }
        return new Promise(function (resolve) { setTimeout(resolve, 2200 * ((attempt || 0) + 1)); })
            .then(function () { return retry(action, data, context, (attempt || 0) + 1); });
    });
}
function beginRun() {
    var previous = run;
    var context = { epoch: ++generation, membership: membershipEpoch, cancelled: false, latest: -1, confirmed: -1, pending: Promise.resolve() };
    run = context;
    submission = '';
    if (!enabled() || leaving) { run = null; return; }
    // The server is authoritative about participation. Cached list data may not
    // have arrived yet when the player quickly taps Start after a cold launch.
    // Finish the previous score request before issuing a new server run token.
    context.ready = (previous ? Promise.all([previous.ready.catch(function () {}), previous.pending]) : Promise.resolve()).catch(function () {}).then(function () {
        return retry('start', null, context);
    }).then(function (value) { context.startError = null; return value.runId; }, function (error) { context.startError = error; throw error; });
    context.ready.catch(function () {});
}
function submit(score) {
    var context = run;
    if (!context) {
        if (enabled()) { submission = '本局保存在本机；参加全服排名后同步新对局'; emit(); }
        return Promise.resolve();
    }
    if (!isFinite(score) || score < 0) return Promise.resolve();
    context.latest = Math.max(context.latest, Math.floor(score));
    submission = '正在同步本局成绩…'; emit();
    context.pending = context.pending.catch(function () {}).then(function () {
        if (context.cancelled || context.membership !== membershipEpoch || context.latest <= context.confirmed) return;
        var points = context.latest;
        return context.ready.then(function (runId) { return retry('submit', { runId: runId, score: points }, context); })
            .then(function (result) {
                if (context.cancelled || context.membership !== membershipEpoch) return;
                context.confirmed = Math.max(context.confirmed, points);
                if (context === run) { submission = '成绩已同步至全服排行榜'; emit(); }
                return refresh(0);
            });
    }).catch(function (error) {
        if (context !== run || context.cancelled || context.membership !== membershipEpoch) return;
        submission = error.message === 'JOIN_REQUIRED' ? '未参加全服排名，本局仅保存在本机' : /^(INVALID_RUN|EXPIRED_RUN|INVALID_SCORE)$/.test(error.message) ? '本局未通过同步校验，请重新开局；本机纪录已保留' : '成绩未同步，点击此处重试；本机纪录已保留';
        emit();
    });
    return context.pending;
}
function retryScore() {
    if (!run || run.latest < 0) return Promise.resolve();
    var context = run;
    if (context.startError && /^(TIMEOUT|SERVICE_UNAVAILABLE|TOO_FREQUENT)$/.test(context.startError.message)) {
        context.ready = retry('start', null, context).then(function (value) { context.startError = null; return value.runId; }, function (error) { context.startError = error; throw error; });
        context.ready.catch(function () {});
    }
    return submit(context.latest);
}
function join() {
    return call('join', { consentVersion: CONSENT }).then(function () { return refresh(0); });
}
function leave() {
    leaving = true;
    membershipEpoch++;
    if (run) run.cancelled = true;
    run = null; submission = ''; emit();
    return call('leave').then(function () { generation++; leaving = false; return refresh(0); }, function (error) { leaving = false; throw error; });
}
function publishProfile(profile) {
    // Saved device-local authorization never implies consent to public upload.
    return new Promise(function (resolve, reject) {
        if (typeof wx === 'undefined' || !wx.getPrivacySetting || !wx.getSetting) { reject(new Error('PERMISSION_UNAVAILABLE')); return; }
        wx.getPrivacySetting({ success: function (privacy) {
            if (privacy.needAuthorization) { reject(new Error('PERMISSION_REQUIRED')); return; }
            wx.getSetting({ success: function (settings) {
                if (!settings.authSetting || !settings.authSetting['scope.userInfo']) { reject(new Error('PERMISSION_REQUIRED')); return; }
                call('publishProfile', { profile: profile, consentVersion: CONSENT }).then(resolve, reject);
            }, fail: function () { reject(new Error('PERMISSION_REQUIRED')); } });
        }, fail: function () { reject(new Error('PERMISSION_REQUIRED')); } });
    }).then(function () { return refresh(0); });
}
module.exports = {
    enabled: enabled, refresh: refresh, beginRun: beginRun, submit: submit, retryScore: retryScore,
    join: join, leave: leave, publishProfile: publishProfile,
    clearProfile: function () { return call('clearProfile').then(function () { return refresh(0); }); },
    state: function () { return state; },
    submission: function () { return submission; },
    subscribe: function (fn) { listeners.push(fn); fn(state); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
};
