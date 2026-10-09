#!/usr/bin/env node
/**
 * 生成 .agents/skills/INDEX.md —— 技能与规则索引。
 *
 * 用法：
 *   node scripts/sync-agent-index.mjs          # 生成 / 更新索引
 *   node scripts/sync-agent-index.mjs --check   # 只校验是否已同步（不同步则退出码 1）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const AGENTS_DIR = path.join(ROOT, '.agents');
const SKILLS_DIR = path.join(AGENTS_DIR, 'skills');
const RULES_DIR = path.join(AGENTS_DIR, 'rules');
const INDEX_PATH = path.join(SKILLS_DIR, 'INDEX.md');

/** 读取 SKILL.md 的 YAML frontmatter（只取单行的 name / description） */
function readFrontmatter(file) {
  const head = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(0, 12);
  const out = {};
  let inFm = false;
  for (const line of head) {
    if (line.trim() === '---') {
      if (inFm) break;
      inFm = true;
      continue;
    }
    if (!inFm) continue;
    const m = line.match(/^(name|description)\s*:\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function listSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = path.join(SKILLS_DIR, d.name, 'SKILL.md');
      if (!fs.existsSync(file)) return null;
      const fm = readFrontmatter(file);
      return {
        dir: d.name,
        name: fm.name || d.name,
        description: fm.description || '(未填写 description)',
        rel: `.agents/skills/${d.name}/SKILL.md`
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listRules() {
  if (!fs.existsSync(RULES_DIR)) return [];
  return fs
    .readdirSync(RULES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const file = path.join(RULES_DIR, f);
      const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/)[0] || '';
      const title = firstLine.replace(/^#\s*/, '').trim() || f;
      return { file: f, title, rel: `.agents/rules/${f}` };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

function build() {
  const skills = listSkills();
  const rules = listRules();

  let md = '# 技能与规则索引\n\n';
  md += '> 本文件由 `node scripts/sync-agent-index.mjs` 自动生成，**请勿手改**。\n\n';
  md += '---\n\n';
  md += `## 技能（${skills.length}）\n\n`;
  md += '| 技能 | 用途 | 路径 |\n|---|---|---|\n';
  for (const s of skills) {
    md += `| \`${s.name}\` | ${s.description.replace(/\|/g, '\\|')} | \`${s.rel}\` |\n`;
  }
  md += '\n---\n\n';
  md += `## 规则（${rules.length}）\n\n`;
  md += '| 规则 | 标题 | 路径 |\n|---|---|---|\n';
  for (const r of rules) {
    md += `| \`${r.file}\` | ${r.title.replace(/\|/g, '\\|')} | \`${r.rel}\` |\n`;
  }
  md += '\n---\n\n';
  md += '## 相关入口\n\n';
  md += '- `AGENTS.md` —— 所有 Agent 的入口索引\n';
  md += '- `CLAUDE.md` —— Claude 专属（`@AGENTS.md` 导入通用部分）\n';
  md += '- `.agents/README.md` —— 本目录的使用与接线说明\n';
  return md;
}

const next = build();
const check = process.argv.includes('--check');
const prev = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : '';

if (check) {
  if (prev === next) {
    console.log('✅ .agents/skills/INDEX.md 已是最新');
    process.exit(0);
  }
  console.error('❌ .agents/skills/INDEX.md 与当前技能/规则不一致，请运行：node scripts/sync-agent-index.mjs');
  process.exit(1);
}

fs.mkdirSync(SKILLS_DIR, { recursive: true });
fs.writeFileSync(INDEX_PATH, next, 'utf8');
console.log(`✅ 已生成 .agents/skills/INDEX.md（技能 ${listSkills().length} 个 / 规则 ${listRules().length} 个）`);
