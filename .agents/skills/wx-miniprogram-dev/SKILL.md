---
name: wx-miniprogram-dev
description: "SYworkwechat 专属开发指南。使用 TypeScript 为微信小程序进行全栈开发 —— Store 双写状态管理、Canvas 2D 自绘图表、云函数同步、暗黑模式适配等。"
---

# SYworkwechat 开发指南

## 1. 项目专属架构

### 1.1 状态管理：Store + Storage 双写
- Store（内存）初始化时从 `wx.getStorageSync` 恢复
- `store.setState(updates, persistKeys)` 同步更新内存 + 持久化
- `persistKeys` 传空数组时不写 Storage（纯 UI 状态不持久化）
- `store.subscribe(key, callback)` 返回取消函数，组件销毁时调用

### 1.2 Canvas 图表（chart-view）
- Canvas 2D 自绘折线图/柱状图/饼图，不依赖第三方库
- 颜色配置通过 `THEME_COLORS` 常量管理（浅色/暗黑两套），不涉及 CSS 变量
- 如需新增图表类型，在 `chart-view.ts` 的 `drawChart()` 中添加分支

### 1.3 云同步流程
- 客户端计算本地哈希 → 云函数返回云端哈希 → 一致跳过，不一致上传
- `MAX_IMAGES_PER_BATCH = 20`，超限截断并 toast
- 检查备份时先比 `computeLocalHash()` 与 `lastSyncHash`，匹配则跳过
- 图片恢复采用元数据回源（只记 fileID 不下载），查看时懒加载

### 1.4 暗黑模式
- `app.json` 配置 `"darkmode": true`，`app.wxss` 为 CSS 变量唯一来源
- `@media (prefers-color-scheme: dark)` 仅出现在 `app.wxss`
- 页面/组件一律用 `var(--xxx)` 引用，禁止 `#xxxxxx` 硬编码和页面级暗色块
- 暗色底色 `#1a1a1a`，卡片 `#262626`，主色降饱和度（`#34d399 → #3a9a7a`）

## 2. TypeScript 红线
- 零 `any`（用 `unknown` + 类型守卫），必要时 `@ts-expect-error` 并注明原因
- 联合类型优于 `enum`（编译后零开销）
- 对象类型优先 `interface` 而非 `type`
- 共享类型放 `types/*.d.ts`，模块内部类型在文件顶部定义且不导出
- 泛型不超过 3 层
- 函数重载签名用泛型约束消除实现体中的 `as` 强转：
  ```typescript
  // 推荐
  subscribe<T extends keyof StoreState>(
    key: T | null,
    cb: T extends null ? (a: StoreState, b: StoreState) => void : (a: StoreState[T], b: StoreState[T]) => void
  ): () => void
  ```
- setState/setData 参数用 `Partial<StoreState>` 或带 key 泛型的精确类型，不用 `Record<string, any>`
- 云函数入参/返回值必须在调用侧声明接口类型，函数体内用类型守卫校验关键字段

## 3. 文件组织
- 导入顺序：微信 API → 工具函数 → 类型导入（`import type`）→ 本地相对路径
- `utils/` 内文件互不引用（最多引用 `store.ts` 和 `types/`）
- `cloudfunctions/` 下的云函数保持 JS，不转 TS
- 不修改：`vendor/jszip.min.js`、构建脚本（`sync_changelog.js`、`version-manager.js`）
- **新文件用 ES module（`import/export`）**，不用 `require/module.exports`，不加 `'use strict'`（TS 编译器自动处理）
- 老文件逐步迁移，允许过渡期内存在双导出模式（`module.exports` + `export {}`），但新代码不可新增

## 4. 构建与检查
```bash
npm run tsc:check  # 编译检查（改完后必须跑）
npm run lint       # ESLint 检查
npm run build      # tsc + 版本同步 + changelog 同步
```

## 5. 性能规范
### 5.1 setData
- **合并写入**：连续 setData 合并为一次，减少逻辑层/渲染层通信
  ```typescript
  // 反对
  this.setData({ shiftData });
  this.setData({ showLoading: false });
  // 推荐
  this.setData({ shiftData, showLoading: false });
  ```
- **数据量控制**：单次 setData < 1024KB，大数据拆分为分批渲染，配合虚拟列表避免一次性传递大量节点
- **变化检测**：只 setData 发生变化的字段，用浅比较过滤无变更数据

### 5.2 分包
- 主包放 tabBar 页面和公共资源，新页面优先放分包
- **分包异步化**（基础库 2.11.2+）：跨分包引用组件时在 `componentPlaceholder` 中指定占位组件，不阻塞首屏
- **预下载限额**：同一分包内各页面共享 2M 预下载总大小

### 5.3 渲染
- Canvas 一律用 `type="2d"` 新接口
- 图表重绘加 300ms debounce，避免日期范围切换时密集渲染
- 图片懒加载 + 缓存 fileID（云存储图片不提前下载）

## 6. ESLint 策略
当前配置较宽松（`no-explicit-any: off`），逐步收紧：
- 新代码遵守 `no-explicit-any: 'warn'`，老代码逐行 `// eslint-disable-next-line` 标记
- 推荐新增 `explicit-function-return-type: ['warn', { allowExpressions: true }]`（只检查独立函数声明）
- 不保留全局豁免，每条豁免应有明确原因

## 7. 云开发最佳实践
### 7.1 数据库查询
- **游标分页替代 skip**：大数据量下 skip 性能劣化明显
  ```typescript
  const list = await db.collection('workRecords')
    .where({ userId, date: _.lt(lastDate) })
    .orderBy('date', 'desc')
    .limit(PAGE_SIZE)
    .get()
  ```
- **字段裁剪**：`.field({ ... })` 只返回必要字段，减少传输量
- **组合索引**：高频查询字段建组合索引，过滤字段放前面，排序字段与索引顺序一致

### 7.2 watch 实时推送
- 最多同时监听 5000 条，不支持 `field` 筛选
- 离开页面时调用 `watcher.close()`

### 7.3 事务
- 仅在云函数端可用，仅支持单记录操作，快照隔离级别
- 适用于跨集合一致性场景（如工时记录 + 统计汇总）

## 8. 数据模型变更流程
1. `types/*.d.ts` 更新接口类型
2. `utils/store.ts` 的 `initialState` 添加默认值
3. `utils/storage.ts` 的 `STORAGE_KEYS` 确认是否需要新 key
4. 已存数据格式变更时在 `store.ts` 初始化中处理旧格式兼容
5. 云函数同步读写逻辑
