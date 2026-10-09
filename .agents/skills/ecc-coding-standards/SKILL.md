---
name: "ecc-coding-standards"
description: "ECC 编码规范与最佳实践。适用于代码审查、编码规范检查、安全审计。与 codegraph 和 karpathy-guidelines 协同工作。"
---

# ECC 编码规范 (微信小程序适配版)

> 精选自 ECC 项目，适配微信小程序 TypeScript 开发

## 1. 核心原则

### 1.1 类型安全
- **零 any**：使用 `unknown` + 类型守卫，必要时 `@ts-expect-error` 并注释原因
- **联合类型优于 enum**：编译后零开销
- **泛型不超过 3 层**，超过说明设计需要简化
- **共享类型**放 `types/*.d.ts`，模块内部类型在文件顶部定义且不导出

### 1.2 命名规范
- 变量/函数/方法：camelCase（`weeklyHours`, `calculateHours()`）
- 类/接口/类型别名：PascalCase，接口无 I 前缀（`ShiftTemplate`）
- 文件：页面/组件用小写+连字符（`chart-view.ts`），工具用驼峰（`cloudManager.ts`）
- 私有属性：下划线前缀（`private _deriveKey()`）

### 1.3 文件组织
- 一个文件一个主要导出（函数/类/组件）+ 必要的内部类型 + 辅助函数
- 导入顺序：微信 API/全局模块 → 工具函数 → 类型导入（`import type`）→ 本地相对路径
- **禁止循环依赖**：utils/ 内文件互不引用（最多引用 store.ts 和 types/）

## 2. 微信小程序专用规范

### 2.1 状态管理
- 读取用 `store.getState(key)`，不要直接调 `wx.getStorageSync`
- 写入用 `store.setState(updates, persistKeys)`
- 纯 UI 状态不持久化，`persistKeys` 传空数组
- 禁止绕过 Store 直写 `wx.setStorageSync`

### 2.2 错误处理
- 所有 `wx.cloud.callFunction` 必须有 catch
- `wx.getStorageSync` / `wx.setStorageSync` 需 try-catch
- 回调风格 wx API 用 Promise 包装

### 2.3 暗黑模式
- CSS 变量统一在 `app.wxss` 定义
- 页面级 `.wxss` 禁止 `#xxxxxx` 硬编码颜色
- 禁止页面级 `@media (prefers-color-scheme: dark)`
- 组件使用 `styleIsolation: "apply-shared"` 继承全局变量

## 3. 安全规范

### 3.1 敏感数据处理
- 密钥通过 `env.js` 管理（不入库）
- 禁止 `eval` 等危险函数
- 过滤用户输入防 XSS
- 不记录敏感数据（密码、个人信息、令牌等）

### 3.2 加密规范
- AES-256-CBC 加密（CryptoJS）
- 密钥由设备指纹派生
- 兼容旧版 XOR 格式

## 4. 与其他 Skills 联动

### 4.1 与 codegraph 联动
```
代码修改前 → codegraph impact <符号> → 评估影响范围
代码修改后 → codegraph callers <符号> → 回查调用方
提交前 → codegraph sync → 刷新索引
```

> 注意：codegraph 只索引 `function` 与 `class` 方法；`Page({...})` / `Component({...})` 内的方法查不到，
> 此时改用 `grep` + `read_file`。详见 `.agents/rules/code-graph-rules.md`。

### 4.2 与 karpathy-guidelines 联动
```
编写代码时 → karpathy-guidelines → 避免常见错误
代码审查时 → ecc-coding-standards → 检查规范
```

### 4.3 与 test-driven-development 联动
```
新功能开发 → test-driven-development → 先写测试
代码实现 → ecc-coding-standards → 遵循规范
```

## 5. 代码审查清单

- [ ] 类型安全：无 `any`，使用类型守卫
- [ ] 命名规范：camelCase/PascalCase 正确使用
- [ ] 文件组织：导入顺序正确，无循环依赖
- [ ] 错误处理：所有 wx API 调用有错误处理
- [ ] 安全规范：无敏感数据泄露风险
- [ ] 暗黑模式：颜色使用 CSS 变量
- [ ] Store 使用：不直接调用 `wx.setStorageSync`

## 6. 触发条件

自动启用此 skill 的场景：
1. 用户请求代码审查
2. 用户询问编码规范
3. 用户请求安全审计
4. 代码提交前的规范检查
5. 与 codegraph impact 配合使用

## 7. 精简原则

为避免 token 浪费：
- 仅在需要时加载此 skill
- 不重复现有 skills 的功能
- 专注于编码规范和安全检查
- 与项目规则 (project_rules.md) 保持一致
