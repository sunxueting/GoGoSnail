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
        // Failure has TWO masks: the immediate death flash and the later
        // game-over shade. Both must follow the viewport, including the first
        // visible frame, parent movement and camera transforms.
        this.fitShade(cc.find('CameraCon/Camera/UILayer/Blink_White/white'), size, cc.color(0, 0, 0, 255));
        this.fitShade(cc.find('CameraCon/Camera/deathboxUp/OverGameBg'), size, cc.color(0, 0, 0, 185));
    },
    fitShade: function (overlay, size, color) {
        if (!overlay || !overlay.activeInHierarchy) return;
        var parent = overlay.parent;
        var camera = cc.Camera.main;
        var matrix = camera && camera.containsNode(overlay) ? camera.viewMatrix : cc.affineTransformIdentity();
        var origin = parent.convertToWorldSpaceAR(cc.Vec2.ZERO);
        var axis = parent.convertToWorldSpaceAR(cc.v2(1, 0));
        var axisY = parent.convertToWorldSpaceAR(cc.v2(0, 1));
        var key = [size.width, size.height, origin.x, origin.y, axis.x, axis.y, axisY.x, axisY.y, matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty, overlay.name === 'white' ? overlay.opacity : 255].join(',');
        if (overlay._shadeLayoutKey === key) return;
        overlay._shadeLayoutKey = key;
        var inverse = cc.affineTransformInvert(matrix);
        var center = parent.convertToNodeSpaceAR(cc.pointApplyAffineTransform(cc.v2(size.width / 2, size.height / 2), inverse));
        overlay.getComponent(cc.Sprite).enabled = false;
        overlay.setAnchorPoint(0.5, 0.5);
        overlay.setScale(1);
        overlay.setPosition(center);
        var points = [[-2, -2], [size.width + 2, -2], [size.width + 2, size.height + 2], [-2, size.height + 2]].map(function (point) {
            return parent.convertToNodeSpaceAR(cc.pointApplyAffineTransform(cc.v2(point[0], point[1]), inverse)).sub(center);
        });
        overlay.setContentSize(2 * Math.max.apply(null, points.map(function (p) { return Math.abs(p.x); })),
            2 * Math.max.apply(null, points.map(function (p) { return Math.abs(p.y); })));
        var paint = overlay.getChildByName('FullScreenShade');
        if (!paint) { paint = new cc.Node('FullScreenShade'); overlay.addChild(paint); paint.addComponent(cc.Graphics); }
        var graphics = paint.getComponent(cc.Graphics);
        graphics.clear();
        // This legacy Graphics renderer does not inherit animated node opacity.
        // Encode the death flash alpha into the fill rather than leaving an
        // opaque child behind after the animation reaches zero.
        if (overlay.name === 'white') color.a = overlay.opacity;
        paint.active = color.a > 0;
        graphics.fillColor = color;
        graphics.moveTo(points[0].x, points[0].y);
        for (var i = 1; i < points.length; i++) graphics.lineTo(points[i].x, points[i].y);
        graphics.close(); graphics.fill();
        // Preserve the immediate mask's animated opacity. The settled mask is
        // permanently translucent, without a second inherited opacity factor.
        if (overlay.name === 'OverGameBg') overlay.opacity = 255;
    }
});

module.exports = function () {
    var canvas = cc.find('Canvas');
    var layout = canvas.getComponent(ScreenLayout) || canvas.addComponent(ScreenLayout);
    layout.lateUpdate();
};
