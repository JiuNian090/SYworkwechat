---
name: version-release
description: "版本发布：更新 CHANGELOG.md、同步版本号到 package.json / project.config.json / utils/versionInfo.js、同步 README 更新日志。用户说“更新更新日志”“更新版本”“发版”“打 tag”“release”时使用。"
---

# 版本发布 — 版本号 & 版本日志

统一负责版本发布：更新 `CHANGELOG.md`、同步版本号（三处文件）、同步 `README.md`，并在需要时跑构建。

> ⚠️ **强制规则**：任何「更新更新日志 / 更新版本 / 发布新版本 / 打 tag / release」请求都必须通过本技能执行，
> 禁止凭记忆手改版本号与更新日志。关联规则：`.agents/rules/version-management-rules.md`

---

## 先看：本项目与通用流程的三个差异

| 通用做法 | 本项目实际 |
|---|---|
| 版本号存 `VERSION.txt` | **没有这个文件**。版本号来源是 `CHANGELOG.md` 的最新标题 `## vX.Y.Z`，由脚本同步到 `package.json`、`project.config.json`、`utils/versionInfo.js` 三处 |
| 全程手写 CHANGELOG | **混合**：先 `npm run release vX.Y.Z` 从 git 提交生成条目骨架，再由 Agent 润色成面向用户的语言 |
| 版本号连备份一起管 | **应用版本号与备份系统版本号相互独立**：`backupSystemVersion`（当前 `v2.0.0`）仅在备份架构/数据格式变更时更新，且 `config.ts` 与 3 个云函数的 `BACKUP_SYSTEM_VERSION` 必须一致 |

---

## 工作流程

### 1. 刷新代码图谱索引

```bash
codegraph sync
```

索引结构异常时才用 `codegraph index --force`（若报 `EPERM ... database file is in use`，先停掉 codegraph 服务）。

### 2. 确认新版本号

与用户确认（如 `v4.2.2`）。默认在当前最新版本上递增 patch。

### 3. 读取当前版本

```bash
grep -m1 "^## v" CHANGELOG.md
```

### 4. 取 git 提交记录（含日期）

```bash
git log --format="%ad %h %s" --date=short -30
```

需要细节时：`git log --format="=== %h %ad %s%n%b" --date=short <上个版本提交>..HEAD`

### 5. 生成 CHANGELOG 骨架

```bash
npm run release vX.Y.Z
```

该脚本会：按关键词分类提交 → 在 `CHANGELOG.md` 顶部插入条目 → 更新 `package.json` / `project.config.json` / `utils/versionInfo.js` → 同步到 `utils/changelog.ts`。

**注意**：脚本用的是**执行当天**的日期（已知缺陷，见 `.agents/rules/version-management-rules.md`），
执行后必须按第 7 步把日期改成该版本提交日期。

### 6. 润色成面向用户的语言（关键步骤）

脚本生成的条目直接取自 commit subject，需要逐条改写。**分类与 emoji：**

| 分类 | emoji | 适用场景 |
|------|-------|---------|
| 新功能 | 🎉 新增 | 用户能直接使用的新能力 |
| 体验优化 | ✨ 优化 | 交互、速度、易用性提升 |
| 问题修复 | 🔧 修复 | 用户遇到的功能异常修复 |
| 界面样式 | 🎨 样式 | 视觉、排版、动效调整 |
| 性能/配置 | ⚡ 调整 | 后台优化、配置项变化 |

**编写原则（严格执行）**：每条只描述**用户能感知到的变化**，禁止出现：

- ❌ 专业术语：函数名、变量名、CSS 选择器、文件名
- ❌ 内部数据：接口名、字段名、数量统计、TTL 数值
- ❌ 管理类改动：环境变量、CI/CD、部署脚本、构建配置
- ❌ 代码清理：重构、重命名、拆模块（除非影响用户可感知的性能或稳定性）
- ❌ 版本管理本身：版本号更新、索引重建、静态资源 hash

**正确示例：**

```
✅ 🔧 修复：设备 B 恢复云端数据后计划页看不到班次模板的问题
✅ 🎉 新增：导出数据支持全选与清空，整理导出内容更方便
✅ 🎨 样式：登录/注册等弹窗统一为主题风格，暗色下不再出现浅底浅字
```

**格式：**

```markdown
## v4.2.2 (2026-10-09)
- 🔧 修复：……
- ✨ 优化：……
```

### 7. 日期规则（严格执行）

条目日期 `(YYYY-MM-DD)` 必须取**该版本 git 提交的实际日期**，禁止使用执行任务当天的日期。

```bash
git log -format="%ad %h %s" --date=short | grep -i release     # 定位发布提交
git log -1 --format="%ad" --date=short <发布提交>              # 取其日期
```

一个版本对应多个提交时，取**最后那个发布提交**的日期。

### 8. 同步 README

README 要同步**两类内容，缺一不可**：

1. **版本相关** — `README.md` 的「## 更新日志」章节（第 210 行附近）顶部插入新版本条目，默认保留最近 3 条，挤出的删掉
2. **与本次改动对应的正文** — 逐项核对并按需修改：

| 本次改动涉及 | 需要核对的 README 章节 |
|---|---|
| 新增/调整用户可感知功能 | 「## 功能特点」下对应小节 |
| 云函数、集合、数据字段变化 | 「## 数据管理」「## 数据安全」 |
| 文件/目录增删移动 | 「## 项目结构」 |
| 构建命令、脚本变化 | 「## 快速开始 › 可用脚本」 |
| 依赖引入或升级 | 「## 技术栈」 |
| 主包体积显著变化 | 「## 注意事项」 |

判据是「README 现有描述是否已与代码不符」——与更新日志的取舍标准不同：纯内部重构不必写进更新日志，但**只要让 README 描述失真就必须改**。确实对应不上时，在结果里显式说明原因，不得默认跳过。

### 9. 验证

- [ ] `CHANGELOG.md` 顶部有新版本条目，日期为**该版本提交日期**
- [ ] `package.json` / `project.config.json` / `utils/versionInfo.js` 三处版本号一致且等于新版本
- [ ] `utils/changelog.ts` 已同步（若跑了 `npm run build`）
- [ ] `README.md` 更新日志章节已同步，正文章节已核对（或已说明无需改动）
- [ ] 未误改 `backupSystemVersion` / `BACKUP_SYSTEM_VERSION`

### 10. 构建

```bash
npm run build
```

等价于 `tsc --noEmit && node version-manager.js && node sync_changelog.js`（类型检查 + 版本注入 + 更新日志注入小程序）。

### 11. 发布

- **小程序端**：微信开发者工具重新编译 → 上传（主包上限 2048KB）
- **云函数**：改动的函数需在开发者工具重新上传部署才对线上生效
- **提交与标签**（若使用）：
  ```bash
  git add . && git commit -m "chore: release vX.Y.Z"
  git tag vX.Y.Z && git push && git push --tags
  ```
