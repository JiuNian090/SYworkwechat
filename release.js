'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 版本发布脚本
 * 功能：
 * 1. 获取上一个tag到当前的所有提交
 * 2. 智能分类提交内容
 * 3. 生成面向用户的更新日志
 * 4. 更新所有版本相关文件
 */

// 配置：提交信息分类规则
const CATEGORY_RULES = [
  {
    name: '🎉 新增',
    keywords: ['新增', '添加', '增加', '新功能', 'feat', 'add', 'feature', 'create'],
    emoji: '🎉'
  },
  {
    name: '✨ 优化',
    keywords: ['优化', '改进', '提升', '增强', 'perf', 'improve', 'enhance', 'optimize'],
    emoji: '✨'
  },
  {
    name: '🔧 修复',
    keywords: ['修复', 'bug', '解决', '修复', 'fix', 'resolve', 'correct'],
    emoji: '🔧'
  },
  {
    name: '⚡ 调整',
    keywords: ['调整', '变更', '修改', 'refactor', 'change', 'modify', 'adjust'],
    emoji: '⚡'
  },
  {
    name: '🏗️ 重构',
    keywords: ['重构', '重写', '架构', 'refactor', 'rewrite', 'architecture'],
    emoji: '🏗️'
  },
  {
    name: '📊 图表',
    keywords: ['图表', '统计', '统计图', 'chart', 'statistics', 'graph'],
    emoji: '📊'
  },
  {
    name: '🎨 样式',
    keywords: ['样式', 'UI', '界面', '视觉', 'style', 'ui', 'design', 'visual', 'css'],
    emoji: '🎨'
  }
];

// 项目路径
const PROJECT_ROOT = __dirname;
const CHANGELOG_PATH = path.join(PROJECT_ROOT, 'CHANGELOG.md');
const PACKAGE_PATH = path.join(PROJECT_ROOT, 'package.json');
const PROJECT_CONFIG_PATH = path.join(PROJECT_ROOT, 'project.config.json');
const VERSION_INFO_PATH = path.join(PROJECT_ROOT, 'utils', 'versionInfo.js');
const CONFIG_TS_PATH = path.join(PROJECT_ROOT, 'config.ts');
const CLOUD_FUNCTIONS_PATH = path.join(PROJECT_ROOT, 'cloudfunctions');

// 获取Git提交历史
function getGitCommits(sinceTag) {
  try {
    let command;
    if (sinceTag) {
      command = `git log ${sinceTag}..HEAD --pretty=format:"%s|%b" --no-merges`;
    } else {
      command = `git log --pretty=format:"%s|%b" --no-merges -50`;
    }
    const output = execSync(command, { encoding: 'utf8', cwd: PROJECT_ROOT });
    return output.split('\n').filter(line => line.trim());
  } catch (e) {
    console.warn('获取Git提交历史失败:', e.message);
    return [];
  }
}

// 获取最新的tag
function getLatestTag() {
  try {
    const tags = execSync('git tag --sort=-v:refname', { encoding: 'utf8', cwd: PROJECT_ROOT })
      .split('\n')
      .filter(t => t.trim());
    return tags[0] || null;
  } catch (e) {
    console.warn('获取Git标签失败:', e.message);
    return null;
  }
}

// 分类提交信息
function categorizeCommits(commits) {
  const categorized = {};
  CATEGORY_RULES.forEach(cat => {
    categorized[cat.name] = [];
  });
  categorized['其他'] = [];

  commits.forEach(commitLine => {
    const [subject, body] = commitLine.split('|');
    const fullText = (subject + ' ' + body).toLowerCase();

    let matched = false;
    for (const cat of CATEGORY_RULES) {
      for (const keyword of cat.keywords) {
        if (fullText.includes(keyword.toLowerCase())) {
          // 清理提交信息，移除技术前缀（如 feat:, fix: 等）
          let cleanSubject = subject.trim();
          cleanSubject = cleanSubject.replace(/^[a-z]+(\([^)]+\))?:\s*/i, '');
          categorized[cat.name].push(cleanSubject);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      let cleanSubject = subject.trim();
      cleanSubject = cleanSubject.replace(/^[a-z]+(\([^)]+\))?:\s*/i, '');
      categorized['其他'].push(cleanSubject);
    }
  });

  return categorized;
}

// 生成面向用户的更新日志内容
function generateUserFriendlyChangelog(categorized, version, date) {
  let content = `## v${version} (${date})\n`;

  CATEGORY_RULES.forEach(cat => {
    const items = categorized[cat.name];
    if (items.length > 0) {
      items.forEach(item => {
        content += `- ${cat.emoji} ${item}\n`;
      });
    }
  });

  // 添加其他类别的内容（合并到优化或新增）
  const otherItems = categorized['其他'];
  if (otherItems.length > 0) {
    otherItems.forEach(item => {
      content += `- ✨ ${item}\n`;
    });
  }

  return content;
}

// 读取现有CHANGELOG
function readChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return '# SYwork 项目更新日志\n\n';
  }
  return fs.readFileSync(CHANGELOG_PATH, 'utf8');
}

// 写入CHANGELOG
function writeChangelog(newContent) {
  const existingContent = readChangelog();
  const headerEnd = existingContent.indexOf('\n## ');
  let finalContent;

  if (headerEnd === -1) {
    finalContent = existingContent.trim() + '\n\n' + newContent;
  } else {
    finalContent = existingContent.substring(0, headerEnd + 1) + '\n' + newContent + '\n' + existingContent.substring(headerEnd + 1);
  }

  fs.writeFileSync(CHANGELOG_PATH, finalContent);
  console.log('✅ CHANGELOG.md 已更新');
}

// 更新package.json
function updatePackageJson(version) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2));
  console.log('✅ package.json 已更新');
}

// 更新project.config.json
function updateProjectConfig(version) {
  if (fs.existsSync(PROJECT_CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(PROJECT_CONFIG_PATH, 'utf8'));
    config.version = version;
    fs.writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('✅ project.config.json 已更新');
  }
}

// 更新versionInfo.js
function updateVersionInfo(version) {
  const content = `'use strict';
// 自动生成的版本信息文件
const versionInfo = {
  'version': '${version}',
  'buildTime': '${new Date().toISOString()}',
  'commit': '${process.env.GIT_COMMIT || 'unknown'}'
};
module.exports = versionInfo;
`;
  fs.writeFileSync(VERSION_INFO_PATH, content);
  console.log('✅ utils/versionInfo.js 已更新');
}

// 更新config.ts中的backupSystemVersion
function updateConfigTs(version) {
  let content = fs.readFileSync(CONFIG_TS_PATH, 'utf8');
  content = content.replace(
    /backupSystemVersion:\s*['"][^'"]*['"]/,
    `backupSystemVersion: 'v${version}'`
  );
  fs.writeFileSync(CONFIG_TS_PATH, content);
  console.log('✅ config.ts 已更新');
}

// 更新云函数中的BACKUP_SYSTEM_VERSION
function updateCloudFunctions(version) {
  const cloudFunctions = ['backup', 'restore', 'cleanup'];
  cloudFunctions.forEach(func => {
    const filePath = path.join(CLOUD_FUNCTIONS_PATH, func, 'index.js');
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(
        /const BACKUP_SYSTEM_VERSION\s*=\s*['"][^'"]*['"]/,
        `const BACKUP_SYSTEM_VERSION = 'v${version}'`
      );
      fs.writeFileSync(filePath, content);
      console.log(`✅ cloudfunctions/${func}/index.js 已更新`);
    }
  });
}

// 同步changelog到utils/changelog.ts
function syncChangelogToTs() {
  const changelogContent = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const tsContent = `'use strict';

interface ChangelogData {
  changelogContent: string;
}

const changelogData: ChangelogData = {
  changelogContent: \`${changelogContent.trim()}\`
};

module.exports = changelogData;

export {};
`;
  fs.writeFileSync(path.join(PROJECT_ROOT, 'utils', 'changelog.ts'), tsContent);
  console.log('✅ utils/changelog.ts 已同步');
}

// 主函数
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let version = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' || args[i] === '-v') {
      version = args[i + 1];
      i++;
    } else if (args[i].startsWith('v')) {
      version = args[i].substring(1);
    } else if (/^\d+\.\d+\.\d+$/.test(args[i])) {
      version = args[i];
    }
  }

  if (!version) {
    console.error('❌ 请指定版本号，例如: node release.js v1.2.3 或 node release.js --version 1.2.3');
    console.error('使用方式: npm run release vx.x.x');
    process.exit(1);
  }

  console.log(`🚀 开始发布版本 v${version}`);

  // 获取提交历史
  const latestTag = getLatestTag();
  console.log(latestTag ? `📝 读取提交历史 (自 ${latestTag} 起)` : '📝 读取最近的提交历史');
  
  const commits = getGitCommits(latestTag);
  if (commits.length === 0) {
    console.warn('⚠️ 没有找到新的提交');
  } else {
    console.log(`📋 找到 ${commits.length} 条新提交`);
  }

  // 分类提交
  const categorized = categorizeCommits(commits);

  // 生成日期
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 生成更新日志内容
  const changelogContent = generateUserFriendlyChangelog(categorized, version, dateStr);
  console.log('\n📄 生成的更新日志:');
  console.log(changelogContent);

  // 更新文件
  writeChangelog(changelogContent);
  updatePackageJson(version);
  updateProjectConfig(version);
  updateVersionInfo(version);
  updateConfigTs(version);
  updateCloudFunctions(version);
  syncChangelogToTs();

  console.log('\n🎉 版本发布完成！');
  console.log('\n📌 下一步操作:');
  console.log(`1. 检查文件变更: git diff`);
  console.log(`2. 提交变更: git add . && git commit -m "chore: release v${version}"`);
  console.log(`3. 创建标签: git tag v${version}`);
  console.log(`4. 推送: git push && git push --tags`);
}

// 导出供其他脚本使用
module.exports = {
  getGitCommits,
  getLatestTag,
  categorizeCommits,
  generateUserFriendlyChangelog
};

// 直接运行
if (require.main === module) {
  main().catch(e => {
    console.error('❌ 发布失败:', e);
    process.exit(1);
  });
}
