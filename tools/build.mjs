import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const legacy = process.env.SNAIL_LEGACY_BUILD || path.join(root, 'vendor/legacy-build');
const out = path.join(root, 'build');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const write = (p, content) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
const copy = (a, b) => fs.cpSync(a, b, { recursive: true });
// IDE/compiler workers may have their cwd inside this tree. Build separately,
// publish complete files, and retain directories so a rebuild cannot orphan cwd.
function publishBuild(prepared, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(prepared, { withFileTypes: true })) {
    const from = path.join(prepared, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) publishBuild(from, to);
    else {
      const contents = fs.readFileSync(from);
      if (fs.existsSync(to) && fs.readFileSync(to).equals(contents)) continue;
      const temporary = to + '.snail-build-tmp';
      fs.writeFileSync(temporary, contents);
      fs.renameSync(temporary, to);
    }
  }
  // Remove obsolete generated files, while keeping even empty directories alive.
  function prune(folder, expected) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name), source = path.join(expected, entry.name);
      if (entry.isDirectory()) prune(file, source);
      else if (!fs.existsSync(source)) fs.rmSync(file);
    }
  }
  prune(destination, prepared);
}
const releaseModule = { exports: {} };
vm.runInNewContext(read(path.join(root, 'source/assets/Script/ReleaseConfig.js')), { module: releaseModule });
const release = releaseModule.exports;
const packageInfo = JSON.parse(read(path.join(root, 'package.json')));
if (release.version !== packageInfo.version) throw new Error('ReleaseConfig and package versions must match');
if (!release.displayName || !release.shareTitle.startsWith(release.displayName)) throw new Error('Share title must use the official display name');
fs.mkdirSync(out, { recursive: true });

// Preserve scene/script UUIDs from the delivered Creator 1.9.2 compilation.
// Assets are reused unchanged; no Creator version migration is implied.
const componentIds = path.join(legacy, 'component-ids.json');
const ids = fs.existsSync(componentIds)
  ? JSON.parse(read(componentIds)).map(({ uuid, name }) => [null, uuid, name])
  : [...read(path.join(legacy, 'src/project.07edb.js')).matchAll(/cc\._RF\.push\([^,]+,"([^"]+)","([^"]+)"\)/g)];
if (ids.length !== 25) throw new Error(`Unexpected legacy component count: ${ids.length}`);
const scriptPaths = new Map();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.js')) scriptPaths.set(path.basename(entry.name, '.js'), p);
  }
}
walk(path.join(root, 'source/assets'));
const moduleDefinitions = ids.concat(['ReleaseUI', 'PlayerProfile', 'ScreenLayout', 'ReleaseConfig', 'ReleasePresentation', 'CloudRankingConfig', 'CloudRanking', 'GlobalRankingPanel', 'ReviveOffer', 'PauseControl'].map(name => [null, null, name]));
const modules = moduleDefinitions.map(([, id, name]) => {
  if (!scriptPaths.has(name)) throw new Error(`Missing source: ${name}`);
  return `${JSON.stringify(name)}:function(require,module,exports){\n${id ? `cc._RF.push(module,${JSON.stringify(id)},${JSON.stringify(name)});` : ''}\n${read(scriptPaths.get(name))}\n${id ? 'cc._RF.pop();' : ''}\n}`;
}).join(',\n');
const entries = ids.map(x => x[2]);
const bundle = `(function(){\nvar FoodType,CircleRunDir,BgConfig,MapConfig;\nvar modules={${modules.replace(/window\.(FoodType|CircleRunDir|BgConfig|MapConfig)\s*=/g, 'window.$1 = $1 =')}},cache={};\nfunction load(name){if(cache[name])return cache[name].exports;if(!modules[name])throw new Error('Unknown game module: '+name);var m=cache[name]={exports:{}};modules[name](load,m,m.exports);return m.exports;}\n${JSON.stringify(entries)}.forEach(load);\n})();\n`;

const settingsContext = { window: {} };
vm.runInNewContext(read(path.join(legacy, 'src/settings.d75c0.js')), settingsContext);
const settings = settingsContext.window._CCSettings;
// These script names belong to the old export; source is bundled above.
settings.jsList = [];
settings.platform = 'web-mobile';
const main = read(path.join(root, 'tools/runtime.js'));

for (const platform of ['web', 'wechat']) {
  const destination = path.join(out, platform);
  const savedPrivateConfigPath = path.join(destination, 'project.private.config.json');
  const privateConfig = fs.existsSync(savedPrivateConfigPath) ? read(savedPrivateConfigPath) : null;
  const dir = fs.mkdtempSync(path.join(out, '.' + platform + '-stage-'));
  copy(path.join(legacy, 'res'), path.join(dir, platform === 'wechat' ? 'assets/res' : 'res'));
  const brandDir = path.join(dir, platform === 'wechat' ? 'assets/brand' : 'brand');
  fs.mkdirSync(brandDir, { recursive: true });
  copy(path.join(root, 'source/assets/resources/home-snail-rush.png'), path.join(brandDir, 'home-snail-rush.png'));
  {
    // Use the same system fonts in both builds. The WeChat runtime cannot rely
    // on legacy bitmap fonts; local validation must show the shipped typography.
    function systemLabels(value) {
      if (typeof value === 'string' && value.includes('cc.Label') && /^[\[{]/.test(value)) {
        try { return JSON.stringify(systemLabels(JSON.parse(value))); } catch { return value; }
      }
      if (!value || typeof value !== 'object') return value;
      if (value.__type__ === 'cc.Label') {
        value._isSystemFontUsed = true;
        value['_N$file'] = null;
        value['_N$fontFamily'] = 'Arial';
      }
      for (const key of Object.keys(value)) value[key] = systemLabels(value[key]);
      return value;
    }
    function patchLabels(folder) {
      for (const file of fs.readdirSync(folder, { withFileTypes: true })) {
        const target = path.join(folder, file.name);
        if (file.isDirectory()) patchLabels(target);
        else if (file.name.endsWith('.json')) write(target, JSON.stringify(systemLabels(JSON.parse(read(target)))));
      }
    }
    patchLabels(path.join(dir, platform === 'wechat' ? 'assets/res/import' : 'res/import'));
  }
  copy(path.join(legacy, 'cocos2d-js-min.e5513.js'), path.join(dir, 'cocos2d-js.js'));
  if (platform === 'wechat') copy(path.join(root, 'vendor/cocos-wechat-engine.js'), path.join(dir, 'cocos2d-js.js'));
  write(path.join(dir, 'src/project.js'), (platform === 'wechat' ? 'var cc=GameGlobal.cc;\n' : '') + bundle);
  write(path.join(dir, 'src/settings.js'), 'window._CCSettings=' + JSON.stringify({ ...settings, platform: platform === 'wechat' ? 'wechatgame' : 'web-mobile' }) + ';');
  write(path.join(dir, 'main.js'), (platform === 'wechat' ? 'var cc=GameGlobal.cc;\n' : '') + main);
  if (platform === 'web') {
    copy(path.join(legacy, 'style-mobile.72851.css'), path.join(dir, 'style.css'));
    write(path.join(dir, 'index.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>' + release.displayName + ' · 本地验证</title><link rel="stylesheet" href="style.css"><body><canvas id="GameCanvas" tabindex="0"></canvas><script src="src/settings.js"></script><script src="cocos2d-js.js"></script><script src="main.js"></script><script>bootSnail(false)</script></body></html>');
  } else {
    const adapter = path.join(root, 'vendor/cocos-creator-packages-weapp-adapter-09cc8c4/wechatgame/libs');
    // The original Babel export-extension syntax is normalized for esbuild.
    await build({
      entryPoints: [path.join(adapter, 'weapp-adapter/index.js')], outfile: path.join(dir, 'libs/weapp-adapter.js'),
      bundle: true, format: 'iife', target: 'es2015', minify: true,
      plugins: [{ name: 'legacy-babel-syntax', setup(b) {
        b.onLoad({ filter: /weapp-adapter\/.*\.js$/ }, args => {
          let contents = read(args.path);
          if (path.basename(args.path) === 'WindowProperties.js') contents = read(path.join(root, 'tools/wechat-window-properties.js'));
          if (path.basename(args.path) === 'index.js') contents = contents.replace("import * as _window from './window'", "import * as windowExports from './window'; const _window = Object.assign({}, windowExports)");
          if (path.basename(args.path) === 'index.js') contents = contents.replace('value: _window[key]', 'value: _window[key], configurable: true, writable: true');
          contents = contents.replace(/^export (\w+) from ('[^']+')/gm, 'export { default as $1 } from $2');
          if (path.basename(args.path) === 'window.js') contents = contents.replace(/^export \{ (setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|cancelAnimationFrame) \}/gm, 'const adapter_$1 = $1; export { adapter_$1 as $1 }');
          return { contents, loader: 'js' };
        });
      } }],
    });
    await build({ entryPoints: [path.join(adapter, 'xmldom/dom-parser.js')], outfile: path.join(dir, 'libs/dom-parser.js'), bundle: true, format: 'cjs', minify: true });
    write(path.join(dir, 'libs/wx-downloader.js'), 'var cc=GameGlobal.cc;\n' + read(path.join(adapter, 'wx-downloader.js')));
    write(path.join(dir, 'assets/game.js'), '// Resource subpackage entry.\n');
    fs.cpSync(path.join(root, 'cloudfunctions'), path.join(dir, 'cloudfunctions'), { recursive: true,
      filter: source => !source.split(path.sep).includes('node_modules') });
    write(path.join(dir, 'game.js'), `function startGame(){
require('./libs/weapp-adapter.js');
window.DOMParser=require('./libs/dom-parser.js').DOMParser;
require('./cocos2d-js.js');
require('./libs/wx-downloader.js');
require('./src/settings.js');
require('./main.js');
window.bootSnail(true);
}
function loadAssets(){
wx.showLoading({title:'准备游戏资源',mask:true});
wx.loadSubpackage({name:'assets',success:function(){wx.hideLoading();startGame();},fail:function(){wx.hideLoading();wx.showModal({title:'资源加载失败',content:'请检查网络后重试。资源准备完成后，核心玩法无需联网。',confirmText:'重试',showCancel:false,success:loadAssets});}});
}
loadAssets();
`);
    write(path.join(dir, 'game.json'), JSON.stringify({ deviceOrientation: 'portrait', showStatusBar: false, subpackages: [{ name: 'assets', root: 'assets/' }] }, null, 2));
    write(path.join(dir, 'project.config.json'), JSON.stringify({ appid: release.appId, projectname: release.displayName, compileType: 'game', cloudfunctionRoot: 'cloudfunctions/', setting: { es6: true, minified: true, urlCheck: true }, packOptions: { ignore: [{type:'folder',value:'cloudfunctions'}] } }, null, 2));
    if (privateConfig) write(path.join(dir, 'project.private.config.json'), privateConfig);
    let mainBytes = 0, assetBytes = 0;
    function sizes(p) { for (const f of fs.readdirSync(p, {withFileTypes:true})) { const full = path.join(p, f.name); if (f.isDirectory()) sizes(full); else if (full.startsWith(path.join(dir, 'assets') + path.sep)) assetBytes += fs.statSync(full).size; else mainBytes += fs.statSync(full).size; } }
    sizes(dir);
    if (mainBytes > 4 * 1024 * 1024) throw new Error('Main package exceeds 4 MiB');
    write(path.join(root, 'artifacts/package-size.json'), JSON.stringify({ mainBytes, assetBytes, totalBytes: mainBytes + assetBytes, method: 'Uncompressed files; developer tool upload size still requires verification' }, null, 2));
  }
  publishBuild(dir, destination);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Created local web validation and WeChat candidate builds. WeChat compatibility is not yet certified.');
