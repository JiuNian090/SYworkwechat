'use strict';
const fs = require('fs');
const path = require('path');

// 读取package.json文件
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 读取project.config.json文件
const projectConfigPath = path.join(__dirname, 'project.config.json');
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));

// 读取CHANGELOG.md文件，获取最新版本号
const changelogPath = path.join(__dirname, 'CHANGELOG.md');
const changelogContent = fs.readFileSync(changelogPath, 'utf8');

// 从CHANGELOG.md中提取最新版本号
function getLatestVersionFromChangelog() {
  const versionRegex = /## v([0-9]+\.[0-9]+\.[0-9]+)/;
  const match = changelogContent.match(versionRegex);
  return match ? match[1] : packageJson.version;
}

// 更新版本号
function updateVersion() {
  const latestVersion = getLatestVersionFromChangelog();

  // 更新package.json
  packageJson.version = latestVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // 更新project.config.json
  projectConfig.version = latestVersion;
  fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2));

  console.log(`版本号已更新为: v${latestVersion}`);
  return latestVersion;
}

// 生成版本信息文件
function generateVersionInfo() {
  const version = updateVersion();

  const versionInfoPath = path.join(__dirname, 'utils', 'versionInfo.js');
  const versionInfoContent = `'use strict';\n// 自动生成的版本信息文件
const versionInfo = {
  'version': '${version}',
  'buildTime': '${new Date().toISOString()}',
  'commit': '${process.env.GIT_COMMIT || 'unknown'}'
};
module.exports = versionInfo;
`;

  // 确保utils目录存在
  if (!fs.existsSync(path.join(__dirname, 'utils'))) {
    fs.mkdirSync(path.join(__dirname, 'utils'));
  }

  fs.writeFileSync(versionInfoPath, versionInfoContent);
  console.log('版本信息文件已生成');
}

// 导出函数
if (require.main === module) {
  generateVersionInfo();
}

module.exports = {
  updateVersion,
  generateVersionInfo
};
