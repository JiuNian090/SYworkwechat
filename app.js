// app.js
App({
  onLaunch() {
    // 小程序初始化
    console.log('小程序已启动');
  },

  // 全局好友分享配置
  onShareAppMessage() {
    return {
      title: 'SYwork排班管理系统',
      path: '/pages/plan/plan'
    };
  },

  // 全局朋友圈分享配置
  onShareTimeline() {
    return {
      title: 'SYwork排班管理系统',
      query: ''
    };
  }
});