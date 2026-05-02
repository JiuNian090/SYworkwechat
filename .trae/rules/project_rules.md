# SYwork 项目规则

> 开发方法论见同级 [karpathy-rules.md](file:///e:/Code/SYworkwechat/.trae/rules/karpathy-rules.md)，此处仅保留项目独有规则。

## 1. 项目框架
- 框架：微信小程序原生开发框架（TypeScript）
- 核心依赖：crypto-js ^4.2.0
- 构建工具：version-manager.js（版本同步）、sync_changelog.js（更新日志同步）
- 类型定义：miniprogram-api-typings ^3.12.3 | types/ 目录自定义类型声明
- 推荐库：dayjs（日期）、wx-charts / echarts-for-weixin（图表）
- 微信官方文档：https://developers.weixin.qq.com/miniprogram/dev/

## 2. 目录结构
```
├── pages/                  # 主包页面
│   ├── schedule/           # 排班页面
│   ├── plan/               # 计划页面
│   ├── statistics/         # 统计页面
│   ├── profile/            # 个人中心
│   └── user-manage/        # 用户管理
├── subpkg-common/          # 公共分包
│   └── pages/docs/         # 文档/说明页面
├── components/             # 公共组件
│   ├── chart-view/         # 图表组件
│   ├── color-picker/       # 颜色选择器
│   └── shift-selector/     # 班次选择器
├── utils/                  # 工具函数（TypeScript）
├── types/                  # 自定义类型声明（.d.ts）
├── cloudfunctions/         # 云函数
│   ├── backupRestore/      # 备份恢复
│   └── userLogin/          # 用户登录
└── vendor/                 # 第三方库（如 jszip.min.js）
```

## 3. 代码规范
- 语言：TypeScript（.ts），构建脚本为 JavaScript（.js）
- 2 空格缩进，驼峰命名
- 页面文件：`pages/[module]/[page].ts` | 组件：`components/[component]/` | 工具：`utils/[util].ts`
- 文件命名：小写字母加下划线（如 `schedule_page.ts`、`date_utils.ts`）
- 类型声明文件统一放在 `types/` 目录
- 目录层级不超过 4 层

## 4. TypeScript 配置
- 配置文件：`tsconfig.json`
- 编译目标：ES2017 | 模块：CommonJS | 严格模式开启
- 路径别名：`@/*` → `./*`
- 检查命令：`npm run tsc:check`（`tsc --noEmit`）
- 排除：node_modules、cloudfunctions、vendor、miniprogram_dist

## 5. ESLint 配置
- 配置文件：`eslint.config.js`（flat config 格式）
- 文件分组：`*.js` / `*.ts` / `cloudfunctions/**/*.js` / 构建脚本，各组独立规则
- TS 规则：`@typescript-eslint` 插件，`no-unused-vars` 等基础规则由 TS 插件接管
- 忽略目录：node_modules、miniprogram_npm、vendor、.trae、miniprogram_dist
- 检查命令：`npm run lint` | 自动修复：`npm run lint:fix`

## 6. 配置与安全
- 密钥配置：通过 `env.js` 文件管理（不入库），`config.ts` 读取
- `env.js` 缺失时 `config.ts` 以空字符串兜底并打印 warn
- 用户数据 AES 加密存储，禁止明文
- 避免 eval 等危险函数，过滤用户输入防 XSS
- 最小权限原则，定期更新依赖

## 7. 更新日志规范
- 分类：🎉 新增 / ✨ 优化 / 🔧 修复 / ⚡ 调整 / 🏗️ 重构 / 📊 图表 / 🎨 样式
- 格式：`- 分类：面向用户的变更描述`
- 版本标题：`## vX.X.X (YYYY-MM-DD)`，从最新到最旧排序
- `sync_changelog.js` 自动同步 CHANGELOG.md → utils/changelog.ts

## 8. 版本管理规范
- 版本号来源：CHANGELOG.md 最新版本标题
- `version-manager.js` 自动同步到：`package.json`、`project.config.json`、`utils/versionInfo.js`
- `npm run build` = tsc 检查 + 版本同步 + 更新日志同步
- 格式：语义化版本 vX.X.X

## 9. 性能优化要点
- 减少 setData 频率和数据量 | 防抖节流频繁操作
- 合理缓存网络请求，避免重复获取
- 图片压缩，合适格式和尺寸
- 虚拟列表处理长列表，避免 onPageScroll 中复杂操作

## 10. 备份系统版本规则
- 格式：语义化版本 vX.X.X（主版本.次版本.修订号）
- 前端 `config.backupSystemVersion` 与云函数 `backupRestore/index.js` 中 BACKUP_SYSTEM_VERSION 保持同步
- 本地版本 >= 备份版本 → 正常恢复 | 本地版本 < 备份版本 → 提示更新 | 本地版本 > 云端版本 → 强制更新云端
