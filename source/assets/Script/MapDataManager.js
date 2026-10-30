window.MapConfig = { MapSum: 0, DifficultyLevel: 1, LevelMapDir: 2, CameraSpeed: 3, AllCount: 4 };
var MapDataManager = cc.Class({
    extends: cc.Component,
    statics: { _instance: null },
    properties: { MapCount: [], Lvl: [], LvMapDir: [], LvCamSpeed: [], currentMapCount: 0, currentBonusCount: 0 },
    loadMapData: function (attempt) {
        var self = this;
        this.utilManager.configLoading = true;
        cc.loader.loadRes('LevelConfig/config', function (error, value) {
            var rows = [];
            if (!error) {
                var csv = typeof value === 'string' ? value : value && value.text;
                if (csv) csv.trim().split(/\r?\n/).slice(1).forEach(function (line) {
                    var cells = line.split(',').map(function (cell) { return cell.trim(); });
                    if (cells.length >= 4 && isFinite(Number(cells[0])) && cells[2] && isFinite(Number(cells[3]))) rows.push(cells);
                });
            }
            self.utilManager.configLoading = false;
            if (!rows.length) {
                if ((attempt || 0) < 2) self.scheduleOnce(function () { self.loadMapData((attempt || 0) + 1); }, 0.5);
                else self.utilManager.loadError = true;
                return;
            }
            rows.sort(function (a, b) { return Number(a[0]) - Number(b[0]); });
            self.MapCount = rows.map(function (row) { return Number(row[0]); });
            self.Lvl = rows.map(function (row) { return row[1]; });
            self.LvMapDir = rows.map(function (row) { return row[2]; });
            self.LvCamSpeed = rows.map(function (row) { return Number(row[3]); });
            self.utilManager.MapDirLen = rows.length;
            self.utilManager.MapArrayDir = self.LvMapDir.slice();
            self.utilManager.loadError = false;
            self.LvMapDir.forEach(function (dir, index) { self.utilManager.loadMMapArray(dir, index); });
            self.utilManager.checkReady();
        });
    },
    UpdatePlayerData: function () { this.currentBonusCount++; },
    CheckMapConfig: function () {
        var next = this.currentMapCount + 1, level = 0;
        if (!this.MapCount.length) return false;
        for (var i = 0; i < this.MapCount.length; i++) if (next >= this.MapCount[i]) level = i;
        if (!this.utilManager.GetMapArray(this.LvMapDir[level])) return false;
        this.currentMapCount = next;
        this.currentLevel = level;
        var camera = cc.find('CameraCon/Camera').getComponent('cameraControl');
        camera.moveSpeed = this.LvCamSpeed[level];
        camera.InitMoveSpeed = this.LvCamSpeed[level];
        return true;
    },
    onLoad: function () {
        MapDataManager._instance = this;
        this.resetMapData();
        this.utilManager = this.node.getComponent('UtilManager');
        cc.game.addPersistRootNode(this.node);
        this.loadMapData();
    },
    resetMapData: function () { this.currentMapCount = -1; this.currentLevel = -1; }
});
