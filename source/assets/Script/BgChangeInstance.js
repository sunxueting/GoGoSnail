// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var ScoreManager = require('ScoreManager');


window.BgConfig = {
    ScoreBelow: 0,
    BgFrame : 1,
            
    PatternFrame : 2,

   
}
var BgChangeInstance = cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },

    properties: {
        AScoreBelow :[],
        AFrameBg:[],
        AFramePattern:[],

        AllBg :[],
        AllPatter:[],

        _CurrentLV :0,

        _loadFinished :false,

        fadeInDt :
        {
          default :1,
        },

        fadetran :
        {
            default : 0.5,
        },
        fadeOutDt :
        {
          default :1,
        }
    },

    getBGFrameByName:function(fname)
    {
      //  console.log("getFrameByName" +fname);
        for(var i=0; i< this.AllBg.length ;i++){
            var tmpname = this.AllBg[i].name;
        //     cc.log("this.AllBg " +tmpname)
            // cc.String.cont
            if( tmpname == fname )
               return this.AllBg[i];
        }
     //   console.log("can't get frame of "+fname);
        return null; 
     },

     getPatFrameByName:function(fname)
     {
         console.log("getFrameByName" +fname);
         for(var i=0; i< this.AllPatter.length ;i++){
             var tmpname = this.AllPatter[i].name;
        //      cc.log("this.AllPatter " +tmpname)
             // cc.String.cont
             if( tmpname == fname )
                return this.AllPatter[i];
         }


         console.log("can't get frame of "+fname);
         return null;
      },

    // LIFE-CYCLE CALLBACKS:

     onLoad () {
         BgChangeInstance._instance = this;
         this.CanvasBg = cc.find('Canvas/bg');
        // cc.game.addPersistRootNode(this.node);
         cc.loader.loadResDir('Texture/BG',cc.SpriteFrame,function (err, assets) {

            if (err) {
                cc.error(err.message || err);
                return;
            }
            for(var i=0; i< assets.length ; i++){
                cc.log("asset = "+ i+ assets[i].name);
               // this.AllBg[i] = assets[i];
            }

           this.AllBg = assets;

          
          


        }.bind(this));


        cc.loader.loadResDir('Texture/Pattern',cc.SpriteFrame,function (err, assets) {

            if (err) {
                cc.error(err.message || err);
                return;
            }

           this.AllPatter = assets;

          this._loadFinished = true;
         
        
        }.bind(this));

         this.LoadBgConfig();
        
     },


     LoadBgConfig :function()
     {
        cc.loader.loadRes("LevelConfig/BGConfig", function (err, bgCsv) {
            //          cc.log("MapDataManager._instance"+MapDataManager._instance);
          
                  var bgArr = bgCsv.split("\n");        
                      for(var i = 1; i< bgArr.length;i++){
                          if(bgArr[i] !=""){
                          var arr = bgArr[i].split(',')
                   //       cc.log("arr"+arr+"len ="+arr.length);
                         
                          var kk = i-1;
                   //       cc.log("kkkk = "+kk);
                        //  var tmp = arr.split(',')
                          for(var j = 0 ; j< arr.length ; j++){
                            switch (j) {
                                case BgConfig.ScoreBelow:
                                this.AScoreBelow[kk] = arr[j];
                                    break;
        
                                case BgConfig.BgFrame:
                                this.AFrameBg[kk] = arr[j];
                                   break;  
        
                                case BgConfig.PatternFrame:
                                this.AFramePattern[kk] = arr[j];
                                  break;    
        
                                default:
                                    break;
                          }
                        }
                    }
                }
                
 /*               cc.log(" this.AScoreBelow.length ="+this.AScoreBelow.length);
                for(var i = 0; i < this.AScoreBelow.length ;i++){
                    cc.log("score "+i +"= "+this.AScoreBelow[i]);
                }
    
                
                for(var i = 0; i < this.AFrameBg.length ;i++){
                    cc.log("bg frame "+i +"= "+this.AFrameBg[i]);
                }
    
                
                for(var i = 0; i < this.AFramePattern.length ;i++){
                    cc.log("pattern "+i +"= "+this.AFramePattern[i]);
                }
*/
                    
            }.bind(this));

            
                             
     },
    start () {
     
    },
    UpdateBg:function(_num){
         
        this.BgFadeOut();
        
        this.scheduleOnce(this.BgFadeIn.bind(this), this.fadetran);


    },


    checkscoreBg:function()
    {
        if(this._loadFinished){
        var score = ScoreManager._instance.PlayerScore;
        var lv = this._CurrentLV;
      //  cc.log('score ='+score+" lv ="+lv);

  
  
 //       for(var i = 0; i < this.AScoreBelow.length ;i++){
  //          cc.log("score "+i +"= "+this.AScoreBelow[i]);
 //       }

        if(lv < this.AScoreBelow.length){
             
             if(score >=this.AScoreBelow[lv]){
                 this.UpdateBg(lv);
                 this._CurrentLV++;
                 cc.log("up to level "+ this._CurrentLV);
             }
        }
    }
    },
    BgFadeOut:function()
    {
        var fadeoutA = cc.fadeOut(this.fadeOutDt);
        this.CanvasBg.runAction(fadeoutA);
    },

    BgFadeIn:function()
    {
        var _num = this._CurrentLV-1;
        var bgName = this.AFrameBg[_num];
        var patternName = this.AFramePattern[_num].toString();
        
        this.CanvasBg.getChildByName('pat').getComponent(cc.Sprite).spriteFrame = this.getPatFrameByName(patternName);
        this.CanvasBg.getComponent(cc.Sprite).spriteFrame = this.getBGFrameByName(bgName);
       

        var fadeinA = cc.fadeIn(this.fadeInDt);
        this.CanvasBg.runAction(fadeinA);
    },
     lateUpdate (dt) {
        this.checkscoreBg();
     },
});
