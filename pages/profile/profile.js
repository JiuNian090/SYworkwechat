// pages/profile/profile.js
const api = require('../../utils/api.js');

Page({
  data: {
    userInfo: {
      avatarUrl: '/images/default_avatar.png',
      nickName: '用户'
    },
    hasLogin: false,
    exportFileName: '',
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    canIUseNicknameComp: false,
    logged: false,
    exportSuccess: false,
    exportFail: false,
    loading: false,
  },

  // 获取用户信息
  async getUserInfo() {
    try {
      const userInfo = await api.get('/user/info');
      this.setData({
        userInfo: userInfo,
        hasUserInfo: true
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none'
      });
    }
  },

  onLoad() {
    this.loadUserInfo();
    // 检查登录状态
    this.checkLoginStatus();
    
    // 如果已登录，获取用户信息
    if (this.data.hasLogin) {
      this.getUserInfo();
    }
  },

  checkLoginStatus() {
    try {
      const app = getApp();
      if (app.globalData.hasLogin && app.globalData.userInfo) {
        this.setData({
          hasLogin: true,
          userInfo: app.globalData.userInfo
        });
      } else {
        // 检查本地存储
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo && userInfo.nickName) {
          this.setData({
            hasLogin: true,
            userInfo: userInfo
          });
          // 同步到全局数据
          app.globalData.userInfo = userInfo;
          app.globalData.hasLogin = true;
        }
      }
    } catch (e) {
      console.error('检查登录状态失败', e);
    }
  },

  // 微信登录
  loginWithWeChat() {
    const app = getApp();
    app.loginWithWeChat((userInfo) => {
      if (userInfo) {
        this.setData({
          hasLogin: true,
          userInfo: userInfo
        });
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      }
    });
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || {
        avatarUrl: '/images/default_avatar.png',
        nickName: '用户'
      };
      this.setData({
        userInfo: userInfo
      });
    } catch (e) {
      console.error('读取用户信息失败', e);
      wx.showToast({
        title: '读取用户信息失败',
        icon: 'none'
      });
    }
  },

  onAvatarError(e) {
    console.error('头像加载失败', e);
    // 使用默认头像
    this.setData({
      'userInfo.avatarUrl': '/images/default_avatar.png'
    });
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
        userInfo: wx.getStorageSync('userInfo') || {},
        shiftTemplates: wx.getStorageSync('shiftTemplates') || [],
        shifts: wx.getStorageSync('shifts') || {}
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
          // 保存文件到本地
          wx.saveFile({
            tempFilePath: filePath,
            success: (res) => {
              wx.hideLoading();
              wx.showToast({
                title: '导出成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('保存文件失败', err);
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
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
              if (!data.userInfo && !data.shiftTemplates && !data.shifts) {
                throw new Error('数据格式不正确');
              }
              
              // 保存数据
              if (data.userInfo) {
                wx.setStorageSync('userInfo', data.userInfo);
              }
              if (data.shiftTemplates) {
                wx.setStorageSync('shiftTemplates', data.shiftTemplates);
              }
              if (data.shifts) {
                wx.setStorageSync('shifts', data.shifts);
              }
              
              // 更新页面数据
              this.loadUserInfo();
              
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

  // 导出所有本地数据为 CSV 文件
  exportAllDataToCSV() {
    wx.showLoading({
      title: '正在导出CSV...'
    });
    
    try {
      // 获取所有数据
      const userInfo = wx.getStorageSync('userInfo') || {};
      const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      const shifts = wx.getStorageSync('shifts') || {};
      
      // 构造CSV内容
      let csvContent = '\uFEFF'; // 添加BOM以支持中文
      
      // 添加用户信息
      csvContent += '用户信息\n';
      csvContent += '昵称,头像URL\n';
      csvContent += `"${userInfo.nickName || ''}","${userInfo.avatarUrl || ''}"\n\n`;
      
      // 添加班次模板
      csvContent += '班次模板\n';
      csvContent += '名称,开始时间,结束时间,小时数,分钟数,工作时长,类型,颜色\n';
      shiftTemplates.forEach(template => {
        csvContent += `"${template.name || ''}","${template.startTime || ''}","${template.endTime || ''}",${template.hours || 0},${template.minutes || 0},${template.workHours || 0},"${template.type || ''}","${template.color || ''}"\n`;
      });
      
      csvContent += '\n';
      
      // 添加排班记录
      csvContent += '排班记录\n';
      csvContent += '日期,班次名称,开始时间,结束时间,工作时长\n';
      Object.keys(shifts).forEach(date => {
        const dayShifts = shifts[date];
        if (Array.isArray(dayShifts)) {
          dayShifts.forEach(shift => {
            csvContent += `"${date}","${shift.shiftName || ''}","${shift.startTime || ''}","${shift.endTime || ''}",${shift.workHours || 0}\n`;
          });
        }
      });
      
      // 获取自定义文件名
      const customFileName = this.data.exportFileName;
      const fileName = customFileName ? customFileName : `sywork_backup_${Date.now()}`;
      
      // 创建临时文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}.csv`;
      
      fs.writeFile({
        filePath: filePath,
        data: csvContent,
        encoding: 'utf8',
        success: () => {
          // 保存文件到本地
          wx.saveFile({
            tempFilePath: filePath,
            success: (res) => {
              wx.hideLoading();
              wx.showToast({
                title: '导出成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('保存文件失败', err);
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
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
      console.error('导出CSV失败', e);
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      });
    }
  },

  // 导入 CSV 文件并恢复数据
  importAllDataFromCSV() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: res => {
        wx.showLoading({
          title: '正在导入CSV...'
        });
        
        const filePath = res.tempFiles[0].path;
        const fs = wx.getFileSystemManager();
        
        fs.readFile({
          filePath,
          encoding: 'utf8',
          success: r => {
            try {
              const lines = r.data.split('\n');
              if (lines.length < 2) {
                throw new Error('CSV文件格式不正确');
              }
              
              let userInfo = {};
              let shiftTemplates = [];
              let shifts = {};
              
              // 解析CSV数据
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // 简化的CSV解析（实际项目中可能需要更复杂的解析）
                const matches = line.match(/"([^"]*)"|([^,]*)/g);
                if (!matches || matches.length < 3) continue;
                
                const type = matches[0].replace(/^"(.*)"$/, '$1');
                const key = matches[1].replace(/^"(.*)"$/, '$1');
                const value = matches[2].replace(/^"(.*)"$/, '$1');
                
                if (type.startsWith('用户信息')) {
                  userInfo[key] = value;
                } else if (type.startsWith('班次模板')) {
                  const idx = parseInt(type.replace('班次模板', '')) - 1;
                  if (!shiftTemplates[idx]) shiftTemplates[idx] = {};
                  shiftTemplates[idx][key] = value;
                } else if (type === '排班') {
                  const [date, field] = key.split('_');
                  if (!shifts[date]) shifts[date] = {};
                  shifts[date][field] = value;
                }
              }
              
              // 保存数据
              wx.setStorageSync('userInfo', userInfo);
              wx.setStorageSync('shiftTemplates', shiftTemplates);
              wx.setStorageSync('shifts', shifts);
              
              // 更新页面数据
              this.loadUserInfo();
              
              wx.hideLoading();
              wx.showToast({
                title: 'CSV导入成功',
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
              console.error('解析CSV失败', e);
              wx.showToast({
                title: 'CSV解析失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('读取CSV文件失败', err);
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
            title: '未选择文件',
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
            
            // 重新加载页面数据
            this.loadUserInfo();
            
            // 通知其他页面刷新
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