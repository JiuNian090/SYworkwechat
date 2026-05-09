# SYwork 微信小程序 Code Wiki

> 文档版本：v4.1.0 | 更新日期：2026-05-10

---

## 一、项目概述

### 1.1 项目简介

SYwork 是一款基于微信小程序的工时记录与排班管理系统，主要功能包括：

- **排班管理**：周视图/月视图日历，支持班次模板自定义
- **计划管理**：班次模板的增删改查，颜色配置
- **数据统计**：工时统计图表（折线图、柱状图、饼图），CSV 数据导出
- **云同步**：微信云开发支持，数据备份与恢复
- **多账户**：支持本地多账户切换与云账户登录
- **深色模式**：自动跟随系统主题切换，支持浅色/深色主题
- **主题色**：统一绿色系主题，使用 CSS 变量管理

### 1.2 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | 微信小程序原生框架 |
| 语言 | TypeScript 5.5.4 |
| 状态管理 | 自研 Store（发布订阅模式） |
| 云服务 | 微信云开发（云函数 + 云数据库） |
| 加密 | CryptoJS 4.2.0（AES-256-CBC） |
| 压缩 | JSZip（数据导出 ZIP 格式） |
| 图表 | Canvas 2D 自绘 |

### 1.3 项目结构

```
SYworkwechat/
├── app.ts                      # 小程序入口
├── app.json                    # 全局页面路由和 TabBar 配置
├── config.ts                   # 全局配置（云环境、版本号等）
│
├── pages/                      # 5 个主包页面
│   ├── plan/                   # 计划管理 - 班次模板 CRUD
│   ├── schedule/               # 排班视图（首页 Tab）- 周/月日历
│   ├── statistics/             # 数据统计 - 图表分析
│   ├── profile/                # 个人中心 - 云备份、导入导出
│   └── user-manage/            # 用户管理 - 多账户切换
│
├── components/                 # 3 个公共组件
│   ├── chart-view/             # Canvas 2D 统计图表
│   ├── color-picker/           # 颜色选择器
│   └── shift-selector/         # 班次选择器
│
├── subpkg-common/              # 分包（非核心功能）
│   └── pages/docs/             # 使用文档页面
│
├── utils/                      # 核心工具层（17 个文件）
│   ├── store.ts                # 状态管理（内存 + Storage 双写）
│   ├── cloudManager.ts          # 云同步（哈希比对 + 增量同步）
│   ├── photoCache.ts            # 图片 LRU 缓存（50MB 上限）
│   ├── dataExportManager.ts     # 数据导出（JSON/ZIP 格式）
│   ├── dataImportManager.ts     # 数据导入
│   ├── imageRelation.ts         # 图片关联表管理
│   ├── date.ts                 # 日期工具函数
│   ├── encrypt.ts              # 加密/哈希工具
│   ├── storage.ts              # 存储键值映射
│   └── ...
│
├── types/                      # TypeScript 类型定义
│   ├── store.d.ts              # Store 状态类型
│   ├── shift.d.ts              # 班次数据类型
│   ├── cloud.d.ts              # 云函数类型
│   └── ...
│
├── cloudfunctions/             # 云函数（4 个，JavaScript）
│   ├── backup/                  # 数据备份
│   ├── restore/                 # 数据恢复
│   ├── cleanup/                 # 数据清理
│   └── userLogin/               # 用户登录注册
│
└── vendor/                     # 第三方库
    └── jszip.min.js            # JSZip 压缩库
```

---

## 二、核心架构

### 2.1 数据流架构

项目采用 **Store + Storage 双写** 模式：

```
UI 操作
    ↓
Page.method() 
    ↓
store.setState(updates, persistKeys)
    ├── 更新内存 Store（发布订阅通知）
    └── 写入 wx.setStorageSync（持久化）
```

**核心特性**：

- Store 初始化时从 `wx.getStorageSync` 恢复数据
- `setState()` 同步更新内存 + 可选持久化到 Storage
- `subscribe(key, callback)` 支持单 key 粒度监听，返回取消订阅函数
- 不依赖任何第三方状态管理库，纯自研约 150 行

### 2.2 云同步架构

```
客户端                                    云函数 backup
  │                                          │
  ├─ 1. 计算本地数据哈希 ───────────────────► │
  │                                          ├─ 2. 计算云端数据哈希
  │◄─ 3. 返回云端哈希 ────────────────────── │
  ├─ 4a. 哈希一致 → 直接返回成功               │
  ├─ 4b. 哈希不同 → 上传完整数据 ──────────► │
  │                                          ├─ 5. 写入云数据库
  │◄─ 6. 返回备份结果 ────────────────────── │
```

**版本兼容策略**：

- 备份数据携带 `backupSystemVersion` 字段
- 恢复时比较本地版本与备份版本：
  - 本地 >= 备份 → 正常恢复
  - 本地 < 备份 → 提示用户更新小程序
  - 本地 > 云端 → 强制更新云端（覆盖旧备份）

**增量同步**：

- 图片备份按哈希去重，只上传新图片
- 单次图片上限：`MAX_IMAGES_PER_BATCH = 20`，超出时截断并 toast 提示

### 2.3 图片缓存系统

```
恢复流程（新）：
  getBackupRelation → 比对 diff → 写入 week_images_*（含 fileID, path=''）→ 完成
  不下载任何图片文件

查看图片（懒加载）：
  loadWeekImages → 从 storage 读取 → 查 photoCache 缓存
    ├─ 缓存命中 → 显示
    └─ 缓存未命中 → 从云端下载 → 缓存后显示
```

---

## 三、核心模块详解

### 3.1 Store 状态管理

**文件位置**：`utils/store.ts`

**核心方法**：

| 方法 | 说明 |
|------|------|
| `getState()` | 获取全部状态 / 单个 key / 多个 key |
| `setState(updates, persistKeys?)` | 更新状态，可选持久化 |
| `removeState(keys, persistKeys?)` | 删除状态 |
| `subscribe(key, callback)` | 订阅状态变更，返回取消订阅函数 |
| `persistToStorage(storageMap)` | 批量持久化 |

**状态定义**：

```typescript
interface StoreState {
  cloudInitialized: boolean;      // 云开发是否初始化
  cloudUserId: string;            // 云用户 ID
  cloudAccount: string;           // 云账户
  cloudUserInfo: object;          // 云用户信息
  username: string;               // 用户名
  avatarType: 'text' | 'emoji';   // 头像类型
  avatarEmoji: string;            // 头像 Emoji
  shifts: Record<string, Shift>;  // 排班数据
  shiftTemplates: ShiftTemplate[]; // 班次模板
  customWeeklyHours: number;       // 周标准工时
  chartType: string;              // 图表类型
  savedAccounts: Account[];        // 保存的账户
  autoRestoreMap: object;         // 自动恢复映射
}
```

### 3.2 CloudManager 云同步

**文件位置**：`utils/cloudManager.ts`

**核心方法**：

| 方法 | 说明 |
|------|------|
| `register(account, password, nickname)` | 注册云账户 |
| `login(account, password)` | 登录云账户 |
| `backup()` | 备份数据到云端 |
| `restore()` | 从云端恢复数据 |
| `getBackupInfo()` | 获取备份信息 |
| `getLocalData()` | 获取本地数据（含哈希） |
| `getAllLocalImages()` | 获取所有本地图片 |
| `calculateImageHash(...)` | 计算图片哈希 |

**关键常量**：

```typescript
MAX_IMAGES_PER_BATCH = 20  // 单次备份/恢复最多处理的图片数
BACKUP_SYSTEM_VERSION      // 备份系统版本，读取 config.ts
```

### 3.3 PhotoCache 图片缓存

**文件位置**：`utils/photoCache.ts`

**核心方法**：

| 方法 | 说明 |
|------|------|
| `getFromCache(fileID)` | 从缓存获取本地路径 |
| `saveToCache(fileID, tempPath, ...)` | 保存临时文件到缓存 |
| `ensureImage(fileID, cloudDownloadFn, ...)` | 确保图片可用（缓存优先） |
| `evictIfNeeded()` | LRU 淘汰超出上限的缓存 |
| `removeFromCache(fileID)` | 移除指定缓存 |
| `clearCache()` | 清空所有缓存 |
| `getCacheStats()` | 获取缓存统计 |

**缓存配置**：

```typescript
CACHE_DIR = `${wx.env.USER_DATA_PATH}/photo_cache/`
MAX_CACHE_SIZE = 50 * 1024 * 1024  // 50MB
```

### 3.4 DataExportManager 数据导出

**文件位置**：`utils/dataExportManager.ts`

**导出格式**：

```
export.zip
├── 班次模板.json       # shiftTemplates 数据
├── 排班数据.json       # shifts 数据（含图片关联信息）
└── images/             # 关联的图片文件
    ├── 2026-05/        # 按年月分组
    │   ├── 2026-05-1.jpg
    │   └── ...
    └── 图片周关联表.json # 图片与周的关联关系
```

**核心方法**：

| 方法 | 说明 |
|------|------|
| `exportSelectedData(selectedDataTypes, fileName, callback?)` | 导出选中数据类型 |
| `exportAsZip(fileName, data, selectedDataTypes, callback?)` | 导出为 ZIP 格式 |
| `generateZipFile(zip, fileName, callback?)` | 生成 ZIP 文件 |
| `shareExportedFile()` | 分享导出的文件 |
| `getExportedFileInfo()` | 获取导出文件信息 |

### 3.5 DataImportManager 数据导入

**文件位置**：`utils/dataImportManager.ts`

**导入流程**：

```
选择文件（JSON/ZIP）
    ↓
├─ JSON 格式 → 解析后直接写入 Storage
└─ ZIP 格式 → JSZip 解压 → 解析 JSON → 哈希比对图片去重
                    → 写入 Storage → 同步到 Store → 刷新页面
```

**核心方法**：

| 方法 | 说明 |
|------|------|
| `importData(callback?)` | 导入数据（自动识别格式） |
| `importFromJson(filePath, callback?)` | 从 JSON 导入 |
| `importFromZip(filePath, callback?)` | 从 ZIP 导入 |
| `finishImport(callback?)` | 完成导入，触发 Store 通知 |

### 3.6 ImageRelation 图片关联表

**文件位置**：`utils/imageRelation.ts`

**核心方法**：

| 方法 | 说明 |
|------|------|
| `getImageRelationTable()` | 获取图片关联表 |
| `addImageToRelation(weekKey, image)` | 添加图片到关联表 |
| `removeImageFromRelation(weekKey, imageId)` | 从关联表移除图片 |
| `syncRelationWithLocal(weekKey?)` | 同步关联表与本地存储 |
| `getAllValidImages()` | 获取所有有效图片（含哈希） |
| `rebuildRelationFromLocal()` | 从本地存储重建关联表 |

---

## 四、页面模块

### 4.1 Schedule 排班页面

**文件位置**：`pages/schedule/schedule.ts`

**功能**：

- 周视图/月视图切换日历
- 班次排班（选择模板或删除）
- 周/月工时统计
- 周视图图片管理

**核心方法**：

| 方法 | 说明 |
|------|------|
| `generateWeekDates()` | 生成周视图日期数据 |
| `generateMonthDates()` | 生成月视图日期数据 |
| `showShiftSelector(e)` | 显示班次选择器 |
| `saveShift(template)` | 保存排班 |
| `removeShift()` | 删除排班 |
| `loadWeekImages()` | 加载周图片 |
| `viewImage(e)` | 预览图片（支持云端懒加载） |

**数据订阅**：

- `_lastDataRestore`：数据恢复完成
- `_importComplete`：数据导入完成
- `avatarType`：头像类型变更

### 4.2 Plan 计划页面

**文件位置**：`pages/plan/plan.ts`

**功能**：

- 班次模板的增删改查
- 颜色选择器集成
- 模板与排班数据同步

**核心方法**：

| 方法 | 说明 |
|------|------|
| `loadTemplates()` | 加载班次模板 |
| `addTemplate()` | 添加模板 |
| `editTemplate(index)` | 编辑模板 |
| `deleteTemplate(index)` | 删除模板 |
| `saveTemplates()` | 保存模板 |

### 4.3 Statistics 统计页面

**文件位置**：`pages/statistics/statistics.ts`

**功能**：

- 工时统计图表（折线图、柱状图、饼图）
- 图表类型切换
- CSV 数据导出

**核心方法**：

| 方法 | 说明 |
|------|------|
| `calculateStatistics()` | 计算统计数据 |
| `refreshStatistics()` | 刷新统计 |
| `setChartType(type)` | 设置图表类型 |
| `exportCSV()` | 导出 CSV |

### 4.4 Profile 个人中心

**文件位置**：`pages/profile/profile.ts`

**功能**：

- 云账户登录/注册
- 数据备份/恢复
- 导入/导出本地数据
- 头像设置
- 今日心语

**核心方法**：

| 方法 | 说明 |
|------|------|
| `initCloud()` | 初始化云开发 |
| `handleLogin()` | 处理登录 |
| `handleRegister()` | 处理注册 |
| `backupData()` | 备份数据 |
| `restoreData()` | 恢复数据 |
| `exportData()` | 导出数据 |
| `importData()` | 导入数据 |

---

## 五、组件模块

### 5.1 ChartView 图表组件

**文件位置**：`components/chart-view/`

**功能**：使用 Canvas 2D API 自绘图表，支持：

- 折线图（line）
- 柱状图（bar）
- 饼图（pie）

**Props**：

```typescript
interface ChartViewProps {
  chartData: ChartData[];      // 图表数据
  chartType: 'line' | 'bar' | 'pie';  // 图表类型
  width?: number;              // 画布宽度
  height?: number;             // 画布高度
}
```

### 5.2 ColorPicker 颜色选择器

**文件位置**：`components/color-picker/`

**功能**：预设颜色选择 + 自定义颜色

### 5.3 ShiftSelector 班次选择器

**文件位置**：`components/shift-selector/`

**功能**：班次模板选择，支持快捷标签输入

---

## 六、工具函数

### 6.1 Date 日期工具

**文件位置**：`utils/date.ts`

| 函数 | 说明 |
|------|------|
| `formatDate(date)` | 格式化日期为 YYYY-MM-DD |
| `formatMonthTitle(date)` | 格式化月份标题，如"2026年 五月" |
| `getWeekOfMonth(date)` | 获取日期在当月的周数 |
| `getCalendarWeekOfMonth(date)` | 获取日期在当月的日历周（1-6） |
| `getMondayOfWeek(date)` | 获取日期所在周的周一 |
| `getWeekday(dateStr)` | 获取星期几的中文表示 |
| `formatDayDisplay(dateStr)` | 格式化日期显示 MM-DD |
| `isCurrentWeek(date)` | 判断是否在当前周 |
| `isCurrentMonth(date)` | 判断是否在当前月 |

### 6.2 Encrypt 加密工具

**文件位置**：`utils/encrypt.ts`

**密钥派生**：由设备指纹（model + platform + system + SDKVersion + version + language）通过 SHA256 派生

| 函数 | 说明 |
|------|------|
| `encryptPassword(password)` | AES-256-CBC 加密密码 |
| `decryptPassword(encrypted)` | 解密密码（兼容新旧格式） |
| `hashPassword(password)` | SHA256 哈希密码 |
| `verifyPassword(password, hash)` | 验证密码 |
| `calculateHash(data)` | 计算数据哈希（djb2） |

### 6.3 Storage 存储管理

**文件位置**：`utils/storage.ts`

**STORAGE_KEYS 映射**：

```typescript
{
  shifts: 'shifts',
  shiftTemplates: 'shiftTemplates',
  customWeeklyHours: 'customWeeklyHours',
  cloudInitialized: 'cloudInitialized',
  cloudUserId: 'cloudUserId',
  // ... 其他映射
}
```

---

## 七、云函数

### 7.1 userLogin 用户登录

**文件位置**：`cloudfunctions/userLogin/index.js`

**Actions**：

| Action | 说明 |
|--------|------|
| `register` | 注册新用户 |
| `login` | 用户登录 |
| `getUserInfo` | 获取用户信息 |

### 8.2 backup 数据备份

**文件位置**：`cloudfunctions/backup/index.js`

**Actions**：

| Action | 说明 |
|--------|------|
| `getBackupInfo` | 获取备份信息（哈希比对） |
| `getBackupDiff` | 获取备份差异 |
| `getExistingImages` | 获取已存在的图片列表 |
| `completeBackup` | 完成备份 |

### 8.3 restore 数据恢复

**文件位置**：`cloudfunctions/restore/index.js`

**Actions**：

| Action | 说明 |
|--------|------|
| `getBackupRelation` | 获取备份关联表 |
| `getAllCloudImages` | 获取所有云端图片 |
| `restoreOtherData` | 恢复其他数据 |
| `restore` | 执行恢复 |

### 8.4 cleanup 数据清理

**文件位置**：`cloudfunctions/cleanup/index.js`

**功能**：清理云端过期或孤立的数据

---

## 九、数据模型

### 9.1 ShiftTemplate 班次模板

```typescript
interface ShiftTemplate {
  id: string;           // 模板 ID
  name: string;         // 模板名称
  startTime: string;    // 开始时间 HH:mm
  endTime: string;      // 结束时间 HH:mm
  workHours: number;    // 工时数
  type: string;         // 类型（白天班/夜班/休息日等）
  color: string;        // 颜色值 #RRGGBB
}
```

### 9.2 Shift 排班数据

```typescript
interface Shift extends ShiftTemplate {
  tag?: string;         // 自定义标签
}
```

### 9.3 Image 图片数据

```typescript
interface WeekImage {
  id: string;           // 图片 ID
  name: string;         // 图片名称
  path: string;         // 本地路径（恢复后可能为空）
  addedTime: string;    // 添加时间 ISO 字符串
  hash?: string;        // 图片哈希
  fileID?: string;      // 云端文件 ID
}
```

### 9.4 CloudBackup 云端备份

```typescript
interface CloudBackup {
  userId: string;
  shiftTemplates: ShiftTemplate[];
  shifts: Record<string, Shift>;
  images: CloudImage[];
  imageWeekRelation: ImageRelation;
  avatarInfo: AvatarInfo;
  backupTime: string;
  backupHash: string;
  backupSystemVersion: string;
}
```

---

## 十、配置说明

### 10.1 环境配置

复制 `env.js.example` 为 `env.js` 并填写：

```javascript
module.exports = {
  CLOUD_ENV: 'your-cloud-env-id',    // 云环境 ID
  APP_ID: 'your-app-id'               // 小程序 AppID
};
```

### 9.2 全局配置

**文件位置**：`config.ts`

| 配置项 | 说明 |
|--------|------|
| `cloudEnv` | 云环境 ID |
| `appid` | 小程序 AppID |
| `appName` | 应用名称 |
| `cloudFunctions` | 云函数名称映射 |
| `collections` | 云数据库集合名称 |
| `backupSystemVersion` | 备份系统版本（需与云函数保持一致） |
| `defaults` | 默认配置（周工时、头像等） |

### 10.3 构建命令

```bash
npm run build      # TypeScript 检查 + 版本同步 + changelog 同步
npm run dev        # 版本同步 + changelog 同步（不含 TS 检查）
npm run lint       # ESLint 检查
npm run lint:fix   # 自动修复 ESLint 问题
npm run tsc:check  # TypeScript 编译检查
```

---

## 十一、开发规范

### 11.1 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 变量/常量 | camelCase | `const weeklyHours = 35;` |
| 函数/方法 | camelCase | `function calculateHours()` |
| 类 | PascalCase | `class CloudManager` |
| 接口 | PascalCase，无 I 前缀 | `interface ShiftTemplate` |
| 文件 | 小写+连字符 | `chart-view.ts` |

### 11.2 类型安全

- 优先使用 `interface` 而非 `type`（对象类型）
- 使用 union type 替代 enum
- 避免 `any`，使用 `unknown` 配合类型守卫
- 微信 API 的回调风格用 Promise 包装

### 11.3 错误处理

- 所有 `wx.cloud.callFunction` 调用必须有 `catch`
- Storage 操作使用 `try-catch` 包裹
- 回调风格 API 使用 Promise 包装

---

## 十二、常见问题

### 12.1 云函数修改后需要重新上传

云函数位于 `cloudfunctions/` 目录，使用 JavaScript。修改后需在微信开发者工具中右键上传部署。

### 12.2 备份版本号不一致

`config.ts` 的 `backupSystemVersion` 必须与云函数中的 `BACKUP_SYSTEM_VERSION` 保持一致。

### 12.3 图片恢复失败

恢复流程改为懒加载模式：只写入元数据（包含 fileID），实际图片在查看时才从云端下载。

### 12.4 多账户数据隔离

本地账户通过 Storage key 隔离，云账户通过 `cloudUserId` 隔离。

---

## 附录

### A. 相关文档

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/)

### B. 依赖版本

| 依赖 | 版本 |
|------|------|
| crypto-js | ^4.2.0 |
| typescript | ^5.5.4 |
| eslint | ^10.2.1 |
| miniprogram-api-typings | ^3.12.3 |

### C. 最低基础库版本

项目要求微信基础库版本 >= 2.10.0（通过 `app.ts` 中的 `checkSDKVersionCompatibility()` 检查）。
