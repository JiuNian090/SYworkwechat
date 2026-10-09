# SYworkwechat — Agent 入口索引

> **规则与技能的唯一内容源是 `.agents/`。** 新增任何 AI 工具时让它的配置指向那里，不要另建副本。

---

## 项目速览

SYwork 工时记录系统 —— 微信小程序原生开发（TypeScript），自用规模（2 位家人使用）。

| 项 | 内容 |
|---|---|
| 前端 | 微信小程序原生 + TypeScript（严格模式），无 UI 框架 |
| 状态 | 自研 Store + Storage 双写（`utils/store.ts`、`utils/storage.ts`） |
| 后端 | 微信云开发：4 个云函数（`backup` / `restore` / `cleanup` / `userLogin`）+ 3 个集合 |
| 加密 | crypto-js AES-256-CBC，密钥由设备指纹经 SHA256 派生 |
| 图表 | Canvas 2D 自绘（`components/chart-view`） |
| 主题 | 暗黑模式；CSS 变量唯一来源 `app.wxss` |
| **主包预算** | **上限 2048KB**（当前约 1176KB）—— 加依赖前先算体积 |

---

## 开工前必读（按需加载，不要一次全读）

| 时机 | 读什么 |
|---|---|
| 收到任何改动请求 | `.agents/rules/project-rules.md` —— 任务分类铁律 + 技能分派 |
| 改函数 / 类方法之前 | 先跑 `codegraph impact <符号>`；细则见 `.agents/rules/code-graph-rules.md` |
| 写或改代码 | `.agents/rules/code-standards-rules.md` |
| 改 UI / 暗黑模式 | `.agents/rules/project-rules.md` 的暗黑模式章节 + `app.wxss` |
| 发布版本 | `.agents/skills/version-release/SKILL.md` |
| 排查 bug | `.agents/skills/systematic-debugging/SKILL.md` |
| 多步任务规划 | `.agents/skills/writing-plans/SKILL.md` |
| 需求不明确 | `.agents/skills/brainstorming/SKILL.md` |
| 写测试 | `.agents/skills/test-driven-development/SKILL.md` |

---

## 技能（`.agents/skills/`）

| 技能 | 用途 |
|---|---|
| `codegraph-cli` | 代码图谱 CLI：符号搜索、调用链、影响分析 |
| `version-release` | 版本发布：CHANGELOG + 版本号 + README 同步 |
| `wx-miniprogram-dev` | 本项目专属：小程序 + TS + Store 双写 + 云函数 + 暗黑模式 |
| `systematic-debugging` | 系统化调试：先诊断再改 |
| `test-driven-development` | 先写测试再实现 |
| `writing-plans` | 多步任务先出计划 |
| `brainstorming` | 需求澄清与方案探索 |
| `karpathy-guidelines` | 编码自查：避免过度设计、最小改动 |

> 完整索引见 `.agents/skills/INDEX.md`。

---

## 规则（`.agents/rules/`）

| 规则 | 内容 |
|---|---|
| `project-rules.md` | 项目定位、任务分类与技能分派、工具约定、暗黑模式 |
| `code-graph-rules.md` | CodeGraph 用法、识别边界、索引维护 |
| `code-standards-rules.md` | 编码规范、提交规范、数据操作规范 |
| `version-management-rules.md` | 版本号来源、发布流程、备份系统版本号 |

---

## 工具约定

- **有 CLI 就用 CLI，不接 MCP。** codegraph 只用 CLI（`query` / `callers` / `callees` / `impact` / `sync`），
  不接它的 MCP server —— CLI 不占常驻工具位、输出可复现、安装器不会往本文件注入标记区块。
- **codegraph 识别边界（重要）**：`function` 声明与 `class` 方法可以被 `query` / `callers` / `impact` 查到；
  但 `Page({ ... })` 与 `Component({ ... })` 里的方法**查不到**，此时改用 `grep` + `read_file`，
  不要据此判断"符号不存在"。
- **`.codegraph/` 不提交、不打包**：`.gitignore` 与 `project.config.json` 的 `packOptions.ignore` 都已排除。
  历史上 `.gitnexus/` 未排除，导致主包 5950KB 上传失败，务必引以为戒。
- **云函数改动**需在微信开发者工具重新上传部署才对线上生效；小程序端改动需重新编译。
- 发版前先 `codegraph sync` 刷新索引。
