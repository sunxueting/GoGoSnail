// Optional, device-local profile. Never store the full authorization response.
var KEY = 'SnailPlayerProfile';
var cached = null;
var privacyListenerInstalled = false;
var privacyPresenter = null;

function installPrivacyListener() {
    if (privacyListenerInstalled || typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) return;
    wx.onNeedPrivacyAuthorization(function (resolve) {
        if (privacyPresenter) privacyPresenter(resolve);
        else resolve({ event: 'disagree' });
    });
    privacyListenerInstalled = true;
}

function authorizationFailure(res) {
    var message = res && res.errMsg || '';
    if (/announce your privacy usage/i.test(message)) return '后台隐私指引未声明头像昵称\n请保存对应信息用途后重试';
    if (/open official popup|onNeedPrivacyAuthorization/i.test(message)) return '隐私确认尚未完成\n请关闭纪录页后重新进入';
    if (/deny|denied|cancel|privacy permission is not authorized/i.test(message)) return '已取消授权，仍可正常游戏\n可再次点击按钮授权';
    return '授权暂未完成，仍可正常游戏\n请稍后重试';
}

function read() {
    if (cached) return cached;
    try {
        var value = JSON.parse(cc.sys.localStorage.getItem(KEY) || 'null');
        if (value && typeof value.nickName === 'string') {
            cached = { nickName: value.nickName.slice(0, 40), avatarUrl: avatar(value.avatarUrl) };
        }
    } catch (e) {}
    return cached;
}

function avatar(value) {
    // Only load the WeChat avatar service; never load arbitrary stored URLs.
    return typeof value === 'string' && /^https:\/\/(?:[a-z0-9-]+\.)*qlogo\.cn\//i.test(value) ? value : '';
}

function save(info) {
    if (!info || typeof info.nickName !== 'string' || !info.nickName.trim()) return false;
    var value = { nickName: info.nickName.trim().slice(0, 40), avatarUrl: avatar(info.avatarUrl) };
    try { cc.sys.localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) { return false; }
    cached = value;
    return true;
}

function clear() {
    cc.sys.localStorage.removeItem(KEY);
    cached = null;
}

function label(parent, name, text, y, width, height, size) {
    var node = new cc.Node(name);
    parent.addChild(node);
    node.setPosition(0, y);
    node.setContentSize(width, height);
    var component = node.addComponent(cc.Label);
    component.useSystemFont = true;
    component.fontFamily = 'Arial';
    component.fontSize = size || 24;
    component.lineHeight = (size || 24) + 8;
    component.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
    component.verticalAlign = cc.Label.VerticalAlign.CENTER;
    component.overflow = cc.Label.Overflow.SHRINK;
    component.string = text;
    node.setContentSize(width, height);
    return node;
}

function notice(text) {
    if (typeof wx !== 'undefined' && wx.showToast) wx.showToast({ title: text, icon: 'none' });
}

function mount(board) {
    var hasGlobalRanking = require('CloudRanking').enabled();
    var host = new cc.Node('PlayerProfilePanel');
    board.node.addChild(host);
    var title = label(host, 'ProfileName', '', -250, 440, 44, 28).getComponent(cc.Label);
    label(host, 'ProfilePurpose', hasGlobalRanking ? '本页授权仅用于本机纪录\n全服公开须另行同意，拒绝可正常游戏' : '头像昵称仅用于本机纪录展示\n拒绝授权也可正常游戏', -310, 440, 80, 23);
    var authorize = label(host, 'ProfileAuthorize', '授权头像昵称', -410, 330, 64, 26);
    var backgroundNode = new cc.Node('ButtonBackground');
    authorize.addChild(backgroundNode);
    backgroundNode.setAnchorPoint(0, 0);
    backgroundNode.setPosition(-165, -32);
    var background = backgroundNode.addComponent(cc.Graphics);
    background.fillColor = cc.color(25, 125, 85, 255);
    background.roundRect(0, 0, 330, 64, 10);
    background.fill();
    // Graphics render after Label on the same node; put the label above it.
    authorize.getComponent(cc.Label).enabled = false;
    label(authorize, 'Caption', '授权头像昵称', 0, 330, 64, 26);
    var remove = label(host, 'ProfileDelete', '删除本机头像昵称', -495, 400, 56, 23);
    var status = label(host, 'ProfileStatus', hasGlobalRanking ? '本页资料保存在本机，可随时删除\n在全服榜另行同意后才上传公开' : '资料保存在本机，可随时删除\n不会上传到开发者服务器', -580, 440, 90, 22).getComponent(cc.Label);
    var contract = label(host, 'ProfilePrivacy', '查看隐私指引', -670, 400, 50, 23);
    var nativeButton = null;
    var generation = 0;
    var loadedAvatar = '';
    var loadedImage = null;
    var avatarTexture = null;
    var disposed = false;
    var checkingAuthorization = false;
    var verification = 0;
    var privacyPanel = null;
    var privacyResolve = null;

    function visible() { return !disposed && cc.isValid(host) && host.activeInHierarchy; }
    function hide() {
        generation++;
        if (privacyPresenter === showPrivacy) privacyPresenter = null;
        closePrivacy('disagree');
        if (nativeButton) {
            try { nativeButton.destroy(); } catch (e) {}
            nativeButton = null;
        }
    }
    function closePrivacy(event) {
        var resolve = privacyResolve;
        privacyResolve = null;
        if (privacyPanel) { privacyPanel.destroy(); privacyPanel = null; }
        if (nativeButton && nativeButton.show && visible()) nativeButton.show();
        if (resolve) resolve({ event: event });
    }
    function showPrivacy(resolve) {
        if (!visible()) { resolve({ event: 'disagree' }); return; }
        closePrivacy('disagree');
        privacyResolve = resolve;
        if (nativeButton && nativeButton.hide) nativeButton.hide();
        var size = cc.view.getVisibleSize();
        privacyPanel = new cc.Node('PrivacyConsentPanel');
        board.node.addChild(privacyPanel);
        privacyPanel.zIndex = 32767;
        privacyPanel.setContentSize(size.width, size.height);
        var center = cc.v2(size.width / 2, size.height / 2);
        if (cc.Camera.main && cc.Camera.main.containsNode(board.node)) center = cc.pointApplyAffineTransform(center, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
        privacyPanel.setPosition(board.node.convertToNodeSpaceAR(center));
        var backdrop = new cc.Node('Backdrop');
        privacyPanel.addChild(backdrop);
        backdrop.setAnchorPoint(0, 0);
        var shade = backdrop.addComponent(cc.Graphics);
        shade.fillColor = cc.color(15, 20, 24, 255);
        shade.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        shade.fill();
        privacyPanel.on(cc.Node.EventType.TOUCH_START, function (event) { event.stopPropagation(); });
        privacyPanel.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); });
        var width = Math.min(800, size.width - 80);
        label(privacyPanel, 'PrivacyTitle', '头像昵称与隐私保护', 240, width, 64, 38);
        label(privacyPanel, 'PrivacyPurpose', hasGlobalRanking ? '经你同意后获取微信头像、昵称\n本页授权仅保存在本机，可随时删除\n在全服榜另行同意后才上传并公开\n拒绝不影响正常游戏' : '经你同意后获取微信头像、昵称\n仅用于本机纪录页展示，保存在设备本地\n不上传至开发者服务器，可随时删除\n拒绝不影响正常游戏', 110, width, 170, 28);
        var contractLink = label(privacyPanel, 'PrivacyContract', '查看《用户隐私保护指引》', -30, width, 65, 28);
        var agree = label(privacyPanel, 'PrivacyAgree', '同意并继续授权头像昵称', -130, width, 70, 32);
        agree.color = cc.color(85, 225, 165);
        var decline = label(privacyPanel, 'PrivacyDecline', '不同意，继续以游客游玩', -230, width, 70, 28);
        contractLink.on(cc.Node.EventType.TOUCH_END, function (event) {
            event.stopPropagation();
            if (wx.openPrivacyContract) wx.openPrivacyContract({ fail: function () { notice('隐私指引暂未加载，请稍后重试'); } });
            else notice('请更新微信后查看隐私指引');
        });
        agree.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); closePrivacy('agree'); });
        decline.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); closePrivacy('disagree'); });
        resolve({ event: 'exposureAuthorization' });
    }
    function refresh() {
        var profile = checkingAuthorization ? null : read();
        title.string = profile ? profile.nickName : '游客 · 本机最高纪录';
        remove.active = !!profile;
        authorize.getChildByName('Caption').getComponent(cc.Label).string = profile ? '更新头像昵称' : '授权头像昵称';
        if (board.ldArray && cc.isValid(board.ldArray[0])) {
            var item = board.ldArray[0];
            item.getChildByName('rank').active = !(profile && profile.avatarUrl);
            item.getChildByName('name').getComponent(cc.Label).string = profile ? profile.nickName : '本机最高纪录';
            var image = item.getChildByName('image');
            if (image) {
                image.setAnchorPoint(0.5, 0.5);
                image.setPosition(-181, -40);
                image.active = !!(profile && profile.avatarUrl);
                if (profile && profile.avatarUrl && (loadedAvatar !== profile.avatarUrl || loadedImage !== image)) {
                    loadedAvatar = profile.avatarUrl;
                    loadedImage = image;
                    var expected = profile.avatarUrl;
                    var epoch = generation;
                    function done(err, texture) {
                        if (epoch !== generation || loadedImage !== image) { if (texture) texture.destroy(); return; }
                        if (!cc.isValid(image) || !read() || read().avatarUrl !== expected) { if (texture) texture.destroy(); return; }
                        if (err || !texture) { image.active = false; item.getChildByName('rank').active = true; loadedAvatar = ''; return; }
                        if (avatarTexture) avatarTexture.destroy();
                        avatarTexture = texture;
                        var sprite = image.getComponent(cc.Sprite);
                        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                        image.setContentSize(64, 64);
                        sprite.spriteFrame = new cc.SpriteFrame(texture);
                    }
                    // Avoid the engine downloader's persistent asset cache for avatars.
                    if (typeof wx !== 'undefined' && wx.createImage) {
                        var picture = wx.createImage();
                        picture.onload = function () {
                            var texture = new cc.Texture2D();
                            texture.initWithElement(picture);
                            texture.handleLoadedTexture();
                            done(null, texture);
                        };
                        picture.onerror = function () { done(true); };
                        picture.src = expected;
                    } else {
                        image.active = false;
                    }
                }
            }
        }
    }
    function sync() {
        if (!visible()) { hide(); return; }
        privacyPresenter = showPrivacy;
        if (privacyPanel) return;
        if (typeof wx === 'undefined' || !wx.createUserInfoButton) return;
        var rect = authorize.getBoundingBoxToWorld();
        if (cc.Camera.main && cc.Camera.main.containsNode(authorize)) rect = cc.rectApplyAffineTransform(rect, cc.Camera.main.viewMatrix);
        var windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        var frame = cc.view.getFrameSize();
        var viewport = cc.view.getViewPortRect();
        var scaleX = cc.view.getScaleX(), scaleY = cc.view.getScaleY();
        var dpr = cc.view.getDevicePixelRatio();
        var width = windowInfo.windowWidth || windowInfo.screenWidth;
        var height = windowInfo.windowHeight || windowInfo.screenHeight;
        var canvasWidth = frame.width * dpr, canvasHeight = frame.height * dpr;
        var style = {
            left: (viewport.x + rect.x * scaleX) / canvasWidth * width,
            top: height - (viewport.y + (rect.y + rect.height) * scaleY) / canvasHeight * height,
            width: rect.width * scaleX / canvasWidth * width,
            height: rect.height * scaleY / canvasHeight * height,
            backgroundColor: '#197d55', color: '#ffffff', textAlign: 'center', fontSize: 16, borderRadius: 6
        };
        style.lineHeight = style.height;
        if (nativeButton) {
            Object.keys(style).forEach(function (key) { nativeButton.style[key] = style[key]; });
            return;
        }
        try {
            nativeButton = wx.createUserInfoButton({ type: 'text', text: read() ? '更新头像昵称' : '授权头像昵称', lang: 'zh_CN', withCredentials: false, style: style });
            var epoch = generation;
            nativeButton.onTap(function (res) {
                if (!visible() || epoch !== generation) return;
                if (!res || !res.userInfo) {
                    status.string = authorizationFailure(res);
                    return;
                }
                if (!save(res.userInfo)) {
                    status.string = '资料未能保存，请稍后重试\n不影响正常游戏';
                    return;
                }
                verification++;
                checkingAuthorization = false;
                status.string = '头像昵称已保存在本机\n可点击上方按钮删除';
                hide();
                refresh();
            });
        } catch (e) {
            status.string = '暂时无法授权，仍可正常游戏\n请检查隐私设置或稍后重试';
        }
    }
    authorize.on(cc.Node.EventType.TOUCH_END, function () {
        if (typeof wx === 'undefined' || !wx.createUserInfoButton) notice('请在微信小游戏中授权');
        else if (!nativeButton) sync();
    });
    remove.on(cc.Node.EventType.TOUCH_END, function () {
        verification++;
        checkingAuthorization = false;
        hide();
        try { clear(); } catch (e) { notice('删除失败，请重试'); return; }
        loadedAvatar = '';
        loadedImage = null;
        if (avatarTexture) { avatarTexture.destroy(); avatarTexture = null; }
        refresh();
        status.string = hasGlobalRanking ? '已删除本机头像昵称，最高分保留\n云端公开资料请到全服榜撤下' : '已删除本机头像昵称\n最高分保留，可继续以游客身份游戏';
    });
    contract.on(cc.Node.EventType.TOUCH_END, function () {
        if (typeof wx !== 'undefined' && wx.openPrivacyContract) wx.openPrivacyContract({ fail: function () { notice('暂时无法打开隐私指引'); } });
        else notice('隐私联系：583339047@qq.com');
    });
    function verify() {
        installPrivacyListener();
        privacyPresenter = showPrivacy;
        // Do not show a saved identity before checking the current permission.
        var requests = [];
        if (typeof wx !== 'undefined' && read()) {
            if (wx.getPrivacySetting) requests.push(function (callback) { wx.getPrivacySetting({ success: function (res) { callback(!res.needAuthorization); }, fail: function () { callback(false); } }); });
            if (wx.getSetting) requests.push(function (callback) { wx.getSetting({ success: function (res) { callback(!!(res.authSetting && res.authSetting['scope.userInfo'])); }, fail: function () { callback(false); } }); });
        }
        var requestId = ++verification;
        var checkEpoch = generation;
        var remaining = requests.length;
        var permitted = true;
        checkingAuthorization = remaining > 0;
        refresh();
        requests.forEach(function (request) { request(function (allowed) {
            if (!visible() || generation !== checkEpoch || requestId !== verification) return;
            permitted = permitted && allowed;
            if (--remaining > 0) return;
            checkingAuthorization = false;
            if (!permitted) {
                hide();
                try { clear(); } catch (e) { checkingAuthorization = true; }
                loadedAvatar = '';
                loadedImage = null;
                if (avatarTexture) { avatarTexture.destroy(); avatarTexture = null; }
            }
            refresh();
        }); });
    }
    return { sync: sync, verify: verify, hide: function () { hide(); loadedAvatar = ''; loadedImage = null; }, refresh: refresh, dispose: function () { hide(); disposed = true; if (avatarTexture) avatarTexture.destroy(); } };
}

module.exports = { read: read, save: save, clear: clear, mount: mount };
