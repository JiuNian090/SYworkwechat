'use strict';
const { store, STORAGE_KEYS } = require('./store');

type ClearCallback = (success: boolean) => void;

class DataClearManager {
  constructor() {
  }

  clearAllData(callback?: ClearCallback): void {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作将清空包括班次模板、登录信息在内的所有数据，且不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res: { confirm: boolean }) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });

          try {
            // 清除业务数据
            wx.removeStorageSync('shifts');
            wx.removeStorageSync('customWeeklyHours');
            wx.removeStorageSync('shiftTemplates');
            wx.removeStorageSync('statData');
            wx.removeStorageSync('statLastModified');
            wx.removeStorageSync('standardHours');
            wx.removeStorageSync('imagesLastModified');
            wx.removeStorageSync('imageRelation');
            wx.removeStorageSync('lastSyncHash');
            wx.removeStorageSync('lastUpdateCheck');

            // 清除图片相关数据
            const info = wx.getStorageInfoSync();
            const keys: string[] = info.keys || [];
            keys.forEach(key => {
              if (key.startsWith('week_images_')) {
                wx.removeStorageSync(key);
              }
            });

            // 清除登录信息相关存储
            const loginKeys = [
              'cloudInitialized', 'cloudUserId', 'cloudAccount', 'cloudUserInfo',
              'cloudLoggedIn', 'username', 'avatarType', 'avatarEmoji',
              'savedAccounts', 'autoRestoreMap', 'lastBackupTime', 'lastRestoreTime'
            ];
            loginKeys.forEach(key => {
              wx.removeStorageSync(STORAGE_KEYS[key] || key);
            });

            // 清除 store 中的状态
            store.removeState(loginKeys, loginKeys);

            wx.hideLoading();

            wx.showToast({
              title: '数据已清空',
              icon: 'success'
            });

            setTimeout(() => {
              const pages = getCurrentPages();
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page.route === 'pages/plan/plan') {
                  if (page.loadShiftTemplates) {
                    page.loadShiftTemplates();
                  }
                } else if (page.route === 'pages/schedule/schedule') {
                  if (page.loadShifts) {
                    page.loadShifts();
                  }
                  if (page.loadShiftTemplates) {
                    page.loadShiftTemplates();
                  }
                  if (page.generateWeekDates) {
                    page.generateWeekDates();
                  }
                  if (page.generateMonthDates) {
                    page.generateMonthDates();
                  }
                  if (page.loadWeekImages) {
                    page.loadWeekImages();
                  }
                } else if (page.route === 'pages/statistics/statistics') {
                  if (page.calculateStatistics) {
                    page.calculateStatistics();
                  }
                } else if (page.route === 'pages/profile/profile') {
                  if (page.initPageData) {
                    page.initPageData();
                  }
                }
              }

              if (callback) callback(true);
            }, 500);
          } catch (e) {
            wx.hideLoading();
            console.error('清空数据失败', e);
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
            if (callback) callback(false);
          }
        }
      }
    });
  }
}

module.exports = DataClearManager;

export {};
