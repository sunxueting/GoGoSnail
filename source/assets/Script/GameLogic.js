// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var PlayerControl = require("PlayerControl");
var AudioSourceManager = require('AudioSourceManager');
var LeaderBoardManager = require('LeaderBoardManager');
var UIManager = require('UIManager');
var FacebookInstant = require('FacebookInstant');
var MapDataManager = require("MapDataManager");
var GameLogic =cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },
    properties: {
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
  
        

        UIlayer: {
            default: null,
            type: cc.Node
        }
    },
    start()
   {
    
   },
    // LIFE-CYCLE CALLBACKS:
///
     onLoad () {
    //    this.node.setLocalZOrder(2);
      //  this.UIlayer.active = false;
       GameLogic._instance = this;
       this.Cam = cc.find("CameraCon/Camera").getComponent("cameraControl");
       this.Cam.enabled = true;  
       this.PlC = cc.find("Player").getComponent('PlayerControl');

       this.uIManager = cc.find('Map').getComponent('UIManager');
       this.audioManager = cc.find('AudioManager').getComponent('AudioSourceManager');
 
        cc.find('MapDataManager').getComponent('MapDataManager').resetMapData();
    //   this.leaderBoardManager = 
 
  //     MapDataManager._instance.resetMapData();
     },


    startGame: function()
    {
        this.audioManager.stopMMBG();
   //    cc.log('-----------startGame-------------')
       this.uIManager.EnterGame();

  //     this.GamePlayStart();
      
    } ,

    TutotailStart:function()
    {
        cc.sys.localStorage.setItem('TutorailFinished',true);
        GameLogic._instance.Cam.CameraPause = false;
      //  cc.sys.localStorage.getItem('TutorailFinished');
      //  this.uIManager.FristTrigger.getComponent(cc.BoxCollider).enabled = true;
        this.GamePlayStart();
        this.uIManager.SetTutVisible(false);
    },
    GamePlayStart:function()
    {
        var playercon = GameLogic._instance.PlC;
    //    cc.log('this.PIC'+ playercon);
       // this.Cam.ResetMoveSpeed();
        playercon.node.active = true; 
        playercon.circleRun( playercon.centerStart);
        playercon.missionStart();
       // GameLogic._instance.audioManager.stopMMBG();
        GameLogic._instance.audioManager.play();
        LeaderBoardManager._instance.GetPlayerRank();
    },
     restartGame : function()
    {
   //     console.log("restart");
       FacebookInstant._instance.MoreLiftCount = 1;
       LeaderBoardManager._instance.active = false;
       var self= this;
       cc.director.loadScene('level1',function()
         {
    //    cc.log('restartGamerestartGamerestartGame');
        GameLogic._instance.uIManager.restartGame();
       // MapDataManager._instance.resetMapData();
       // self.GamePlayStart();
        });
      
      //  AudioSourceManager._instance.play();
    //    this.PlC.circleRun(this.PlC.centerStart);
    //    cc.find("Camera/UILayer/startGame").active = false;
    //    this.Cam.ResetMoveSpeed();  
    },


    ShareGame()
    {
        FacebookInstant._instance.onShareGame();
    },
     CheckContinueGame:function()
     {
        if (FacebookInstant._instance.MoreLiftCount > 0) this.ContinueGame();
     },
     ContinueGame: function()
     {
        if (FacebookInstant._instance.MoreLiftCount <= 0 || !this.PlC.missionContinue()) return;
        FacebookInstant._instance.MoreLiftCount=0;
    //      cc.log("continue");
        GameLogic._instance.uIManager.continueGame();
        LeaderBoardManager._instance.active = false;
       this.audioManager.resume();
        
     },
    
     
    // update (dt) {},
});
