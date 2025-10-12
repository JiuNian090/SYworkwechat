// pages/profile/support/support.js
Page({
  data: {

  },

  onLoad: function (options) {

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
  },

  // 回到首页
  goHome: function() {
    wx.switchTab({
      url: '/pages/plan/plan'
    });
  }
});