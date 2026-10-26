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
var MapDataManager = require("MapDataManager")
cc.Class({
    extends: cc.Component,

    properties: {

    },
    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start () {

    },


    onCollisionEnter: function (other, self) {

        
      //  console.log("next map "+self.node.name+" "+ other.node.group);
         MapDataManager._instance.CheckMapConfig();
        

        var mapArray = UtilManager._instance.mapArray;

        var mapLength = mapArray.length;


        var _index = UtilManager._instance.getRandomInt(0,mapLength-1);

      //      cc.log('Result should be a prefab: ' + (nodex instanceof cc.Prefab));
            var curnode = cc.instantiate(mapArray[_index]);
             var children = curnode.children;
             curnode.parent =  cc.find("Map");
             
            for (var i = 0; i < children.length; ++i) {
         //     cc.log("Node: " + children[i].name);
              
               var ctp1 =  cc.pAdd(children[i].position,self.node.position);
            
               children[i].setPosition(ctp1);
        //       cc.log("ctp1111111111"+children[i].parent.name);
            
            }
            this.node.active = false;

        this.node.destroy();

    }
    // update (dt) {},
});
