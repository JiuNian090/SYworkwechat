# SYwork 项目规则
## 1. 项目框架
- 微信小程序原生开发框架
- 使用微信小程序原生组件和API：
- 微信小程序组件库（用于开发界面组件）：https://developers.weixin.qq.com/miniprogram/dev/component/
TDesign：https://tdesign.tencent.com/miniprogram/overview
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
- 内容要求：先查看所有提交，然后总结与精简变更内容，突出核心变更，使用面向用户的写法规范，更新完成后再更新readme.md文件
- 内容分类：
  - 新增：添加的新功能
  - 优化：界面或功能的改进
  - 修复：bug修复
  - 调整：功能或逻辑的调整
- 格式规范：
  - 版本标题使用 `## vX.X.X (YYYY-MM-DD)` 格式
  - 每条变更使用 `- 分类：变更描述` 格式
  - 从最新版本到旧版本排序
  - 多提交合并：相同类型的变更归为一类
  - 格式一致性：保持更新日志的格式一致
- 版本号格式：vX.X.X
- 日期格式：YYYY-MM-DD
- 面向用户的写法规范：
  - 使用生动的emoji图标增强可读性（如🎉、✨、⚡、🎨、🔧）
  - 语言友好易懂，避免技术性细节
  - 突出功能对用户的价值和好处
  - 精简描述，只保留用户愿意看到的内容
  - 多提交合并时，只保留一个版本（合并中间版本）
  - 示例：`- 🎉 新增：账号切换和记住密码功能，多账号使用更方便`

## 7. 版本管理规范
- 版本号配置：在 `project.config.json` 中配置小程序版本号
- 版本号同步：
  - 使用 `version-manager.js` 脚本自动同步版本号
  - 版本号来源：从 `CHANGELOG.md` 中提取最新版本号
  - 同步文件：`package.json`、`project.config.json` 和 `utils/versionInfo.js`
- 构建流程：
  - 执行 `npm run build` 时自动更新版本号
  - 确保版本号与更新日志保持一致
- 版本号格式：遵循语义化版本规范 (vX.X.X)

## 8. 性能优化
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
## 9. 安全规范
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
## 10. 文档规范
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

## 11. 备份系统版本规则
1. **版本号格式**
   - 采用语义化版本规范：vX.X.X
   - X为非负整数，从0开始
   - 格式：主版本号.次版本号.修订号
   - 示例：v1.0.0, v1.1.0, v2.0.0

2. **版本号更新规则**
   - **主版本号**：当备份系统架构发生重大变化，不兼容旧版本时更新
   - **次版本号**：当添加新功能，兼容旧版本时更新
   - **修订号**：当修复bug，不影响功能兼容性时更新

3. **版本检查逻辑**
   - 备份时：前端传递当前版本号，云端与存储的版本号比较
   - 恢复时：前端检查云端备份的版本号与本地版本号的兼容性

4. **数据处理策略**
   - **版本兼容**：当本地版本 >= 备份版本时，正常恢复数据
   - **版本不兼容**：当本地版本 < 备份版本时，提示用户更新小程序
   - **版本更新**：当本地版本 > 云端版本时，强制更新云端数据结构

5. **版本号管理**
   - 前端：在 CloudManager 类中定义 BACKUP_SYSTEM_VERSION 常量
   - 后端：在 backupRestore 云函数中定义 BACKUP_SYSTEM_VERSION 常量
   - 同步更新：前端和后端的版本号应保持一致

6. **代码更新规范**
   - 每次修改备份系统代码时，应更新相应的版本号
   - 在提交代码时，应在提交信息中说明版本号的变更原因
   - 确保版本号的变更符合语义化版本规范
