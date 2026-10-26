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

cc.Class({
    extends: cc.Component,

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
    },

    GetMaxPoint: function(){
    return this.MaxPoint;
    },

    lsInBonusArray: function(param){
      if(param >= this.IndexStart && param <= this.IndexEnd)
        return true;
      else
        return false;
    },
    SetStartAndEndIndex:function(startIndex)
    {
      this.IndexStart = startIndex + 1;
      this.IndexEnd = startIndex + this.MaxPoint;

    //  cc.log("this bonus startIndex = "+ this.IndexStart +"IndexEnd = "+this.IndexEnd);
    },
    // LIFE-CYCLE CALLBACKS:
    
    DestroyMe :function()
    {
   //     cc.log('DestroyMe');
        
        this.node.destroy();
    },
    onLoad () {

        var radius = this.node.width/2*this.node.scaleX;
        var goodPrefab = UtilManager._instance.GoodPrefab;
        var goodNode = goodPrefab.data;
        var goodRadius = goodNode.width/2*goodNode.scaleX +5;

        this.followR = radius+goodRadius;
        var tanv = goodRadius/this.followR;
        var ctan = Math.atan(tanv);
         this.PreAngle = cc.radiansToDegrees(ctan)*2 +5;
        
         this.PointRichTxt = this.node.getChildByName('point');
         if(this.PointRichTxt !=null){
         this.PointRichTxt.opacity = 0;
         this.PointRichTxt.getComponent(cc.RichText).handleTouchEvent = false;
         }

        
        this.cCRichTxt = this.node.getChildByName('circleComplete');
        if(this.cCRichTxt!=null){
        this.cCRichTxt.opacity = 0;
        this.cCRichTxt.getComponent(cc.RichText).handleTouchEvent = false;
        }
        this.MaxPoint = Math.floor(360 /this.PreAngle);

        
 

 //       cc.log("this bonus per angle:"+this.PreAngle);
  //      cc.log("this bonus MaxPoint:"+this.MaxPoint); 
        
    },

     CreateGoodBonus:function(IndexPama,bonusHp,Pnode,type)
     {
   //      cc.log("CreateGoodBonus");
               var num = IndexPama - this.IndexStart;
              
               var centerP = this.node.position;
           //    cc.log("1111111111111"+centerP+"RRR"+this.followR);
               var mulR = cc.pMult(cc.v2(0,1),this.followR);
               
               var rotateP = cc.pAdd(centerP,mulR);

               
               var goodPos = cc.pRotateByAngle(rotateP,centerP,cc.degreesToRadians(this.PreAngle*num));
           //    cc.log("foodType:"+type);
             
               var Food;
               switch (type) {
                   case FoodType.goodFood:
                  
                         Food = cc.instantiate(UtilManager._instance.GoodPrefab);
                       break;
                   case   FoodType.LowBadFood:
                  
                       Food = cc.instantiate(UtilManager._instance.LowBadPrefab);
                       break;
                   case   FoodType.MidBadFood:
                 
                       Food = cc.instantiate(UtilManager._instance.midBadPrefab);
                       break;    
                   case  FoodType.HighBadFood:
                   
                       Food = cc.instantiate(UtilManager._instance.highBadPrefab);
                       break;                  
                   default:
                       break;
               }


               Food.parent = Pnode;
         //      cc.log("444444444444");
               Food.position = goodPos;
               //Food.parent = this.node;
               Food.getComponent('EnergyActor').setBonusHP(Math.abs(bonusHp),this.PreAngle*num,type);
     },


    start () {

    },

    // update (dt) {},
});
