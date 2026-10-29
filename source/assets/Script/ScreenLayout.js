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
        // The game-over shade lives under a scaled camera anchor, not Canvas.
        // Its old fixed 2000-unit height leaves a bright strip on tall phones.
        var overlay = this._overlay || (this._overlay = cc.find('CameraCon/Camera/deathboxUp/OverGameBg'));
        var visible = overlay && overlay.activeInHierarchy;
        if (visible && (!this._overlayVisible || this._overlayWidth !== size.width || this._overlayHeight !== size.height)) {
            var parent = overlay.parent;
            var origin = parent.convertToWorldSpaceAR(cc.Vec2.ZERO);
            var sx = cc.pDistance(origin, parent.convertToWorldSpaceAR(cc.v2(1, 0)));
            var sy = cc.pDistance(origin, parent.convertToWorldSpaceAR(cc.v2(0, 1)));
            var shade = overlay.getComponent(cc.Sprite);
            var art = shade.spriteFrame.getOriginalSize();
            var cover = Math.max(size.width / art.width, size.height / art.height);
            shade.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            overlay.setAnchorPoint(0.5, 0.5);
            overlay.setScale(1 / sx, 1 / sy);
            overlay.setContentSize(art.width * cover, art.height * cover);
            var center = cc.v2(size.width / 2, size.height / 2);
            if (cc.Camera.main && cc.Camera.main.containsNode(overlay)) center = cc.pointApplyAffineTransform(center, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
            overlay.setPosition(parent.convertToNodeSpaceAR(center));
            this._overlayWidth = size.width;
            this._overlayHeight = size.height;
        }
        this._overlayVisible = visible;
    }
});

module.exports = function () {
    var canvas = cc.find('Canvas');
    var layout = canvas.getComponent(ScreenLayout) || canvas.addComponent(ScreenLayout);
    layout.lateUpdate();
};
