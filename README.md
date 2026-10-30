# 蜗牛向前冲 · GoGoSnail

基于 Cocos Creator 1.9.2 旧工程恢复的微信小游戏。点击屏幕控制蜗牛从旋转圆盘起跳，收集道具、避开障碍，挑战本机最高纪录。

当前候选版本为 **1.1.18**，玩法页说明按用户原文更新为恢复生命值、损失生命值及击中怪物游戏失败，保留道具靠左和说明分列，详情见 [1.1.18 版本记录](docs/releases/1.1.18.md)。保留已确认的主页蜗牛与标题底部对齐。游戏内名称、设置和分享文案保持“蜗牛向前冲”。保留 1.1.9 的暂停功能和此前的死亡遮罩、成绩同步、地图连续生成及背景切换修复。此前 1.1.5 已接入微信云开发全服排行榜，手机确认成绩同步及返回正常；普通浏览器保持本机验证模式。此前 **1.1.3** 因产品展示与后台信息不一致被拒审；尚无已确认上线版本。此次修改游戏内展示名称，后台注册名称和资质仍需单独核对，尚未重新提审。

1.1.5 已于 2026-10-29 上传开发版，手机已确认成绩显示及返回首页正常；后台隐私/联网资料及其他上线验证仍待完成，尚未重新提审。

后续本地性能修复已加入当前分支：界面布局改为按需更新，不再每帧读取最高分或计算隐藏控件。已上传的 1.1.4 仍对应 6ea8a5c；此性能改动尚未重新上传。

## 工程结构

| 路径 | 用途 |
| --- | --- |
| `source/` | 可编辑场景、脚本、美术和音频，保留原 Creator UUID |
| `tools/` | 构建、游戏流程、隐私授权、长屏和复活检查 |
| `cloudfunctions/` | 全服榜云函数、权限和索引部署清单 |
| `vendor/legacy-build/` | 保留序列化场景所需的旧版资源、网页引擎、组件 UUID 映射 |
| `vendor/cocos-wechat-engine.js` | 固定上游提交生成的微信引擎 |
| `vendor/cocos-creator-packages-weapp-adapter-09cc8c4/` | 固定版本的官方微信适配器 |
| `docs/releases/` | 版本记录 |
| `build/` | 自动生成的网页与微信工程，不进入 Git |
| `artifacts/` | 本机测试报告、截图和预览二维码，不进入 Git |

本仓库不是新版 Creator 迁移工程。标准构建复用旧版序列化资源，并从 `source/assets` 生成脚本，以保留场景与组件关联。更改脚本可直接重建；在 Creator 中修改场景、美术或音频时，也需重新生成对应的基线资源，不能只修改 `source/` 后假设资源会自动重导入。

首页新增蜗牛是显式构建资源：`source/assets/resources/home-snail-rush.png` 会复制到网页 `brand/` 和微信资源分包 `assets/brand/`，不依赖旧版 UUID 资源包。

## 安装和构建

使用 Node.js 22 或更高版本：

```sh
npm ci
npm run build
```

构建默认使用仓库中的基线资源，不依赖某一台电脑的桌面目录。生成：

- `build/web/`：本地网页验证版本。
- `build/wechat/`：导入微信开发者工具的小游戏工程；当前 AppID 为 `wx60136090bb46174f`。

如需使用重新导出的旧版构建，可设置 `SNAIL_LEGACY_BUILD`。该目录需有 `res/`、原始引擎、样式、settings 和 `component-ids.json`；也兼容原 `src/project.07edb.js` 提取组件映射的方式。

## 验证

首次在没有本机 Chrome 的环境运行时安装浏览器：

```sh
npx playwright install chromium
npm test
npm run test:profile
npm run test:layout
npm run test:release
npm run test:performance
npm run test:ranking
npm run test:ranking-ui
npm run test:revive
npm run test:progression
npm run test:score-sync
npm run test:pause
```

检查仅启动独立浏览器访问本地游戏，不读取已登录的个人浏览器。macOS 存在常规安装的 Chrome 时优先使用该路径，也可用 `SNAIL_CHROME_PATH` 指定浏览器。其他环境默认使用 Playwright Chromium。

- `npm test`：教程、跳跃、失败、每局一次免费继续、重开及本机纪录。
- `npm run test:profile`：使用模拟微信 API 和合成信息验证授权、拒绝、删除、撤销及隐私确认衔接。
- `npm run test:layout`：四种尺寸的背景覆盖、七种尺寸结算页遮罩/安全区/控件边界，以及复活目标和边界。
- `npm run test:release`：正式名称、实际分享调用、四屏标题/按钮边界、适龄和健康提示的真实触摸及遮罩覆盖、冷启动纪录页恢复。
- `npm run test:performance`：采样实际 Cocos 调用次数，防止静止首页逐帧布局或同步读取最高分。帧时间仅为本地参考，不等同于微信模拟器或手机帧率。
- `npm run test:ranking`：以真实服务逻辑和内存事务数据库验证多用户排名、最高分、公开资料检查及删除。
- `npm run test:ranking-ui`：实际 Cocos 页面连接本地服务替身，验证参加确认、提交和本人排名、头像昵称公开与撤销、四屏边界及断网提示。
- `npm run test:revive`：实际复活按钮触摸、免广告提示、每局一次、曝光/点击/成功事件、统计故障容错及合成玩家 UV/PV 区分。
- `npm run test:progression`：乱序/失败资源加载、重试、重复目录、背景延迟及连续切换、结算边缘像素，八次触屏物理跳跃和六十次模拟镜头跳跃；另用合成微信窗口数据检查适配器。
- `npm run test:score-sync`：合成云传输验证冷启动成绩同步、重试、立即重开、并发高分和退出取消，不访问生产用户数据。

- `npm run test:pause`：四屏真实触摸、暂停/继续、物理和游戏计时冻结、输入拦截、胶囊安全区、面板像素、后台事件与窗口变化。

GitHub Actions 在提交及拉取请求时执行以上构建和检查。网页或模拟 API 检查不等于微信真机或平台审核通过；微信上传和发布仍通过官方开发者工具与公众平台办理。

## 当前功能

- 单人休闲跳跃，本机保存最高分和教程状态。
- 每局一次免广告复活，视频图标入口点击后满血恢复，保留分数；修复长屏背景和安全复活位置。
- 本机纪录页可选授权头像昵称；仅本机保存，支持删除，拒绝授权仍可游戏。
- 没有广告、充值或公开聊天。联网排行榜已接入 cloud1；提审前仍须同步后台隐私与联网资料并完成其余真机验证，步骤见 [微信云排行榜部署](docs/微信云排行榜部署.md)。
- 当前正式名称统一为“蜗牛向前冲软件”，主页、设置页、分享标题和工程配置从 `source/assets/Script/ReleaseConfig.js` 读取。
- 主页提供 8+ 适龄说明和健康游戏提示；版权人名与音乐来源署名保留原文。

中文操作和标题使用运行时 Cocos 文本组件，隐藏原英文位图；网页验证与微信构建均使用系统字体。没有通过修改源图片来假设基线资源会自动更新。此实现不替代微信平台的健康系统或后台资料配置。

版本管理约定见 [docs/版本管理.md](docs/版本管理.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。引擎、适配器及第三方许可来源见 [vendor/PROVENANCE.md](vendor/PROVENANCE.md)。素材及第三方组件依各自授权使用；本仓库没有为全部内容新增统一开源许可。
