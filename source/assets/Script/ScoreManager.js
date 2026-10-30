// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var LeaderBoardManager = require('LeaderBoardManager');
var ScoreManager = cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },
    properties: {

        _ScoreFullCircle :{
            default: 5,
            type:cc.Integer,
            visible:true
        },

        _ScorePassCircle:
        {
            default:1,
            type :cc.Integer,
            visible:true
        },

       _ScoreDoubleJump :
       {
           default:1,
           type :cc.Integer,
           visible:true
       } ,   

       _ScoreTripleJump :
       {
           default:2,
           type :cc.Integer,
           visible:true
       } ,  

       _ScoreQuadrupleJump :
       {
           default:3,
           type :cc.Integer,
           visible:true
       },

       _ScoreSurperJump :
       {
           default:4,
           type :cc.Integer,
           visible:true
       }, 

       _intervalJump:
       {
           default :3,
           visible :true
       },
        
       _invincibleRevive :
       {
           default :5,
           visible:true
          // type :CC.
       },

       Str_DoubleJump : 'DOUBLE JUMP',
       Str_TripleJump: 'Triple Jump',
       Str_QuadrupleJump:'Quadruple Jump',
       Str_SurperJump:'SuperJump',
       Str_FullCircle :'Complete',
       PlayerScore:
       {
            default: 0,
            type : cc.Integer,
            visible:false
       },

       _lsNewRecord:false
        // foo: {
        //     // ATTRIBUTES:
        //     default: null,        // The default value will be used only when the component attaching
        //                           // to a node for the first time
        //     type: cc.SpriteFrame, // optional, default is typeof default
        //     serializable: true,   // optional, default is true
        // },
        // bar: {
        //     get () {
        //         return this._bar;
        //     },
        //     set (value) {
        //         this._bar = value;
        //     }
        // },
    },

    // LIFE-CYCLE CALLBACKS:

    UploadScore()
    {
        var score = Math.max(0, Math.floor(Number(this.PlayerScore) || 0));
        this._lsNewRecord = score > this.GetTopScore();
        if (this._lsNewRecord) cc.sys.localStorage.setItem('TopScore', String(score));
        require('CloudRanking').submit(score);
    },
    GetTopScore()
    {
        var score = Number(cc.sys.localStorage.getItem('TopScore'));
        return isFinite(score) && score > 0 ? Math.floor(score) : 0;
    },
     onLoad () {
      //  cc.log(" ScoreManager._instance ");
        ScoreManager._instance = this;
        this.scoreUI = cc.find('CameraCon/Camera/deathboxUp/scoreName/Score').getComponent(cc.Label);
      //  cc.log(" ScoreManager._instance "+ ScoreManager._instance);

        this.processBar = cc.find("CameraCon/Camera/deathboxUp/progressBar").getComponent(cc.ProgressBar);
     },

     UpdateScore :function(param)
     {
        this.PlayerScore += param;
        if(param >0)
           LeaderBoardManager._instance.CheckUpOpponent( this.PlayerScore);

        var processLen = (this.PlayerScore%50 )/50;
      //  cc.log("processLen "+processLen);
        this.processBar.progress = processLen;

     },
    start () {

    },

     update (dt) {
        this.scoreUI.string = +this.PlayerScore;
     },
});
