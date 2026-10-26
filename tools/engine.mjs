import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
const root = path.resolve(import.meta.dirname, '..');
await build({
  entryPoints: [path.join(root, 'vendor/cocos-engine/index.js')],
  outfile: path.join(root, 'vendor/cocos-wechat-engine.js'),
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2015', minify: true,
  define: { CC_EDITOR: 'false', CC_PREVIEW: 'false', CC_BUILD: 'true', CC_TEST: 'false', CC_DEV: 'false', CC_DEBUG: 'false', CC_JSB: 'false', CC_WECHATGAME: 'true', CC_QQPLAY: 'false', CC_SUPPORT_JIT: 'false' },
  plugins: [{ name: 'legacy-readonly-alias', setup(b) {
    b.onLoad({ filter: /CCToggleGroup\.js$/ }, args => ({ contents: fs.readFileSync(args.path,'utf8').replace('cc.ToggleGroup = module.exports = ToggleGroup;', 'module.exports = ToggleGroup;'), loader:'js' }));
    b.onLoad({ filter: /physics\/index\.js$/ }, args => ({ contents: fs.readFileSync(args.path,'utf8').replace('window.b2 =', 'window.b2 = b2 ='), loader:'js' }));
    b.onLoad({ filter: /animation-manager\.js$/ }, args => ({ contents: fs.readFileSync(args.path,'utf8').replace('for (i = 0, l = events.length;', 'for (var i = 0, l = events.length;'), loader:'js' }));
    b.onLoad({ filter: /uuid-loader\.js$/ }, args => ({ contents: fs.readFileSync(args.path,'utf8').replace('if (item.uuid && item.content) {', "if (item.uuid && item.content && typeof item.content === 'object') {"), loader:'js' }));
  }}],
  banner: { js: 'var cc, _ccsg, _cc, ccs, cp, sp, dragonBones, b2; /* Cocos v1.9-release, 3afbc285779d69855be988361cf91501eb129345 */' },
  footer: { js: 'GameGlobal.cc=cc; GameGlobal._ccsg=_ccsg; GameGlobal.ccs=ccs; GameGlobal.cp=cp; window.cc=cc; window.CocosEngine=cc.ENGINE_VERSION="1.9-release@3afbc285";' },
});
