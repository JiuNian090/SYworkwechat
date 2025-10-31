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



  onLoad() {
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
      // 获取班次模板数据和排班数据
      const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      const shifts = wx.getStorageSync('shifts') || {};
      
      // 构造导出数据结构
      const data = {
        shiftTemplates: shiftTemplates,
        shifts: shifts
      };
      
      // 添加统计数据（根据排班实时计算）
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
      // 提示用户选择JSON文件，提高用户体验
      success: (res) => {
        // 额外验证文件扩展名，确保是JSON文件
        const fileName = res.tempFiles[0].name;
        if (!fileName.toLowerCase().endsWith('.json')) {
          wx.showToast({
            title: '请选择JSON格式文件',
            icon: 'none'
          });
          return;
        }
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
              
              // 验证数据格式 - 检查必需的数据结构
              if (!data.hasOwnProperty('shiftTemplates') || !data.hasOwnProperty('shifts')) {
                throw new Error('数据格式不正确');
              }
              
              // 保存数据到本地存储
              if (data.shiftTemplates) {
                wx.setStorageSync('shiftTemplates', data.shiftTemplates);
              }
              if (data.shifts) {
                wx.setStorageSync('shifts', data.shifts);
              }
              
              wx.showToast({
                title: '导入成功',
                icon: 'success'
              });
              
              // 延迟一段时间确保数据保存完成后再刷新页面
              setTimeout(() => {
                // 刷新所有相关页面数据
                const pages = getCurrentPages();
                for (let i = 0; i < pages.length; i++) {
                  const page = pages[i];
                  if (page.route === 'pages/plan/plan') {
                    // 重新加载班次模板数据
                    if (page.loadShiftTemplates) {
                      page.loadShiftTemplates();
                    }
                  } else if (page.route === 'pages/schedule/schedule') {
                    // 重新加载排班数据和班次模板
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
                  } else if (page.route === 'pages/statistics/statistics') {
                    // 重新计算统计数据
                    if (page.calculateStatistics) {
                      page.calculateStatistics();
                    }
                  }
                }
                
                // 如果当前在tab页面，也需要刷新当前页面数据
                if (this.loadUserData && typeof this.loadUserData === 'function') {
                  this.loadUserData();
                }
                
                // 隐藏loading
                wx.hideLoading();
              }, 500);
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
            // 清空所有相关的本地存储数据
            wx.removeStorageSync('shiftTemplates');
            wx.removeStorageSync('shifts');
            // 如果还有其他需要清空的数据，可以在这里添加
            
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
                  // 重新加载班次模板数据（空数组）
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
                } else if (page.route === 'pages/statistics/statistics') {
                  // 重新计算统计数据（应该为空）
                  if (page.calculateStatistics) {
                    page.calculateStatistics();
                  }
                }
              }
              
              // 隐藏loading
              wx.hideLoading();
            }, 500);
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
  },

  // 联系作者功能
  contactAuthor() {
    wx.showModal({
      title: '联系作者',
      content: '是否要发送邮件给jiunian929@gmail.com？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 使用微信小程序的邮件功能
          if (wx.canIUse('openEmail')) {
            wx.openEmail({
              recipients: ['jiunian929@gmail.com'],
              subject: '关于SYwork排班管理系统',
              body: '您好，我在使用SYwork排班管理系统时遇到了一些问题，希望能得到您的帮助。'
            });
          } else {
            // 如果不支持openEmail，则提示用户手动发送邮件
            wx.setClipboardData({
              data: 'jiunian929@gmail.com',
              success: () => {
                wx.showToast({
                  title: '邮箱已复制',
                  icon: 'success'
                });
                wx.showModal({
                  title: '提示',
                  content: '您的微信版本不支持直接发送邮件，邮箱地址已复制到剪贴板，请您手动发送邮件至jiunian929@gmail.com',
                  showCancel: false,
                  confirmText: '知道了'
                });
              }
            });
          }
        }
      }
    });
  },

  // 捐赠支持功能
  donate() {
    wx.showModal({
      title: '捐赠支持',
      content: '即将跳转到腾讯公益小程序，感谢您的支持！',
      confirmText: '确认',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 跳转到腾讯公益小程序
          wx.navigateToMiniProgram({
            appId: 'wxfdcee92a299bcaf1', // 腾讯公益小程序的appId
            path: 'tKUOWaEQmgv5gId', // 小程序路径
            extraData: {
              from: 'SYwork排班管理系统'
            },
            success: (res) => {
              console.log('跳转到腾讯公益小程序成功', res);
            },
            fail: (err) => {
              console.error('跳转到腾讯公益小程序失败', err);
              wx.showToast({
                title: '跳转失败，请稍后重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 好友分享功能
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      path: '/pages/profile/profile'
    };
  },

  // 朋友圈分享功能
  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统 - 个人中心',
      query: 'page=profile'
    };
  }
});