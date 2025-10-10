// pages/profile/profile.js
Page({
  data: {
    userInfo: {
      avatarUrl: '/images/default_avatar.png',
      nickName: '用户'
    },
    hasLogin: false
  },

  onLoad() {
    this.loadUserInfo();
    // 检查登录状态
    this.checkLoginStatus();
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

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    const { userInfo } = this.data;
    
    const newUserInfo = {
      ...userInfo,
      avatarUrl: avatarUrl
    };
    
    this.setData({
      userInfo: newUserInfo
    });
    
    try {
      wx.setStorageSync('userInfo', newUserInfo);
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('保存头像失败', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
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
      
      // 创建临时文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/sywork_backup_${Date.now()}.json`;
      
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
      const userInfo = wx.getStorageSync('userInfo') || {};
      const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
      const shifts = wx.getStorageSync('shifts') || {};
      
      // 构建CSV内容
      let csv = '类型,字段,内容\n';
      
      // 用户信息
      Object.keys(userInfo).forEach(key => {
        // 转义CSV特殊字符
        const value = String(userInfo[key]).replace(/"/g, '""');
        csv += `用户信息,${key},"${value}"\n`;
      });
      
      // 班次模板
      shiftTemplates.forEach((tpl, idx) => {
        Object.keys(tpl).forEach(key => {
          const value = String(tpl[key]).replace(/"/g, '""');
          csv += `班次模板${idx+1},${key},"${value}"\n`;
        });
      });
      
      // 排班信息
      Object.keys(shifts).forEach(date => {
        const shift = shifts[date];
        Object.keys(shift).forEach(key => {
          const value = String(shift[key]).replace(/"/g, '""');
          csv += `排班,${date}_${key},"${value}"\n`;
        });
      });
      
      // 保存为文件
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/sywork_backup_${Date.now()}.csv`;
      
      fs.writeFile({
        filePath,
        data: csv,
        encoding: 'utf8',
        success: () => {
          wx.saveFile({
            tempFilePath: filePath,
            success: (res) => {
              wx.hideLoading();
              wx.showToast({
                title: 'CSV导出成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('保存CSV文件失败', err);
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
          });
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('写入CSV文件失败', err);
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
        title: '导出异常',
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