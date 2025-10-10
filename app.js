// app.js
App({
  globalData: {
    userInfo: null,
    hasLogin: false
  },

  onLaunch() {
    // 小程序初始化时检查是否已有用户信息
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    try {
      // 从本地存储获取用户信息
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.nickName) {
        this.globalData.userInfo = userInfo;
        this.globalData.hasLogin = true;
      }
    } catch (e) {
      console.error('检查登录状态失败', e);
    }
  },

  // 微信登录获取用户信息
  loginWithWeChat(callback) {
    // 提示用户需要通过界面按钮触发登录
    wx.showToast({
      title: '请通过界面按钮登录',
      icon: 'none'
    });
    callback && callback(null);
  }
});