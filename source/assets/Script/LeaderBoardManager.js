// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var UtilManager = require('UtilManager');
var cameraControl = require('cameraControl');
//var ScoreManager = require('ScoreManager');

var LeaderBoardManager = cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },

    properties: {

        ItemSpace :{
            default :10,
            type :cc.Integer
        },

        _playerRank: {
            default : -1,
            type : cc.Integer
        },

        _leaderBoard :{
            default :null
        },

        _UpScoreArray :[],

        _currentLayer: 0,

        ItemArray:[],

        SpriteRank1: {
            default:null,
            type:cc.SpriteFrame
        },

        SpriteRank2:
        {
            default:null,
            type:cc.SpriteFrame
        },

        SpriteRank3:
        {
            default:null,
            type:cc.SpriteFrame
        },

        ItemView :
        { 
            default:null,
            type:cc.Node
        },

        globalButton :
        {
            default:null,
            type: cc.Button
        },

        friendButton:
        {
            default:null,
            type: cc.Button
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

     onLoad () {
         LeaderBoardManager._instance = this;
        this.setLeaderboardUI(false);
        this.MapNode = cc.find('Map');

        this.rankSp=new Array();
        this.rankSp[0]=this.SpriteRank1;
        this.rankSp[1]=this.SpriteRank2;
        this.rankSp[2]=this.SpriteRank3;

        this.utilManager = cc.find('MapDataManager').getComponent('UtilManager');

        this.scoreManager = cc.find('Map').getComponent('ScoreManager');

        this.ViewContent = this.ItemView.getComponent(cc.ScrollView).content;
      //  cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
     },
     onKeyDown (event) {
        switch(event.keyCode) {
            case cc.KEY.k:
                cc.log('onKeyDown kkkkkkkkkkkkkkkkkkkkk');
                var person = {LName:'FDFDF', LRank:'XX', LScore:'150', LPhoto:''};

                var pp = new Array;
                pp[0] = person;
                this.showUpUI(pp);
                //TODO 切换场景操作
                break;

             case cc.KEY.a:
             this.scoreManager.PlayerScore +=20;
             break; 
        }
    },
     setLeaderboardUI :function(_visible)
     {
        this.getComponent(cc.Sprite).enabled = _visible;
        for (var i = 0; i < this.node.children.length; ++i) {
  //          cc.log('xxxxxxxxxx');
            this.node.children[i].active = _visible;
           // cc.log("Node: " + children[i]);
        }
   //     this.node.getChildByName('CloseButton').active =_visible;
     },
     TestLD :function()
     {
        var offset =10;
        this.ViewContent.height =20 * (80 + this.ItemSpace) + this.ItemSpace;

       for(var i = 0; i< 6; i++)
       {
           var Item = cc.instantiate(this.utilManager._LdEntry);
           var sizeH =  Item.height;
          
         //  Item.parent = this.node;
           var posY = (sizeH+this.ItemSpace)*i*-1 - offset;
           Item.setPosition(0,posY);
           this.ViewContent.addChild(Item);
       }
     },
     ShowTopLeaderboard:function(entryArray)
     {
         this.friendButton.interactable = true;
         this.globalButton.interactable = false; 
         this.ShowLeaderboard(entryArray);
     },

     ShowFriendLeaderboard:function(entryArray)
     {
        this.friendButton.interactable = false;
        this.globalButton.interactable = true; 
        this.ShowLeaderboard(entryArray);
     },
     ClearLeaderboard:function()
     {
        if (this._profile) this._profile.hide();
        this.ViewContent.destroyAllChildren();
     },
     ShowLeaderboard :function(entryArray)
     {
       // this.setLeaderboardUI(true);   
        this.ldArray =[];
        var offset =10;
       
        var itemCount = entryArray.length;
        this.ViewContent.height =itemCount * (80 + this.ItemSpace) + this.ItemSpace;
       for(var i = 0; i< itemCount; i++)
       {
           var Item = cc.instantiate(this.utilManager._LdEntry);
           var sizeH =  Item.height;
         //  Item.parent = this.node;
           var posY = (sizeH+this.ItemSpace)*i*-1 - offset;
           Item.setPosition(0,posY);
           var rank =  entryArray[i].LRank;
           if(rank<=3)
           {
            var tmp = rank -1;
            // cc.log("current rank "+tmp);
             Item.getChildByName('rank').addComponent(cc.Sprite).spriteFrame = this.rankSp[tmp];
           }else{
             Item.getChildByName('rank').addComponent(cc.Label).string = rank;
            }
           Item.getChildByName('score').getComponent(cc.Label).string = entryArray[i].LScore;
           Item.getChildByName('name').getComponent(cc.Label).string = entryArray[i].LName;
           this.ldArray[i]=  Item;
           this.ViewContent.addChild(Item);
        }

       //  this.loadImage(0,entryArray);
     },

     loadImage :function(_imageIndex, EntryArray)
     {
        
            if(_imageIndex < EntryArray.length)
            {
        
      //          cc.log('load image');
                var textUrl = EntryArray[_imageIndex].LPhoto;
                cc.loader.load(textUrl, (err, texture) => {
                    this.ldArray[_imageIndex].getChildByName('image').getComponent(cc.Sprite).spriteFrame = new cc.SpriteFrame(texture);
                    var nextIndex = _imageIndex+1;
                    this.loadImage(nextIndex,EntryArray );
                  });
            }
     },
    GetPlayerRank:function()
    {
        // Local records do not fetch player identity or network leaderboards.
        this._UpScoreArray = [];
        this._currentLayer = 0;
    },
    GetUpPlayer:function() {},
    showPlayerProfile:function() {
        if (!this._profile) this._profile = require('PlayerProfile').mount(this);
        this._profile.verify();
        this._profile.sync();
    },
    onDisable:function() {
        if (this._profile) this._profile.hide();
    },
    onDestroy:function() {
        if (this._profile) this._profile.dispose();
    },
    update:function(dt) {
        this._profileTick = (this._profileTick || 0) + dt;
        if (this._profile && this._profileTick >= 0.25) {
            this._profileTick = 0;
            this._profile.sync();
        }
    },
    start () {
    //  this.TestLD();
    },

    CheckUpOpponent :function(_curScore)
    {
        if(this._UpScoreArray.length <=0) return;
   //     cc.log('CheckUpOpponent');
        var startIndex = this._currentLayer;
        var upArray = new Array();
        var j = 0;
       if(this._currentLayer < this._UpScoreArray.length)
       {
           for(var i = startIndex; i < this._UpScoreArray.length;i++)
           {
                 if(_curScore > this._UpScoreArray[i].LScore)
                 {
                    upArray[j]= this._UpScoreArray[i];
                    this._currentLayer = i+1;
                    j++;
                 }
                
           }
      //     cc.log('Get up len'+upArray.length);
           if(upArray.length >0)
              this.showUpUI(upArray);
       }
       

    },
    BgFadeOut:function()
    {
   //     cc.log('BgFadeOut');
        var space = 5;
        var fadeoutA = cc.fadeOut(8);
        for(var i =0; i <  this.ItemArray.length ;i++){
            var posY = (cameraControl._instance.node.position.y +500)+(this.ItemArray[i].height+space)*i;
            var posX = cameraControl._instance.viewWidth/3;
            this.ItemArray[i].active = true;
            this.ItemArray[i].setPosition(posX,posY);
            this.ItemArray[i].runAction(fadeoutA);
        }
    },
    showUpUI: function(_array)
    {
        
        this.ItemArray = [];
      for(var i =0; i < _array.length ;i++)
      {
     //     cc.log("showUpUI");
            var item = cc.instantiate(this.utilManager._LdGetUp);
            item.parent = this.MapNode;

            item.setPosition(700,700);
           //  item.x= 100;
            item.getChildByName('Name').getComponent(cc.Label).string = _array[i].LName;
        
            cc.loader.load(_array[i].LPhoto, (err, texture) => {
                item.getChildByName('Image').getComponent(cc.Sprite).spriteFrame = new cc.SpriteFrame(texture);
            });
   //            cc.log("showUpUI zzzzzzzzzz");
            this.ItemArray[i] = item;
            this.scheduleOnce(this.BgFadeOut.bind(this), 0.5);
      }
    }
    // update (dt) {},
});
