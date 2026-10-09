---
name: codegraph-cli
description: "CodeGraph 代码图谱 CLI：符号搜索、调用链追踪、影响分析。改函数/类/方法前查影响面、重命名前列调用点、发版前刷新索引时使用。"
---

# CodeGraph CLI

本项目**只用 CLI，不接 MCP**（CLI 不占常驻工具位、输出在终端可直接复现、安装器不会往 `AGENTS.md` 注入标记区块）。
安装：`npm i -g @colbymchenry/codegraph`（本项目已装：`codegraph --version` → `1.6.0`）

---

## 基本命令

### 初始化项目（换机器 / 重新 clone 后跑一次）
```bash
codegraph init
```
一条命令完成初始化 + 首次全量索引。本项目实测：47 文件 / 454 节点 / 1,050 边 / 2.1 秒。

### 搜索符号
```bash
codegraph query "setState"
```

### 调用关系
```bash
codegraph callers "setState"      # 谁调用了它
codegraph callees "backup"        # 它调用了谁
```

### 影响分析
```bash
codegraph impact "getLocalData"
```
输出按受影响符号分组（文件 → 符号 → 行号），用于改前评估爆炸半径。

### 任务上下文（给 AI 的浓缩上下文）
```bash
codegraph context "实现导出功能" --max-nodes 50
```

### 文件结构与状态
```bash
codegraph files --format tree --max-depth 3
codegraph status
```

### 索引维护
```bash
codegraph sync          # 增量刷新（日常用这个）
codegraph index --force # 全量重建（仅索引结构异常时）
codegraph update        # 更新索引
```

---

## ⚠️ 识别边界（本项目必须知道）

| 代码形态 | 能否识别 | 例子 |
|---|---|---|
| `function` 声明 | ✅ | `utils/store.ts` 的 `createStore` / `setState` |
| `class` 方法 | ✅ | `utils/cloudManager.ts` 的 `getLocalData` / `backup` |
| `Page({ ... })` 内方法 | ❌ | `pages/profile/profile.ts` 的 `computeLocalHash` |
| `Component({ ... })` 内方法 | ❌ | `components/chart-view/chart-view.ts` 的方法 |

页面/组件内方法**没有图谱节点**，查不到时改用 `grep` + `read_file`，不要当成"符号不存在"。

---

## 使用场景

- **代码探索**：`query` 定位符号 → `callers` / `callees` 梳理链路，避免整文件通读
- **重构**：改前 `impact` 看影响面，改后 `callers` 回查调用方
- **Bug 排查**：先从报错点 `query` 找入口，再顺调用链下行
- **发版前**：`sync` 刷新索引（`version-release` 流程的第一步）

## 维护要点

- 索引库 `.codegraph/` **不要提交、不要打包**（`.gitignore` 与 `project.config.json` 的 `packOptions.ignore` 都已排除）
- `EPERM ... database file is in use` → 停掉 codegraph 服务后重试
- 详细纪律与分类见 `.agents/rules/code-graph-rules.md`
