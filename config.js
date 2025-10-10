// API配置文件
const config = {
  // API基础URL
  baseURL: 'https://your-api-domain.com/api',
  
  // API密钥（通过小程序全局配置设置）
  apiKey: '',
  
  // 其他配置项
  timeout: 10000, // 请求超时时间
  
  // 各个接口的路径
  apiEndpoints: {
    getSchedule: '/schedule/list',
    submitSchedule: '/schedule/submit',
    getStatistics: '/statistics/data',
    exportData: '/export/data'
  }
};

// 在小程序环境中获取全局配置
if (typeof getApp !== 'undefined') {
  const app = getApp();
  if (app && app.globalData && app.globalData.config) {
    Object.assign(config, app.globalData.config);
  }
}

module.exports = config;