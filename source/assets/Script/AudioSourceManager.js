var UtilManager = require("UtilManager");

var AudioSourceManager =cc.Class({
    extends: cc.Component,
    statics: {
        _instance : null
    },
    properties: {
        audioSource: {
            type: cc.AudioSource,
            default: null
        },

        audioMMBG :{
            type:cc.AudioSource,
            default:null
        },

        audio_bonuspick : {
            type: cc.AudioSource,
            default: null
        },

        audio_gameover01: {
            type: cc.AudioSource,
            default: null
        },

        audio_hitenemy : {
            type: cc.AudioSource,
            default: null
        },

        audio_jump: {
            type: cc.AudioSource,
            default: null
        },
        audio_monsterdie: {
            type: cc.AudioSource,
            default: null
        },
        

        _lsSoundOn :true,
        _lsSfxOn:true
        
    },

    // use this for initialization
    onLoad: function () {
        AudioSourceManager._instance = this;
        cc.game.addPersistRootNode(this.node);
        // cc.audioEngine.setMaxWebAudioSize(1024*10);
    },
    StopAllSound:function(){
        this.stopMMBG();
    },

    update: function () {
      
  //      var audio = this.audioSource;
  //      this.label.string = audio.getCurrentTime().toFixed(1) + ' s / ' + audio.getDuration().toFixed(1) + ' s';
    },
    
    playMMBG:function()
    {
   //     cc.log('--------------playMMBG');
        if(cc.isValid(this.audioMMBG)){
  //          cc.log('xxx----playMMBG');
            if(this._lsSoundOn)
                this.audioMMBG.play();
        }
    },

    stopMMBG:function()
    {
        if(cc.isValid(this.audioMMBG)){
              this.audioMMBG.stop();
        }
    },
    play: function () {
        if(this._lsSoundOn) 
              this.audioSource.play();
      // this.bgChip = cc.audioEngine.play(UtilManager._instance._MusicBGM, true);

      
    },
    
    pause: function () {
       // cc.audioEngine.pause(this.bgChip);
       if(this._lsSoundOn)
              this.audioSource.pause();
    },
    
    stop: function () {
       // cc.audioEngine.stop(this.bgChip);
        this.audioSource.stop();
    },
    
    resume: function () {
      //  cc.audioEngine.resume(this.bgChip);
      if(this._lsSoundOn)
        this.audioSource.resume();
    },

    playBonuspick()
    {
        if(this._lsSfxOn) 
            this.audio_bonuspick.play();
    },
    
    playGameover01()
    {
        if(this._lsSfxOn)
        this.audio_gameover01.play();
    },

    playHitenemy()
    {
        if(this._lsSfxOn)
        this.audio_hitenemy.play();
    },

    playJump()
    {
        if(this._lsSfxOn)
        this.audio_jump.play();
    },

    playMonsterdie()
    {
        cc.log('playMonsterdie');
        if(this._lsSfxOn)
        this.audio_monsterdie.play();
    },

});
