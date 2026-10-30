/* Runtime entry for the restored Creator 1.9.2 game. */
(function () {
  window.bootSnail = function (isWechat) {
    var settings = window._CCSettings;
    window._CCSettings = undefined;
    var uuids = settings.uuids;
    if (!settings.debug) {
      var raw = settings.rawAssets;
      settings.rawAssets = {};
      Object.keys(raw).forEach(function (mount) {
        var expanded = settings.rawAssets[mount] = {};
        Object.keys(raw[mount]).forEach(function (id) {
          var entry = raw[mount][id];
          if (typeof entry[1] === 'number') entry[1] = settings.assetTypes[entry[1]];
          expanded[uuids[id] || id] = entry;
        });
      });
      settings.scenes.forEach(function (scene) {
        if (typeof scene.uuid === 'number') scene.uuid = uuids[scene.uuid];
      });
      Object.keys(settings.packedAssets).forEach(function (id) {
        settings.packedAssets[id] = settings.packedAssets[id].map(function (uuid) { return typeof uuid === 'number' ? uuids[uuid] : uuid; });
      });
    }
    if (isWechat) cc.loader.insertPipeAfter(cc.loader.md5Pipe || cc.loader.assetLoader, window.wxDownloader);
    console.log('Snail boot', isWechat, !!document.body, cc._engineLoaded);
    cc.game.run({
      id: 'GameCanvas', scenes: settings.scenes, debugMode: cc.DebugMode.ERROR,
      showFPS: false, frameRate: 60, jsList: isWechat ? [] : ['src/project.js'],
      groupList: settings.groupList, collisionMatrix: settings.collisionMatrix, renderMode: 0,
    }, function () {
      console.log('Snail engine initialized');
      if (isWechat) require('./src/project.js');
      cc.view.resizeWithBrowserSize(true);
      cc.view.enableRetina(true);
      cc.view.setOrientation(cc.macro.ORIENTATION_PORTRAIT);
      cc.view.enableAutoFullScreen(false);
      var prefix = isWechat ? 'assets/' : '';
      window.__snailAssetRoot = prefix;
      cc.AssetLibrary.init({ libraryPath: prefix + 'res/import', rawAssetsBase: prefix + 'res/raw-', rawAssets: settings.rawAssets, packedAssets: settings.packedAssets, md5AssetsMap: settings.md5AssetsMap });
      cc.director.loadScene(settings.launchScene, function (err) {
        if (err) { console.error('Game scene failed', err); return; }
        window.__snailSceneReady = true;
        console.log('GoGoSnail scene ready');
      });
    });
  };
})();
