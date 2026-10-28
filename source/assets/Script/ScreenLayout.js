// Cover the viewport without scaling foreground controls or title artwork.
var ScreenLayout = cc.Class({
    extends: cc.Component,
    lateUpdate: function () {
        var size = cc.view.getVisibleSize();
        if (!this._targets) {
            this._targets = ['Canvas/bg', 'Canvas/bg/pat', 'Canvas/UINode/MainMenu/MMBg'].map(function (path) {
                var node = cc.find(path);
                return node && node.getComponent(cc.Sprite);
            }).filter(function (sprite) { return !!sprite; });
        }
        for (var i = 0; i < this._targets.length; i++) {
            var sprite = this._targets[i];
            var node = sprite.node;
            if (!sprite || !sprite.spriteFrame) continue;
            var frame = sprite.spriteFrame;
            if (node._coverFrame === frame && node._coverWidth === size.width && node._coverHeight === size.height) continue;
            var widget = node.getComponent(cc.Widget);
            if (widget) widget.enabled = false;
            var original = frame.getOriginalSize();
            var scale = Math.max(size.width / original.width, size.height / original.height);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            node.setContentSize(original.width * scale, original.height * scale);
            node.setPosition(0, 0);
            node._coverFrame = frame;
            node._coverWidth = size.width;
            node._coverHeight = size.height;
        }
    }
});

module.exports = function () {
    var canvas = cc.find('Canvas');
    var layout = canvas.getComponent(ScreenLayout) || canvas.addComponent(ScreenLayout);
    layout.lateUpdate();
};
