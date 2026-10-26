// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var UtilManager = require("UtilManager");


window.MapConfig = {
    MapSum: 0,
    DifficultyLevel : 1,
            
    LevelMapDir : 2,
   
    CameraSpeed : 3,

    AllCount :4
}
var MapDataManager = cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },

    properties: {

          MapCount :[],
          Lvl:[],
          LvMapDir:[],
          LvCamSpeed:[],


         currentMapCount :{
             default :0,
             visible :false
             },

         currentBonusCount :{
              default: 0,
              visible :false
         } 
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
    loadMapData:function(){
        var self = this;
        cc.loader.loadRes("LevelConfig/config", function (err, mapCsv) {
  //          cc.log("MapDataManager._instance"+MapDataManager._instance);

        var mapArr = mapCsv.split("\n");      
      
    //    if(!cc.isValid( UtilManager._instance))
            self.utilManager.MapDirLen = mapArr.length -2;

            for(var i = 1; i< mapArr.length;i++){
                if(mapArr[i] !=""){
                var arr = mapArr[i].split(',')
             //   cc.log("arr"+arr+"len ="+arr.length);
             //   cc.log("mapArr len ="+mapArr.length);
                var kk = i-1;

             //   cc.log("kkkk = "+kk);
              //  var tmp = arr.split(',')
                for(var j = 0 ; j< arr.length ; j++)
                {
            //        cc.log("arr "+j +"="+arr[j]);
                    switch (j) {
                        case MapConfig.MapSum:
                        MapDataManager._instance.MapCount[kk] = arr[j];
                            break;

                        case MapConfig.DifficultyLevel:
                        MapDataManager._instance.Lvl[kk] = arr[j];
                           break;  

                        case MapConfig.LevelMapDir:
                        MapDataManager._instance.LvMapDir[kk] = arr[j];
                        self.utilManager.loadMMapArray(arr[j],kk);
                          break; 

                        case MapConfig.CameraSpeed:
                        MapDataManager._instance.LvCamSpeed[kk] = arr[j];
                         break;      

                        default:
                            break;
                    }
                }
            }
        }

      
 //           for(var k = 0 ; k< MapDataManager._instance.MapCount.length ; k++)
 //           {
               
 //            cc.log("map data" +  MapDataManager._instance.MapCount[k]+"," +MapDataManager._instance.Lvl[k]+","+MapDataManager._instance.LvMapDir[k]+","+MapDataManager._instance.LvCamSpeed[k]);   
 //           }

       //     MapDataManager._instance.CheckMapConfig();
        });



     },
    UpdatePlayerData :function()
    {
        this.currentBonusCount ++;
     //   this.BonusUI.string = "Bonus:"+this.currentBonusCount;
    },
    CheckMapConfig: function()
    {
          ++ this.currentMapCount;

        
        
        var ArrayCount = MapDataManager._instance.MapCount.length;
//        cc.log("CheckMapConfig " +ArrayCount);
//        cc.log("map count " +this.currentMapCount);
        for(var k = 0 ; k< ArrayCount ; k++)
        {
           var top = k+1;
           if(top < ArrayCount){
                  if(this.currentMapCount >= MapDataManager._instance.MapCount[k] 
                    && this.currentMapCount < MapDataManager._instance.MapCount[top] 
                   )
                    {
                        
                       
                      
       //                 cc.log("up level:" + MapDataManager._instance.LvMapDir[k]);
                        if(k <=this.currentLevel)
                           break;

//                         if( this.currentLevel >=0)
//                         {
//                             cc.loader.releaseResDir('Level/'+MapDataManager._instance.LvMapDir[ this.currentLevel])
//                         }  
                        this.currentLevel = k;
 //                       cc.log("get"+MapDataManager._instance.LvMapDir[k] );

                        var dirLevel = MapDataManager._instance.LvMapDir[k];
//                        UtilManager._instance.loadMapAarray(MapDataManager._instance.LvMapDir[k]);
                        this.utilManager.GetMapArray(dirLevel);

                        var camCom=cc.find("CameraCon/Camera").getComponent("cameraControl")
//                      if(camCom.moveSpeed > 0)
                          camCom.moveSpeed  = MapDataManager._instance.LvCamSpeed[k];
//                         else
//                           camCom.InitMoveSpeed = MapDataManager._instance.LvCamSpeed[k];

                  //      this.LVUI.string = "Lv:"+MapDataManager._instance.LvMapDir[k];
                        break;
                        
                          
                    }

           }else{
      //         cc.log("you get top level:"+MapDataManager._instance.LvMapDir[k]);
               if(k <=this.currentLevel)
               break;
                
               this.currentLevel = k;
               var toplv = MapDataManager._instance.LvMapDir[k];
              // cc.log("get map"+MapDataManager._instance.LvMapDir[k]+"k="+k );
            //   UtilManager._instance.loadMapAarray(MapDataManager._instance.LvMapDir[k]);
                 this.utilManager.GetMapArray(toplv);
                var camCom=cc.find("CameraCon/Camera").getComponent("cameraControl")
               if(camCom.moveSpeed > 0)
                  camCom.moveSpeed  = MapDataManager._instance.LvCamSpeed[k];
                else
                camCom.InitMoveSpeed = MapDataManager._instance.LvCamSpeed[k];

           //     this.LVUI.string = "Lv:"+MapDataManager._instance.LvMapDir[k];
           }
        }
    },

     onLoad () {
        MapDataManager._instance = this;
        this.currentMapCount = -1;
        this.currentLevel = -1;
        this.utilManager = this.node.getComponent('UtilManager');
        cc.game.addPersistRootNode(this.node);
        this.loadMapData();
      //  this.BonusUI = cc.find('Canvas/BonusCount').getComponent(cc.Label);
      //  this.LVUI = cc.find('Canvas/LV').getComponent(cc.Label);


   //    
         
     },
    resetMapData()
    {
    this.currentMapCount = -1;
    this.currentLevel = -1;
    },

    // update (dt) {},
});
