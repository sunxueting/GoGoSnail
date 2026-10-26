# 微信适配器来源

使用 Cocos Creator 官方组织仓库 https://github.com/cocos-creator-packages/weapp-adapter 。

固定提交：09cc8c4829a09c043b2a14cafe4a65e12e2b0970（2018 年，匹配旧工程年代）。

原始目录保留。`tools/build.mjs` 在构建时转换旧 Babel 的 export 扩展语法，将 namespace 复制为可变对象并显式导出宿主计时器；不改写供应商原文件。网页验证引擎与序列化资源来自用户原始交付的 Creator 1.9.2 构建，保留原有许可注释。

版本管理入库时，所需旧资源、网页引擎、样式和 settings 收录于 `vendor/legacy-build/`。组件 UUID 与名称从原编译脚本提取为 `component-ids.json`；不执行旧编译逻辑，也不依赖本机桌面目录。相关引擎上游许可保留于 `vendor/licenses/`。原游戏美术、音频和其他第三方资源仍依其各自授权使用，本说明不对这些素材授予新的开源许可。

微信引擎来源：https://github.com/cocos/cocos-engine/tree/3afbc285779d69855be988361cf91501eb129345 ，固定提交 3afbc285779d69855be988361cf91501eb129345（1.9-release 分支合并点）。不能声称它精确等同于原交付的 1.9.2 二进制。`tools/engine.mjs` 以 CC_WECHATGAME=true、CC_SUPPORT_JIT=false 构建，处理微信模块全局命名空间，并修复旧源码在严格模式下的三个兼容点：只读 ToggleGroup 别名赋值、动画循环漏声明变量、向原始音频路径字符串写入 UUID。物理 b2 显式绑定本地命名空间。原始引擎源码不修改。

生成文件 vendor/cocos-wechat-engine.js 随项目保留。重新生成需将该固定提交源码放到 vendor/cocos-engine，然后执行 node tools/engine.mjs；该原始目录不进入 Git。微信构建对序列化 Label 使用系统字体，避免组件启动前自定义字体加载失败。

此来源说明不代表已验证与当前微信基础库兼容。开发者工具及真机验证是发布的前置步骤。

参考发布及分包文档：
- https://docs.cocos.com/creator/1.9/manual/zh/publish/publish-wechatgame.html
- https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html
