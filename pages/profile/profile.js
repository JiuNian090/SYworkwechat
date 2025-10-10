// pages/profile/profile.js
const api = require('../../utils/api.js');

Page({
  data: {
    exportFileName: '',
    exportedFilePath: '',
    exportedFileName: '',
    exportSuccess: false,
    exportFail: false,
    loading: false,
  },

  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统',
      path: '/pages/plan/plan',
      success: function(res) {
        wx.showToast({
          title: '分享成功',
          icon: 'success'
        });
      },
      fail: function(err) {
        console.error('分享失败', err);
        wx.showToast({
          title: '分享失败',
          icon: 'none'
        });
      }
    };
  },

  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统',
      query: ''
    };
  },

  onLoad() {
    // 用户信息相关代码已删除
  },

  onShow() {
    // 用户信息相关代码已删除
  },

  loadUserInfo() {
    // 用户信息相关代码已删除
  },





  // 处理文件名输入
  onFileNameInput(e) {
    this.setData({
      exportFileName: e.detail.value
    });
  },

  

  exportData() {
    wx.showLoading({
      title: '正在导出...'
    });
    
    try {
      const data = {
        shiftTemplates: wx.getStorageSync('shiftTemplates') || [],
        shifts: wx.getStorageSync('shifts') || {}
      };
      
      // 添加统计数据
      const allShifts = data.shifts;
      let totalHours = 0;
      let workDays = 0;
      let offDays = 0;
      let totalDays = 0;
      
      // 计算统计数据
      Object.keys(allShifts).forEach(date => {
        const shift = allShifts[date];
        totalHours += parseFloat(shift.workHours) || 0;
        totalDays++;
        
        // 按班次类型统计工作班次和休息日
        const shiftType = shift.type;
        if (shiftType === '白天班' || shiftType === '跨夜班') {
          workDays++;
        } else if (shiftType === '休息日') {
          offDays++;
        }
      });
      
      // 添加统计数据到导出数据中
      data.statistics = {
        totalHours: totalHours.toFixed(1),
        totalDays: totalDays,
        workDays: workDays,
        offDays: offDays
      };
      
      const jsonData = JSON.stringify(data, null, 2);
      
      // 获取自定义文件名
      const customFileName = this.data.exportFileName;
      const fileName = customFileName ? customFileName : `sywork_backup_${Date.now()}`;
      
      // 创建临时文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.json`;
      
      fs.writeFile({
        filePath: filePath,
        data: jsonData,
        encoding: 'utf8',
        success: () => {
          wx.hideLoading();
          // 保存文件路径和文件名到页面数据中，等待用户点击分享按钮
          this.setData({
            exportedFilePath: filePath,
            exportedFileName: fileName
          });
          
          // 显示提示，让用户点击分享按钮
          wx.showModal({
            title: '导出成功',
            content: '数据已导出为JSON文件，请点击下方"分享给好友"按钮将文件发送给好友',
            showCancel: false,
            confirmText: '知道了'
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('写入文件失败', err);
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
        }
      });
    } catch (e) {
      wx.hideLoading();
      console.error('导出数据失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  // 分享导出的文件给好友
  shareExportedFile() {
    // 检查是否有导出的文件
    if (this.data.exportedFilePath && this.data.exportedFileName) {
      this.shareFile(this.data.exportedFilePath, this.data.exportedFileName);
    } else {
      wx.showToast({
        title: '请先导出数据',
        icon: 'none'
      });
    }
  },

  // 分享文件给好友
  shareFile(filePath, fileName) {
    // 检查是否支持分享文件
    if (wx.shareFileMessage) {
      wx.shareFileMessage({
        filePath: filePath,
        fileName: `${fileName}.json`,
        success: () => {
          wx.showToast({
            title: '分享成功',
            icon: 'success'
          });
        },
        fail: (err) => {
          console.error('分享失败', err);
          wx.showToast({
            title: '分享失败',
            icon: 'none'
          });
        }
      });
    } else {
      // 如果不支持分享文件，则提示用户手动发送
      wx.showModal({
        title: '提示',
        content: '当前微信版本不支持直接分享文件，您可以手动发送文件给好友。文件已保存到本地。',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  importData() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        wx.showLoading({
          title: '正在导入...'
        });
        
        const filePath = res.tempFiles[0].path;
        
        wx.getFileSystemManager().readFile({
          filePath: filePath,
          encoding: 'utf-8',
          success: (readRes) => {
            try {
              const data = JSON.parse(readRes.data);
              
              // 验证数据格式
              if (!data.shiftTemplates && !data.shifts) {
                throw new Error('数据格式不正确');
              }
              
              // 保存数据
              if (data.shiftTemplates) {
                wx.setStorageSync('shiftTemplates', data.shiftTemplates);
              }
              if (data.shifts) {
                wx.setStorageSync('shifts', data.shifts);
              }
              
              wx.hideLoading();
              wx.showToast({
                title: '导入成功',
                icon: 'success'
              });
              
              // 刷新其他页面数据
              const pages = getCurrentPages();
              if (pages.length > 1) {
                const prevPage = pages[pages.length - 2];
                if (prevPage.route === 'pages/plan/plan') {
                  prevPage.loadShiftTemplates && prevPage.loadShiftTemplates();
                } else if (prevPage.route === 'pages/schedule/schedule') {
                  prevPage.loadShifts && prevPage.loadShifts();
                  prevPage.generateWeekDates && prevPage.generateWeekDates();
                  prevPage.generateMonthDates && prevPage.generateMonthDates();
                }
              }
            } catch (e) {
              wx.hideLoading();
              console.error('解析数据失败', e);
              wx.showToast({
                title: '数据格式错误',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('读取文件失败', err);
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes('cancel')) {
          wx.showToast({
            title: '选择文件失败',
            icon: 'none'
          });
        }
      }
    });
  },

  

  
  
  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有数据吗？此操作不可恢复！',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在清空...'
          });
          
          try {
            wx.clearStorageSync();
            wx.showToast({
              title: '数据已清空',
              icon: 'success'
            });
            
            // 通知所有相关页面刷新数据
            const pages = getCurrentPages();
            for (let i = 0; i < pages.length; i++) {
              const page = pages[i];
              if (page.route === 'pages/plan/plan') {
                page.loadShiftTemplates && page.loadShiftTemplates();
              } else if (page.route === 'pages/schedule/schedule') {
                page.loadShifts && page.loadShifts();
                page.loadShiftTemplates && page.loadShiftTemplates();
                page.generateWeekDates && page.generateWeekDates();
                page.generateMonthDates && page.generateMonthDates();
              } else if (page.route === 'pages/statistics/statistics') {
                page.calculateStatistics && page.calculateStatistics();
              }
            }
          } catch (e) {
            wx.hideLoading();
            console.error('清空数据失败', e);
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});