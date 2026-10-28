// Keep the serialized component identity so the delivered scene remains valid.
// This release uses local records and one free revive per run.
var FacebookInstant = cc.Class({
    extends: cc.Component,
    statics: { _instance: null },
    properties: {
        preloadedRewardedVideo: null,
        preloadedInterstitial: null,
        _Base64Img: null,
        MoreLiftCount: 1,
        PlayerAvatar: { default: null, url: cc.Texture2D },
        SharePNG: { default: null, url: cc.Texture2D }
    },
    onLoad: function () {
        FacebookInstant._instance = this;
        cc.game.addPersistRootNode(this.node);
    },
    onShareGame: function () {
        if (typeof wx !== 'undefined' && wx.shareAppMessage) {
            wx.shareAppMessage({ title: require('ReleaseConfig').shareTitle });
        }
    },
    showLeaderboard: function () {
        var board = require('LeaderBoardManager')._instance;
        board.ClearLeaderboard();
        board.node.active = true;
        var ready = board.ShowLeaderboard([{ LName: '本机最高纪录', LRank: 1, LScore: require('ScoreManager')._instance.GetTopScore(), LPhoto: '' }]);
        board.globalButton.node.active = false;
        board.friendButton.node.active = false;
        if (ready) board.showPlayerProfile();
    },
    showGobalLeaderBoard: function () { this.showLeaderboard(); },
    showInterstitialAD: function () { cc.find('Map').getComponent('GameLogic').restartGame(); },
    showAD: function () { cc.find('Map').getComponent('GameLogic').CheckContinueGame(); },
    invateGame: function () { cc.find('Map').getComponent('UIManager').EnterGame(); },
    // Retained for compatibility with existing scene events; no ad SDK is loaded.
    resetAD: function () {},
    OnLoadAD: function () {}
});
