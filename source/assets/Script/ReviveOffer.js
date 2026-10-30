// Measure intent to use the placement, never an ad impression/completion.
// WeChat deduplicates players in its analytics; do not generate or send user IDs.
var release = require('ReleaseConfig');

function report(event) {
    if (typeof wx === 'undefined' || typeof wx.reportEvent !== 'function') return;
    try {
        wx.reportEvent(event, {
            placement: 'gameover_revive',
            experiment: 'no_ad_v1',
            reward_mode: 'free',
            version: release.version
        });
    } catch (error) {
        // Reporting is best effort and must never prevent the reward.
    }
}

module.exports = {
    create: function () {
        var offer = null;
        return {
            beginRun: function () {
                offer = null;
                report('snail_play_start');
            },
            show: function () {
                if (offer) return;
                offer = { visible: true, clicked: false, claimed: false };
                report('snail_revive_show');
            },
            hide: function () { if (offer) offer.visible = false; },
            claim: function (revive) {
                if (!offer || !offer.visible || offer.claimed) return false;
                var current = offer;
                current.claimed = true; // Lock before reporting/callbacks, including reentrant taps.
                if (!current.clicked) {
                    current.clicked = true;
                    report('snail_revive_click');
                }
                var success = false;
                try { success = revive() === true; }
                finally { if (!success) current.claimed = false; }
                if (success) {
                    current.visible = false;
                    report('snail_revive_success');
                }
                return success;
            }
        };
    }
};
