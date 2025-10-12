// API配置文件
const config = {
  // API基础URL
  baseURL: 'https://your-api-domain.com/api',
  
  // 各个接口的路径
  apiEndpoints: {
    getSchedule: '/schedule/list',
    submitSchedule: '/schedule/submit',
    getStatistics: '/statistics/data',
    exportData: '/export/data'
  }
};

module.exports = config;