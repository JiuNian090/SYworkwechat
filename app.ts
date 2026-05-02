'use strict';
const { deviceInfo, getPlatformName, isHarmonyOS, supportsFeature, compareVersion, getSDKVersion } = require('./utils/deviceInfo.js');
const config = require('./config');
const { store } = require('./utils/store');

interface IGlobalData {
  deviceInfo: Record<string, any> | null;
  platform: string | null;
  isHarmonyOS: boolean;
}

interface IAppOption {
  [key: string]: any;
  globalData: IGlobalData;
  onLaunch(options: Record<string, any>): void;
  initExperienceAnalysis(options: Record<string, any>): void;
  checkSDKVersionCompatibility(): void;
  initCloudAndSync(): Promise<void>;
  initCloud(): Promise<void>;
  initDeviceInfo(): void;
  clearLoginInfo(): void;
  syncUserInfoFromCloud(): Promise<void>;
  setupErrorHandlers(): void;
  onShareAppMessage(): { title: string; path: string };
  onShareTimeline(): { title: string; query: string };
  onPageNotFound(res: Record<string, any>): void;
}

App<IAppOption>({
  globalData: {
    deviceInfo: null,
    platform: null,
    isHarmonyOS: false
  },

  onLaunch(options: Record<string, any>) {
    console.log('小程序已启动');

    this.initDeviceInfo();

    this.setupErrorHandlers();

    this.checkSDKVersionCompatibility();

    this.initExperienceAnalysis(options);

    setTimeout(() => {
      this.initCloudAndSync();
    }, 0);
  },

  initExperienceAnalysis(options: Record<string, any>) {
    try {
      const cloudUserId = wx.getStorageSync('cloudUserId');
      if (cloudUserId) {
        console.log('体验分析：已设置用户ID');
      }
      console.log('体验分析初始化完成');
    } catch (e) {
      console.error('体验分析初始化失败:', e);
    }
  },

  checkSDKVersionCompatibility() {
    const SDKVersion = getSDKVersion();
    console.log('当前基础库版本:', SDKVersion);

    const minVersion = '2.10.0';
    if (compareVersion(SDKVersion, minVersion) < 0) {
      console.warn(`当前基础库版本 ${SDKVersion} 低于最低要求 ${minVersion}，某些功能可能无法正常使用`);

      wx.showModal({
        title: '版本提示',
        content: '当前微信版本过低，可能无法使用全部功能，请更新微信至最新版本',
        showCancel: false
      });
    }

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

  async initCloudAndSync() {
    try {
      await this.initCloud();

      await this.syncUserInfoFromCloud();
    } catch (e) {
      console.error('初始化云开发和同步用户信息失败:', e);
    }
  },

  async initCloud() {
    if (wx.cloud) {
      try {
        let initAttempts = 0;
        const maxAttempts = 3;
        const retryDelay = 1000;

        while (initAttempts < maxAttempts) {
          try {
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => {
                reject(new Error('云开发初始化超时'));
              }, 10000);
            });

            await Promise.race([
              wx.cloud.init({
                env: config.cloudEnv,
                traceUser: true
              }),
              timeoutPromise
            ]);

            store.setState({ cloudInitialized: true });
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
        store.setState({ cloudInitialized: false });
      }
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      store.setState({ cloudInitialized: false });
    }
  },

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

  clearLoginInfo() {
    try {
      wx.removeStorageSync('cloudUserId');
      wx.removeStorageSync('cloudUserInfo');
      wx.removeStorageSync('avatarType');
      wx.removeStorageSync('avatarEmoji');
      wx.removeStorageSync('username');
      store.setState({ cloudUserId: '', cloudAccount: '', cloudUserInfo: null, username: '', avatarType: 'text', avatarEmoji: '', _lastDataRestore: Date.now() });
      console.log('本地登录信息已清除');
    } catch (e) {
      console.error('清除登录信息失败:', e);
    }
  },

  async syncUserInfoFromCloud() {
    try {
      const cloudUserId = wx.getStorageSync('cloudUserId');
      if (!cloudUserId) {
        console.log('用户未登录，跳过云端同步');
        return;
      }

      if (!store.getState('cloudInitialized')) {
        console.log('云开发未初始化，跳过云端同步');
        return;
      }

      console.log('开始同步云端用户信息...');

      let result: any;
      let retries = 0;
      const maxRetries = 2;
      const retryDelay = 1000;

      while (retries <= maxRetries) {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('云函数调用超时'));
            }, 10000);
          });

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

          break;
        } catch (e) {
          retries++;
          if (retries > maxRetries) {
            throw e;
          }
          console.warn(`同步云端用户信息失败，正在重试(${retries}/${maxRetries})...`, e);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      if (result.result.success && result.result.data) {
        const userData = result.result.data;

        const cloudUserInfo = {
          userId: userData.userId,
          account: userData.account,
          nickname: userData.nickname,
          avatarType: userData.avatarType || 'emoji',
          avatarEmoji: userData.avatarEmoji || '😊',
          avatarText: userData.avatarText || ''
        };

        wx.setStorageSync('cloudUserInfo', cloudUserInfo);
        store.setState({ cloudUserInfo, avatarType: userData.avatarType || 'emoji', avatarEmoji: userData.avatarEmoji || '😊', username: userData.nickname || '' }, ['cloudUserInfo', 'avatarType', 'avatarEmoji', 'username']);

        wx.setStorageSync('avatarType', userData.avatarType || 'emoji');
        wx.setStorageSync('avatarEmoji', userData.avatarEmoji || '😊');
        wx.setStorageSync('username', userData.nickname || '');

        console.log('云端用户信息同步成功');
      } else {
        console.log('获取云端用户信息失败:', result.result.errMsg);
        this.clearLoginInfo();
      }
    } catch (e) {
      console.error('同步云端用户信息失败:', e);
    }
  },

  setupErrorHandlers() {
    if (typeof wx.onError === 'function') {
      wx.onError((error: any) => {
        console.error('全局捕获到错误:', error);
      });
    }

    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection((res: any) => {
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

  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统',
      query: ''
    };
  },

  onPageNotFound(res: Record<string, any>) {
    if (res.path.indexOf('pages/user-manage/index') !== -1) {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
    } else {
      wx.switchTab({
        url: '/pages/plan/plan'
      });
    }
  }
});

export {};
