// pages/profile/profile.js
Page({
  data: {
    userInfo: {
      avatarUrl: '/images/default_avatar.png',
      nickName: '用户'
    },
    showEditModal: false,
    editUserInfo: {
      nickName: ''
    }
  },

  onLoad() {
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
    }
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

  editNickname() {
    this.setData({
      showEditModal: true,
      editUserInfo: {
        nickName: this.data.userInfo.nickName
      }
    });
  },

  hideEditModal() {
    this.setData({
      showEditModal: false
    });
  },

  onNicknameInput(e) {
    this.setData({
      'editUserInfo.nickName': e.detail.value
    });
  },

  saveNickname() {
    const { editUserInfo, userInfo } = this.data;
    
    if (!editUserInfo.nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      });
      return;
    }
    
    const newUserInfo = {
      ...userInfo,
      nickName: editUserInfo.nickName
    };
    
    this.setData({
      userInfo: newUserInfo,
      showEditModal: false
    });
    
    try {
      wx.setStorageSync('userInfo', newUserInfo);
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } catch (e) {
      console.error('保存昵称失败', e);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  exportData() {
    try {
      const data = {
        userInfo: wx.getStorageSync('userInfo') || {},
        shiftTemplates: wx.getStorageSync('shiftTemplates') || [],
        shifts: wx.getStorageSync('shifts') || {}
      };
      
      const jsonData = JSON.stringify(data, null, 2);
      const base64Data = wx.base64ToArrayBuffer(wx.arrayBufferToBase64(new TextEncoder().encode(jsonData)));
      
      wx.downloadFile({
        url: 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonData),
        success: (res) => {
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: (saveRes) => {
              wx.showToast({
                title: '导出成功',
                icon: 'success'
              });
            },
            fail: () => {
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            }
          });
        },
        fail: () => {
          wx.showToast({
            title: '导出失败',
            icon: 'none'
          });
        }
      });
    } catch (e) {
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
        const filePath = res.tempFiles[0].path;
        
        wx.getFileSystemManager().readFile({
          filePath: filePath,
          encoding: 'utf-8',
          success: (readRes) => {
            try {
              const data = JSON.parse(readRes.data);
              
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
              
              wx.showToast({
                title: '导入成功',
                icon: 'success'
              });
              
              // 刷新其他页面数据
              const pages = getCurrentPages();
              pages.forEach(page => {
                if (page.route === 'pages/plan/plan') {
                  page.loadShiftTemplates();
                } else if (page.route === 'pages/schedule/schedule') {
                  page.loadShifts();
                  page.generateWeekDates();
                  page.generateMonthDates();
                }
              });
            } catch (e) {
              console.error('解析数据失败', e);
              wx.showToast({
                title: '数据格式错误',
                icon: 'none'
              });
            }
          },
          fail: () => {
            wx.showToast({
              title: '读取文件失败',
              icon: 'none'
            });
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
    },

    // 导出所有本地数据为 CSV 文件
    exportAllDataToCSV() {
      try {
        const userInfo = wx.getStorageSync('userInfo') || {};
        const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
        const shifts = wx.getStorageSync('shifts') || {};
        // 统计数据可按需扩展

        let csv = '类型,字段,内容\n';
        // 用户信息
        Object.keys(userInfo).forEach(key => {
          csv += `用户信息,${key},${userInfo[key]}\n`;
        });
        // 班次模板
        shiftTemplates.forEach((tpl, idx) => {
          Object.keys(tpl).forEach(key => {
            csv += `班次模板${idx+1},${key},${tpl[key]}\n`;
          });
        });
        // 排班信息
        Object.keys(shifts).forEach(date => {
          const shift = shifts[date];
          Object.keys(shift).forEach(key => {
            csv += `排班,${date}_${key},${shift[key]}\n`;
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
            wx.openDocument({ filePath, fileType: 'csv' });
            wx.showToast({ title: 'CSV已生成', icon: 'success' });
          },
          fail: () => {
            wx.showToast({ title: '导出失败', icon: 'none' });
          }
        });
      } catch (e) {
        wx.showToast({ title: '导出异常', icon: 'none' });
      }
    },

    // 导入 CSV 文件并恢复数据
    importAllDataFromCSV() {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['csv'],
        success: res => {
          const filePath = res.tempFiles[0].path;
          const fs = wx.getFileSystemManager();
          fs.readFile({
            filePath,
            encoding: 'utf8',
            success: r => {
              try {
                const lines = r.data.split('\n');
                let userInfo = {};
                let shiftTemplates = [];
                let shifts = {};
                let tplIdx = -1;
                lines.forEach(line => {
                  const arr = line.split(',');
                  if (arr[0].startsWith('用户信息')) {
                    userInfo[arr[1]] = arr[2];
                  } else if (arr[0].startsWith('班次模板')) {
                    const idx = parseInt(arr[0].replace('班次模板','')) - 1;
                    if (!shiftTemplates[idx]) shiftTemplates[idx] = {};
                    shiftTemplates[idx][arr[1]] = arr[2];
                  } else if (arr[0] === '排班') {
                    const [date, key] = arr[1].split('_');
                    if (!shifts[date]) shifts[date] = {};
                    shifts[date][key] = arr[2];
                  }
                });
                wx.setStorageSync('userInfo', userInfo);
                wx.setStorageSync('shiftTemplates', shiftTemplates);
                wx.setStorageSync('shifts', shifts);
                this.loadUserInfo();
                wx.showToast({ title: 'CSV导入成功', icon: 'success' });
              } catch (e) {
                wx.showToast({ title: 'CSV解析失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.showToast({ title: '读取文件失败', icon: 'none' });
            }
          });
        },
        fail: () => {
          wx.showToast({ title: '未选择文件', icon: 'none' });
        }
      });
    },
    
    // 清空所有数据
    clearAllData() {
      wx.showModal({
        title: '确认清空',
        content: '确定要清空所有数据吗？此操作不可恢复！',
        success: (res) => {
          if (res.confirm) {
            try {
              wx.clearStorageSync();
              wx.showToast({
                title: '数据已清空',
                icon: 'success'
              });
              // 重新加载页面数据
              this.loadUserInfo();
            } catch (e) {
              wx.showToast({
                title: '清空失败',
                icon: 'none'
              });
            }
          }
        }
      });
    }
  }
);