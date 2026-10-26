export default class DeviceMotionEvent {
  constructor() {
    this.type = 'devicemotion';
    this.accelerationIncludingGravity = null;
  }
}

wx.onAccelerometerChange && wx.onAccelerometerChange(function (res) {
  var deviceMotionEvent = new DeviceMotionEvent();
  deviceMotionEvent.accelerationIncludingGravity = res;

  document.dispatchEvent(deviceMotionEvent);
});