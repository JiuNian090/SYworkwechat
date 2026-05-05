# SYwork 项目规则

> 更新于 2026-05-05 | 项目版本 v4.0.0 (TypeScript) | 云函数已拆分为 backup / restore / cleanup

## 1. 项目框架
- **框架**：微信小程序原生开发框架（TypeScript）
- **语言**：TypeScript（.ts），构建/工具脚本保留 JavaScript（.js）
- **核心依赖**：crypto-js ^4.2.0（AES 加密）
- **开发依赖**：typescript ^5.5.4, eslint ^10.2.1, miniprogram-api-typings ^3.12.3, @typescript-eslint/* ^8.29.0
- **类型声明**：types/ 目录（10 个 .d.ts 文件）+ miniprogram-api-typings
- **包管理**：npm
- **微信官方文档**：https://developers.weixin.qq.com/miniprogram/dev/

## 2. 目录结构
```
SYworkwechat/
├── app.ts                   # 小程序入口
├── app.json                 # 全局页面路由配置
├── config.ts                # 全局配置（云环境、集合名、备份版本号）
│
├── pages/                   # 5 个主包页面
│   ├── plan/                # 计划管理 - 班次模板 CRUD + 颜色选择
│   ├── schedule/            # 排班视图（首页tab）- 周/月日历
│   ├── statistics/          # 数据统计 - 图表分析、热力图、CSV导出
│   ├── profile/             # 个人中心 - 云备份、导入导出、今日心语
│   └── user-manage/         # 用户管理 - 多账户切换
│
├── components/              # 3 个公共组件
│   ├── chart-view/          # Canvas 2D 统计图表
│   ├── color-picker/        # 颜色选择器
│   └── shift-selector/      # 班次选择器
│
├── subpkg-common/           # 分包（非核心功能）
├── utils/                   # 核心工具层（16 个 .ts 文件）
│   ├── store.ts             # 自研发布订阅 Store（内存 + Storage 双写）
│   ├── cloudManager.ts      # 云同步封装（哈希比对 + 增量同步）
│   ├── dataExportManager.ts # 数据导出（ZIP 格式）
│   ├── dataImportManager.ts # 数据导入
│   └── ...                  # 日期、加密、存储、头像等其他工具
├── types/                   # TypeScript 类型定义（10 个 .d.ts 文件）
├── cloudfunctions/          # 云函数（4 个，保持 JS）
│   ├── backup/              # 数据备份
│   ├── restore/             # 数据恢复
│   ├── cleanup/             # 数据清理
│   └── userLogin/           # 用户登录
├── HeartBeat/               # 架构参考文档（与 .trae/ 同步维护）
├── config/                  # ESLint 配置
│   └── eslint.config.js
└── tsconfig.json
```

## 3. 代码规范
- **语言**：TypeScript（.ts），严格模式开启
- **缩进**：2 空格
- **命名**：驼峰命名（camelCase）
  - 页面/组件文件名：小写+连字符（如 `chart-view.ts`）
  - 工具文件名：驼峰（如 `cloudManager.ts`、`dataExportManager.ts`）
  - 类型文件名：点分隔（如 `shift.d.ts`、`store.d.ts`）
- **页面结构**：`pages/[module]/[page].ts` + `.wxml` + `.wxss` + `.json`
- **组件结构**：`components/[component]/` 同名四件套
- **类型声明**：统一放在 `types/` 目录，不在业务文件中内联复杂类型
- **目录层级**：不超过 4 层

## 4. TypeScript 配置
- **配置文件**：`tsconfig.json`
- **编译目标**：ES2017 | 模块：CommonJS | 严格模式开启
- **路径别名**：`@/*` → `./*`
- **检查命令**：`npm run tsc:check`（`tsc --noEmit`）
- **排除目录**：node_modules、cloudfunctions、vendor、miniprogram_dist
- **类型来源**：miniprogram-api-typings + types/ 自定义声明

## 5. ESLint 配置
- **配置文件**：`eslint.config.js`（flat config 格式）
- **文件分组**：`*.js`、`*.ts`、`cloudfunctions/**/*.js`、构建脚本，各组独立规则
- **TS 规则**：`@typescript-eslint` 插件接管 `no-unused-vars` 等基础规则
- **忽略目录**：node_modules、miniprogram_npm、vendor、.trae、miniprogram_dist
- **检查命令**：`npm run lint` | 自动修复：`npm run lint:fix`

## 6. 构建命令
```bash
npm run build      # tsc --noEmit + 版本同步 + changelog 同步
npm run dev        # 版本同步 + changelog 同步（不含 TS 编译检查）
npm run lint       # ESLint 检查
npm run lint:fix   # 自动修复
npm run tsc:check  # TypeScript 编译检查
```

## 7. 配置与安全
- **密钥配置**：通过 `env.js` 文件管理（不入库），`config.ts` 读取
- `env.js` 缺失时 `config.ts` 以空字符串兜底并打印 warn
- 用户数据 AES-256-CBC 加密存储（CryptoJS），禁止明文
- 密钥由设备指纹（model + platform + system + sdkVersion + version + language）通过 SHA256 派生
- 兼容旧版 XOR 加密格式，新数据统一使用 AES
- 避免 eval 等危险函数，过滤用户输入防 XSS

## 8. 更新日志规范
- **分类**：🎉 新增 / ✨ 优化 / 🔧 修复 / ⚡ 调整 / 🏗️ 重构 / 📊 图表 / 🎨 样式
- **格式**：`- 分类：面向用户的变更描述`
- **版本标题**：`## vX.X.X (YYYY-MM-DD)`，最新到最旧排序
- **同步**：`sync_changelog.js` 自动同步 CHANGELOG.md → utils/changelog.ts

## 9. 版本管理规范
- **版本号来源**：CHANGELOG.md 最新版本标题
- **自动同步**：`version-manager.js` 将版本号同步到 package.json、project.config.json、utils/versionInfo.js
- **格式**：语义化版本 vX.X.X

## 10. 备份系统版本规则
- **前端位置**：`config.ts` 的 `backupSystemVersion` 字段
- **云函数位置**：`cloudfunctions/backup/index.js`、`restore/index.js`、`cleanup/index.js` 中 `BACKUP_SYSTEM_VERSION`
- **必须保持所有版本号一致**
- **恢复逻辑**：本地 >= 备份 → 正常恢复 | 本地 < 备份 → 提示更新 | 本地 > 云端 → 强制更新云端

## 11. 云数据库集合
| 集合名 | config.ts Key | 用途 |
|---|---|---|
| schedule_users | collections.users | 用户账号信息 |
| schedule_data_backups | collections.dataBackups | 排班数据备份（主数据） |
| schedule_image_backups | collections.imageBackups | 排班图片备份 |
