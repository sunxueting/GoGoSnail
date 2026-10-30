// Use the drawable game window, which can differ from the physical screen.
function windowInfo() {
  try { if (wx.getWindowInfo) return wx.getWindowInfo(); } catch (_) {}
  return wx.getSystemInfoSync();
}
const info = windowInfo();
export let innerWidth = info.windowWidth || info.screenWidth;
export let innerHeight = info.windowHeight || info.screenHeight;
export const devicePixelRatio = info.pixelRatio || info.devicePixelRatio || 1;
export const screen = {
  width: info.screenWidth || innerWidth, height: info.screenHeight || innerHeight,
  availWidth: innerWidth, availHeight: innerHeight, availLeft: 0, availTop: 0
};
export const ontouchstart = null;
export const ontouchmove = null;
export const ontouchend = null;

function assign(target, key, value) {
  try { if (target) target[key] = value; } catch (_) { /* Native devtools can expose readonly fields. */ }
}
if (wx.onWindowResize) wx.onWindowResize(function (event) {
  const next = event && event.size || windowInfo();
  if (!(next.windowWidth > 0 && next.windowHeight > 0)) return;
  innerWidth = next.windowWidth; innerHeight = next.windowHeight;
  screen.availWidth = innerWidth; screen.availHeight = innerHeight;
  const global = GameGlobal;
  [global, global.window].forEach(function (target) {
    assign(target, 'innerWidth', innerWidth); assign(target, 'innerHeight', innerHeight);
  });
  const canvas = global.screencanvas;
  if (canvas && canvas.style) { canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px'; }
  const document = global.document || global.window && global.window.document;
  if (document && document.dispatchEvent) document.dispatchEvent({ type: 'resize' });
});
