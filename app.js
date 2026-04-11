// app.js
const { deviceInfo, getPlatformName, isHarmonyOS } = require('./utils/deviceInfo.js');

App({
  globalData: {
    deviceInfo: null,
    platform: null,
    isHarmonyOS: false,
    cloudInitialized: false
  },

  onLaunch() {
    // 小程序初始化
    console.log('小程序已启动');
    
    // 初始化设备信息
    this.initDeviceInfo();
    
    // 初始化云开发
    this.initCloud();
  },
  
  // 初始化云开发
  initCloud() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: 'YOUR_CLOUD_ENV_ID',
          traceUser: true,
        });
        this.globalData.cloudInitialized = true;
        console.log('云开发初始化成功');
      } catch (e) {
        console.error('云开发初始化失败', e);
        this.globalData.cloudInitialized = false;
        // 云开发初始化失败不影响其他功能
      }
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      this.globalData.cloudInitialized = false;
    }
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