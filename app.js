// app.js
App({
  globalData: {
    userInfo: null,
    hasLogin: false,
    // API配置信息
    config: {
      apiKey: 'your_api_key_here', // 请替换为实际的API密钥
      baseURL: 'https://your-api-domain.com/api' // 请替换为实际的API基础URL
    }
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