cc.Class({
    extends: cc.Component,
    tryLoad: function (depth) {
        var ui = require('UIManager')._instance;
        var util = require('UtilManager')._instance;
        if (this._consumed || !ui || ui._CurrentState !== 1 || !util.GetMapFinished()) return false;
        var data = require('MapDataManager')._instance;
        if (!data.CheckMapConfig()) return false;
        var prefabs = util.mapArray;
        var map = cc.find('Map');
        var anchor = map.convertToNodeSpaceAR(this.node.convertToWorldSpaceAR(cc.Vec2.ZERO));
        this._consumed = true;
        var next = cc.instantiate(prefabs[util.getRandomInt(0, prefabs.length - 1)]);
        next.setPosition(anchor);
        next.parent = map;
        this.node.active = false;
        this.node.destroy();
        // Catch up in the same frame after a fast camera jump, with a bounded
        // batch so recovering a skipped seam cannot monopolize the UI thread.
        if ((depth || 0) < 7) next.getComponentsInChildren('LoadNextMap').forEach(function (trigger) {
            if (trigger.nearCamera()) trigger.tryLoad((depth || 0) + 1);
        });
        return true;
    },
    onCollisionEnter: function () { this.tryLoad(); },
    nearCamera: function () {
        var ui = require('UIManager')._instance;
        if (this._consumed || !this.node.activeInHierarchy || !ui || ui._CurrentState !== 1 || !ui.FMap.activeInHierarchy) return false;
        var collider = this.node.getComponent(cc.BoxCollider);
        if (!collider || !collider.enabled) return false;
        var camera = cc.find('CameraCon/Camera');
        var top = camera.convertToWorldSpaceAR(cc.v2(0, cc.view.getVisibleSize().height / 2)).y;
        var boundary = this.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y;
        // Position-based prefetch also catches triggers skipped by a long frame.
        return boundary <= top + cc.view.getVisibleSize().height * 0.35;
    },
    update: function () { if (this.nearCamera()) this.tryLoad(); }
});
