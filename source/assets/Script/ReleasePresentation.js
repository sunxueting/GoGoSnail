var release = require('ReleaseConfig');

function text(parent, name, value, width, height, size, color) {
    var node = new cc.Node(name);
    parent.addChild(node);
    node.setContentSize(width, height);
    var label = node.addComponent(cc.Label);
    label.useSystemFont = true;
    label.fontFamily = 'Arial';
    label.fontSize = size;
    label.lineHeight = size + 12;
    label.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
    label.verticalAlign = cc.Label.VerticalAlign.CENTER;
    label.overflow = cc.Label.Overflow.SHRINK;
    label.string = value;
    node.color = color || cc.Color.WHITE;
    node.setContentSize(width, height);
    return node;
}

// Old scene controls have different, sometimes very large parent scales. Keep
// new text crisp and the same size in world space without changing hit areas.
function place(node, target, offsetX, offsetY, screenPoint) {
    var origin = target.convertToWorldSpaceAR(cc.v2(0, 0));
    var axisX = target.convertToWorldSpaceAR(cc.v2(1, 0));
    var axisY = target.convertToWorldSpaceAR(cc.v2(0, 1));
    var sx = Math.max(0.0001, cc.pDistance(origin, axisX));
    var sy = Math.max(0.0001, cc.pDistance(origin, axisY));
    var point;
    if (screenPoint) {
        point = screenPoint;
        if (cc.Camera.main && cc.Camera.main.containsNode(target)) {
            point = cc.pointApplyAffineTransform(point, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
        }
    } else {
        point = target.convertToWorldSpaceAR(cc.v2((0.5 - target.anchorX) * target.width, (0.5 - target.anchorY) * target.height));
        point = cc.v2(point.x + offsetX, point.y + offsetY);
    }
    node.setScale(1 / sx, 1 / sy);
    node.setPosition(target.convertToNodeSpaceAR(point));
}

function moveToScreen(node, point) {
    if (cc.Camera.main && cc.Camera.main.containsNode(node)) {
        point = cc.pointApplyAffineTransform(point, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
    }
    node.setPosition(node.parent.convertToNodeSpaceAR(point));
}

var Presentation = cc.Class({
    extends: cc.Component,
    onLoad: function () {
        this.bindings = [];
        this.ui = cc.find('Map').getComponent('UIManager');
        this.mount();
    },
    bind: function (path, name, value, width, height, size, x, y, color) {
        var target = typeof path === 'string' ? cc.find(path) : path;
        if (!target) return null;
        var node = text(target, name, typeof value === 'function' ? value() : value, width, height, size, color);
        this.bindings.push({ node: node, target: target, x: x || 0, y: y || 0, value: value });
        return node;
    },
    hidePicture: function (path, stopAnimation) {
        var node = cc.find(path);
        if (!node) return null;
        var sprite = node.getComponent(cc.Sprite);
        if (sprite) sprite.enabled = false;
        if (stopAnimation) {
            var animation = node.getComponent(cc.Animation);
            if (animation) { animation.stop(); animation.enabled = false; }
        }
        return node;
    },
    mount: function () {
        var top = 'CameraCon/Camera/deathboxUp/';
        var layer = 'CameraCon/Camera/UILayer/';
        var bottom = 'CameraCon/Camera/deathboxBottom/';
        var title = this.hidePicture(top + 'MMlogo');
        var heading = this.bind(title, 'OfficialGameTitle', release.displayName, 880, 125, 82, 0, 40);
        this.heading = heading;
        this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(size.width / 2, size.height - 320); };
        heading.getComponent(cc.Label).isBold = true;
        var outline = heading.addComponent(cc.LabelOutline);
        outline.color = cc.color(25, 53, 82);
        outline.width = 4;
        this.tagline = this.bind(title, 'GameTagline', '轻点起跳 · 挑战本机最高纪录', 860, 65, 34, 0, -70, cc.color(208, 239, 249));
        this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(size.width / 2, size.height - 440); };
        this.menuControls = [cc.find(bottom + 'Setting'), cc.find(bottom + 'Tutotail'), cc.find(bottom + 'LeaderBoard')];
        this.startControl = cc.find(layer + 'startGame');
        // A static menu button needs no per-frame inverse-scale text layout.
        var startAnimation = this.startControl.getComponent(cc.Animation);
        if (startAnimation) { startAnimation.stop(); startAnimation.enabled = false; }
        this.startControl.setScale(0.9);

        // The gameplay SCORE caption is baked into a sprite, not a Label.
        // Keep its numeric child intact so ScoreManager continues updating it.
        this.hidePicture(top + 'scoreName');
        this.bind(top + 'scoreName', 'ChineseScoreCaption', '得分', 130, 80, 44);

        var bestPaths = [layer + 'Top/TopScoreLable/best', layer + 'OverGame/Top/TopScoreLable/best'];
        for (var i = 0; i < bestPaths.length; i++) {
            this.hidePicture(bestPaths[i]);
            this.bind(bestPaths[i], 'ChineseBest', '最高纪录', 220, 80, 36);
            if (i === 0) this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(size.width * 0.43, size.height * 0.58); };
        }
        var mainScore = cc.find(layer + 'Top/score');
        mainScore.getComponent(cc.Label).enabled = false;
        var score = cc.find('Map').getComponent('ScoreManager');
        this.bind(mainScore, 'ChineseBestValue', function () { return String(score.GetTopScore()); }, 160, 80, 48, 0, 0, cc.color(255, 110, 95));
        this.bindings[this.bindings.length - 1].onEnterOnly = true;
        this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(size.width * 0.64, size.height * 0.58); };
        var tutorial = cc.find(bottom + 'Tutotail/TutorialFont');
        if (tutorial) tutorial.active = false;
        this.bind(bottom + 'Setting', 'ChineseCaption', '设置', 200, 55, 34, 0, -110);
        this.bind(bottom + 'Tutotail', 'ChineseCaption', '玩法', 200, 55, 34, 0, -110);
        this.bind(bottom + 'LeaderBoard', 'ChineseCaption', '本机纪录', 220, 55, 34, 0, -110);
        this.bind(layer + 'startGame', 'ChineseCaption', '开始游戏', 330, 65, 42, 0, -225);

        var again = this.hidePicture(layer + 'OverGame/AgainButton', true);
        again.setScale(2);
        var background = new cc.Node('ChineseContinueBackground');
        again.addChild(background);
        background.zIndex = -1;
        var graphics = background.addComponent(cc.Graphics);
        graphics.fillColor = cc.color(25, 125, 85);
        graphics.roundRect(-140, -80, 280, 160, 24);
        graphics.fill();
        this.bindings.push({ node: background, target: again, x: 0, y: 0 });
        this.bind(again, 'ChineseContinue', '免费继续一次', 270, 65, 38, 0, 35);
        var timer = cc.find(layer + 'OverGame/AgainButton/Time').getComponent(cc.Label);
        timer.enabled = false;
        this.bind(again, 'ChineseCountdown', function () { return '剩余 ' + timer.string + ' 秒'; }, 260, 55, 30, 0, -35, cc.color(216, 244, 225));
        this.hidePicture(layer + 'OverGame/TapToRestart', true);
        this.bind(layer + 'OverGame/TapToRestart', 'ChineseRestart', '点击空白处重新开始', 570, 100, 38);
        this.hidePicture(layer + 'OverGame/Top/newrecord');
        this.bind(layer + 'OverGame/Top/newrecord', 'ChineseNewRecord', '新纪录', 260, 90, 48, 0, 0, cc.color(255, 223, 125));
        this.bind(layer + 'OverGame/Top/Share', 'ChineseCaption', '分享', 190, 55, 32, 0, -105);

        this.safety = new cc.Node('ChineseSafetyLinks');
        this.node.addChild(this.safety);
        var age = this.bind(this.safety, 'AgePrompt', release.age + '+ 适龄提示', 245, 65, 36, 0, 0, cc.color(219, 248, 228));
        this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(145, size.height - 120); };
        var health = this.bind(this.safety, 'HealthPrompt', '健康游戏提示', 310, 65, 34, 0, 0, cc.color(219, 239, 249));
        this.bindings[this.bindings.length - 1].screen = function (size) { return cc.v2(455, size.height - 120); };
        var self = this;
        age.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); self.showNotice('age'); });
        health.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); self.showNotice('health'); });
        this.lateUpdate();
    },
    showNotice: function (kind) {
        if (this.notice) return;
        var size = cc.view.getVisibleSize();
        var panel = new cc.Node('ChineseSafetyNotice');
        var camera = cc.find('CameraCon/Camera');
        camera.addChild(panel);
        panel.zIndex = 32767;
        panel.setContentSize(size.width, size.height);
        place(panel, camera, 0, 0, cc.v2(size.width / 2, size.height / 2));
        var backdrop = new cc.Node('Backdrop');
        panel.addChild(backdrop);
        backdrop.setAnchorPoint(0, 0);
        var shade = backdrop.addComponent(cc.Graphics);
        shade.fillColor = cc.color(5, 15, 28, 245);
        shade.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        shade.fill();
        panel.on(cc.Node.EventType.TOUCH_START, function (event) { event.stopPropagation(); });
        panel.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); });
        var width = Math.min(840, size.width - 100);
        var title = text(panel, 'NoticeTitle', kind === 'age' ? release.age + '+ 适龄提示' : '健康游戏忠告', width, 95, 52);
        title.y = 260;
        var message = kind === 'age'
            ? '本游戏为单人休闲跳跃游戏\n适合 ' + release.age + ' 周岁及以上用户\n建议未成年人在监护人指导下使用\n\n点击屏幕，在旋转圆盘之间跳跃\n收集道具、避开障碍，挑战本机纪录\n无充值、无广告、无陌生人聊天\n\n合理安排时间，享受健康生活'
            : '抵制不良游戏，拒绝盗版游戏。\n注意自我保护，谨防受骗上当。\n适度游戏益脑，沉迷游戏伤身。\n合理安排时间，享受健康生活。';
        var body = text(panel, 'NoticeBody', message, width, 520, 34);
        body.y = -15;
        var close = text(panel, 'NoticeClose', '我知道了', 460, 100, 42, cc.color(120, 235, 180));
        close.y = -380;
        var self = this;
        close.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); panel.destroy(); self.notice = null; });
        this.notice = panel;
    },
    lateUpdate: function () {
        if (!this.bindings) return;
        var size = cc.view.getVisibleSize();
        var state = this.ui._CurrentState;
        if (this._layoutWidth !== size.width || this._layoutHeight !== size.height || this._layoutState !== state) this._layoutWarmup = 3;
        // The legacy camera positions its top/bottom anchors in start(). Let
        // those transforms settle for two frames after a scene/state/size change.
        var dirty = this._layoutWarmup > 0;
        if (dirty) this._layoutWarmup--;
        this.safety.active = state === 0;
        this.heading.active = state === 0;
        this.tagline.active = state === 0;
        if (dirty && state === 0) {
            for (var control = 0; control < this.menuControls.length; control++) {
                moveToScreen(this.menuControls[control], cc.v2(size.width * (0.18 + control * 0.32), 200));
            }
            moveToScreen(this.startControl, cc.v2(size.width / 2, size.height * 0.43));
        }
        for (var i = 0; i < this.bindings.length; i++) {
            var binding = this.bindings[i];
            if (!cc.isValid(binding.node) || !cc.isValid(binding.target)) continue;
            var visible = binding.node.activeInHierarchy;
            if (visible && (dirty || !binding.visible)) {
                place(binding.node, binding.target, binding.x, binding.y, binding.screen ? binding.screen(size) : null);
            }
            if (visible && typeof binding.value === 'function' && (!binding.onEnterOnly || dirty || !binding.visible)) {
                var value = binding.value();
                var label = binding.node.getComponent(cc.Label);
                if (label.string !== value) label.string = value;
            }
            binding.visible = visible;
        }
        this._layoutWidth = size.width;
        this._layoutHeight = size.height;
        this._layoutState = state;
    }
});

module.exports = function () {
    var parent = cc.find('CameraCon/Camera/UILayer');
    var host = parent.getChildByName('ReleasePresentation');
    if (!host) {
        host = new cc.Node('ReleasePresentation');
        parent.addChild(host);
        host.addComponent(Presentation);
    }
};
