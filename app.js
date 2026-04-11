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
    
    // 自动同步云端用户信息
    this.syncUserInfoFromCloud();
  },
  
  // 初始化云开发
  initCloud() {
    if (wx.cloud) {
      try {
        wx.cloud.init({
          env: 'cloudbase-1gar7d7f967d8a60',
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
  
  // 自动同步云端用户信息
  async syncUserInfoFromCloud() {
    try {
      // 检查是否已登录
      const cloudUserId = wx.getStorageSync('cloudUserId');
      if (!cloudUserId) {
        console.log('用户未登录，跳过云端同步');
        return;
      }
      
      // 检查云开发是否初始化成功
      if (!this.globalData.cloudInitialized) {
        console.log('云开发未初始化，跳过云端同步');
        return;
      }
      
      console.log('开始同步云端用户信息...');
      
      // 调用云函数获取用户信息
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'getUserInfo',
          userId: cloudUserId
        }
      });
      
      if (result.result.success && result.result.data) {
        const userData = result.result.data;
        
        // 更新本地存储的用户信息
        const cloudUserInfo = {
          userId: userData.userId,
          account: userData.account,
          nickname: userData.nickname,
          avatarType: userData.avatarType || 'emoji',
          avatarEmoji: userData.avatarEmoji || '😊',
          avatarText: userData.avatarText || ''
        };
        
        wx.setStorageSync('cloudUserInfo', cloudUserInfo);
        
        // 同步头像信息到本地存储
        wx.setStorageSync('avatarType', userData.avatarType || 'emoji');
        wx.setStorageSync('avatarEmoji', userData.avatarEmoji || '😊');
        wx.setStorageSync('username', userData.nickname || '');
        
        console.log('云端用户信息同步成功');
      } else {
        console.log('获取云端用户信息失败:', result.result.errMsg);
      }
    } catch (e) {
      console.error('同步云端用户信息失败:', e);
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