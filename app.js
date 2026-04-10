// app.js
const { deviceInfo, getPlatformName, isHarmonyOS } = require('./utils/deviceInfo.js');

App({
  globalData: {
    deviceInfo: null,
    platform: null,
    isHarmonyOS: false
  },

  onLaunch() {
    // 小程序初始化
    console.log('小程序已启动');
    
    // 初始化设备信息
    this.initDeviceInfo();
  },

  // 初始化设备信息
  initDeviceInfo() {
    try {
      this.globalData.deviceInfo = deviceInfo.getDeviceInfo();
      this.globalData.platform = getPlatformName();
      this.globalData.isHarmonyOS = isHarmonyOS();
      
      console.log('设备信息:', this.globalData.deviceInfo);
      console.log('平台:', this.globalData.platform);
      
      if (this.globalData.isHarmonyOS) {
        console.log('检测到 HarmonyOS 平台');
      }
    } catch (e) {
      console.error('初始化设备信息失败:', e);
    }
  },

  // 全局好友分享配置
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统',
      path: '/pages/plan/plan'
    };
  },

  // 全局朋友圈分享配置
  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统',
      query: ''
    };
  }
});