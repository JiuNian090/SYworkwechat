'use strict';
type ClearCallback = (success: boolean) => void;

class DataClearManager {
  constructor() {
  }

  clearAllData(callback?: ClearCallback): void {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作将清空包括班次模板在内的所有数据，且不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res: { confirm: boolean }) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });

          try {
            wx.removeStorageSync('shifts');
            wx.removeStorageSync('customWeeklyHours');
            wx.removeStorageSync('shiftTemplates');
            wx.removeStorageSync('statData');
            wx.removeStorageSync('statLastModified');
            wx.removeStorageSync('standardHours');
            wx.removeStorageSync('imagesLastModified');

            wx.removeStorageSync('imageRelation');

            const info = wx.getStorageInfoSync();
            const keys: string[] = info.keys || [];
            keys.forEach(key => {
              if (key.startsWith('week_images_')) {
                wx.removeStorageSync(key);
              }
            });

            wx.removeStorageSync('lastUpdateCheck');

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
