window.FoodType = { goodFood: 0, LowBadFood: 1, MidBadFood: 2, HighBadFood: 3 };
var requiredPrefabs = {
    GoodPrefab: 'Prefab/GoodFood', LowBadPrefab: 'Prefab/lowBadFood', midBadPrefab: 'Prefab/midBadFood',
    highBadPrefab: 'Prefab/highBadFood', _VfxPlayerDead: 'Prefab/Vfxdead', _VfxOniDead: 'Prefab/VfxOniDead',
    _LdEntry: 'Prefab/ItemEntry', _LdGetUp: 'Prefab/GetUpMessage'
};
var UtilManager = cc.Class({
    extends: cc.Component,
    statics: { _instance: null },
    properties: {
        GoodPrefab: { default: null, type: cc.Prefab }, LowBadPrefab: { default: null, type: cc.Prefab },
        midBadPrefab: { default: null, type: cc.Prefab }, highBadPrefab: { default: null, type: cc.Prefab },
        _VfxPlayerDead: { default: null, type: cc.Prefab }, _VfxOniDead: { default: null, type: cc.Prefab },
        _MusicBGM: { default: null, url: cc.AudioClip }, _LdEntry: { default: null, type: cc.Prefab },
        _LdGetUp: { default: null, type: cc.Prefab }, mapArray: [], MemoryMapArray: [], MapArrayDir: [],
        MapDirLen: 0, AllMapLoadFinished: false
    },
    GetMapFinished: function () { return this.AllMapLoadFinished; },
    getRandomInt: function (min, max) { return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min); },
    getGoodFood: function () { return this.GoodPrefab; },
    getOrder: function (start, end, count) {
        var pool = [], result = [];
        for (var i = start; i <= end; i++) pool.push(i);
        while (pool.length && result.length < count) result.push(pool.splice(this.getRandomInt(0, pool.length - 1), 1)[0]);
        return result;
    },
    FindMaplsLoaded: function (dir) { return this.MapArrayDir.indexOf(dir); },
    checkReady: function () {
        var self = this;
        this.AllMapLoadFinished = this.MapArrayDir.length > 0 && this.MapArrayDir.every(function (dir, index) {
            var entry = self._mapLoads[dir];
            if (!entry || !entry.assets || !entry.assets.length) return false;
            self.MemoryMapArray[index] = entry.assets;
            return true;
        }) && Object.keys(requiredPrefabs).every(function (key) { return !!self[key]; });
        if (this.AllMapLoadFinished && !this._readyNotified) {
            this._readyNotified = true;
            var ui = require('UIManager')._instance;
            if (ui) { ui.setLoadingVisble(false); ui.FristTriggerEnable(true); }
        }
    },
    lsAllMAPload: function () { this.checkReady(); },
    loadMMapArray: function (dir, index, attempt) {
        this.MapArrayDir[index] = dir;
        var entry = this._mapLoads[dir];
        if (entry && (entry.pending || entry.assets)) { this.checkReady(); return; }
        entry = this._mapLoads[dir] = { pending: true };
        var self = this;
        cc.loader.loadResDir('Level/' + dir, cc.Prefab, function (error, assets) {
            entry.pending = false;
            if (error || !assets || !assets.length) {
                if ((attempt || 0) < 2) self.scheduleOnce(function () { self.loadMMapArray(dir, index, (attempt || 0) + 1); }, 0.5);
                else { entry.failed = true; self.loadError = true; }
                return;
            }
            entry.assets = assets;
            self.MapArrayDir.forEach(function (name, i) { if (name === dir) self.MemoryMapArray[i] = assets; });
            self.checkReady();
        });
    },
    GetMapArray: function (dir) {
        var entry = this._mapLoads[dir];
        if (!entry || !entry.assets || !entry.assets.length) return false;
        this.mapArray = entry.assets;
        return true;
    },
    loadMapAarray: function (dir) { this.loadMMapArray(dir, Math.max(0, this.FindMaplsLoaded(dir))); },
    loadPrefab: function (key, attempt) {
        var self = this;
        if (this[key] || this._prefabLoads[key]) return;
        this._prefabLoads[key] = true;
        cc.loader.loadRes(requiredPrefabs[key], function (error, prefab) {
            self._prefabLoads[key] = false;
            if (error || !prefab) {
                if ((attempt || 0) < 2) self.scheduleOnce(function () { self.loadPrefab(key, (attempt || 0) + 1); }, 0.5);
                else self.loadError = true;
                return;
            }
            self[key] = prefab;
            self.checkReady();
        });
    },
    retryResources: function () {
        var self = this;
        this.loadError = false;
        var manager = this.node.getComponent('MapDataManager');
        if (!this.MapArrayDir.length && !this.configLoading) manager.loadMapData();
        this.MapArrayDir.forEach(function (dir, index) { self.loadMMapArray(dir, index); });
        Object.keys(requiredPrefabs).forEach(function (key) { self.loadPrefab(key); });
    },
    onLoad: function () {
        UtilManager._instance = this;
        this._mapLoads = {};
        this._prefabLoads = {};
        this.AllMapLoadFinished = false;
        this._readyNotified = false;
        this.MapDirLen = 0;
        this.loadError = false;
        var self = this;
        Object.keys(requiredPrefabs).forEach(function (key) { self.loadPrefab(key); });
    }
});
