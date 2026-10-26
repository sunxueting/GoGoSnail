// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var UIManager = require('UIManager');
window.FoodType = {
    goodFood: 0,
    LowBadFood : 1,
            
    MidBadFood : 2,
   
    HighBadFood : 3,
}


var UtilManager = cc.Class({
    extends: cc.Component,
    
    statics: {
        _instance : null
    },
    
    properties: {
        GoodPrefab: {
            default: null,
            type: cc.Prefab,
            visible :false
        },

        LowBadPrefab: {
            default: null,
            type: cc.Prefab,
            visible :false
        },

        midBadPrefab: {
            default: null,
            type: cc.Prefab,
            visible :false
        },
        
        highBadPrefab: {
            default: null,
            type: cc.Prefab,
            visible :false
        },
     
        _VfxPlayerDead:
        {
            default:null,
            type:cc.Prefab
        },

        _VfxOniDead:
        {
            default:null,
            type:cc.Prefab
        },

        _MusicBGM:
        {
            default:null,
            url:cc.AudioClip
        },

        _LdEntry:
        {
           default:null,
           type: cc.Prefab
        },

        _LdGetUp:
        {
           default:null,
           type: cc.Prefab
        },
        mapArray:[] ,

        MemoryMapArray:[],

        MapArrayDir:[],

        MapDirLen:0,
  
        AllMapLoadFinished :false

    },


    GetMapFinished :function()
    {
        return this.AllMapLoadFinished;
    },
    getRandomInt : function (min,max){
        min = Math.ceil(min);
        max = Math.round(max);
        return Math.round(Math.random()*(max-min)+min);
    },

    getGoodFood : function()
    {
        return this.GoodPrefab;
    },
     
    getOrder :function(start, end, count){
       
        var myorder = [];
        var index = 0;
        while (index < count) {
            var flag = true;
            var num = this.getRandomInt(start,end);
            for (var i in myorder) {
                if (myorder[i] == num) {
                    flag = false;
                }
            }
            if (flag == true) {
                myorder[index] = num;
                index++;
            }
        }
        
  //      for(var i = 0; i<myorder.length ; i++)
  //      {
  //          cc.log("myorder"+i+"="+myorder[i]);
  //      }
        return myorder;
    },

    FindMaplsLoaded(_dirname)
    {
        for(var i =0 ; i < this.MapArrayDir.length ; i++)
        {
       //     cc.log('MapArrayDir'+i+ this.MapArrayDir[i]+" name="+_dirname);
          if(_dirname == this.MapArrayDir[i])
          {
     //         cc.log('find mapIndex = '+i+" name="+_dirname);
              return i;
          }
        }

        return -1;
    },

    lsAllMAPload(paramIndex)
    {
        if(paramIndex ==  (UtilManager._instance.MapDirLen-1)){
      //      cc.log("--------------------lsAllMAPload");
            UtilManager._instance.AllMapLoadFinished = true;
            UIManager._instance.setLoadingVisble(false);
            UIManager._instance.FristTriggerEnable(true);
        //    this.node.emit('loadFinish');
       }
    },
    loadMMapArray :function(param,index)
    {
    //    cc.log("loadMMapArray dir = "+param +"   index="+index);
        
        var mapIndex = this.FindMaplsLoaded(param);
        this.MapArrayDir[index] = param;

        if(mapIndex >=0)
        {
            return;
    //        cc.log("get  index="+index)
      //      UtilManager._instance.MemoryMapArray[index] = new Array();
      //      UtilManager._instance.MemoryMapArray[index] = UtilManager._instance.MemoryMapArray[mapIndex];
      //      UtilManager._instance.lsAllMAPload(index);
     //       return;
        }
        cc.loader.loadResDir("Level/"+param, cc.Prefab, function (err, assets) {

            if (err) {
                cc.error(err.message || err);
                return;
            }
      //      cc.log("loadMMapArray index: "+index +" param=" +param +"  length: "+assets.length);

            UtilManager._instance.MemoryMapArray[index] = new Array();

            UtilManager._instance.MemoryMapArray[index] = assets;
          
            UtilManager._instance.lsAllMAPload(index);


 
        });
    },


    GetMapArray :function(lvlDir)
    {
        var index = this.FindMaplsLoaded(lvlDir)
        
        UtilManager._instance.mapArray = UtilManager._instance.MemoryMapArray[index];
    },
    loadMapAarray : function( param)
    {
 //      cc.log("loadMapAarray:"+param);
        cc.loader.loadResDir("Level/"+param, cc.Prefab, function (err, assets) {

            if (err) {
                cc.error(err.message || err);
                return;
            }
  //          cc.log("load rrrrrrrrrrrrrrr"+assets.length);
            UtilManager._instance.mapArray = assets;
            var firstMap =  cc.find('Map/NextMap');
            if(cc.isValid(firstMap))
                cc.find('Map/NextMap').getComponent(cc.BoxCollider).enabled = true;
        });
    },
 
    //最先进入地方
    onLoad(){
   //     cc.warn(" ============== UtilManager init" );
        UtilManager._instance = this; 
        UtilManager._instance.AllMapLoadFinished = false;
        UtilManager._instance.MapDirLen = 0;

    /*
        var self = this;
         cc.loader.onProgress = function (completedCount, totalCount, item) {
            var progress = (completedCount / totalCount).toFixed(2);
            cc.log("completedCount = "+completedCount+",totalCount="+totalCount+",progress="+progress+"item"+item);
        };
    */
        
        cc.loader.loadRes('Prefab/GoodFood', function (err, nodex) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance.GoodPrefab= nodex;
        //    UtilManager._instance.showProgress(1);
        });

        cc.loader.loadRes('Prefab/lowBadFood', function (err, nodex1) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance.LowBadPrefab= nodex1;
       //     UtilManager._instance.showProgress(2);
        });

        cc.loader.loadRes('Prefab/midBadFood', function (err, nodex2) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance.midBadPrefab= nodex2;
      //      UtilManager._instance.showProgress(3);
        });      
        
        cc.loader.loadRes('Prefab/highBadFood', function (err, nodex3) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance.highBadPrefab= nodex3;
      //      UtilManager._instance.showProgress(4);
        }); 

        cc.loader.loadRes('Prefab/Vfxdead', function (err, nodex4) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance._VfxPlayerDead= nodex4;
      //      UtilManager._instance.showProgress(5);
        }); 

        cc.loader.loadRes('Prefab/VfxOniDead', function (err, nodex5) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance._VfxOniDead= nodex5;
        //    UtilManager._instance.showProgress(6);
        }); 

        cc.loader.loadRes('Prefab/ItemEntry', function (err, nodex6) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance._LdEntry= nodex6;
         //   UtilManager._instance.showProgress(7);
        }); 

        cc.loader.loadRes('Prefab/GetUpMessage', function (err, nodex7) {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance._LdGetUp= nodex7;
     //       UtilManager._instance.showProgress(8);
        }); 
/*        cc.loader.loadRes('sound/bensound-clearday.mp3',cc.AudioClip,function(err, nodex6)
        {
            if (err) {
                cc.error(err.message || err);
                return;
            }
            UtilManager._instance._MusicBGM = nodex6; 
        });
*/
       // cc.loader.loadResDir('sound',cc.AudioClip,function)
         //设置帧率
       
        //设置该对象为不销毁
       // cc.game.addPersistRootNode(this.node);
    }});
