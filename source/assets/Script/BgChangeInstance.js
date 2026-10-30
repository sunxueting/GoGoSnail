var ScoreManager = require('ScoreManager');
window.BgConfig = { ScoreBelow: 0, BgFrame: 1, PatternFrame: 2 };
var BgChangeInstance = cc.Class({
    extends: cc.Component,
    statics: { _instance: null },
    properties: {
        AScoreBelow: [], AFrameBg: [], AFramePattern: [], AllBg: [], AllPatter: [],
        _CurrentLV: 0, _loadFinished: false, fadeInDt: 1, fadetran: 0.5, fadeOutDt: 1
    },
    getBGFrameByName: function (name) {
        return this.AllBg.filter(function (frame) { return frame.name === name; })[0] || null;
    },
    getPatFrameByName: function (name) {
        return this.AllPatter.filter(function (frame) { return frame.name === name; })[0] || null;
    },
    onLoad: function () {
        BgChangeInstance._instance = this;
        this.CanvasBg = cc.find('Canvas/bg');
        this.CanvasBg.stopAllActions();
        this.CanvasBg.opacity = 255;
        this._loaded = {};
        this._CurrentLV = 0;
        this._loadFinished = false;
        this.loadFrames('Texture/BG', 'AllBg', 'background');
        this.loadFrames('Texture/Pattern', 'AllPatter', 'pattern');
        this.LoadBgConfig();
    },
    loaded: function (key) {
        this._loaded[key] = true;
        this._loadFinished = !!(this._loaded.background && this._loaded.pattern && this._loaded.config);
    },
    loadFrames: function (dir, property, key, attempt) {
        var self = this;
        cc.loader.loadResDir(dir, cc.SpriteFrame, function (error, frames) {
            if (error || !frames || (key === 'background' && !frames.length)) {
                if ((attempt || 0) < 2) self.scheduleOnce(function () { self.loadFrames(dir, property, key, (attempt || 0) + 1); }, 0.5);
                return; // Keep the shipped opaque background if loading fails.
            }
            self[property] = frames;
            self.loaded(key);
        });
    },
    LoadBgConfig: function (attempt) {
        var self = this;
        cc.loader.loadRes('LevelConfig/BGConfig', function (error, value) {
            var csv = typeof value === 'string' ? value : value && value.text;
            if (error || !csv) {
                if ((attempt || 0) < 2) self.scheduleOnce(function () { self.LoadBgConfig((attempt || 0) + 1); }, 0.5);
                return;
            }
            self.AScoreBelow = []; self.AFrameBg = []; self.AFramePattern = [];
            csv.trim().split(/\r?\n/).slice(1).forEach(function (line) {
                var cells = line.split(',').map(function (cell) { return cell.trim(); });
                if (cells.length < 2 || !cells[1] || !isFinite(Number(cells[0]))) return;
                self.AScoreBelow.push(Number(cells[0]));
                self.AFrameBg.push(cells[1]);
                self.AFramePattern.push(cells[2] || '');
            });
            self.loaded('config');
        });
    },
    fitTransition: function () {
        if (!this.transition || !this.transition.active) return;
        var size = cc.view.getVisibleSize();
        if (size.width === this._width && size.height === this._height) return;
        var frame = this.transition.getComponent(cc.Sprite).spriteFrame;
        var original = frame.getOriginalSize();
        var scale = Math.max(size.width / original.width, size.height / original.height);
        this.transition.setContentSize(original.width * scale, original.height * scale);
        this.transition.setPosition(0, 0);
        this._width = size.width; this._height = size.height;
    },
    UpdateBg: function (index) {
        var frame = this.getBGFrameByName(this.AFrameBg[index]);
        if (!frame) return false; // Never replace a usable frame with null.
        var patternName = this.AFramePattern[index];
        var pattern = patternName ? this.getPatFrameByName(patternName) : null;
        if (patternName && !pattern) return false;
        if (!this.transition) {
            this.transition = new cc.Node('BackgroundCrossfade');
            this.CanvasBg.addChild(this.transition);
            this.transition.addComponent(cc.Sprite).sizeMode = cc.Sprite.SizeMode.CUSTOM;
        }
        this.transition.stopAllActions();
        this.CanvasBg.stopAllActions();
        this.CanvasBg.opacity = 255;
        this.transition.active = true;
        this.transition.opacity = 0;
        this.transition.getComponent(cc.Sprite).spriteFrame = frame;
        this._width = this._height = 0;
        this.fitTransition();
        var generation = this._generation = (this._generation || 0) + 1;
        var self = this;
        this.transition.runAction(cc.sequence(cc.fadeIn(Math.max(0.1, this.fadeInDt)), cc.callFunc(function () {
            if (self._generation !== generation) return;
            self.CanvasBg.getComponent(cc.Sprite).spriteFrame = frame;
            var node = self.CanvasBg.getChildByName('pat');
            node.getComponent(cc.Sprite).spriteFrame = pattern;
            node.active = !!pattern;
            require('ScreenLayout')();
            self.transition.active = false;
        })));
        return true;
    },
    checkscoreBg: function () {
        if (!this._loadFinished) return;
        var score = ScoreManager._instance.PlayerScore, index = -1;
        for (var i = 0; i < this.AScoreBelow.length; i++) if (score >= this.AScoreBelow[i]) index = i;
        if (index >= this._CurrentLV && this.UpdateBg(index)) this._CurrentLV = index + 1;
    },
    lateUpdate: function () { this.checkscoreBg(); this.fitTransition(); }
});
