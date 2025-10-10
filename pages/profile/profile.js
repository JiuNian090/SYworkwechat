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
  }
});