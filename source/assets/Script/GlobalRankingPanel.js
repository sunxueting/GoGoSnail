var ranking = require('CloudRanking');

function label(parent, name, value, x, y, width, height, size, action) {
    var node = new cc.Node(name);
    parent.addChild(node);
    node.setPosition(x, y);
    node.setContentSize(width, height);
    var text = node.addComponent(cc.Label);
    text.useSystemFont = true; text.fontFamily = 'Arial'; text.fontSize = size;
    text.lineHeight = size + 8; text.overflow = cc.Label.Overflow.SHRINK;
    text.horizontalAlign = cc.Label.HorizontalAlign.CENTER;
    text.verticalAlign = cc.Label.VerticalAlign.CENTER;
    text.string = value;
    node.setContentSize(width, height);
    if (action) {
        node.color = cc.color(110, 235, 180);
        node.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); action(); });
    }
    return text;
}
function confirm(title, content, action) {
    if (typeof wx === 'undefined' || !wx.showModal) return;
    wx.showModal({ title: title, content: content, confirmText: '同意', cancelText: '取消', success: function (result) { if (result.confirm) action(); } });
}

module.exports = function (board, openLocal) {
    var camera = cc.find('CameraCon/Camera');
    var previous = camera.getChildByName('GlobalRankingPanel');
    if (previous) previous.destroy();
    board.ClearLeaderboard();
    board.node.active = false;
    var panel = new cc.Node('GlobalRankingPanel');
    camera.addChild(panel);
    panel.zIndex = 30000;
    var alive = true, busy = false, unsubscribe, current = null;
    var textures = [];
    var renderGeneration = 0;
    var pageRows = new cc.Node('Rows'); panel.addChild(pageRows);
    var size = cc.view.getVisibleSize();
    var width = Math.min(920, size.width - 60);
    panel.setContentSize(size.width, size.height);
    var center = cc.v2(size.width / 2, size.height / 2);
    if (cc.Camera.main && cc.Camera.main.containsNode(camera)) center = cc.pointApplyAffineTransform(center, cc.affineTransformInvert(cc.Camera.main.viewMatrix));
    panel.setPosition(camera.convertToNodeSpaceAR(center));
    var backdrop = new cc.Node('Backdrop'); panel.addChild(backdrop);
    backdrop.zIndex = -1; backdrop.setAnchorPoint(0, 0);
    var background = backdrop.addComponent(cc.Graphics);
    background.fillColor = cc.color(12, 25, 42, 253);
    background.rect(-size.width / 2, -size.height / 2, size.width, size.height); background.fill();
    panel.on(cc.Node.EventType.TOUCH_START, function (event) { event.stopPropagation(); });
    panel.on(cc.Node.EventType.TOUCH_END, function (event) { event.stopPropagation(); });
    function dispose() {
        if (!alive) return;
        alive = false; renderGeneration++;
        if (unsubscribe) unsubscribe();
        textures.forEach(function (texture) { texture.destroy(); }); textures = [];
        panel.destroy();
    }
    function close() { dispose(); cc.find('Map').getComponent('UIManager').SubBackMM(); }
    var top = size.height / 2 - 160;
    label(panel, 'Title', '全服排行榜', 0, top, width - 160, 80, 52);
    label(panel, 'Close', '关闭', width / 2 - 65, top, 130, 80, 32, close);
    label(panel, 'Rules', '按每位玩家历史最高分排序 · 同分并列', 0, top - 85, width, 55, 30);
    var summary = label(panel, 'Summary', '正在连接排行榜…', 0, top - 150, width, 60, 32);
    var mine = label(panel, 'Mine', '', 0, -size.height / 2 + 535, width, 80, 36);
    var status = label(panel, 'Status', '', 0, -size.height / 2 + 450, width, 80, 32, function () { ranking.refresh(current ? current.offset : 0); });
    function operation(action) {
        if (busy) return;
        busy = true; status.string = '正在处理…';
        action().then(function () { if (alive) status.string = ''; }, function (error) {
            if (alive) status.string = /PROFILE_NOT_APPROVED/.test(error.message) ? '检查未完成或未通过，本次资料未公开' : /PERMISSION/.test(error.message) ? '请先在“本机资料”重新确认隐私及头像昵称授权' : '操作未完成，请稍后重试；可继续游戏';
        }).then(function () { busy = false; });
    }
    var join = label(panel, 'Join', '参加全服排名', -width * 0.25, -size.height / 2 + 350, width * 0.48, 85, 36, function () {
        if (current && current.joined) return;
        confirm('参加全服排行榜', '同意后，将保存微信账号标识及今后联网对局的最高分，并以玩家代号向所有玩家展示成绩和排名。头像昵称需另行同意公开。你可随时退出并删除云端数据；不参加也能正常游戏。', function () { operation(ranking.join); });
    });
    var publish = label(panel, 'Publish', '公开头像昵称', width * 0.25, -size.height / 2 + 350, width * 0.48, 85, 36, function () {
        if (!current || !current.joined) { status.string = '请先同意参加全服排名'; return; }
        var profile = require('PlayerProfile').read();
        if (!profile) { status.string = '请先在“本机资料”里设置头像昵称'; return; }
        confirm('公开头像昵称', '将把已授权的微信头像、昵称上传至本游戏云开发环境，经检查通过后在全服榜向所有玩家展示。你可随时撤下；原本仅保存在本机的资料不会自动公开。', function () { operation(function () { return ranking.publishProfile(profile); }); });
    });
    label(panel, 'LocalProfile', '本机资料', -width * 0.32, -size.height / 2 + 240, width * 0.3, 85, 34, function () { dispose(); openLocal(); });
    label(panel, 'ClearProfile', '撤下头像昵称', 0, -size.height / 2 + 240, width * 0.34, 85, 34, function () {
        if (!current || !current.profilePublished) return;
        confirm('撤下头像昵称', '删除云端头像昵称，排名改为玩家代号。本机资料与成绩保留。', function () { operation(ranking.clearProfile); });
    });
    label(panel, 'Leave', '退出并删除', width * 0.33, -size.height / 2 + 240, width * 0.31, 85, 34, function () {
        if (!current || !current.joined) return;
        confirm('退出排行榜', '删除你的云端成绩、头像昵称和参与记录。本机纪录保留，之后可重新参加。', function () { operation(ranking.leave); });
    });
    label(panel, 'Previous', '上一页', -width * 0.3, -size.height / 2 + 130, width * 0.3, 75, 36, function () {
        if (current && current.offset > 0) ranking.refresh(current.offset - 20);
    });
    label(panel, 'Refresh', '刷新', 0, -size.height / 2 + 130, width * 0.3, 75, 36, function () { ranking.refresh(0); });
    label(panel, 'Next', '下一页', width * 0.3, -size.height / 2 + 130, width * 0.3, 75, 36, function () {
        if (current && current.hasMore) ranking.refresh(current.offset + 20);
    });
    label(panel, 'Privacy', '隐私指引', 0, -size.height / 2 + 50, width * 0.5, 60, 32, function () {
        if (typeof wx !== 'undefined' && wx.openPrivacyContract) wx.openPrivacyContract({ fail: function () { status.string = '隐私联系：583339047@qq.com'; } });
    });
    function render(state) {
        if (!alive || !cc.isValid(panel)) return;
        status.string = state.message;
        if (state.status === 'loading') { summary.string = '正在刷新…'; return; }
        // Never present cached entries as current after a network failure.
        renderGeneration++;
        pageRows.children.slice().forEach(function (node) { node.destroy(); });
        pageRows.removeAllChildren();
        textures.forEach(function (texture) { texture.destroy(); }); textures = [];
        if (state.status !== 'ready' || !state.data) { summary.string = '暂未获取全服成绩'; mine.string = ''; return; }
        current = state.data;
        summary.string = current.total ? '共 ' + current.total + ' 位玩家 · 全服最高 ' + current.highest : '暂无成绩，参加后完成一局即可上榜';
        mine.string = current.mine ? '我的名次：' + current.mine.rank + '    最高分：' + current.mine.score : current.joined ? '已参加 · 完成下一局后记录成绩' : '未参加 · 可正常游玩';
        join.string = current.joined ? '已参加全服排名' : '参加全服排名';
        publish.string = current.profilePublished ? '更新公开资料' : '公开头像昵称';
        var rowTop = top - 235;
        var available = rowTop - (-size.height / 2 + 620);
        // A scroll view contains all 20 entries even on shorter screens.
        var viewport = new cc.Node('RankingScroll'); pageRows.addChild(viewport);
        viewport.setPosition(0, rowTop - Math.max(90, available) / 2);
        viewport.setContentSize(width, Math.max(90, available)); viewport.addComponent(cc.Mask);
        var content = new cc.Node('Content'); viewport.addChild(content);
        content.setAnchorPoint(0.5, 1); content.setContentSize(width, current.entries.length * 85);
        content.setPosition(0, Math.max(90, available) / 2);
        var scroll = viewport.addComponent(cc.ScrollView); scroll.content = content; scroll.horizontal = false; scroll.vertical = true;
        var epoch = renderGeneration;
        current.entries.forEach(function (entry, index) {
            var y = -index * 85 - 42;
            label(content, 'Rank' + index, String(entry.rank), -width * 0.43, y, width * 0.13, 75, 36);
            label(content, 'Name' + index, entry.nickName, -width * 0.02, y, width * 0.5, 75, 36);
            label(content, 'Score' + index, String(entry.score), width * 0.37, y, width * 0.23, 75, 38);
            if (!entry.avatarUrl || !/^https:\/\/(?:[a-z0-9-]+\.)*qlogo\.cn\//i.test(entry.avatarUrl) || typeof wx === 'undefined' || !wx.createImage) return;
            var avatar = new cc.Node('Avatar' + index); content.addChild(avatar);
            avatar.setPosition(-width * 0.3, y); avatar.setContentSize(58, 58);
            var picture = wx.createImage();
            picture.onload = function () {
                if (!alive || epoch !== renderGeneration || !cc.isValid(avatar)) return;
                var texture = new cc.Texture2D(); texture.initWithElement(picture); texture.handleLoadedTexture(); textures.push(texture);
                var sprite = avatar.addComponent(cc.Sprite); sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = new cc.SpriteFrame(texture); avatar.setContentSize(58, 58);
            };
            picture.onerror = function () {};
            picture.src = entry.avatarUrl;
        });
    }
    unsubscribe = ranking.subscribe(render);
    ranking.refresh(0);
    // Clean up subscription/textures if a scene reload removes the panel.
    var Cleanup = cc.Class({ extends: cc.Component, onDestroy: function () {
        alive = false; renderGeneration++; if (unsubscribe) unsubscribe();
        textures.forEach(function (texture) { texture.destroy(); }); textures = [];
    } });
    panel.addComponent(Cleanup);
};
