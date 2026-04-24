// app.js
const { deviceInfo, getPlatformName, isHarmonyOS, supportsFeature, compareVersion, getSDKVersion } = require('./utils/deviceInfo.js');
const config = require('./config.js');

App({
  globalData: {
    deviceInfo: null,
    platform: null,
    isHarmonyOS: false,
    cloudInitialized: false
  },

  async onLaunch() {
    // 小程序初始化
    console.log('小程序已启动');
    
    // 检查基础库版本兼容性
    this.checkSDKVersionCompatibility();
    
    // 初始化设备信息（同步执行，因为设备信息可能被其他地方立即使用）
    this.initDeviceInfo();
    
    // 初始化云开发和同步用户信息（并行执行，不阻塞启动）
    this.initCloudAndSync();

    // 注册全局错误处理
    this.setupErrorHandlers();
  },
  
  // 检查基础库版本兼容性
  checkSDKVersionCompatibility() {
    const SDKVersion = getSDKVersion();
    console.log('当前基础库版本:', SDKVersion);
    
    // 检查最低版本要求
    const minVersion = '2.10.0';
    if (compareVersion(SDKVersion, minVersion) < 0) {
      console.warn(`当前基础库版本 ${SDKVersion} 低于最低要求 ${minVersion}，某些功能可能无法正常使用`);
      
      // 可以在这里添加用户提示
      wx.showModal({
        title: '版本提示',
        content: `当前微信版本过低，可能无法使用全部功能，请更新微信至最新版本`,
        showCancel: false
      });
    }
    
    // 检查特定API的兼容性
    if (!supportsFeature('getAppBaseInfo')) {
      console.warn('当前基础库不支持 wx.getAppBaseInfo API');
    }
    
    if (!supportsFeature('getDeviceInfo')) {
      console.warn('当前基础库不支持 wx.getDeviceInfo API');
    }
    
    if (!supportsFeature('getWindowInfo')) {
      console.warn('当前基础库不支持 wx.getWindowInfo API');
    }
  },
  
  // 初始化云开发并同步用户信息
  async initCloudAndSync() {
    try {
      // 初始化云开发
      await this.initCloud();
      
      // 同步云端用户信息
      await this.syncUserInfoFromCloud();
    } catch (e) {
      console.error('初始化云开发和同步用户信息失败:', e);
    }
  },
  
  // 初始化云开发
  async initCloud() {
    if (wx.cloud) {
      try {
        // 增加初始化尝试次数
        let initAttempts = 0;
        const maxAttempts = 3;
        const retryDelay = 1000;
        
        while (initAttempts < maxAttempts) {
          try {
            // 设置云开发初始化超时
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error('云开发初始化超时'));
              }, 10000); // 10秒超时
            });
            
            await Promise.race([
              wx.cloud.init({
                env: config.cloudEnv,
                traceUser: true,
              }),
              timeoutPromise
            ]);
            
            this.globalData.cloudInitialized = true;
            console.log('云开发初始化成功');
            break;
          } catch (e) {
            initAttempts++;
            if (initAttempts >= maxAttempts) {
              throw e;
            }
            console.warn(`云开发初始化失败，正在重试(${initAttempts}/${maxAttempts})...`, e);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
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
  
  // 清除登录信息
  clearLoginInfo() {
    try {
      wx.removeStorageSync('cloudUserId');
      wx.removeStorageSync('cloudUserInfo');
      wx.removeStorageSync('avatarType');
      wx.removeStorageSync('avatarEmoji');
      wx.removeStorageSync('username');
      console.log('本地登录信息已清除');
    } catch (e) {
      console.error('清除登录信息失败:', e);
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
      
      // 尝试调用云函数，最多重试2次
      let result;
      let retries = 0;
      const maxRetries = 2;
      const retryDelay = 1000; // 1秒重试延迟
      
      while (retries <= maxRetries) {
        try {
          // 设置云函数调用超时
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('云函数调用超时'));
            }, 10000); // 10秒超时
          });
          
          // 调用云函数获取用户信息
          result = await Promise.race([
            wx.cloud.callFunction({
              name: 'userLogin',
              data: {
                action: 'getUserInfo',
                userId: cloudUserId
              }
            }),
            timeoutPromise
          ]);
          
          // 成功获取结果，跳出循环
          break;
        } catch (e) {
          retries++;
          if (retries > maxRetries) {
            throw e; // 超过最大重试次数，抛出错误
          }
          console.warn(`同步云端用户信息失败，正在重试(${retries}/${maxRetries})...`, e);
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
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
        // 如果获取用户信息失败，清除本地登录信息
        this.clearLoginInfo();
      }
    } catch (e) {
      console.error('同步云端用户信息失败:', e);
      // 同步失败不清除本地登录信息，避免因为网络问题导致用户需要重新登录
      // this.clearLoginInfo();
    }
  },

  // 全局好友分享配置

  setupErrorHandlers() {
    if (typeof wx.onError === 'function') {
      wx.onError((error) => {
        console.error('全局捕获到错误:', error);
      });
    }

    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection((res) => {
        console.error('全局捕获到未处理的Promise拒绝:', res.reason);
      });
    }
  },
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