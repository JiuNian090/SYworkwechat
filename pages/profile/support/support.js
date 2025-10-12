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
  }
});