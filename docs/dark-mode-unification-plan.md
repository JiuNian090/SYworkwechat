# 暗色模式统一方案

## 问题现状

本次暗色适配暴露了三个结构性问题：

**1. CSS 变量没有统一来源**
每个页面自己定义一套 `--bg-color`、`--card-bg` 等变量，暗色覆盖也要每个页面单独加 `@media`。改一个变量需要改 5 个文件。

**2. 组件样式与页面隔离**
自定义组件不继承 `page {}` 里的 CSS 变量，必须在自己 wxss 里独立写暗色覆盖。

**3. 硬编码颜色散落在各处**
大量样式使用 `.xxx { background: #f5f5f5 }` 而非 `var(--bg-color)`。暗色适配约 60% 的工作量是在查找和替换这些硬编码值。

## 目标

- 新增页面/组件时，暗色模式自动生效，无需单独适配
- 改一个主题色即可影响全局
- 组件的暗色样式由父级变量驱动，不自成孤岛

---

## 第一阶段：全局扫描

动手改造前，先扫清家底。扫描结果记录在下表，扫到一个记一个。

### 扫描项 A：多余 wxml 结构

逐页面检查每一层 view/scroll-view/block 是否有实际作用（样式、事件、内容）。

常见多余模式：
- 没有 CSS 定义的空 view
- 只有一层 wrapper 但没有样式和事件的 view
- 内容为空的无用节点

**已发现：**

| 元素 | 所在页面 | 状态 |
|------|----------|------|
| `<view class="header-bg"></view>` | schedule / profile / plan / statistics | 已删除 |

**待扫描：** schedule / plan / statistics / profile / user-manage / docs

### 扫描项 B：硬编码颜色

找出所有使用 `#xxxxxx` / `rgb()` / `rgba()` 而非 `var(--xxx)` 的样式声明。

**已发现（高优先级）：**

| 位置 | 当前值 | 建议替换 |
|------|--------|----------|
| 各 page 自身的 page-header 渐变 | `#34d399 0%, #10b981 100%` | 暗色模式下已覆盖 |
| 各页面弹窗容器 background | `#ffffff` | `var(--card-bg)` |
| 零散的按钮背景色 | `#f3f4f6` 等 | `var(--bg-color)` |
| 图标背景渐变（data-icon 等） | 亮色渐变 | 暗色渐变 |
| 各类 badge、tag 背景色 | 亮色 | 暗色 |

### 扫描项 C：组件隔离状态

检查每个自定义组件的 `.json` 是否配置了 `styleIsolation`。

| 组件 | 当前状态 | 需要修改 |
|------|----------|----------|
| chart-view | 未配置 | 加 `apply-shared` |
| color-picker | 未配置 | 加 `apply-shared` |
| shift-selector | 未配置 | 加 `apply-shared` |

### 扫描项 D：未使用的 CSS 类

检查各 `.wxss` 文件中定义了但 wxml 中没有引用的样式类（需要工具辅助，手查效率低）。

---

## 第二阶段：根据扫描结果制定实施计划

扫描完成后，将结果汇总为具体的改动清单，按优先级排序。以下为预判的实施步骤，实际以扫描结果为准。

### Step 1：集中变量到 app.wxss

新建或补充 `app.wxss`，将所有 CSS 变量定义在一个位置：

```css
/* app.wxss */
page {
  --bg-color: #f5f5f5;
  --card-bg: #ffffff;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --border-color: #e5e5e5;
  --shadow-color: rgba(0, 0, 0, 0.08);
  --primary-color: #34d399;
  --primary-light: #6ee7b7;
  --primary-dark: #10b981;
}

@media (prefers-color-scheme: dark) {
  page {
    --bg-color: #1a1a1a;
    --card-bg: #262626;
    --text-primary: #e5e5e5;
    --text-secondary: #a3a3a3;
    --text-tertiary: #737373;
    --border-color: #333333;
    --shadow-color: rgba(0, 0, 0, 0.4);
    --primary-color: #3a9a7a;
    --primary-light: #4a9a7a;
    --primary-dark: #1a5a3a;
  }
}
```

**影响：**
- 清空各页面 `.wxss` 里重复的变量定义（约 5 个文件各删 15 行）
- 清空各页面 `.wxss` 里独立的 `@media (prefers-color-scheme: dark)` 块

### Step 2：组件启用变量继承

每个自定义组件的 `.json` 加一行：

```json
{
  "component": true,
  "styleIsolation": "apply-shared"
}
```

涉及组件：chart-view / color-picker / shift-selector

### Step 3：清理多余 wxml 结构

根据扫描项 A 的结果，逐页删除无实际作用的节点。

### Step 4：替换硬编码颜色

根据扫描项 B 的结果，将硬编码颜色替换为 CSS 变量。

### Step 5：制定编码规范

写新代码时的颜色引用规则：

| 场景 | 用法 | 不要用 |
|------|------|--------|
| 页面背景 | `background: var(--bg-color)` | `#f5f5f5` |
| 卡片背景 | `background: var(--card-bg)` | `#ffffff` |
| 主文字 | `color: var(--text-primary)` | `#333` |
| 次要文字 | `color: var(--text-secondary)` | `#666` |
| 边框 | `border: 1rpx solid var(--border-color)` | `#e5e5e5` |
| 按钮主色 | `background: var(--primary-color)` | `#34d399` |
| 弹窗容器 | `background: var(--card-bg)` | `#ffffff` |
| 阴影 | `box-shadow: 0 2rpx 8rpx var(--shadow-color)` | `rgba(0,0,0,0.08)` |

对于用户自定义颜色（班次颜色、热力图色板等），保持 JS 检测主题模式的做法：

```typescript
const theme = wx.getSystemInfoSync().theme;
const alpha = theme === 'dark' ? '50' : '20';
```

---

## 改造成本估算

| 阶段 | 步骤 | 工作量 | 收益 |
|------|------|--------|------|
| 扫描 | A：扫描多余结构 | 1 小时 | wxml 精简 |
| 扫描 | B：扫描硬编码颜色 | 1 小时 | 消除暗色遗漏死角 |
| 扫描 | C：检查组件隔离状态 | 10 分钟 | 摸清现状 |
| 改造 | 1：集中变量到 app.wxss | 30 分钟 | 新增页面无需再配暗色 |
| 改造 | 2：组件加 styleIsolation | 10 分钟 | 组件自动继承变量 |
| 改造 | 3：清理多余结构 | 30~60 分钟 | 减少无用嵌套 |
| 改造 | 4：替换硬编码 | 1~2 小时（可分批） | 消除暗色遗漏死角 |
| 改造 | 5：制定规范 | 一次性文档 | 新代码天然暗色兼容 |

## 实施记录（2026-05-10）

### 已完成

| 步骤 | 状态 | 详情 |
|------|------|------|
| 扫描 A：多余 wxml | ✅ | 发现大量空 view 节点（plan ~30个, profile ~50个, schedule 3个, statistics 2个, user-manage 3个），其中 header-bg 已在之前删除 |
| 扫描 B：硬编码颜色 | ✅ | 发现 5 个页面 + 2 个组件共 ~80+ 处硬编码颜色 |
| 扫描 C：组件隔离 | ✅ | 3 个组件均未配置 styleIsolation |
| Step 1：集中变量到 app.wxss | ✅ | 创建 `app.wxss`，整合 5 个页面的 17 个变量（含标签系统变量），清空各页面重复定义共 ~85 行 |
| Step 2：组件 styleIsolation | ✅ | chart-view / color-picker / shift-selector 三个组件均已添加 `"styleIsolation": "apply-shared"` |
| Step 4：组件替换硬编码 | ✅ | color-picker: 替换 9 处，移除 4 条无效暗色覆盖；shift-selector: 替换 11 处，移除 12 条无效暗色覆盖 |
| Step 4（续）：页面级替换 | ✅ | 5 个页面共替换 ~30 处关键硬编码 → 变量，同步清理暗色块共移除 ~20 条冗余规则 |
| Step 3：wxml 清理 | ⏭️ | 扫描结果多为假阳性（wrapper 承载布局），跳过 |
| 编译验证（最终） | ✅ | `tsc --noEmit` + `eslint` 均通过 |

### 页面级替换详情

| 页面 | 主体替换 | 暗色块移除 |
|------|----------|-----------|
| schedule | modal-container/header/footer、close-icon、shift-name/tag/time、btn-cancel、picker-shift、stat-row | modal-container、modal-footer、modal-header、modal-content、shift-name、shift-tag-text、shift-time、btn-cancel 颜色 |
| plan | modal-container/header/footer、close-icon、template-item、header、title、section-title、label、btn-cancel/confirm、empty-tip | modal-container、modal-footer、modal-header、label、work-hours-display、btn-cancel 颜色 |
| profile | modal-container/header/footer、close-icon、form-card (×2) | modal-container、form-card |
| statistics | modal-container/footer、close-icon、form-card、btn-cancel | modal-container、modal-header、close-icon、form-card、modal-footer、btn-cancel 颜色 |
| user-manage | modal-container/footer、form-card、btn-cancel | modal-container、modal-header、modal-footer、form-card、btn-cancel 颜色 |

### 关键设计决策

1. **profile 和 user-manage 保留 `--primary-light: #d1fae5` 覆盖**：这两个页面使用的 `--primary-light` 值为 `#d1fae5`（极浅绿色），与其他页面 `#6ee7b7` 语义不同（前者用于装饰背景渐变，后者用于按钮渐变），故保留页面级覆盖。

2. **页面暗色块保留选择器特定覆盖**：集中变量后，各页面的 `@media (prefers-color-scheme: dark)` 块仅清除了 `page { --xxx }` 部分的变量重定义。`.page-header`、`.modal-container`、`.form-input` 等选择器级别的暗色覆盖因使用了与变量默认值不同的特定颜色（如 header 使用的深绿色渐变），暂时保留。这些可在后续分批替换。

3. **组件暗色块精简**：color-picker 暗色块从 7 条规则减至 5 条，shift-selector 从 13 条减至 5 条。被移除的规则因 CSS 变量暗色值已覆盖对应场景。

### 待后续处理

- **page-header 渐变替换**：各页面的 header 使用 `linear-gradient(#34d399, #10b981)` 等主色渐变，暗色块中用 `linear-gradient(#2d7a5a, #1a5a3a)` 覆盖。可用 `var(--primary-color)` / `var(--primary-dark)` 替代渐变值，但需验证视觉一致性。
- **badge/tag/图标渐变**：data-icon、cloud-icon 等装饰性背景渐变使用了亮色/暗色独立配色，需逐个评估替换风险。
- **Step 3（wxml 清理）**：plan/profile 页面确实存在一定量的无样式 wrapper view，可在页面重构时一并处理。
- **Step 5**：编码规范已在本文档中，新增页面/组件时需遵循变量引用规则。

### 改造前后对比

| 指标 | 改造前 | 改造后 |
|------|--------|--------|
| 变量定义位置 | 5 个文件各定义一遍 | 1 个 app.wxss |
| 变量定义行数 | ~85 行（分散） | ~60 行（集中） |
| 暗色变量重定义 | 7 个文件（5 页 + 2 组件） | 1 个 app.wxss |
| 组件变量继承 | 无（独立隔离） | apply-shared 自动继承 |
| 硬编码颜色替换 | 80+ 处硬编码 | ~50 处已替换为变量 |
| 暗色块冗余规则 | ~45 条 | ~25 条（移除 ~20 条） |
| 新增页面暗色工作量 | 需手动添加 @media 块 | 自动生效 |
