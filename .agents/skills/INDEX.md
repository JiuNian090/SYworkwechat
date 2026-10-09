# 技能与规则索引

> 本文件由 `node scripts/sync-agent-index.mjs` 自动生成，**请勿手改**。

---

## 技能（9）

| 技能 | 用途 | 路径 |
|---|---|---|
| `brainstorming` | You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation. | `.agents/skills/brainstorming/SKILL.md` |
| `codegraph-cli` | CodeGraph 代码图谱 CLI：符号搜索、调用链追踪、影响分析。改函数/类/方法前查影响面、重命名前列调用点、发版前刷新索引时使用。 | `.agents/skills/codegraph-cli/SKILL.md` |
| `ecc-coding-standards` | ECC 编码规范与最佳实践。适用于代码审查、编码规范检查、安全审计。与 codegraph 和 karpathy-guidelines 协同工作。 | `.agents/skills/ecc-coding-standards/SKILL.md` |
| `karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. | `.agents/skills/karpathy-guidelines/SKILL.md` |
| `systematic-debugging` | Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes | `.agents/skills/systematic-debugging/SKILL.md` |
| `test-driven-development` | Use when implementing any feature or bugfix, before writing implementation code | `.agents/skills/test-driven-development/SKILL.md` |
| `version-release` | 版本发布：更新 CHANGELOG.md、同步版本号到 package.json / project.config.json / utils/versionInfo.js、同步 README 更新日志。用户说“更新更新日志”“更新版本”“发版”“打 tag”“release”时使用。 | `.agents/skills/version-release/SKILL.md` |
| `writing-plans` | Use when you have a spec or requirements for a multi-step task, before touching code | `.agents/skills/writing-plans/SKILL.md` |
| `wx-miniprogram-dev` | SYworkwechat 专属开发指南。使用 TypeScript 为微信小程序进行全栈开发 —— Store 双写状态管理、Canvas 2D 自绘图表、云函数同步、暗黑模式适配等。 | `.agents/skills/wx-miniprogram-dev/SKILL.md` |

---

## 规则（5）

| 规则 | 标题 | 路径 |
|---|---|---|
| `code-graph-rules.md` | 代码图谱规则（CodeGraph） | `.agents/rules/code-graph-rules.md` |
| `code-standards-rules.md` | 编码与提交规范 | `.agents/rules/code-standards-rules.md` |
| `project-rules.md` | 项目规则（SYworkwechat） | `.agents/rules/project-rules.md` |
| `skill-scheduling-rules.md` | 技能调度规则 | `.agents/rules/skill-scheduling-rules.md` |
| `version-management-rules.md` | 版本管理规则 | `.agents/rules/version-management-rules.md` |

---

## 相关入口

- `AGENTS.md` —— 所有 Agent 的入口索引
- `CLAUDE.md` —— Claude 专属（`@AGENTS.md` 导入通用部分）
- `.agents/README.md` —— 本目录的使用与接线说明
