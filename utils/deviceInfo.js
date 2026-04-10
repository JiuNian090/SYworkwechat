// utils/deviceInfo.js
// 设备信息检测工具，用于 HarmonyOS 平台兼容

class DeviceInfo {
  constructor() {
    this.deviceInfo = null;
    this.init();
  }

  // 初始化设备信息
  init() {
    try {
      if (wx.getDeviceInfo) {
        this.deviceInfo = wx.getDeviceInfo();
      } else {
        // 兼容旧版本基础库
        this.deviceInfo = this.getFallbackDeviceInfo();
      }
    } catch (e) {
      console.error('获取设备信息失败:', e);
      this.deviceInfo = this.getFallbackDeviceInfo();
    }
  }

  // 获取兼容旧版本的设备信息
  getFallbackDeviceInfo() {
    const systemInfo = wx.getSystemInfoSync();
    return {
      platform: systemInfo.platform,
      system: systemInfo.system,
      model: systemInfo.model,
      brand: systemInfo.brand,
      SDKVersion: systemInfo.SDKVersion
    };
  }

  // 获取完整设备信息
  getDeviceInfo() {
    return this.deviceInfo;
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
    return this.deviceInfo?.SDKVersion || '';
  }

  // 检查是否支持某个特性
  supportsFeature(featureName) {
    const features = {
      // HarmonyOS 特有特性
      'harmonyos': this.isHarmonyOS(),
      // 通用特性
      'cloud': !!wx.cloud,
      'getDeviceInfo': !!wx.getDeviceInfo
    };
    return features[featureName] || false;
  }

  // 获取设备型号
  getModel() {
    return this.deviceInfo?.model || '';
  }

  // 获取设备品牌
  getBrand() {
    return this.deviceInfo?.brand || '';
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
  supportsFeature: (feature) => deviceInfo.supportsFeature(feature)
};
