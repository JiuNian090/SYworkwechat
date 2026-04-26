'use strict';
class DataClearManager {
  constructor() {
  }

  // 清空所有数据（包括班次模板）
  clearAllData(callback) {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作将清空包括班次模板在内的所有数据，且不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });

          try {
            // 1. 清空基础数据
            wx.removeStorageSync('shifts');
            wx.removeStorageSync('customWeeklyHours');
            wx.removeStorageSync('shiftTemplates');
            wx.removeStorageSync('statData');
            wx.removeStorageSync('statLastModified');
            wx.removeStorageSync('standardHours');
            wx.removeStorageSync('imagesLastModified');

            // 2. 清空图片关联表
            wx.removeStorageSync('imageRelation');

            // 3. 查找并清空所有周图片存储 (week_images_*)
            const info = wx.getStorageInfoSync();
            const keys = info.keys || [];
            keys.forEach(key => {
              if (key.startsWith('week_images_')) {
                wx.removeStorageSync(key);
              }
            });

            // 4. 清空更新数据
            wx.removeStorageSync('lastUpdateCheck');

            // 隐藏loading
            wx.hideLoading();

            wx.showToast({
              title: '数据已清空',
              icon: 'success'
            });

            // 延迟一段时间确保数据清空完成后再刷新页面
            setTimeout(() => {
              // 通知所有相关页面刷新数据
              const pages = getCurrentPages();
              for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                if (page.route === 'pages/plan/plan') {
                  // 重新加载班次模板数据（保留原有数据）
                  if (page.loadShiftTemplates) {
                    page.loadShiftTemplates();
                  }
                } else if (page.route === 'pages/schedule/schedule') {
                  // 重新加载排班数据（空对象）和班次模板
                  if (page.loadShifts) {
                    page.loadShifts();
                  }
                  if (page.loadShiftTemplates) {
                    page.loadShiftTemplates();
                  }
                  // 重新生成日期数据
                  if (page.generateWeekDates) {
                    page.generateWeekDates();
                  }
                  if (page.generateMonthDates) {
                    page.generateMonthDates();
                  }
                  // 重新加载图片数据（清空）
                  if (page.loadWeekImages) {
                    page.loadWeekImages();
                  }
                } else if (page.route === 'pages/statistics/statistics') {
                  // 重新计算统计数据（应该为空）
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
