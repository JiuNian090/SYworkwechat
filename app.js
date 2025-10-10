// app.js
App({
  globalData: {
    // API配置信息
    config: {
      apiKey: 'your_api_key_here', // 请替换为实际的API密钥
      baseURL: 'https://your-api-domain.com/api' // 请替换为实际的API基础URL
    }
  },

  onLaunch() {
    // 小程序初始化
    console.log('小程序已启动');
  }
});