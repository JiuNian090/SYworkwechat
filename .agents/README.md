# `.agents/` — 规则与技能的唯一内容源

> 本目录是**规则与技能的唯一存放处**。新增任何 AI 工具时，让它的配置指向本目录，不要另建副本。

---

## 目录结构

```
.agents/
├── rules/                     # 规则正文（按需加载，索引在 AGENTS.md）
│   ├── project-rules.md              # 项目定位 + 任务分类与技能分派（每个任务开始前必读）
│   ├── code-graph-rules.md           # CodeGraph 用法、识别边界、索引维护
│   ├── code-standards-rules.md       # 编码规范 + 提交规范 + 数据操作规范
│   └── version-management-rules.md   # 版本号来源与发布流程
├── skills/                    # 技能正文，每个技能一个目录
│   ├── INDEX.md                      # 技能与规则索引（自动生成）
│   └── <skill-name>/SKILL.md
└── README.md                  # 本文件
```

---

## 索引文件

| 文件 | 作用 | 生成方式 |
|---|---|---|
| `AGENTS.md`（仓库根） | 所有 Agent 的入口索引 | 手写骨架 + 手工维护技能表 |
| `CLAUDE.md`（仓库根） | Claude 专属，`@AGENTS.md` 导入通用部分 | 手写 |
| `.agents/skills/INDEX.md` | 技能与规则清单 | `node scripts/sync-agent-index.mjs` 自动生成 |

**新增技能或规则后必须重跑：**

```bash
node scripts/sync-agent-index.mjs          # 重新生成索引
node scripts/sync-agent-index.mjs --check  # 只检查是否已同步（提交前用）
```

---

## 各工具接线

| 工具 | 机制 | 接线 |
|---|---|---|
| **Reasonix** | `reasonix.toml` 原生支持额外技能根 | `[skills] paths = [".agents/skills"]` |
| **Claude Code** | 技能路径固定为 `.claude/skills/`，无配置项 | `.claude/skills` 建为指向 `.agents/skills` 的联接（junction / symlink） |
| **Trae / Cursor / Windsurf / Codex 等** | 读根目录 `AGENTS.md` | 无需额外配置，索引里已含路径 |

---

## 版本控制

| 路径 | 是否纳入 git | 原因 |
|---|---|---|
| `.agents/`、`AGENTS.md`、`CLAUDE.md` | ✅ 纳入 | 通用层，跨 Agent / 跨机器共用 |
| `.trae/`、`.claude/` | ❌ 忽略 | 各 IDE 的本地配置与联接 |
| `.codegraph/` | ❌ 忽略 | 代码图谱索引，可重建；**且必须排除小程序打包** |

> `reasonix.toml` 里的 `[skills] paths` 与 `.claude/skills` 的联接属于本机接线，不入库；
> 换机器后按上表重新接线即可。
