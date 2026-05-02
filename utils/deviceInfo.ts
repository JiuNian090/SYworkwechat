// @ts-nocheck
'use strict';

interface IDeviceInfo {
  platform: string;
  system: string;
  model: string;
  brand: string;
  SDKVersion?: string;
  [key: string]: any;
}

interface IAppBaseInfo {
  SDKVersion: string;
  [key: string]: any;
}

interface IWindowInfo {
  safeArea?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
  screenWidth?: number;
  screenHeight?: number;
  [key: string]: any;
}

interface ISafeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface IFeatureMap {
  [key: string]: boolean | ((version: string) => boolean);
}

class DeviceInfo {
  private deviceInfo: IDeviceInfo | null;
  private appBaseInfo: IAppBaseInfo | null;
  private windowInfo: IWindowInfo | null;

  constructor() {
    this.deviceInfo = null;
    this.appBaseInfo = null;
    this.windowInfo = null;
    this.init();
  }

  init(): void {
    try {
      if (wx.getAppBaseInfo) {
        this.appBaseInfo = wx.getAppBaseInfo() as unknown as IAppBaseInfo;
      }

      if (wx.getDeviceInfo) {
        this.deviceInfo = wx.getDeviceInfo() as unknown as IDeviceInfo;
      }

      if (wx.getWindowInfo) {
        this.windowInfo = wx.getWindowInfo() as unknown as IWindowInfo;
      }

      if (!this.deviceInfo) {
        this.deviceInfo = this.getFallbackDeviceInfo();
      }
    } catch (e) {
      console.error('获取设备信息失败:', e);
      this.deviceInfo = this.getFallbackDeviceInfo();
    }
  }

  getFallbackDeviceInfo(): IDeviceInfo {
    try {
      const appBaseInfo = wx.getAppBaseInfo ? wx.getAppBaseInfo() as unknown as IAppBaseInfo : {} as IAppBaseInfo;
      const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() as unknown as IDeviceInfo : {} as IDeviceInfo;

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

  compareVersion(v1: string, v2: string): number {
    const v1Arr = v1.split('.');
    const v2Arr = v2.split('.');
    const len = Math.max(v1Arr.length, v2Arr.length);

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1Arr[i], 10) || 0;
      const num2 = parseInt(v2Arr[i], 10) || 0;
      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }
    return 0;
  }

  getDeviceInfo(): IDeviceInfo | null {
    return this.deviceInfo;
  }

  getAppBaseInfo(): IAppBaseInfo | null {
    return this.appBaseInfo;
  }

  getWindowInfo(): IWindowInfo | null {
    return this.windowInfo;
  }

  isHarmonyOS(): boolean {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    const system = this.deviceInfo.system || '';
    return platform.toLowerCase().includes('harmony') ||
           system.toLowerCase().includes('harmony') ||
           platform === 'harmony';
  }

  isIOS(): boolean {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'ios';
  }

  isAndroid(): boolean {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'android';
  }

  isWindows(): boolean {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'windows' || platform === 'devtools';
  }

  isDevTools(): boolean {
    if (!this.deviceInfo) return false;
    const platform = this.deviceInfo.platform || '';
    return platform === 'devtools';
  }

  getPlatformName(): string {
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

  getSDKVersion(): string {
    return this.appBaseInfo?.SDKVersion || this.deviceInfo?.SDKVersion || '';
  }

  supportsFeature(featureName: string): boolean | ((version: string) => boolean) {
    const SDKVersion = this.getSDKVersion();
    const features: IFeatureMap = {
      'harmonyos': this.isHarmonyOS(),
      'cloud': !!wx.cloud,
      'getDeviceInfo': !!wx.getDeviceInfo,
      'getAppBaseInfo': !!wx.getAppBaseInfo,
      'getWindowInfo': !!wx.getWindowInfo,
      'getSystemSetting': !!wx.getSystemSetting,
      'getAppAuthorizeSetting': !!wx.getAppAuthorizeSetting,
      'minVersion': (version: string) => this.compareVersion(SDKVersion, version) >= 0
    };

    if (typeof features[featureName] === 'function') {
      return features[featureName] as (version: string) => boolean;
    }

    return features[featureName] || false;
  }

  supportsAPI(apiName: string): boolean {
    return typeof (wx as any)[apiName] === 'function';
  }

  getModel(): string {
    return this.deviceInfo?.model || '';
  }

  getBrand(): string {
    return this.deviceInfo?.brand || '';
  }

  getSafeArea(): ISafeArea | null {
    if (this.windowInfo?.safeArea) {
      return this.windowInfo.safeArea;
    }
    return null;
  }

  getScreenWidth(): number {
    if (this.windowInfo?.screenWidth) {
      return this.windowInfo.screenWidth;
    }
    return 0;
  }

  getScreenHeight(): number {
    if (this.windowInfo?.screenHeight) {
      return this.windowInfo.screenHeight;
    }
    return 0;
  }
}

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
  supportsFeature: (feature: string) => deviceInfo.supportsFeature(feature),
  supportsAPI: (apiName: string) => deviceInfo.supportsAPI(apiName),
  compareVersion: (v1: string, v2: string) => deviceInfo.compareVersion(v1, v2),
  getModel: () => deviceInfo.getModel(),
  getBrand: () => deviceInfo.getBrand(),
  getSafeArea: () => deviceInfo.getSafeArea(),
  getScreenWidth: () => deviceInfo.getScreenWidth(),
  getScreenHeight: () => deviceInfo.getScreenHeight()
};

export {};
