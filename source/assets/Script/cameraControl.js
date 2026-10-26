var cameraControl= cc.Class({
    extends: cc.Component,
    statics: {
        _instance : null
    },
    properties: {
        target: {
            default: null,
            type: cc.Node
        },
        //Camera Shake
        canShake: false,
        shakeDuration: {
            default: 0,
            visible () {
                return this.canShake;
            }
        },

        moveSpeed : 10,
       // UIXXlayer : cc.Node
    },
    ResetMoveSpeed :function(){

        this.moveSpeed = this.InitMoveSpeed;
    },
    // use this for initialization
    onLoad: function () {

        cameraControl._instance = this;
        this.camera = this.getComponent(cc.Camera);
    //    console.log("onload");

        this.viewHeight = cc.view.getVisibleSize().height;
        this.viewWidth = cc.view.getVisibleSize().width;

       // console.log("sssssssssss"+  cc.view.getVisibleSize().width +" "+cc.view.getVisibleSize().height);
        this.node.parent.position.x = cc.view.getVisibleSize().width/2;
      //  this.parent.position.x = 
        this.cameraFollow = false;
        // cc.view.getVisibleSize()
         this.startX =  this.node.x;

       
         //ajdust location
        this.anim = this.node.parent.getComponent(cc.Animation);

       
    //     this.InitMoveSpeed = this.moveSpeed;
         this.moveSpeed = 0;
        
    },
    start :function() {
      //  console.log("position " +this.UIXXlayer.position);
   //     console.log("position1 " +this.node.position);
        

        this.deathBoxBom = cc.find('CameraCon/Camera/deathboxBottom');
        this.deathBoxBom.y = -1*this.viewHeight/2;


        this.deathBoxUp = cc.find('CameraCon/Camera/deathboxUp');
        this.deathBoxUp.y = this.viewHeight/2;

        this.FPSlabel = cc.find("Canvas/FPS").getComponent(cc.Label);
    //    this.deathBox.y = -640;
      //  this.Player = cc.find("Player");
      //  this.RelativeDir = cc.pSub(this.UIXXlayer.position,this.node.position);
        
    },
    onEnable: function () {
        cc.director.getPhysicsManager().attachDebugDrawToCamera(this.camera);
    },
    onDisable: function () {
        cc.director.getPhysicsManager().detachDebugDrawFromCamera(this.camera);
    },
    setUIPosition : function()
    {
     //   this.UIXXlayer.position = cc.pAdd(this.node.position,this.RelativeDir);
    },
    update:function(dt)
    {
        if(this.CameraPause)
        return;
        var FPS =Math.floor(1/dt);
  //      cc.log("FPS = "+FPS);
        this.FPSlabel.string ='FPS :'+FPS;
        this.node.y += this.moveSpeed*dt;
  //      return;
        var obsH = this.target.y - this.node.y;
        //  console.log("ppppppppppppppp" + obsH);
  
    //  cc.log("camera speed "+ this.moveSpeed);
        
          if(obsH >0)
          {
     //     cc.log("upppppppppppppppppp");
          let targetPos = this.target.convertToWorldSpaceAR(cc.Vec2.ZERO);
        //  var pos =  this.node.position.x;
          this.node.y =  this.target.y;  
          }
          else{
         this.node.y += this.moveSpeed*dt;
          }  
         // this.node.position.x =0 ;
        //  this.node.parent.x = 480;
    },
    shakeCamera () {
        if (!this.canShake) return;
        this.anim.play('shake');
        this.scheduleOnce(this.stopShake.bind(this), this.shakeDuration);
    },

    stopShake () {
        this.anim.stop();
      //  this.node.position = cc.p( this.startX, 0);
    },
    // called every frame, uncomment this function to activate update callback
    lateUpdate: function (dt) {


      //  let targetPos = this.target.convertToWorldSpaceAR(cc.Vec2.ZERO);
      //  var pos =  this.node.position.x;
      //  this.node.position = cc.v2(this.startX,this.node.parent.convertToNodeSpaceAR(targetPos).y);
      //  this.setIPositUion();
      //  let ratio = targetPos.x / cc.winSize.width;
      //  this.camera.zoomRatio = 0.4;
    },
});