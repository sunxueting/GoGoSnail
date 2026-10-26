// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html

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

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start () {

    },
     
    onCollisionExit: function (other, self) {
        var IndexCollison= other.node.groupIndex;
     //   cc.log("dead destory :"+IndexCollison);
   //    if(IndexCollison == 12 || IndexCollison == 9 || IndexCollison == 7 || IndexCollison == 8)// 9 circle;
      if(IndexCollison !=2 )
       {
            // CollisionExit also runs while the collider is being removed.
            // Defer destruction to avoid re-entering removeCollider in that callback.
            var leavingNode = other.node;
            this.scheduleOnce(function () {
                if (cc.isValid(leavingNode, true)) leavingNode.destroy();
            }, 0);
        }
    }
    // update (dt) {},
});
