// Learn cc.Class:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/class.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/class.html
// Learn Attribute:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/reference/attributes.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - [Chinese] http://docs.cocos.com/creator/manual/zh/scripting/life-cycle-callbacks.html
//  - [English] http://www.cocos2d-x.org/docs/creator/en/scripting/life-cycle-callbacks.html
var MapDataManager = require("MapDataManager");
var ScoreManager = require("ScoreManager");
var UtilManager = require("UtilManager");
var AudioSourceManager = require('AudioSourceManager');
var UIManager = require('UIManager');

var PlayerControl =cc.Class({
    extends: cc.Component,

    statics: {
        _instance : null
    },
    properties: {
        centerStart: {
            default: null,
            type: cc.Node
        },
       
        tangentSpeed:{
            default:1,
            type:cc.Integer
        },

        circleRunSpeed :{
            default :5,
            type: cc.Integer
        },
        currentCenter:cc.Node,

        currentRadius:
        {
            default:1,
            type:cc.Integer,
            visible:false
        },

        lsClockWise: 
        {
            default:false,
            visible :false,
        },

        InvincibleTime: -1,

        HP: 100,

        DelayFailTime :1,

        CutInDir:
        {
           default:  cc.v2(0,-1),
           visible :false
        },
        
        runTime :
        {
            default: 0,
            visible: false
        },
      
        lastRunTime :
        {
           default :-1,
           visible :false
        },

        jumpCount :
        {
            default: 0,
            visible :false
        }

    },
    getHP:function()
    {
        return this.HP;
    },
    // LIFE-CYCLE CALLBACKS:

     onLoad () {
     //   cc.warn(" ============== playercontroll init" );
       this._instance = this;
       this.audioManager = cc.find('AudioManager').getComponent('AudioSourceManager');
        cc.director.getCollisionManager().enabled = true;
        this.lsClockWise = true;
        this.selfRadius = this.node.width/2*this.node.scaleX;

        this.cameraControl = cc.find("CameraCon/Camera").getComponent("cameraControl");

        this.UIBlinkAnim = cc.find('CameraCon/Camera/UILayer/Blink_White');
        this.UIBlinkAnim.active = false;
        this.canvas = cc.find('Canvas');
        this.HPShow = this.canvas.getChildByName('HP').getComponent(cc.Label);
        this.canvas.fitWidth = true;

        this.utilManager = cc.find('MapDataManager').getComponent('UtilManager');
        this.uIManager = cc.find('Map').getComponent('UIManager');
        this.jumpCount =0;
        this.canvas.on(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);

        this.Sp =  this.node.getChildByName('sprite');
        this.jumpAnim = cc.find("jumpBonus");

        this.initHp = this.getHP();
        this._reviveSpriteFrame = this.centerStart.getComponent(cc.Sprite).spriteFrame;

        this.lsDead = false;
        this.VfxNode = this.node.getChildByName('VfxInvincible');
      //  this.m_hp =this.node.getChildByName("HP");
        

        this.RBody = this.node.getComponent(cc.RigidBody);


    //    cc.director.getCollisionManager().enabledDebugDraw = true;

    //    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
       
      //  this.loadMapData();
     },


     onDestroy () {
       
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_UP, this.onKeyUp, this);
        this.canvas.off(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);
    },
    onTouchDown(event)
    {
        if (this.uIManager.isPaused) return;
     //    var len = cc.pSub(this.node.getComponent(cc.RigidBody).linearVelocity,cc.Vec2.ZERO).mag();
    //    if(len <=0)
              this.tangentMove();
              this.canvas.off(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);
     //   this.tangentMove();
    },
    checkJumpBonus: function()
    {
        if(this.runTime < ScoreManager._instance._intervalJump && this.runTime >0){
            this.jumpCount ++;
           }
        else
            this.jumpCount = 0;
 
            var bonusNAME;
            var jumpScore;
   if( this.jumpCount >=2) //
   {
     //  cc.log("jjjjjjjjjjjjjjjjjjjjj");
       switch (this.jumpCount) {
            case 2:
            bonusNAME = ScoreManager._instance.Str_DoubleJump;
            jumpScore = ScoreManager._instance._ScoreDoubleJump;
               break;
            case 3:
            bonusNAME = ScoreManager._instance.Str_TripleJump;
            jumpScore = ScoreManager._instance._ScoreTripleJump;
              break;
            case 4:
            bonusNAME = ScoreManager._instance.Str_QuadrupleJump;
            jumpScore = ScoreManager._instance._ScoreQuadrupleJump;
              break;
            default:
            bonusNAME =   ScoreManager._instance.Str_SurperJump;
            jumpScore = ScoreManager._instance._ScoreSurperJump;
               break;
       }
       this.jumpAnim.setPosition(this.node.getPosition());
       
       this.jumpAnim.getChildByName('point').getComponent(cc.Label).string =  "+"+jumpScore  ;// ;
  
       this.jumpAnim.getChildByName('txt').getComponent(cc.Label).string =   bonusNAME ;
       //if()
       this.jumpAnim.getComponent(cc.Animation).play('jumpScore');

       ScoreManager._instance.UpdateScore(jumpScore);
   }       
    },

    tangentMove:function()
    {
        if (this.uIManager.isPaused) return;
        if (this.lsDead || !cc.isValid(this.currentCenter, true)) return;

        this.checkJumpBonus();
      //  console.log("tangentMove");
        
      //   var _time = this.action2.getDuration();
      //   cc.log("circle running time ="+this.runTime);
      //BHOP
      if(!cc.isValid(this.currentCenter)) return;
         var scorePass = ScoreManager._instance._ScorePassCircle;
      //   if(this.currentCenter !=null){
         var point = this.currentCenter.getChildByName('point');
    //     cc.log("point ="+point);
         if(point != null){
             var Lpoint =  point.getComponent(cc.RichText);
            // Lpoint.fontSize = 70;
             Lpoint.string = '<color=#ffffff>' +  "+"+scorePass + '</c>';//"+"+scorePass;
         }
      //  }
       
    
        this.node.stopAllActions();


        var currentPos = this.node.getPosition();
        var centerPos = this.circlePosition(this.currentCenter);

        var dir =cc.pSub( currentPos,centerPos);

      
     
      
        var dirImplulse;
        
        if(this.lsClockWise)
        dirImplulse = cc.pPerp(dir);
        else
        dirImplulse = cc.pRPerp(dir);

      
      // console.log("dirImplulse"+dirImplulse);

      
       this.CutInDir = cc.pMult(cc.pNormalize(dirImplulse),this.tangentSpeed);
      // rb.gravityScale = 1;
       this.RBody.active = true;
       this.RBody.applyLinearImpulse( this.CutInDir,this.RBody.getWorldCenter());
       var pos = cc.pAdd(this.node.getPosition(),cc.pMult(dirImplulse,10));

      this.CurrentCircleDisappear();
    //  cc.log("xxxxxxxxxxxxxx =");
      ScoreManager._instance.UpdateScore(scorePass);
    
      
    },

     
     CurrentCircleDisappear()
     {
        this.runTime = -1;
        if(cc.isValid(this.currentCenter, true)){
        if (this.currentCenter === this._revivePlatform) this.currentCenter.destroy();
        var anim = this.currentCenter.getComponent(cc.Animation);
        if(anim)
         anim.play('golddead');
         //this.currentCenter.removeComponent("Bonus");
         }
         this.currentCenter = null;
     },

     updateRotate()
     {
         if(cc.isValid(this.currentCenter)){
              var dir =cc.pSub( this.node.getPosition(), this.circlePosition(this.currentCenter));
              var updir = cc.p(0,1);
              var pangel =cc.pDot(dir,cc.p(0,1))/(cc.pLength(dir)*cc.pLength(updir));

              var ccos= Math.acos(pangel);
              var angle = cc.radiansToDegrees(ccos);

              if(this.node.getPosition().x < this.circlePosition(this.currentCenter).x)
              this.Sp.rotation = angle*-1;
              else
              this.Sp.rotation = angle;
         
         }
     },
     circleRunBonus :function(dt)
     {
        if( this.runTime >=0){
            this.runTime += dt;
            if(this.runTime >=this.circleRunSpeed && this.currentCenter!=null)
            {       
                 var ccR = this.currentCenter.getChildByName('circleComplete');
                 var scoreCircle = ScoreManager._instance._ScoreFullCircle;
               if(ccR != null){
                   ccR.getComponent(cc.RichText).string =  '<color=#ffffff>' +  ScoreManager._instance.Str_FullCircle+"+"+scoreCircle + '</c>';//"complete +"+scoreCircle;
                   this.currentCenter.getComponent(cc.Animation).play('circleComplete');
                 }   
               ScoreManager._instance.UpdateScore(scoreCircle); 
               this.runTime = -1;
            }
           }
     },
     circlePosition:function(trackCenter)
     {
         return this.node.parent.convertToNodeSpaceAR(trackCenter.convertToWorldSpaceAR(cc.Vec2.ZERO));
     },
     circleRun:function( trackCenter,CircleDIR )
     {
        
        this.node.stopAllActions();
   //     this.cameraControl.moveSpeed = this.lastCamSpeed;
         //cc.Graphics.lineTo(0,0);
         this.currentCenter = trackCenter;
         var _center = trackCenter;
    //      console.log("circleRun =" +trackCenter.name);
         var numberPoint= 100;
         var angle = 360/numberPoint;
         var radius = trackCenter.width/2*trackCenter.scaleX+this.selfRadius;
 //        console.log("radius: "+radius);
         this.currentRadius = radius;
        // this.centerCircle.setPosition(_center);
        // this.centerCircle.width = radius*2;
        // this.centerCircle.height = radius*2-10;
         
   //      cc.log("center Position: " + _center.getPosition());
         var centerP = this.circlePosition(_center);
 

         var zx;
         var sx= this.Sp.scaleX;
         var currentPos = this.node.getPosition();
         var p1 = cc.pSub(currentPos,centerP);
         var p2 = cc.pLength(p1) > 0 ? cc.pNormalize(p1) : cc.v2(0, 1);
         var pt = cc.pAdd(centerP,cc.pMult(p2,radius));
     //    console.log("CircleDIR =" +CircleDIR);
    if(CircleDIR == CircleRunDir.None){

        

               var pz = cc.pAdd(pt,cc.pMult(cc.pNormalize(this.CutInDir),10));

               var dirPZ = cc.pSub(pz,centerP);
               var rada= cc.pAngle(dirPZ,p1);
         
              var newDir = cc.pRotateByAngle(pt,centerP,rada);
               var newxxx = cc.pSub(newDir,centerP);

        

             var aaa = cc.pAngleSigned(dirPZ,newxxx);
             zx = cc.radiansToDegrees(aaa);


  //       console.log("dir angle  "+zx);
        // console.log("222222222  "+Normalnewxxx);
        
        
    }else
      {
           if(CircleDIR == CircleRunDir.anticlockwise){
     //          cc.log('111111111111111111111111111111111111');
               zx =0
           }else if(CircleDIR == CircleRunDir.clockwise){
                zx =1;
           }
      }


        if(zx == 0){
            this.Sp.scaleX = Math.abs(sx);
          this.lsClockWise = true;
         }
         else{
            this.Sp.scaleX = Math.abs(sx)*-1;
         this.lsClockWise = false;
        }
    
         var pt0;
         var rray = [];
   //      console.log("lsClockWise "+this.lsClockWise);
         for (let index = 0; index < numberPoint; index++) {
           
            if(this.lsClockWise)
              pt0 = cc.pRotateByAngle(pt,centerP,cc.degreesToRadians(angle*index));           
            else
             pt0 = cc.pRotateByAngle(pt,centerP,cc.degreesToRadians(-angle*index));

              rray.push(pt0);
             
         }
         rray.push(pt);
         this.action1 = cc.cardinalSplineTo(this.circleRunSpeed, rray, 0);   
         this.action2 = cc.repeatForever(this.action1);
         this.node.runAction(this.action2);
         this.runTime = 0;
         this.canvas.on(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);
     //    console.log("circleRunzzzzz");
 
 
     },
    onCollisionEnter: function (other, self) {
     if (this.lsDead) return;
  //   console.log("onCollisionEnter "+other.node.groupIndex+" "+ other.node.group);
     var IndexCollison= other.node.groupIndex;
     if(IndexCollison == 9)// 9 circle;
     {
     
     this.RBody.linearVelocity  = cc.v2(0,0);
     this.RBody.active = false;

     var dirCOM = other.node.getComponent('DirCircleRun');
     if(cc.isValid(dirCOM))
     this.circleRun(other.node,dirCOM.Dir);
     else
     this.circleRun(other.node,CircleRunDir.None);

     other.node.groupIndex = -1;
   //  other.node.removeComponent('Bonus');
    }else if(IndexCollison ==7)//7 goodFood
    {
        var  tmp = other.node.getComponent('EnergyActor').HP_Per;
        this.HP +=tmp;
        other.node.destroy(); 
        ScoreManager._instance.UpdateScore(tmp);
      //  MapDataManager._instance.UpdatePlayerData();
       this.audioManager.playBonuspick();
        
    }
    else if(IndexCollison ==8)//8 badFood
    {
        this.audioManager.playHitenemy();
        if(this.lsInvincible())
        {
            var  EAC = other.node.getComponent("EnergyActor");
    
            this.HP +=EAC.HP_Per;
            ScoreManager._instance.UpdateScore(EAC.HP_Per);    
        }
        else{
        var  EAC1 = other.node.getComponent("EnergyActor");
        if(EAC1.Etype == FoodType.HighBadFood || 
           EAC1.Etype == FoodType.MidBadFood)
                this.cameraControl.shakeCamera();

        this.HP -=EAC1.HP_Per;
        if(this.HP <=0)
           this.HP =0;
      
//        MapDataManager._instance.UpdatePlayerData();
 
        }

        other.node.destroy();
    }
    else if(IndexCollison ==4 || IndexCollison ==6 )//4 wall
    {
      //  console.log("this 4444444444444")
        this.missionFailed();
       
    }else if(IndexCollison == 12)// deadTrap
    {
        if(this.lsInvincible())
        {
         
           var vfxD =  cc.instantiate(this.utilManager._VfxOniDead);
           vfxD.parent = other.node.parent;
           vfxD.setPosition( other.node.getPosition());
           this.audioManager.playMonsterdie();
           other.node.destroy();
        }else{
            this.missionFailed();
        }
    }else if(IndexCollison == 5)//spring
    {
     //   cc.log("col 555555555555");
        this.node.stopAllActions();
        this.audioManager.playJump();
        this.RBody.linearVelocity = cc.v2(0,0);
        this.RBody.active = false;
        var rot =  other.node.rotation;
        other.node.getComponent(cc.Animation).play();

        var p2 = cc.pRotateByAngle(cc.v2(0,1),cc.v2(0,0),cc.degreesToRadians(-rot));


        var vol = cc.pMult(cc.pNormalize(p2),this.tangentSpeed);
        // rb.gravityScale = 1;
        if(cc.isValid(this.currentCenter))
        {
            this.currentCenter.destroy();
        }
        this.RBody.active = true;
        this.RBody.linearVelocity = vol;
     //   this.RBody.applyLinearImpulse( vol,this.RBody.getWorldCenter());
    }
    },

    lsInvincible :function()
    {
        var flag = (this.InvincibleTime >0);
          return flag;
    },
    missionStart :function()
    {
        this.lsDead = false;
        this.SetPlayerVisible(true);
        ScoreManager._instance.PlayerScore = 0;
        this.canvas.on(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);
    },
    SetPlayerVisible:function(_visible)
    {
      // this.Sp.getComponent(cc.Sprite).enabled = _visible;
      this.Sp.active = _visible;
  //     this.m_hp.active = _visible;
       
    },
    missionFailed :function() {
        if (this.lsDead) return;
        this.lsDead = true;
 //       cc.log('mission failed11111111111111111111111');
        
 this.audioManager.playGameover01();
 this.audioManager.pause();
        this.swichAnim(false);
        this.VfxNode.active = false;
        this.runTime = -1;
        this.SetPlayerVisible(false);
        this.UIBlinkAnim.active = true;
        this.UIBlinkAnim.getComponent(cc.Animation).play();
        require('ScreenLayout')();
        var deadVfx = cc.instantiate(this.utilManager._VfxPlayerDead);
        deadVfx.parent = this.node;
        deadVfx.setPosition(cc.p(0,0));




        if(cc.isValid(this.currentCenter))
        {
            this.currentCenter.destroy();
        }
     //   this.UIRestart.active = true;
    //    this.UIStart.active = false;
    //    this.UIContinue.active = true;
        this.currentCenter = null;
        this.RBody.linearVelocity = cc.v2(0,0);
        this.RBody.active = false;
        this.node.stopAllActions();
        var camCom =  cc.find("CameraCon/Camera").getComponent("cameraControl");
        camCom.enabled = false;
        camCom.stopShake();
        camCom.setUIPosition();
        this.canvas.off(cc.Node.EventType.TOUCH_START,this.onTouchDown,this);
        this.lsDead = true;
        ScoreManager._instance.UploadScore();
       

        this.scheduleOnce(this.OverGame.bind(this), this.DelayFailTime);
 //       cc.log('mission failed22222222222222222222');
    },

    OverGame:function()
    {
        this.uIManager.EnterOverGame();
    },
    missionContinue : function()
    {
        if (!this.lsDead) return false;
        var map = cc.find('Map');
        var camera = this.cameraControl;
        var view = cc.view.getVisibleSize();
        var cameraY = this.node.parent.convertToNodeSpaceAR(camera.node.convertToWorldSpaceAR(cc.Vec2.ZERO)).y;
        var selectNode = null;
        var nearest = Infinity;
        var circles = map.getComponentsInChildren('Bonus');
        for (var i = 0; i < circles.length; i++) {
            var candidate = circles[i].node;
            if (!cc.isValid(candidate, true) || !candidate.activeInHierarchy || candidate.groupIndex !== 9) continue;
            var position = this.circlePosition(candidate);
            var radius = candidate.width * Math.abs(candidate.scaleX) / 2 + this.selfRadius;
            if (position.x - radius < 30 || position.x + radius > view.width - 30) continue;
            if (position.y < cameraY - view.height * 0.25 || position.y + radius > cameraY + view.height * 0.3) continue;
            var distance = cc.pDistance(this.node.getPosition(), position);
            if (distance < nearest) { nearest = distance; selectNode = candidate; }
        }
        if (!selectNode) {
            selectNode = new cc.Node('RevivePlatform');
            map.addChild(selectNode);
            var sprite = selectNode.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this._reviveSpriteFrame;
            selectNode.setContentSize(160, 160);
            var spawn = this.node.parent.convertToWorldSpaceAR(cc.v2(view.width / 2, cameraY - view.height * 0.15 - 80 - this.selfRadius));
            selectNode.setPosition(map.convertToNodeSpaceAR(spawn));
            this._revivePlatform = selectNode;
        }
        var center = this.circlePosition(selectNode);
        var orbitRadius = selectNode.width * Math.abs(selectNode.scaleX) / 2 + this.selfRadius;
        this.node.stopAllActions();
        this.RBody.active = false;
        this.RBody.linearVelocity = cc.v2(0, 0);
        this.RBody.angularVelocity = 0;
        this.node.setPosition(center.x, center.y + orbitRadius);
        this.HP = this.initHp;
        this.jumpCount = 0;
        this.CutInDir = cc.v2(this.tangentSpeed, 0);
        this.UIBlinkAnim.getComponent(cc.Animation).stop();
        this.UIBlinkAnim.active = false;
        this.SetPlayerVisible(true);
        this.lsDead = false;
        this.SetInvincible(ScoreManager._instance._invincibleRevive);
        selectNode.groupIndex = -1;
        this.circleRun(selectNode, CircleRunDir.anticlockwise);
        camera.node.y = this.node.y + view.height * 0.15;
        camera.CameraPause = false;
        camera.enabled = true;
        return true;
    },

    swichAnim: function(_Invincible)
    {
         var spAnim =this.Sp.getComponent(cc.Animation);
         if(_Invincible)
         spAnim.play('snailmove_invincible');
         else
         spAnim.play('snailmove');
    },
     SetInvincible :function(param)
     {
        this.InvincibleTime = param;
        if(this.InvincibleTime >0){
           this.VfxNode.active = true;
            this.swichAnim(true);
        }
     },
     update (dt) {
         this.updateRotate();
        this.circleRunBonus(dt);
        

         if(this.InvincibleTime >0){
            this.InvincibleTime -= dt;
            if(this.InvincibleTime <0){
             this.VfxNode.active = false;
             this.swichAnim(false);
             }
         }
         this.HPShow.string = this.HP;
         if( this.InvincibleTime <0 && this.HP <=0 &&
            !this.lsDead){ 
       //      console.log("you are dead");
             this.CurrentCircleDisappear();
             this.missionFailed();
         }
     },

});
