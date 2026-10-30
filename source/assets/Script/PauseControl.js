// Pause the simulation while leaving touch dispatch and rendering available.
function place(node, point) {
    var parent = node.parent;
    var origin = parent.convertToWorldSpaceAR(cc.Vec2.ZERO);
    var sx = cc.pDistance(origin, parent.convertToWorldSpaceAR(cc.v2(1, 0)));
    var sy = cc.pDistance(origin, parent.convertToWorldSpaceAR(cc.v2(0, 1)));
    if (cc.Camera.main && cc.Camera.main.containsNode(parent)) point = cc.pointApplyAffineTransform(point, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
    node.setScale(1 / sx, 1 / sy);
    node.setPosition(parent.convertToNodeSpaceAR(point));
}
function label(parent, name, value, width, height, font) {
    var node = new cc.Node(name); parent.addChild(node); node.setContentSize(width, height);
    var text = node.addComponent(cc.Label);
    text.useSystemFont = true; text.fontFamily = 'Arial'; text.fontSize = font; text.lineHeight = font + 12;
    text.horizontalAlign = cc.Label.HorizontalAlign.CENTER; text.verticalAlign = cc.Label.VerticalAlign.CENTER;
    text.overflow = cc.Label.Overflow.SHRINK; text.string = value;
    node.setContentSize(width, height); return node;
}
function stop(event) { event.stopPropagation(); }
var PauseControl = cc.Class({
    extends: cc.Component,
    onLoad: function () {
        this.ui = cc.find('Map').getComponent('UIManager');
        this.paused = false; this.audio = [];
        this.button = new cc.Node('PauseButton'); this.node.addChild(this.button);
        var icon = new cc.Node('Icon'); this.button.addChild(icon); this.icon = icon.addComponent(cc.Graphics);
        this.button.on(cc.Node.EventType.TOUCH_START, function (event) { stop(event); this.pause(); }, this);
        this.button.on(cc.Node.EventType.TOUCH_END, stop);
        this.panel = new cc.Node('PausePanel'); this.node.addChild(this.panel); this.panel.zIndex = 1;
        var backdrop = new cc.Node('Backdrop'); this.panel.addChild(backdrop); this.backdrop = backdrop.addComponent(cc.Graphics);
        this.panel.on(cc.Node.EventType.TOUCH_START, stop); this.panel.on(cc.Node.EventType.TOUCH_END, stop);
        this.title = label(this.panel, 'Title', '游戏已暂停', 700, 110, 64);
        this.title.y = 190;
        this.resumeButton = new cc.Node('ResumeButton'); this.panel.addChild(this.resumeButton); this.resumeButton.setContentSize(620, 140);
        this.resumeButton.y = 10;
        var fill = new cc.Node('Background'); this.resumeButton.addChild(fill); fill.zIndex = -1;
        var graphic = fill.addComponent(cc.Graphics); graphic.fillColor = cc.color(25, 125, 85);
        graphic.roundRect(-310, -70, 620, 140, 24); graphic.fill();
        var caption = label(this.resumeButton, 'Caption', '继续游戏', 620, 140, 48); caption.zIndex = 1;
        this.resumeButton.on(cc.Node.EventType.TOUCH_START, stop);
        this.resumeButton.on(cc.Node.EventType.TOUCH_END, function (event) { stop(event); this.resume(); }, this);
        this.hint = label(this.panel, 'Hint', '点击继续，回到当前对局', 760, 70, 34); this.hint.y = -150;
        this.panel.active = false; this.button.active = false;
        this._hide = this.pause.bind(this);
        cc.game.on(cc.game.EVENT_HIDE, this._hide);
        this._resize = function () {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(function () { if (cc.isValid(this.node)) this.layout(); }.bind(this), 0);
        }.bind(this);
        if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', this._resize);
        this.layout();
    },
    playable: function () {
        var player = cc.find('Player');
        return this.ui._CurrentState === 1 && player && player.activeInHierarchy && !player.getComponent('PlayerControl').lsDead &&
            !this.ui.WaitBar.activeInHierarchy && !this.ui.TototailUI.activeInHierarchy;
    },
    layout: function () {
        var size = cc.view.getVisibleSize(), pixels = cc.view.getFrameSize().height || size.height;
        var top = 12, right = 12;
        try {
            if (typeof wx !== 'undefined') {
                var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
                if (info && info.windowHeight) pixels = info.windowHeight;
                if (info && info.safeArea) { top = Math.max(top, info.safeArea.top + 8); right = Math.max(right, info.windowWidth - info.safeArea.right + 8 || 0); }
                var capsule = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
                if (capsule && capsule.bottom > 0) top = Math.max(top, capsule.bottom + 10);
            }
        } catch (_) { /* Keep the 44-pixel control in the upper-right viewport. */ }
        var unit = size.height / pixels, diameter = 44 * unit, radius = diameter / 2;
        this.button.setContentSize(diameter, diameter);
        place(this.button, cc.v2(size.width - right * unit - radius, size.height - top * unit - radius));
        this.icon.clear(); this.icon.fillColor = cc.color(15, 29, 43, 230); this.icon.circle(0, 0, radius); this.icon.fill();
        this.icon.fillColor = cc.Color.WHITE;
        this.icon.roundRect(-radius * 0.38, -radius * 0.45, radius * 0.24, radius * 0.9, radius * 0.05);
        this.icon.roundRect(radius * 0.14, -radius * 0.45, radius * 0.24, radius * 0.9, radius * 0.05); this.icon.fill();
        this.panel.setContentSize(size.width, size.height); place(this.panel, cc.v2(size.width / 2, size.height / 2));
        this.backdrop.clear(); this.backdrop.fillColor = cc.color(0, 0, 0, 195);
        this.backdrop.rect(-size.width / 2 - 2, -size.height / 2 - 2, size.width + 4, size.height + 4); this.backdrop.fill();
        this._width = size.width; this._height = size.height;
    },
    pause: function () {
        if (this.paused || !this.playable() || cc.director.isPaused()) return false;
        this.paused = this.ui.isPaused = true;
        this.layout(); this.button.active = false; this.panel.active = true;
        this.audio = cc.director.getScene().getComponentsInChildren(cc.AudioSource).filter(function (source) { return source.isPlaying; });
        this.audio.forEach(function (source) { source.pause(); });
        cc.director.pause(); return true;
    },
    resume: function () {
        if (!this.paused) return false;
        this.paused = this.ui.isPaused = false; this.panel.active = false;
        this._warmup = 3; this._show = false;
        cc.director.resume();
        this.audio.forEach(function (source) { if (cc.isValid(source)) source.resume(); }); this.audio = [];
        this.button.active = this.playable(); return true;
    },
    lateUpdate: function () {
        var show = !this.paused && this.playable();
        this.button.active = show;
        if (show !== this._show) this._warmup = 3;
        this._show = show;
        var size = cc.view.getVisibleSize();
        if (this._width !== size.width || this._height !== size.height || this._warmup > 0) { this.layout(); this._warmup = Math.max(0, (this._warmup || 0) - 1); }
    },
    onDestroy: function () {
        cc.game.off(cc.game.EVENT_HIDE, this._hide);
        if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('resize', this._resize);
        clearTimeout(this._resizeTimer);
        if (this.paused) {
            this.ui.isPaused = false; cc.director.resume();
            this.audio.forEach(function (source) { if (cc.isValid(source)) source.stop(); });
        }
    }
});
module.exports = function (parent) {
    var node = parent.getChildByName('PauseControl');
    if (!node) { node = new cc.Node('PauseControl'); parent.addChild(node); node.zIndex = 32000; node._pauseControl = node.addComponent(PauseControl); }
    return node._pauseControl;
};
