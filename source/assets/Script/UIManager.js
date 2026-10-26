// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html

var ScoreManager = require("ScoreManager");
var GameLogic = require("GameLogic");
var AudioSourceManager = require('AudioSourceManager');
var FacebookInstant = require('FacebookInstant');
var UtilManager = require('UtilManager');

var MMUI_TYPE = window.MMUI_TYPE = {
    MM_Logo: 0,
    MM_Bg : 1,
    MM_StartGame : 2,
    MM_Top :3,
    MM_Setting :4,
    MM_Leaderboard :5,
   // MM_Share :6,
    MM_Tutorail:6
   
};

var OverGameUI_TYPE = window.OverGameUI_TYPE = {
    OG_Bg :0,
    OG_CurScore :1,
    OG_TopScore :2,
    OG_AD:3,
    OG_TapContinue:4,
    OG_Back:5,
    OG_VFX:6,
    OG_NEWRecord:7
};

var GameState = window.GameState ={
    MainMenu :0,
    GamePlay :1,
    OverGame:2,
    LeaderBoardMM:3,
    SettingMM:4,
    TutorailMM:5
}
var UIManager = cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },
    properties: {

        _MM_UINode:[],

        _OG_UINode:[],

        countDownTime :{
            default : 5,
           
        },    
        
        _CurrentState : GameState.MainMenu,
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
    onDestroy()
    {
    //    cc.log("---UIManager onDestroy");
        UIManager._instance = null;
        this._MM_UINode =[];
    },
    // LIFE-CYCLE CALLBACKS:
 
    onLoad () {
        UIManager._instance = this;
this.gameLogic = cc.find('Map').getComponent('GameLogic');
        this._MM_UINode[MMUI_TYPE.MM_Logo] = cc.find('CameraCon/Camera/deathboxUp/MMlogo');
        this._MM_UINode[MMUI_TYPE.MM_Bg] = cc.find('Canvas/UINode/MainMenu');
        this._MM_UINode[MMUI_TYPE.MM_StartGame] = cc.find('CameraCon/Camera/UILayer/startGame');
        this._MM_UINode[MMUI_TYPE.MM_Top] = cc.find('CameraCon/Camera/UILayer/Top');
        this._MM_UINode[MMUI_TYPE.MM_Setting] = cc.find('CameraCon/Camera/deathboxBottom/Setting');
        this._MM_UINode[MMUI_TYPE.MM_Leaderboard] = cc.find('CameraCon/Camera/deathboxBottom/LeaderBoard');
        this._MM_UINode[MMUI_TYPE.MM_Tutorail] = cc.find('CameraCon/Camera/deathboxBottom/Tutotail');
       // this._MM_UINode[MMUI_TYPE.MM_Share] = cc.find('CameraCon/Camera/deathboxBottom/Share');
        this.WaitBar = cc.find("CameraCon/Camera/UILayer/WaitLoading"); 
        this.FMap = cc.find('Map/FMap');
        this.GameBg= cc.find('Canvas/bg');
        this.HPShow = cc.find('Canvas/HP');
        this.ScoreShow = cc.find('CameraCon/Camera/deathboxUp/scoreName');

        this.utilManager = cc.find('MapDataManager').getComponent('UtilManager');

        this.FristTrigger =   cc.find('Map/NextMap');

        this._OG_UINode[OverGameUI_TYPE.OG_Bg] = cc.find('CameraCon/Camera/deathboxUp/OverGameBg');
        this._OG_UINode[OverGameUI_TYPE.OG_CurScore] = cc.find('CameraCon/Camera/UILayer/OverGame/CurrentScore');
        this._OG_UINode[OverGameUI_TYPE.OG_TopScore] = cc.find('CameraCon/Camera/UILayer/OverGame/Top');
        this._OG_UINode[OverGameUI_TYPE.OG_AD] = cc.find('CameraCon/Camera/UILayer/OverGame/AgainButton');
        this._OG_UINode[OverGameUI_TYPE.OG_TapContinue] = cc.find('CameraCon/Camera/UILayer/OverGame/TapToRestart');
        this._OG_UINode[OverGameUI_TYPE.OG_Back] = cc.find('CameraCon/Camera/deathboxUp/BackMM');
        this._OG_UINode[OverGameUI_TYPE.OG_VFX] = cc.find('CameraCon/Camera/UILayer/OverGame/CurrentScore/Vfx');
        this._OG_UINode[OverGameUI_TYPE.OG_NEWRecord] = cc.find('CameraCon/Camera/UILayer/OverGame/Top/newrecord');

        this.MMSeting = cc.find('CameraCon/Camera/UILayer/Setting');

        this.canvas = cc.find('Canvas');
        this.TototailUI = cc.find('CameraCon/Camera/UILayer/tut');
        this.audioManager = cc.find('AudioManager').getComponent('AudioSourceManager');
        this.GameState = GameState.MainMenu;
        this.initCountTime = this.countDownTime;
        this.SetOverGameVisible(false);
        this.SetMMSettingVisible(false);
        this.SetTutVisible(false);
        this.SubLeaderBoard = cc.find('CameraCon/Camera/UILayer/Leaderboard');
        this.SubLeaderBoard.x=0;
        this.gameLogic = cc.find('Map').getComponent('GameLogic');
        this.processBar = cc.find("CameraCon/Camera/deathboxUp/progressBar");

        this.lsTutoailFinished = cc.sys.localStorage.getItem('TutorailFinished');
    //    cc.log("-------------------UIManager onload end-------------------------------");
    },

    SetMMSettingVisible:function(_visible)
    {
        this.MMSeting.active = _visible;
    },

    SetOverGameVisible :function(_visible)
    {
        var ovLen = this._OG_UINode.length;
        if(_visible)
             ovLen --;
        for(var i=0; i< ovLen;i++)
        {
         this._OG_UINode[i].active = _visible;
        }

        if(_visible)
            this.scheduleOnce(this.OverGameVfxShow.bind(this),3);
        else
            this.unschedule(this.OverGameVfxShow);
    },

    OverGameVfxShow()
    {
        this._OG_UINode[OverGameUI_TYPE.OG_VFX].active = true;
    },
    SetMMVisble :function(_visible)
    {
      
       for(var i=0; i< this._MM_UINode.length;i++)
       {
        this._MM_UINode[i].active = _visible;
       }
    },
    EnterGame :function()
    {
        if(this._CurrentState == GameState.GamePlay)
        return;
    //    this.node.on('loadFinish',this.FristTriggerEnable,this.utilManager.node);
        this.FMap.active = true;
        this.GameBg.active = true;
        this.HPShow.active = true;
        this.ScoreShow.active = true;
        this.processBar.active = true;
        var b1 = this._MM_UINode[MMUI_TYPE.MM_StartGame].getComponent(cc.Button);
    //    cc.log("button = "+b1);
        b1.enabled = false;
     //   var b2  = this._MM_UINode[MMUI_TYPE.MM_Top].getComponent(cc.Button);
         var b3 =this._MM_UINode[MMUI_TYPE.MM_Setting].getComponent(cc.Button);
         var b4 =this._MM_UINode[MMUI_TYPE.MM_Leaderboard].getComponent(cc.Button);
         var b5 =this._MM_UINode[MMUI_TYPE.MM_Tutorail].getComponent(cc.Button);
       //  b2.enabled = false;
         b3.enabled = false;
         b4.enabled = false;
         b5.enabled = false;
        var loadingShow = this.utilManager.GetMapFinished();
        this.setLoadingVisble(!loadingShow);

        this.lsTutoailFinished = cc.sys.localStorage.getItem('TutorailFinished');
    //    cc.log('loadingShow'+loadingShow);
   //     cc.log('lsTutoailFinished'+ this.lsTutoailFinished);
        this._CurrentState =  GameState.GamePlay;
        if(loadingShow){   
           this.FristTriggerEnable(true);     
        }
     
      
        
        this.ChangeMusic(); 
        this.canvas.off(cc.Node.EventType.TOUCH_START,this.TapReStart,this);

        
    },

    SetTutVisible :function(_visible)
    {
        this.TototailUI.active = _visible;
    },

    FristTriggerEnable:function(_enable)
    {
        if(this._CurrentState ==  GameState.GamePlay){
       
    //    cc.log('FristTriggerEnable');
        this._CurrentState  = GameState.GamePlay;   
        UIManager._instance.SetMMVisble(false);
        UIManager._instance.FristTrigger.getComponent(cc.BoxCollider).enabled = _enable;  
        this.lsTutoailFinished = cc.sys.localStorage.getItem('TutorailFinished');
        if(!cc.isValid(this.lsTutoailFinished) || !this.lsTutoailFinished)
        {
    //         cc.log('FristTriggerEnable');
             this.gameLogic.Cam.CameraPause = true;
             UIManager._instance.SetTutVisible(true)               
        }else{      
            this.gameLogic.GamePlayStart();
        }
    }
    },

    continueGame:function()
    {
           this.countDownTime = this.initCountTime;
           this.SetOverGameVisible(false);
           this.canvas.off(cc.Node.EventType.TOUCH_START,this.TapReStart,this);
           this._CurrentState  = GameState.GamePlay;
           this.ScoreShow.active = true;
    },
    restartGame :function()
    {

        this.EnterGame();
     /*   this.FMap.active = true;
        this.GameBg.active = true;
        this.HPShow.active = true;
        this.ScoreShow.active = true;
        this.SetMMVisble(false);
        var loadingShow = this.utilManager.GetMapFinished();   
        this.setLoadingVisble(!loadingShow);
        this.countDownTime = this.initCountTime;
        this.node.on('loadFinish',this.FristTriggerEnable,this.utilManager.node);
        this._CurrentState  = GameState.GamePlay;
        this.canvas.off(cc.Node.EventType.TOUCH_START,this.TapReStart,this);*/
  
    },
    setLoadingVisble:function(_visible)
    {
        this.WaitBar.active = _visible;
    },
    EnterOverGame :function()
    {
        this._CurrentState  = GameState.OverGame;
        this.SetOverGameVisible(true);
        this._OG_UINode[OverGameUI_TYPE.OG_CurScore].getComponent(cc.Label).string =  ScoreManager._instance.PlayerScore;
        this._OG_UINode[OverGameUI_TYPE.OG_TopScore].getChildByName('score').getComponent(cc.Label).string =   ScoreManager._instance.GetTopScore();
        this.ScoreShow.active = false;
          if(ScoreManager._instance._lsNewRecord)
             this._OG_UINode[OverGameUI_TYPE.OG_NEWRecord].active = true;
          else
              this._OG_UINode[OverGameUI_TYPE.OG_NEWRecord].active = false;
        this.canvas.on(cc.Node.EventType.TOUCH_START,this.TapReStart,this);
        
        if(FacebookInstant._instance.MoreLiftCount<=0)
            this._OG_UINode[OverGameUI_TYPE.OG_AD].active = false;

  //      FacebookInstant._instance.resetAD();
    },  

    EnterSubTutorail:function()
    {
        this._MM_UINode[MMUI_TYPE.MM_StartGame].active = false;
       
        this._MM_UINode[MMUI_TYPE.MM_Top].active = false;
       
        this._MM_UINode[MMUI_TYPE.MM_Leaderboard].active =false;
        
        this._MM_UINode[MMUI_TYPE.MM_Setting].active =false;
      //  this._MM_UINode[MMUI_TYPE.MM_Share].active = false; 
        this._MM_UINode[MMUI_TYPE.MM_Tutorail].active = false;
        this._CurrentState = GameState.TutorailMM;
        this.SetTutVisible(true);
        //this.CheckSettingState();    
    },
    EnterSetting:function()
    {
        
        this._MM_UINode[MMUI_TYPE.MM_StartGame].active = false;
        this._MM_UINode[MMUI_TYPE.MM_Tutorail].active = false;
        this._MM_UINode[MMUI_TYPE.MM_Top].active = false;
       
        this._MM_UINode[MMUI_TYPE.MM_Leaderboard].active =false;
        
        this._MM_UINode[MMUI_TYPE.MM_Setting].active =false;
   //     this._MM_UINode[MMUI_TYPE.MM_Share].active = false;
        this._CurrentState = GameState.SettingMM;
        this.SetMMSettingVisible(true);
        this.CheckSettingState();
 

    },

    CheckSettingState()
    {
      if(this.audioManager._lsSoundOn)
        this.MMSeting.getChildByName('MusicButton').color = cc.Color.WHITE;
      else
      this.MMSeting.getChildByName('MusicButton').color = cc.Color.RED;

      if(this.audioManager._lsSfxOn)
        this.MMSeting.getChildByName('SfxButton').color = cc.Color.WHITE;
      else
      this.MMSeting.getChildByName('SfxButton').color = cc.Color.RED;


    },
    TutorailClose:function () {
        if(this._CurrentState == GameState.TutorailMM)
        {
            this.SubBackMM();
        }else{
            GameLogic._instance.TutotailStart();
        }
    },
    EnterLeaderBoard:function()
    {
        this._MM_UINode[MMUI_TYPE.MM_Tutorail].active = false;
        this._MM_UINode[MMUI_TYPE.MM_StartGame].active = false;
        this._MM_UINode[MMUI_TYPE.MM_Top].active = false;
        this._MM_UINode[MMUI_TYPE.MM_Leaderboard].active =false;   
        this._MM_UINode[MMUI_TYPE.MM_Setting].active =false;
  //      this._MM_UINode[MMUI_TYPE.MM_Share].active = false;
        this._MM_UINode[MMUI_TYPE.MM_Tutorail].active = false;

        this._CurrentState = GameState.LeaderBoardMM;
        this.SubLeaderBoard.active = true;
        this.SubLeaderBoard.position.x =0;
        this.SubLeaderBoard.getComponent('LeaderBoardManager').setLeaderboardUI(true);
      //  this.SubLeaderBoard.getComponent('LeaderBoardManager').TestLD();
      //  this.SubLeaderBoard.getComponent(cc.Sprite).enabled = true;
      //  this.SubLeaderBoard.getChildByName('CloseButton').active = true;
        FacebookInstant._instance.showLeaderboard();
    },

    LeaderBoardTop:function()
    {
        FacebookInstant._instance.showGobalLeaderBoard();
    } ,   
    LeaderBoardFriend:function()
    {
        FacebookInstant._instance.showLeaderboard();
    } ,   

    SubBackMM:function()
    {
        this.SubLeaderBoard.active = false;
        this.SetTutVisible(false);
        this.SetMMSettingVisible(false);
     //   this.SubLeaderBoard.getChildByName('CloseButton').active = false;
        this._CurrentState = GameState.MainMenu;
        this.SetMMVisble(true);
        
    },

    ChangeMusicState:function()
    {
        this.audioManager._lsSoundOn = !this.audioManager._lsSoundOn;
       if( this.audioManager._lsSoundOn)
       this.audioManager.playMMBG();
        else     
        this.audioManager.stopMMBG();

        this.CheckSettingState();
 
    },
    ChangeSFXState:function()
    {
        this.audioManager._lsSfxOn = !this.audioManager._lsSfxOn;
        this.CheckSettingState();
 
    },
    TapReStart()
    {
        if( this._CurrentState  ==GameState.OverGame)    {
            //GameLogic._instance.restartGame(); 
            FacebookInstant._instance.showInterstitialAD();     
        }   
    },
    CheckTopScore :function()
    {
       var TopVar = ScoreManager._instance.GetTopScore();
       if(cc.isValid(TopVar))
       {   
        this._MM_UINode[MMUI_TYPE.MM_Top].getChildByName('score').getComponent(cc.Label).string = TopVar;
       }else 
       {
        this._MM_UINode[MMUI_TYPE.MM_Top].active = false;
       }
    },

    ChangeMusic : function()
    {
        switch (this._CurrentState) {
            case GameState.MainMenu:
            this.audioManager.playMMBG();
                break;
             case GameState.GamePlay:
             this.audioManager.stopMMBG();
            default:
                break;
        }
    },
    start () {
       require('ReleaseUI')();
       this.CheckTopScore();
        this.ChangeMusic();
    },


    BackToMM()
    {
        FacebookInstant._instance.MoreLiftCount =1;
        cc.director.loadScene('level1');
    },
     update (dt) {
         switch (this._CurrentState) {
             case GameState.OverGame:
                 {
                     if( this.countDownTime >0){
                        
                     this.countDownTime -=dt;
                     var time =Math.ceil(this.countDownTime);
                    // cc.log("time==========="+time);
                     this._OG_UINode[OverGameUI_TYPE.OG_AD].getChildByName('Time').getComponent(cc.Label).string = time;
                     if(this.countDownTime <=0){
                          this._OG_UINode[OverGameUI_TYPE.OG_AD].active = false;
                     }
                    }
                 }
                 break;
         
             default:
                 break;
         }
     },
});
