// utils/deviceInfo.js
// 设备信息检测工具，用于 HarmonyOS 平台兼容

class DeviceInfo {
  constructor() {
    this.deviceInfo = null;
    this.appBaseInfo = null;
    this.windowInfo = null;
    this.init();
  }

  // 初始化设备信息
  init() {
    try {
      // 获取应用基础信息
      if (wx.getAppBaseInfo) {
        this.appBaseInfo = wx.getAppBaseInfo();
      }
      
      // 获取设备信息
      if (wx.getDeviceInfo) {
        this.deviceInfo = wx.getDeviceInfo();
      }
      
      // 获取窗口信息
      if (wx.getWindowInfo) {
        this.windowInfo = wx.getWindowInfo();
      }
      
      // 如果设备信息获取失败，使用兼容方案
      if (!this.deviceInfo) {
        this.deviceInfo = this.getFallbackDeviceInfo();
      }
    } catch (e) {
      console.error('获取设备信息失败:', e);
      this.deviceInfo = this.getFallbackDeviceInfo();
    }
  }

  // 获取兼容旧版本的设备信息
  getFallbackDeviceInfo() {
    try {
      // 尝试使用各种可能的API
      const appBaseInfo = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : {};
      
      return {
        platform: deviceInfo.platform || 'unknown',
        system: deviceInfo.system || 'unknown',
        model: deviceInfo.model || 'unknown',
        brand: deviceInfo.brand || 'unknown',
        SDKVersion: appBaseInfo.SDKVersion || ''
      };
    } catch (e) {
      console.error('获取设备信息失败:', e);
      return {
        platform: 'unknown',
        system: 'unknown',
        model: 'unknown',
        brand: 'unknown',
        SDKVersion: ''
      };
    }
  }

  // 比较版本号
  compareVersion(v1, v2) {
    v1 = v1.split('.');
    v2 = v2.split('.');
    const len = Math.max(v1.length, v2.length);

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1[i]) || 0;
      const num2 = parseInt(v2[i]) || 0;
      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }
    return 0;
  }

  // 获取完整设备信息
  getDeviceInfo() {
    return this.deviceInfo;
  }

  // 获取应用基础信息
  getAppBaseInfo() {
    return this.appBaseInfo;
  }

  // 获取窗口信息
  getWindowInfo() {
    return this.windowInfo;
  }

  // 判断是否为 HarmonyOS 平台
  isHarmonyOS() {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    const system = this.deviceInfo.system || '';
    return platform.toLowerCase().includes('harmony') || 
           system.toLowerCase().includes('harmony') ||
           platform === 'harmony';
  }

  // 判断是否为 iOS 平台
  isIOS() {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'ios';
  }

  // 判断是否为 Android 平台
  isAndroid() {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'android';
  }

  // 判断是否为 Windows 平台（开发者工具）
  isWindows() {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'windows' || platform === 'devtools';
  }

  // 判断是否为开发者工具
  isDevTools() {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'devtools';
  }

  // 获取平台名称
  getPlatformName() {
    if (this.isHarmonyOS()) {
      return 'HarmonyOS';
    } else if (this.isIOS()) {
      return 'iOS';
    } else if (this.isAndroid()) {
      return 'Android';
    } else if (this.isWindows()) {
      return 'Windows';
    } else {
      return this.deviceInfo?.platform || 'Unknown';
    }
  }

  // 获取基础库版本
  getSDKVersion() {
    return this.appBaseInfo?.SDKVersion || this.deviceInfo?.SDKVersion || '';
  }

  // 检查是否支持某个特性
  supportsFeature(featureName) {
    const SDKVersion = this.getSDKVersion();
    const features = {
      // HarmonyOS 特有特性
      'harmonyos': this.isHarmonyOS(),
      // 通用特性
      'cloud': !!wx.cloud,
      'getDeviceInfo': !!wx.getDeviceInfo,
      'getAppBaseInfo': !!wx.getAppBaseInfo,
      'getWindowInfo': !!wx.getWindowInfo,
      'getSystemSetting': !!wx.getSystemSetting,
      'getAppAuthorizeSetting': !!wx.getAppAuthorizeSetting,
      // 版本相关特性
      'minVersion': (version) => this.compareVersion(SDKVersion, version) >= 0
    };
    
    // 处理版本检查
    if (typeof features[featureName] === 'function') {
      return features[featureName];
    }
    
    return features[featureName] || false;
  }

  // 检查是否支持某个API
  supportsAPI(apiName) {
    return typeof wx[apiName] === 'function';
  }

  // 获取设备型号
  getModel() {
    return this.deviceInfo?.model || '';
  }

  // 获取设备品牌
  getBrand() {
    return this.deviceInfo?.brand || '';
  }

  // 获取安全区域信息
  getSafeArea() {
    if (this.windowInfo?.safeArea) {
      return this.windowInfo.safeArea;
    }
    return null;
  }

  // 获取屏幕宽度
  getScreenWidth() {
    if (this.windowInfo?.screenWidth) {
      return this.windowInfo.screenWidth;
    }
    return 0;
  }

  // 获取屏幕高度
  getScreenHeight() {
    if (this.windowInfo?.screenHeight) {
      return this.windowInfo.screenHeight;
    }
    return 0;
  }
}

// 创建单例实例
const deviceInfo = new DeviceInfo();

module.exports = {
  deviceInfo,
  isHarmonyOS: () => deviceInfo.isHarmonyOS(),
  isIOS: () => deviceInfo.isIOS(),
  isAndroid: () => deviceInfo.isAndroid(),
  isWindows: () => deviceInfo.isWindows(),
  isDevTools: () => deviceInfo.isDevTools(),
  getPlatformName: () => deviceInfo.getPlatformName(),
  getSDKVersion: () => deviceInfo.getSDKVersion(),
  getDeviceInfo: () => deviceInfo.getDeviceInfo(),
  getAppBaseInfo: () => deviceInfo.getAppBaseInfo(),
  getWindowInfo: () => deviceInfo.getWindowInfo(),
  supportsFeature: (feature) => deviceInfo.supportsFeature(feature),
  supportsAPI: (apiName) => deviceInfo.supportsAPI(apiName),
  compareVersion: (v1, v2) => deviceInfo.compareVersion(v1, v2),
  getModel: () => deviceInfo.getModel(),
  getBrand: () => deviceInfo.getBrand(),
  getSafeArea: () => deviceInfo.getSafeArea(),
  getScreenWidth: () => deviceInfo.getScreenWidth(),
  getScreenHeight: () => deviceInfo.getScreenHeight()
};
