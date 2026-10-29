var config = require('CloudRankingConfig');
var listeners = [];
var state = { status: 'idle', data: null, message: '' };
var initialized = false;
var generation = 0;
var run = null;
var submission = '';
var pageRequest = 0;
var CONSENT = 'global-ranking-v1';

function enabled() { return !!config.environmentId && typeof wx !== 'undefined' && !!wx.cloud && typeof wx.cloud.callFunction === 'function'; }
function emit() { listeners.slice().forEach(function (fn) { fn(state); }); }
function call(action, data) {
    return new Promise(function (resolve, reject) {
        if (!enabled() || typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) { reject(new Error('CLOUD_UNAVAILABLE')); return; }
        var settled = false;
        var timer = setTimeout(function () { finish(new Error('TIMEOUT')); }, 12000);
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
function beginRun() {
    var epoch = ++generation;
    run = null;
    submission = '';
    if (!enabled() || !state.data || !state.data.joined) return;
    run = call('start').then(function (value) {
        if (epoch !== generation) throw new Error('STALE_RUN');
        return value.runId;
    });
    // Keep a failed start from becoming an unhandled promise during gameplay.
    run.catch(function () {});
}
function submit(score) {
    if (!run) {
        if (enabled()) { submission = '本局保存在本机；参加全服排名后同步新对局'; emit(); }
        return;
    }
    var epoch = generation;
    submission = '正在同步本局成绩…'; emit();
    run.then(function (runId) {
        if (epoch !== generation) return;
        return call('submit', { runId: runId, score: score });
    }).then(function (result) {
        if (!result || epoch !== generation) return;
        submission = '成绩已同步至全服排行榜'; emit();
        refresh(0);
    }).catch(function () {
        if (epoch !== generation) return;
        submission = '成绩未同步，已保留本机纪录';
        state.message = '本局成绩未同步，已保留本机纪录'; emit();
    });
}
function join() {
    return call('join', { consentVersion: CONSENT }).then(function () { return refresh(0); });
}
function leave() {
    return call('leave').then(function () { generation++; run = null; return refresh(0); });
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
    enabled: enabled, refresh: refresh, beginRun: beginRun, submit: submit,
    join: join, leave: leave, publishProfile: publishProfile,
    clearProfile: function () { return call('clearProfile').then(function () { return refresh(0); }); },
    state: function () { return state; },
    submission: function () { return submission; },
    subscribe: function (fn) { listeners.push(fn); fn(state); return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }
};
