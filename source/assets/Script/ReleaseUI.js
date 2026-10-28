var translations = {
    'LeaderBoard': '本机纪录',
    'Global': '本机',
    'Friend': '本机',
    'Score': '得分',
    'STAFF': '制作人员',
    'MUSIC': '音乐来源',
    'clearday-bensound.com\nsummer-bensound.com': 'clearday-bensound.com\nukulele-bensound.com',
    'Feel free to let us know how you like the game!\nPlease send your feedback to: \nsunxueting2015@gmail.com': '欢迎反馈游戏体验与问题：\n583339047@qq.com',
    'Tutorial': '玩法',
    'Tap to Jump\nSnail leap forward on circle': '点击屏幕起跳\n把握时机，沿圆的切线飞出',
    'From Circle to Cirecle': '从一个圆跳向下一个圆',
    'HP  in the center\nGame over when Hp is 0': '圆心显示生命值\n生命值为 0 时游戏结束',
    'Damage HP': '碰到障碍会损失生命',
    'Heal HP': '收集道具恢复生命',
    'Oni Kill': '击中怪物',
    'Hat spring': '利用弹簧起跳'
};

module.exports = function () {
    var release = require('ReleaseConfig');
    if (require('CloudRanking').enabled()) translations.LeaderBoard = '全服排行榜';
    require('ScreenLayout')();
    var scene = cc.director.getScene();
    scene.getComponentsInChildren(cc.Label).forEach(function (label) {
        var replacement = translations[String(label.string).trim()];
        if (replacement) {
            label.useSystemFont = true;
            label.fontFamily = 'Arial';
            label.string = replacement;
        }
        if (label.node.name === 'version') {
            label.useSystemFont = true;
            label.fontFamily = 'Arial';
            label.fontSize = 24;
            label.lineHeight = 34;
            label.overflow = cc.Label.Overflow.SHRINK;
            label.node.setContentSize(440, 95);
            label.string = release.displayName + '\n版本 ' + release.version;
        }
    });
    var score = cc.find('Map').getComponent('ScoreManager');
    score.Str_DoubleJump = '二连跳';
    score.Str_TripleJump = '三连跳';
    score.Str_QuadrupleJump = '四连跳';
    score.Str_SurperJump = '超级跳跃';
    score.Str_FullCircle = '绕圆完成';
    require('ReleasePresentation')();
};
