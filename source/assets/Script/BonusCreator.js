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

var PlayerControl = require("PlayerControl");


const MaxPerBonus   =5 ;
cc.Class({
    extends: cc.Component,

    properties: {
        ScoreSum : 
        {
            default: 15,  
            type: cc.Integer
        },
        LowBadFoodMin : 1,
        LowBadFoodMax :3,

        MidBadFoodMin : 1,
        MidBadFoodMax :3,   
        
        HighBadFoodMin : 1,
        HighBadFoodMax :1, 

        BonusCircle :[]
    },
  
    RandomCreateList: function(param)
    {
        var count = param;
        var array = [];
         var arrayRemaider =[];

    //     cc.log("RandomCreateList ");
        for(var i =1; i <= MaxPerBonus ; i++)
        {
            array[i-1] = Math.floor(this.ScoreSum / i);
            arrayRemaider[i-1] = this.ScoreSum % i;

            if(arrayRemaider[i-1]>0)
               {
                   array[i-1] +=1;
               }
   //            cc.log("array "+(i-1)+"="+ array[i-1]);
        }
       
        var baseNum = array[0]; 
        var baseScore =1;
        var baseScoreRemaider = arrayRemaider[0];
        for(var j = 1 ; j < array.length ; j++)
        {
            if(Math.abs(array[j]-count) < Math.abs(baseNum-count)){
               baseNum = array[j];
               baseScore = j+1;
               baseScoreRemaider = arrayRemaider[j];
            }
        }
//        cc.log("baseNum =  "+baseNum +" count ="+count +" baseScore="+baseScore +" baseScoreRemaider="+baseScoreRemaider);
        var scoreList =[];
        if(baseNum == count){
             
            if(baseScoreRemaider>0){
                var scortTmp0 ={
                    dcount: count -1,
                    dscore :baseScore
                };
                scoreList[0] = scortTmp0;

                var scortTmp1 ={
                    dcount:1,
                    dscore :baseScoreRemaider
                };
                scoreList[1] = scortTmp1;
 //               cc.log(" 总分为："+this.ScoreSum + "分为"+(count-1)+"个分数为"+baseScore +"和一个分数为："+baseScoreRemaider);
                return scoreList;
            }
            else{
                var scortTmp0 ;

                var scortTmp0 ={
                    dcount: count,
                    dscore :baseScore
                };
                scoreList[0] = scortTmp0;
 //              cc.log(" 总分为："+this.ScoreSum + "分为"+count+"个分数为"+baseScore);
               return scoreList;
            }
        }   
       
         //需要扩展
        if(baseNum < count)
        {
            
           var AddNum = count - baseNum;
 //          cc.log("扩展个数"+AddNum);
           var tmp = baseScore -1;
           if(tmp > 0) 
           {
  //          cc.log("扩展成功");   
            var baseNumcc;           
            if(baseScoreRemaider>0) 
             baseNumcc=  baseNum - AddNum -1;
            else
             baseNumcc = baseNum - AddNum;

            

             var scortTmp0 ={
                 dcount: baseNumcc,
                 dscore :baseScore
             };
             scoreList[0] = scortTmp0;

             
             var scortTmp1 ={
                dcount: AddNum,
                dscore :tmp
            };

             scoreList[1] = scortTmp1;

             var scortTmp2 ={
                dcount: AddNum,
                dscore :1
            };
             scoreList[2] = scortTmp2;
             
            if(baseScoreRemaider>0){               
                var scortTmp3 ={
                   dcount: 1,
                   dscore :baseScoreRemaider
               };
                scoreList[3] = scortTmp3;
            }


 //            cc.log(" 总分为："+this.ScoreSum + "分为"+AddNum+"个分数为"+tmp +"和个数为"+AddNum+"分数为1"+"和个数为"+baseNumcc+"分数为"+baseScore+"和一个分数"+baseScoreRemaider);
             return scoreList;
           }
        }
        
        

       
        //需要收缩
        if(baseNum > count)
        {
            var subNum = baseNum - count;
//            cc.log("收缩个数"+subNum);

            for(var kk = 2; kk< baseNum ; kk++){
            
            var tmpSub = baseScore*kk;

            var aatmp = Math.floor(tmpSub/5);
            var bbtmp = tmpSub%5;

            var cctmp = (bbtmp>0)?1:0;
            
            if( (aatmp+cctmp) < kk)
            {
                var baseNumss;
                if(baseScoreRemaider>0) 
                baseNumss=  baseNum - subNum*kk -1;
               else
                baseNumss = baseNum - subNum*kk;

                //5的个数
                var FiveCount = subNum*aatmp;
                var bbtmpCount = subNum*cctmp;

                if(aatmp < 1){

                    var scortTmp0 ={
                        dcount: baseNumss,
                        dscore :baseScore
                    };
                    
                    scoreList[0] = scortTmp0;
       
                    var scortTmp1 ={
                        dcount: subNum,
                        dscore :tmpSub
                    };
                    
                    scoreList[1] = scortTmp1;
                    
                   if(baseScoreRemaider>0){

                       var scortTmp2 ={
                        dcount: 1,
                        dscore :baseScoreRemaider
                    };
                    scoreList[2] = scortTmp2;
                   }

 //               cc.log(" 总分为："+this.ScoreSum + "分为"+baseNumss+"个分数为"+baseScore + "和"+subNum+"个分数为"+tmpSub+"和一个分数为："+baseScoreRemaider);
                return scoreList;
                }
                else{
                    var scortTmp0 ={
                        dcount: baseNumss,
                        dscore :baseScore
                    };
                    scoreList[0] = scortTmp0;

                    var scortTmp1 ={
                        dcount: FiveCount,
                        dscore :5
                    };
                    scoreList[1] = scortTmp1;

                    var scortTmp2 ={
                        dcount: bbtmpCount,
                        dscore :bbtmp
                    };
                    scoreList[2] = scortTmp2;
                    
                   if(baseScoreRemaider>0){
                       var scortTmp3 ={
                        dcount: 1,
                        dscore :baseScoreRemaider
                    };
                       scoreList[3] = scortTmp3;
                   }
                    
 //               cc.log(" 总分为："+this.ScoreSum + "分为"+baseNumss+"个分数为"+baseScore + "和"+FiveCount+"个分数为5和"+bbtmpCount+"个分数为："+bbtmp+"和一个分数为："+baseScoreRemaider);
                }
                return scoreList;
            }

        
         }
        }
    },

    FindAndCreatBonus: function( id, score,type)
    {
 //       cc.log("FindAndCreatBonus "+id);
       for(var j=0; j < this.BonusCircle.length; j++){
        if(this.BonusCircle[j].lsInBonusArray(id))
        {
 //           cc.log("lsInBonusArray "+id);
            this.BonusCircle[j].CreateGoodBonus(id,score,this.node,type);
        }
       }
    },
    // LIFE-CYCLE CALLBACKS:
    start () {
        var children= this.node.children;
 //       cc.log("this.ScoreSum " +this.ScoreSum);

        var remainder = this.ScoreSum % 5;
        

        var diffNum = Math.floor( this.ScoreSum / 5)

        var countNum = diffNum;
        if(remainder > 0)
             countNum +=1;

        var objlist = [];
   /*     for(var i= countNum ;  i<=this.ScoreSum ; i++)
        {
            objlist = this.RandomCreateList(i);
            for(var j = 0; j<objlist.length ; j++)
            {
                cc.log("list "+j+" = "+"个数"+objlist[j].dcount+" 分数"+objlist[j].dscore);
            }
        }
    */  
        var ramdonCount  = UtilManager._instance.getRandomInt(countNum,this.ScoreSum);
   //     cc.log("this.ScoreSum " +this.ScoreSum +"分为"+ramdonCount);
 
        objlist = this.RandomCreateList(ramdonCount);

        var sumPosition = 0;  
    
        
        for(var i = 0, jj =0 ; i < children.length ; i++){
              var childBonus = children[i].getComponent('Bonus');
              
              if(cc.isValid(childBonus)){
    //              cc.log("childBous is not null ");
                  childBonus.SetStartAndEndIndex(sumPosition);
                  sumPosition += childBonus.GetMaxPoint();
                  this.BonusCircle[jj] =childBonus;
                  jj++;
              }else{
     //           cc.log("childBous is  null ");
              }
        }
    //    cc.log("sumPoint = "+sumPosition);

  //      for(var vv =0; vv < this.BonusCircle.length; vv++ )
  //      {
 //           cc.log("bonusCircle"+vv+"="+this.BonusCircle[vv]);
  //      }


        var bonusCount = 0;
        this.bonusScore = [];
        this.bonusType =[];
        
        var k=0;
        for(var j=0; j<objlist.length ; j++)
        {
  //          cc.log("list "+j+" = "+"个数"+objlist[j].dcount+" 分数"+objlist[j].dscore);
           if(objlist[j].dcount > 0)
           {
               bonusCount  += objlist[j].dcount;
               for(var hh = k ; hh< bonusCount ; hh++){
                this.bonusScore[hh] = objlist[j].dscore;
                this.bonusType[hh] = FoodType.goodFood;
               k++;
            }
           }
        }
   //  随机产生 坏果子
        var LowBFCount = UtilManager._instance.getRandomInt(this.LowBadFoodMin,this.LowBadFoodMax);
  //      cc.log("LowBFCount  "+LowBFCount);
        for(var ll = 0 ; ll< LowBFCount; ll++)
        {
             var start1= 1;
            var lowS =  UtilManager._instance.getRandomInt(start1,MaxPerBonus);
  //          cc.log("lowS "+lowS);
            this.bonusScore[bonusCount] = lowS*-1;
            this.bonusType[bonusCount] = FoodType.LowBadFood;
            bonusCount++;
        }
   // 随机产生2类 坏果子
        
 //  cc.log("PlayerController" +PlayerControl._instance);

        var pc = cc.find('Player').getComponent('PlayerControl');
        var MidBFCount = UtilManager._instance.getRandomInt(this.MidBadFoodMin,this.MidBadFoodMax);
        
            for(var ll = 0 ; ll< MidBFCount; ll++)
            {
           
              var lowHP = Math.floor(pc.getHP()*0.3);
              var highHp =  Math.floor(pc.getHP()*0.7);

              var lowS =  UtilManager._instance.getRandomInt(lowHP,highHp);      
              this.bonusScore[bonusCount] = -1*lowS;
              this.bonusType[bonusCount] = FoodType.MidBadFood;
              bonusCount ++;
            }
 // 随机产生2类 坏果子
 var MidBFCount = UtilManager._instance.getRandomInt(this.HighBadFoodMin,this.HighBadFoodMax);
        
        for(var ll = 0 ; ll< MidBFCount; ll++)
        {

             var lowHP = Math.floor(pc.getHP()*0.7);
             var highHp =  Math.floor(pc.getHP()*1);
             var lowS =  UtilManager._instance.getRandomInt(lowHP,highHp);      
             this.bonusScore[bonusCount] = -1*lowS;
             this.bonusType[bonusCount] = FoodType.HighBadFood;
             bonusCount ++;
 }
 
//        for(var mm =0; mm < this.bonusScore.length; mm++ )
 //       {
 //           cc.log("bonusScore"+mm+"="+this.bonusScore[mm]);
 //       }

        var bonusList = UtilManager._instance.getOrder(1 , sumPosition, bonusCount);

        for(var j=0; j < bonusList.length; j++){
             this.FindAndCreatBonus(bonusList[j],this.bonusScore[j], this.bonusType[j]);
        }
        
    },

    onLoad () {
    //    cc.log("bonus start ");
    },

     update (dt) {
         var count = this.node.childrenCount;
         
           if(count ==0){
     //      cc.log('bonus creator destroy');
               this.node.destroy();
           }
     },
});
