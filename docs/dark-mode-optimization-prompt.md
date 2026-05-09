# 暗色模式统一方案 · 优化改造任务

## 一、背景：现有架构

项目是一个微信小程序（SYworkwechat），已实现暗色模式统一方案，核心架构如下：

**变量集中定义**：所有 CSS 变量在 `app.wxss` 的 `page {}` 中定义，暗色值在同文件的 `@media (prefers-color-scheme: dark)` 中覆盖。

**主题系统**：`app.json` 配置了 `darkmode: true` 和 `themeLocation: "theme.json"`，导航栏和 tabBar 的颜色由 `@变量` 驱动。

**组件继承**：3 个自定义组件（chart-view、color-picker、shift-selector）已配置 `styleIsolation: "apply-shared"`，可继承 page 层的 CSS 变量。

**核心原则**：所有颜色用 `var(--xxx)` 引用，不使用硬编码 `#xxxxxx`。暗色模式自动生效。

**项目文件结构**（相关部分）：

```
SYworkwechat/
├── app.wxss                    # 全局 CSS 变量（唯一来源）
├── app.json                    # darkmode: true + themeLocation
├── theme.json                  # @变量（nav/tab 原生组件）
├── pages/
│   ├── schedule/schedule.wxss
│   ├── plan/plan.wxss
│   ├── statistics/statistics.wxss
│   ├── profile/profile.wxss
│   └── user-manage/index.wxss
├── components/
│   ├── color-picker/color-picker.wxss
│   └── shift-selector/shift-selector.wxss
└── subpkg-common/
    └── pages/
        ├── agreement/agreement.wxss
        └── docs/docs.wxss
```

---

## 二、任务总览

本任务分 4 个子任务，按优先级排列：

| 优先级 | 任务 | 涉及文件 |
|--------|------|----------|
| **P0** | 清理 user-manage 剩余硬编码颜色 | pages/user-manage/index.wxss |
| **P1** | agreement 全量切换为 CSS 变量 | subpkg-common/pages/agreement/agreement.wxss |
| **P1** | docs 页面消除重复变量定义 | subpkg-common/pages/docs/docs.wxss |
| **P1** | page-header 渐变抽成全局变量 | app.wxss + 所有含 page-header 的页面 |
| **P2** | app.wxss 尾部添加编码规范注释 | app.wxss |

---

## 三、详细改造说明

### 任务 P0：user-manage 硬编码清理

**文件**：`pages/user-manage/index.wxss`

**问题**：大量硬编码颜色（约 50+ 处），亮色用 `#ffffff`、`#f8f9fa` 等，暗色查询块中也用手动硬编码覆盖。改造后亮色部分全部改为 `var(--xxx)`，暗色块中所有规则可删除（CSS 变量暗色值自动生效）。

**注意：`--primary-light` 变量在此页面中覆盖为 `#d1fae5`（极浅绿），与其他页面的 `#6ee7b7` 语义不同，此覆盖保留不改。**

改造方式：

1. **亮色部分**（dark 块之外的规则）：将每个 `#xxxxxx` 按颜色语义替换为对应 CSS 变量
   - 白色背景 `#ffffff` → `var(--card-bg)`
   - 灰色背景 `#f5f5f5`、`#f8f9fa`、`#f9fafb` → `var(--bg-color)` 或 `var(--card-bg)`（视场景）
   - 边框 `#f0f0f0`、`#e0e0e0`、`#d1d5db` → `var(--border-color)`
   - 阴影 `rgba(0,0,0,0.04)`、`rgba(0,0,0,0.06)`、`rgba(0,0,0,0.08)` → `var(--shadow-color)`
   - 主色阴影 `rgba(52,211,153,0.1)` → `var(--shadow-color)`
   - 文字颜色 `#d46b08`、`#ef4444` → `var(--warning-color)`、`var(--error-color)`
   - 保留白色文字 `color: #ffffff`（白色文字在暗色下依然是白色，不受变量影响）

2. **图标背景渐变**（`.account-icon`、`.nickname-icon` 等）：亮色渐变用于区分不同信息区域，更换配色方案，暗色下已有单独覆盖 → 亮色值改为使用深浅不同的 `var(--card-bg)` 或保留原值但确保暗色下被覆盖

3. **暗色块**（`@media (prefers-color-scheme: dark)` 内的所有规则）：理论上全部可删除，因为 CSS 变量暗色值会自动生效。但需逐条确认：
   - 如果某个选择器在亮色下用了变量，暗色下自动生效 → **删除**暗色覆盖
   - 如果某个选择器用了渐变/特殊颜色（如 `.user-info-header` 的渐变），则需要考虑是否保留暗色覆盖或在 app.wxss 中加全局变量
   - `.form-input`、`.checkbox` 等表单控件在暗色下可能需要更暗的背景区分，可保留 3~5 条必要的暗色覆盖

4. **最终的 dark 块精简目标**：从当前 ~40 条规则减少到不超过 5 条（仅保留必须的渐变和表单暗色覆盖）

**变量对照表**：

| 场景 | 亮色值 | 对应变量 |
|------|--------|----------|
| 卡片/列表背景 | `#ffffff` | `var(--card-bg)` |
| 输入框背景 | `#f8f9fa` | `var(--bg-color)` |
| 边框分割线 | `#f0f0f0`、`#e0e0e0` | `var(--border-color)` |
| 主文字 | `#333333` | `var(--text-primary)` |
| 次要文字 | `#666666`、`#8c8c8c` | `var(--text-secondary)` |
| 弱化文字 | `#999999`、`#9ca3af` | `var(--text-tertiary)` |
| 阴影 | `rgba(0,0,0,0.04)`~`0.08` | `var(--shadow-color)` |
| 错误色 | `#ef4444`、`#ff4d4f` | `var(--error-color)` |
| 警告色 | `#d46b08`、`#faad14` | `var(--warning-color)` |

---

### 任务 P1-a：agreement 全量切换

**文件**：`subpkg-common/pages/agreement/agreement.wxss`

**现状**：所有颜色硬编码，无任何 CSS 变量。

**要求**：
1. 将所有 `color: #1f2937`、`background-color: #f5f5f5` 等硬编码替换为 `var(--xxx)`
2. 页面背景：`page { background-color: #f5f5f5 }` → `page { background-color: var(--bg-color) }`
3. 主标题 color `#1f2937` → `var(--text-primary)`
4. 副标题/正文 color `#4b5563` → `var(--text-secondary)`
5. 日期信息 color `#9ca3af` → `var(--text-tertiary)`
6. 删除整个 `@media (prefers-color-scheme: dark)` 块（变量暗色值自动生效）

**注意**：此页面仅用于展示协议文本，样式简单（无图片/渐变/特殊效果），是最容易切变量的页面。

---

### 任务 P1-b：docs 页面消除重复变量

**文件**：`subpkg-common/pages/docs/docs.wxss`

**现状**：`page {}` 块中重复定义了 `app.wxss` 中已存在的变量（`--primary-color`、`--primary-dark`、`--bg-color`、`--card-bg`、`--border-color`、`--shadow`、`--shadow-hover`、`--radius-sm/md/lg`），且亮色值与 app.wxss 不一致（如 `--bg-color: #f7f8fa` vs 全局 `#f5f5f5`）。

**要求**：
1. 删除 `page {}` 中所有与 `app.wxss` 重复的变量定义
2. 文档页面特有的变量（`--tip-bg`、`--tip-border`、`--tip-text`、`--info-bg`、`--info-border`、`--info-text`、`--warning-bg/warning-border/warning-text`、`--danger-bg/danger-border/danger-text`、`--code-bg`、`--code-text`、`--title-color`、`--text-color`）因是 docs 专属变量，**迁移到 app.wxss 统一管理**
3. 在 app.wxss 的亮色和暗色块中分别添加这些私有变量的定义（亮色值用 docs 当前的亮色值，暗色值用 docs 当前的暗色值）
4. docs 自身的 `@media (prefers-color-scheme: dark)` 块中仅保留 `page {}` 之外的规则（如 `.page-header` 渐变覆盖），`page {}` 内的变量覆盖可删除

**迁移到 app.wxss 的新变量**：

```css
/* 亮色 */
--title-color: #1a1a1a;
--text-color: #4a4a4a;
--tip-bg: rgba(24, 119, 242, 0.08);
--tip-border: rgba(24, 119, 242, 0.15);
--tip-text: #1877f2;
--info-bg: rgba(52, 211, 153, 0.1);
--info-border: rgba(52, 211, 153, 0.2);
--info-text: #10b981;
--warning-bg: rgba(245, 158, 11, 0.08);
--warning-border: rgba(245, 158, 11, 0.15);
--warning-text: #d97706;
--danger-bg: rgba(239, 68, 68, 0.08);
--danger-border: rgba(239, 68, 68, 0.15);
--danger-text: #dc2626;
--code-bg: rgba(0, 0, 0, 0.05);
--code-text: #374151;

/* 暗色 */
--title-color: #e5e5e5;
--text-color: #a3a3a3;
--tip-bg: rgba(24, 119, 242, 0.15);
--tip-border: rgba(24, 119, 242, 0.25);
--tip-text: #3b82f6;
--info-bg: rgba(52, 211, 153, 0.15);
--info-border: rgba(52, 211, 153, 0.25);
--info-text: #34d399;
--warning-bg: rgba(245, 158, 11, 0.15);
--warning-border: rgba(245, 158, 11, 0.25);
--warning-text: #fbbf24;
--danger-bg: rgba(239, 68, 68, 0.15);
--danger-border: rgba(239, 68, 68, 0.25);
--danger-text: #f87171;
--code-bg: rgba(255, 255, 255, 0.1);
--code-text: #e5e7eb;
```

---

### 任务 P1-c：page-header 渐变抽成全局变量

**涉及文件**：`app.wxss` + `pages/profile/profile.wxss` + `pages/statistics/statistics.wxss` + `subpkg-common/pages/docs/docs.wxss`

**现状**：各页面各自维护 page-header 的暗色渐变覆盖，重复代码：

```css
@media (prefers-color-scheme: dark) {
  .page-header { background: linear-gradient(135deg, #2d7a5a 0%, #1a5a3a 100%); }
}
```

**要求**：
1. 在 app.wxss 中添加两个新的全局变量：
   ```css
   --header-gradient: linear-gradient(135deg, #34d399 0%, #10b981 100%);
   --header-gradient-dark: linear-gradient(135deg, #2d7a5a 0%, #1a5a3a 100%);
   ```
   亮色值在 `page {}` 中，暗色值在 `@media (prefers-color-scheme: dark)` 中。

2. 各页面中 `.page-header` 的 `background` 改为 `var(--header-gradient)`

3. 各页面 `@media (prefers-color-scheme: dark)` 块中删除 `.page-header` 的暗色覆盖

**注意**：仅替换各页面中的 `background` 属性，`.page-header` 的其他属性（margin/padding/border-radius/box-shadow）保持不变，这些已在变量中。

---

### 任务 P2：app.wxss 尾部添加编码规范

**文件**：`app.wxss`

在文件末尾添加如下注释：

```css
/*
 * ── 编码规范：新写 UI 时颜色引用规则 ──
 * 页面/容器背景    → var(--bg-color)
 * 卡片/块背景      → var(--card-bg)
 * 主文字           → var(--text-primary)
 * 次要文字         → var(--text-secondary)
 * 弱化文字         → var(--text-tertiary)
 * 边框/分割线      → var(--border-color)
 * 阴影             → var(--shadow-color) / var(--shadow)
 * 主色背景/按钮    → var(--primary-color)
 * 页面头渐变       → var(--header-gradient)
 * 成功色           → var(--success-color)
 * 警告色           → var(--warning-color)
 * 错误色           → var(--error-color)
 * 输入框背景       → var(--bg-color) 或 var(--card-bg)
 * 弹窗蒙层         → rgba(0, 0, 0, 0.5)
 * 组件隔离         → styleIsolation: "apply-shared"
 *
 * 不要用：color: #333 / background: #fff / border: 1rpx solid #eee
 * 不要在每个页面重写 @media (prefers-color-scheme: dark)
 * 新增页面只需引用 var(--xxx)，暗色自动生效
 */
```

---

## 四、执行顺序建议

1. 先在 app.wxss 中加两个变量集：`--title-color` ~ `--code-text`（docs 专用）+ `--header-gradient` / `--header-gradient-dark`
2. 改 agreement.wxss（最简单，先练手）
3. 改 docs.wxss（删除重复变量 + 删除 page {} 的变量覆盖）
4. 改 user-manage/index.wxss（工作量最大，单条逐个替换 + 精简暗色块）
5. 改 profile/statistics/docs 的 page-header 渐变引用
6. 最后在 app.wxss 尾部加编码规范注释

每改完一个文件，用 `tsc --noEmit` 验证 TypeScript 编译通过，用微信开发者工具预览检查亮色和暗色模式。
