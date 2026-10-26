# 旧构建基线

来自原交付的 Cocos Creator 1.9.2 `fb-instant-games` 构建。这里只保留重建所需的序列化资源、网页引擎、样式、settings 和组件 UUID 映射；不保留 Facebook 启动入口或平台配置。

`component-ids.json` 从原 `src/project.07edb.js` 的 `cc._RF.push` 提取 25 个组件 UUID 和名称。当前脚本始终从 `source/assets` 构建，旧编译脚本不作为游戏逻辑执行。

基线资源不是自动从 `source/` 重新导入得到的。需要在对应 Creator 导出流程中更新资源，并核对 UUID；构建脚本不能代替 Creator 资源导入器。
