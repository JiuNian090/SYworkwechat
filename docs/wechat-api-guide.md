# 微信小程序API配置和使用指南

## 1. 网络请求API

### 1.1 wx.request
用于发起网络请求，是与后端API交互的主要方式。

**使用示例：**
```javascript
// utils/api.js 中已封装
const api = require('../../utils/api.js');

// GET请求
const userInfo = await api.get('/user/info');

// POST请求
const result = await api.post('/schedule/submit', {
  date: '2023-06-15',
  hours: 8,
  description: '项目开发'
});
```

**配置要求：**
1. 在微信公众平台配置服务器域名
   - 登录微信公众平台
   - 进入"开发管理"->"开发设置"
   - 在"服务器域名"部分配置request域名（必须是HTTPS协议）

2. API密钥配置
   - 在`app.js`的`globalData.config`中配置：
   ```javascript
   globalData: {
     // API配置信息
     config: {
       apiKey: 'your_api_key_here', // 请替换为实际的API密钥
       baseURL: 'https://your-api-domain.com/api' // 请替换为实际的API基础URL
     }
   }
   ```

## 2. 本地数据存储API

### 2.1 wx.getStorageSync / wx.setStorageSync
用于本地数据的持久化存储，实现用户信息、班次模板等数据的保存。

**使用示例：**
```javascript
// 读取班次模板
const templates = wx.getStorageSync('shiftTemplates') || [];

// 保存班次模板
wx.setStorageSync('shiftTemplates', templates);

// 读取用户信息
const userInfo = wx.getStorageSync('userInfo');

// 保存用户信息
wx.setStorageSync('userInfo', userInfo);

// 读取排班数据
const shifts = wx.getStorageSync('shifts') || {};

// 保存排班数据
wx.setStorageSync('shifts', shifts);
```

### 2.2 数据管理API
用于数据的导出、导入和清空功能，支持将班次模板、排班数据等整合成JSON文件进行备份和迁移。

**导出数据方法：**
```javascript
// 导出数据到JSON文件
exportData() {
  // 获取本地存储的班次模板和排班数据
  const data = {
    shiftTemplates: wx.getStorageSync('shiftTemplates') || [],
    shifts: wx.getStorageSync('shifts') || {}
  };
  
  // 计算统计数据
  // ...统计逻辑...
  
  // 添加统计数据到导出数据中
  data.statistics = statisticsData;
  
  // 创建JSON文件并分享
  // ...文件创建和分享逻辑...
}
```

**导入数据方法：**
```javascript
// 从JSON文件导入数据
importData() {
  // 选择JSON文件
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    extension: ['json'],
    success: (res) => {
      // 读取并解析文件内容
      // ...文件读取逻辑...
      
      // 验证数据格式
      // ...数据验证逻辑...
      
      // 保存数据到本地存储
      if (data.shiftTemplates) {
        wx.setStorageSync('shiftTemplates', data.shiftTemplates);
      }
      if (data.shifts) {
        wx.setStorageSync('shifts', data.shifts);
      }
      
      // 刷新相关页面数据
      // ...页面刷新逻辑...
    }
  });
}
```

**清空数据方法：**
```javascript
// 清空所有相关数据
clearAllData() {
  // 清空所有相关的本地存储数据
  wx.removeStorageSync('shiftTemplates');
  wx.removeStorageSync('shifts');
  wx.removeStorageSync('userInfo');
  // 如果还有其他需要清空的数据，可以在这里添加
  
  // 刷新所有相关页面数据
  const pages = getCurrentPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page.route === 'pages/plan/plan') {
      // 重新加载班次模板数据（空数组）
      if (page.loadShiftTemplates) {
        page.loadShiftTemplates();
      }
    } else if (page.route === 'pages/schedule/schedule') {
      // 重新加载排班数据（空对象）和班次模板
      if (page.loadShifts) {
        page.loadShifts();
      }
      if (page.loadShiftTemplates) {
        page.loadShiftTemplates();
      }
      // 重新生成日期数据
      if (page.generateWeekDates) {
        page.generateWeekDates();
      }
      if (page.generateMonthDates) {
        page.generateMonthDates();
      }
    } else if (page.route === 'pages/statistics/statistics') {
      // 重新计算统计数据（应该为空）
      if (page.calculateStatistics) {
        page.calculateStatistics();
      }
    }
  }
}
```

**数据结构说明：**
1. **shiftTemplates（班次模板）**：包含用户创建的所有班次模板，保留排列顺序
2. **shifts（排班数据）**：包含用户所有的排班记录，以日期为键的键值对结构
3. **statistics（统计数据）**：根据排班数据实时计算生成的统计信息



## 3. 用户登录和信息API

### 3.1 微信登录流程
当前项目中已实现基础的登录框架，但需要完善实际的登录逻辑。

**涉及的API：**
- `wx.login()` - 获取登录凭证code
- `wx.getUserProfile()` - 获取用户基本信息（推荐）
- `wx.getUserInfo()` - 获取用户信息（已废弃推荐使用getUserProfile）

**建议实现流程：**
1. 用户点击登录按钮触发登录
2. 调用`wx.login()`获取code
3. 将code发送到后端服务器换取session_key和openid
4. 调用`wx.getUserProfile()`获取用户基本信息
5. 将用户信息和登录状态保存到本地存储

### 3.2 当前项目登录实现
```javascript
// app.js 中的基础登录方法
loginWithWeChat(callback) {
  // 提示用户需要通过界面按钮触发登录
  wx.showToast({
    title: '请通过界面按钮登录',
    icon: 'none'
  });
  callback && callback(null);
}
```

## 4. 界面交互API

### 4.1 wx.showToast
显示消息提示框，用于向用户展示操作结果。

**使用示例：**
```javascript
wx.showToast({
  title: '操作成功',
  icon: 'success'
});

wx.showToast({
  title: '操作失败',
  icon: 'none'
});
```

### 4.2 wx.showLoading / wx.hideLoading
显示/隐藏加载提示框，用于网络请求等耗时操作。

**使用示例：**
```javascript
wx.showLoading({
  title: '加载中...'
});

// 操作完成后隐藏
wx.hideLoading();
```

### 4.3 wx.showModal
显示模态对话框，用于重要信息提示或用户确认操作。

**使用示例：**
```javascript
wx.showModal({
  title: '提示',
  content: '确定要删除这个班次吗？',
  success: function(res) {
    if (res.confirm) {
      // 用户点击确定
    } else if (res.cancel) {
      // 用户点击取消
    }
  }
});
```

## 5. 权限配置

### 5.1 文件系统权限
已在`app.json`中配置了文件系统读写权限：

```json
"permission": {
  "filescope.read": {
    "desc": "用于读取小程序内的文件"
  },
  "filescope.write": {
    "desc": "用于写入小程序内的文件"
  }
}
```

### 5.2 权限说明
- `filescope.read` - 允许小程序读取本地文件
- `filescope.write` - 允许小程序写入本地文件

## 6. 配置步骤总结

### 6.1 服务器域名配置
1. 登录微信公众平台
2. 进入"开发管理"->"开发设置"
3. 在"服务器域名"部分配置以下域名：
   - request合法域名
   - socket合法域名
   - uploadFile合法域名
   - downloadFile合法域名

### 6.2 API密钥配置
1. 修改`app.js`中的`globalData.config`：
   ```javascript
   config: {
     apiKey: '实际的API密钥',
     baseURL: '实际的API基础URL'
   }
   ```

### 6.3 文件系统权限
已默认配置，无需额外操作。

## 7. 注意事项

1. 所有网络请求必须使用HTTPS协议
2. 服务器域名需要在微信公众平台进行配置
3. 敏感信息（如API密钥）不应硬编码在代码中
4. 文件操作需要相应的权限配置
5. 用户信息获取需要用户主动触发授权