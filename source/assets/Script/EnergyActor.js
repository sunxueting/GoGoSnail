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
        HP_Per :{
            default: 1,
            type:cc.Integer
        
        },

        Etype :{
            default : FoodType.LowBadFood,
            visible (){
                return false;
            }
        }
    },

    getEtype :function()
    {
        return this.Etype;
    },

    
    setBonusHP: function(param,angle,type)
    {
        this.HP_Per = param;
        this.node.getChildByName('tip').getComponent(cc.Label).string = this.HP_Per;
        this.node.rotation = 360-angle;
        this.Etype = type;
    },
    // LIFE-CYCLE CALLBACKS:

     onLoad () {
         this.node.getChildByName('tip').getComponent(cc.Label).string = this.HP_Per;
     },

    start () {

    },

    // update (dt) {},
});
