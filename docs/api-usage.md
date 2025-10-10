# API使用说明

## 配置步骤

1. 配置服务器域名：
   - 登录微信公众平台
   - 进入"开发管理"->"开发设置"
   - 在"服务器域名"部分配置request合法域名（必须是HTTPS协议）

2. 在`app.js`的`globalData.config`中配置API密钥和基础URL：
   - 将`your_api_key_here`替换为实际的API密钥
   - 将`https://your-api-domain.com/api`替换为实际的API基础URL

3. 在`config.js`中配置API路径和参数

## API调用示例

### 引入API客户端
```javascript
const api = require('../../utils/api.js');
```

### GET请求
```javascript
// 获取用户信息
const userInfo = await api.get('/user/info');

// 带参数的GET请求
const scheduleData = await api.get('/schedule/list', {
  startDate: '2023-01-01',
  endDate: '2023-12-31'
});
```

### POST请求
```javascript
// 提交数据
const result = await api.post('/schedule/submit', {
  date: '2023-06-15',
  hours: 8,
  description: '项目开发'
});
```

### PUT请求
```javascript
// 更新数据
const result = await api.put('/user/info', {
  name: '张三',
  email: 'zhangsan@example.com'
});
```

### DELETE请求
```javascript
// 删除数据
const result = await api.delete('/schedule/123');
```

## 错误处理

API调用会自动处理网络错误和HTTP状态码错误，但建议在业务代码中添加额外的错误处理：

```javascript
try {
  const data = await api.get('/user/info');
  // 处理成功响应
} catch (error) {
  // 处理错误
  wx.showToast({
    title: '请求失败',
    icon: 'none'
  });
}
```

## 注意事项

1. 敏感信息（如API密钥）应通过环境变量配置，不要硬编码在代码中
2. 所有API请求都需要在微信公众平台配置对应的服务器域名
3. 建议对API响应进行验证，确保数据格式正确
4. 在网络请求时显示加载状态，提升用户体验