# SYwork 项目规则
## 1. 项目框架
- 微信小程序原生开发框架
- 使用微信小程序原生组件和API：
- 微信小程序组件库（用于开发界面组件）：https://developers.weixin.qq.com/miniprogram/dev/component/
- 微信小程序开发API（用于调用小程序功能接口）：https://developers.weixin.qq.com/miniprogram/dev/api/
- 微信小程序服务端API规范（用于服务端开发）：https://developers.weixin.qq.com/miniprogram/dev/framework/api/
- 微信小程序UI设计规范（用于界面设计参考）：https://github.com/Tencent/weui-wxss/
- 小程序连接腾讯云数据库文档（用于云数据库操作）：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide
- 小程序框架云开发模板（用于云开发参考）：https://github.com/TencentCloudBase/awesome-cloudbase-examples/tree/master/miniprogram/cloudbase-miniprogram-template
- HarmonyOS适配指南（用于HarmonyOS平台适配）：https://developers.weixin.qq.com/miniprogram/dev/framework/ability/ohos.html
- 核心依赖：@babel/runtime ^7.24.0
- 构建工具：Gulp ^4.0.2
- 微信小程序原生组件库：@tencent/weui-wxss ^2.4.1
- 推荐开发库：
  - 网络请求：wx.request（原生API）或 wx-axios
  - 状态管理：miniprogram-redux 或 miniprogram-mobx
  - 工具库：miniprogram-utils、dayjs（日期处理）
  - UI组件：@tencent/weui-wxss、miniprogram-component-plus
  - 图表库：wx-charts、echarts-for-weixin
  - 地图服务：wx.getLocation（原生API）
  - 媒体处理：wx.chooseImage、wx.uploadFile（原生API）
- 开发工具：
  - 微信开发者工具（官方IDE）
  - VS Code + 小程序插件
  - Gulp（构建工具）
-
## 2. 开发规范
- 严格遵循微信小程序开发规范与设计标准
- 使用ES6+语法，保持代码简洁易读
- 缩进使用2个空格，保持代码格式一致
- 变量命名使用驼峰命名法（camelCase）
## 3. 目录结构
- 页面文件：pages/[module]/[page].js
- 组件文件：components/[component]/
- 工具文件：utils/[util].js
- 避免目录层级过深，一般不超过4层
## 4. 命名规范
- 页面文件：小写字母加下划线（如schedule_page.js）
- 组件文件：小写字母加下划线（如custom_picker.wxml）
- 工具文件：小写字母加下划线（如date_utils.js）
- 配置文件：小写字母加下划线（如app_config.js）
## 6. 更新日志规范
- 内容要求：总结性与简洁性，突出核心变更
- 内容分类：新增功能、界面优化、功能调整、问题修复
- 多提交合并：相同类型的变更归为一类
- 格式一致性：保持更新日志的格式一致
- 版本号格式：vX.X.X
- 日期格式：YYYY-MM-DD
## 7. 性能优化
1. **代码优化**
   - 减少不必要的计算和循环
   - 使用防抖和节流优化频繁操作
   - 合理使用setData，避免频繁更新
2. **网络优化**
   - 合理使用缓存，避免重复获取数据
   - 压缩请求数据，减少传输量
   - 使用HTTPS协议，确保数据安全
3. **渲染优化**
   - 优化页面渲染，减少重绘和回流
   - 使用虚拟列表处理长列表
   - 避免在onPageScroll中进行复杂操作
4. **资源优化**
   - 图片资源应进行压缩
   - 使用合适的图片格式和尺寸
   - 合理使用本地存储，避免存储过多数据
## 8. 安全规范
1. **数据安全**
   - 敏感数据应进行加密存储
   - 避免在代码中硬编码敏感信息
   - 使用环境变量管理配置信息
2. **权限管理**
   - 合理设置数据权限，防止越权访问
   - 遵循最小权限原则
   - 对用户输入进行严格验证
3. **代码安全**
   - 避免使用eval等危险函数
   - 防止XSS攻击，对用户输入进行过滤
   - 定期更新依赖，修复安全漏洞
## 9. 文档规范
1. **项目文档**
   - README.md应及时更新，反映项目最新状态
   - 包含项目介绍、快速开始、目录结构等内容
   - 提供详细的API文档和使用说明
2. **代码注释**
   - 关键函数和模块应有清晰的注释
   - 注释应简洁明了，解释代码的用途和实现思路
   - 使用JSDoc规范编写函数注释
3. **变更记录**
   - 保持更新日志的格式一致
   - 记录重要功能变更和问题修复
   - 版本号使用语义化版本（如v1.0.0）
