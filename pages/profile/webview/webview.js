// pages/profile/webview/webview.js
Page({
  data: {
    url: ''
  },

  onLoad: function (options) {
    if (options.url) {
      this.setData({
        url: decodeURIComponent(options.url)
      });
    } else {
      wx.showToast({
        title: '链接地址无效',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShareAppMessage: function () {
    return {
      title: 'SYwork排班管理系统',
      path: '/pages/profile/profile'
    };
  },

  onShareTimeline: function () {
    return {
      title: 'SYwork排班管理系统'
    };
  }
});