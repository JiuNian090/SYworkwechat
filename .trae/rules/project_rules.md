# SYwork 项目规则

> Caveman 交流风格 + Karpathy 开发方法论见同级 [karpathy-rules.md](file:///e:/Code/SYworkwechat/.trae/rules/karpathy-rules.md)，此处仅保留项目独有规则。

## 1. 项目框架
- 框架：微信小程序原生开发框架
- 核心依赖：@babel/runtime ^7.24.0 | 构建工具：Gulp ^4.0.2 | UI 组件库：@tencent/weui-wxss ^2.4.1
- 推荐库：dayjs（日期）、wx-charts / echarts-for-weixin（图表）、miniprogram-redux / miniprogram-mobx（状态管理）
- 官方文档：https://developers.weixin.qq.com/miniprogram/dev/

## 2. 代码规范
- ES6+，2 空格缩进，驼峰命名
- 页面文件：`pages/[module]/[page].js` | 组件：`components/[component]/` | 工具：`utils/[util].js`
- 文件命名：小写字母加下划线（如 `schedule_page.js`、`date_utils.js`）
- 目录层级不超过 4 层

## 3. 更新日志规范
- 分类：🎉 新增 / ✨ 优化 / 🔧 修复 / ⚡ 调整
- 格式：`- 分类：面向用户的变更描述`，使用 emoji 增强可读性
- 版本标题：`## vX.X.X (YYYY-MM-DD)`，从最新到最旧排序

## 4. 版本管理规范
- 版本号在 `project.config.json` 中配置，`version-manager.js` 自动同步
- 同步文件：`package.json`、`project.config.json`、`utils/versionInfo.js`
- 执行 `npm run build` 时自动更新版本号
- 格式：语义化版本 vX.X.X

## 5. 性能优化要点
- 减少 setData 频率和数据量 | 防抖节流频繁操作
- 合理缓存网络请求，避免重复获取
- 图片压缩，合适格式和尺寸
- 虚拟列表处理长列表，避免 onPageScroll 中复杂操作

## 6. 安全规范要点
- 用户数据 AES 加密存储，禁止明文
- 避免 eval 等危险函数，过滤用户输入防 XSS
- 最小权限原则，定期更新依赖

## 7. 备份系统版本规则
- 格式：语义化版本 vX.X.X（主版本.次版本.修订号）
- 前端 `CloudManager.BACKUP_SYSTEM_VERSION` 与云函数 `backupRestore.BACKUP_SYSTEM_VERSION` 保持同步
- 本地版本 >= 备份版本 → 正常恢复 | 本地版本 < 备份版本 → 提示更新 | 本地版本 > 云端版本 → 强制更新云端
