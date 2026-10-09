@AGENTS.md

# CLAUDE.md

本文件是 Claude Code 的入口。**通用规则、技能索引与工具约定全部在 `AGENTS.md`**（已通过上面的 `@AGENTS.md` 导入），
这里只写 Claude 专属的补充。

## 内容源约定

- 规则与技能的唯一内容源是 **`.agents/`**：`rules/` 放规则正文，`skills/<name>/SKILL.md` 放技能
- 不要在本文件或 `.claude/` 下另建规则/技能副本；`.claude/skills` 只是指向 `.agents/skills` 的联接
- 新增规则或技能后，重新生成索引：`node scripts/sync-agent-index.mjs`

## 需要特别记住的项目约束

- 主包上限 **2048KB**，新增文件前先估体积；索引/缓存类目录必须同时加进 `.gitignore` 与
  `project.config.json` 的 `packOptions.ignore`
- 页面与组件内的方法（`Page({...})` / `Component({...})`）**不在 codegraph 索引里**，查不到时用 `grep` + `read_file`
- 数据写入统一走 `store.setState(updates, persistKeys)`，禁止绕过 Store 直写 `wx.setStorageSync`
- 页面/组件 `.wxss` 禁止硬编码颜色、禁止写 `@media (prefers-color-scheme: dark)`，一律用 `app.wxss` 的 CSS 变量
