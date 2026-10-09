'use strict';
const { deviceInfo, getPlatformName, isHarmonyOS, supportsFeature, compareVersion, getSDKVersion } = require('./utils/deviceInfo.js');
const config = require('./config');
const { store } = require('./utils/store');

// 说明：tabBar 的 iconPath / selectedIconPath 不支持 theme.json 的 @主题变量
// （微信只对 tabBar 的 color / selectedColor / backgroundColor / borderStyle 这类颜色字段支持主题变量），
// 所以图标随系统主题切换必须走运行时 API：浅色用 *.png，深色用 *2.png（选中态两套共用 *1.png）。
interface TabBarIconSet {
  iconPath: string;
  selectedIconPath: string;
}

const TAB_BAR_ICONS_LIGHT: TabBarIconSet[] = [
  { iconPath: 'images/list-add.png', selectedIconPath: 'images/list-add1.png' },
  { iconPath: 'images/schedule.png', selectedIconPath: 'images/schedule1.png' },
  { iconPath: 'images/status.png', selectedIconPath: 'images/status1.png' },
  { iconPath: 'images/me.png', selectedIconPath: 'images/me1.png' }
];

const TAB_BAR_ICONS_DARK: TabBarIconSet[] = [
  { iconPath: 'images/list-add2.png', selectedIconPath: 'images/list-add1.png' },
  { iconPath: 'images/schedule2.png', selectedIconPath: 'images/schedule1.png' },
  { iconPath: 'images/status2.png', selectedIconPath: 'images/status1.png' },
  { iconPath: 'images/me2.png', selectedIconPath: 'images/me1.png' }
];

interface IGlobalData {
  deviceInfo: Record<string, any> | null;
  platform: string | null;
  isHarmonyOS: boolean;
}

interface IAppOption {
  [key: string]: any;
  globalData: IGlobalData;
  onLaunch(options: Record<string, any>): void;
  onShow(): void;
  initTabBarIcons(): void;
  bindThemeChange(): void;
  applyTabBarIcons(isDark: boolean): void;
  isDarkTheme(): boolean;
  _themeChangeBound?: boolean;
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
    this.initDeviceInfo();

    this.initTabBarIcons();

    this.setupErrorHandlers();

    this.checkSDKVersionCompatibility();

    this.initExperienceAnalysis(options);

    setTimeout(() => {
      this.initCloudAndSync();
    }, 0);
  },

  onShow() {
    // tabBar 在 onShow 阶段才确保就绪；从后台回到前台时系统主题也可能已经改变
    this.initTabBarIcons();
  },

  initTabBarIcons() {
    try {
      this.applyTabBarIcons(this.isDarkTheme());
      this.bindThemeChange();
    } catch (e) {
      console.error('初始化 tabBar 图标失败:', e);
    }
  },

  isDarkTheme(): boolean {
    try {
      const appBaseInfo = typeof wx.getAppBaseInfo === 'function'
        ? wx.getAppBaseInfo()
        : wx.getSystemInfoSync();
      return (appBaseInfo as unknown as { theme?: string }).theme === 'dark';
    } catch (e) {
      return false;
    }
  },

  bindThemeChange() {
    if (this._themeChangeBound || typeof wx.onThemeChange !== 'function') {
      return;
    }
    this._themeChangeBound = true;
    wx.onThemeChange((res: { theme: string }) => {
      this.applyTabBarIcons(res.theme === 'dark');
    });
  },

  applyTabBarIcons(isDark: boolean) {
    const icons = isDark ? TAB_BAR_ICONS_DARK : TAB_BAR_ICONS_LIGHT;
    icons.forEach((icon, index) => {
      wx.setTabBarItem({
        index: index,
        iconPath: icon.iconPath,
        selectedIconPath: icon.selectedIconPath,
        fail: (err: WechatMiniprogram.GeneralCallbackResult) => {
          console.warn(`设置 tabBar 第 ${index + 1} 项图标失败:`, err);
        }
      });
    });
  },

  initExperienceAnalysis(options: Record<string, any>) {
    try {
      const cloudUserId = wx.getStorageSync('cloudUserId');
      if (cloudUserId) {
        wx.setEnableDebug({ enableDebug: false });
      }
    } catch (e) {
      console.error('体验分析初始化失败:', e);
    }
  },

  checkSDKVersionCompatibility() {
    const SDKVersion = getSDKVersion();

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
    } catch (e) {
      console.error('清除登录信息失败:', e);
    }
  },

  async syncUserInfoFromCloud() {
    try {
      const cloudUserId = wx.getStorageSync('cloudUserId');
      if (!cloudUserId) {
        return;
      }

      if (!store.getState('cloudInitialized')) {
        return;
      }

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
              name: config.cloudFunctions.userLogin,
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
      } else {
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
