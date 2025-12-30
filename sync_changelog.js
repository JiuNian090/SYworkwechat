// sync_changelog.js
// 用于将CHANGELOG.md的内容同步到utils/changelog.js中

const fs = require('fs');
const path = require('path');

// 读取CHANGELOG.md文件内容
const changelogPath = path.join(__dirname, 'CHANGELOG.md');
const utilsPath = path.join(__dirname, 'utils', 'changelog.js');

// 读取CHANGELOG.md文件内容
fs.readFile(changelogPath, 'utf8', (err, data) => {
    if (err) {
        console.error('读取CHANGELOG.md失败:', err);
        return;
    }
    
    // 生成utils/changelog.js文件内容
    const changelogContent = `// utils/changelog.js
// 存储更新日志内容，与CHANGELOG.md保持一致

module.exports = {
  changelogContent: \`${data.trim()}\`
};`;
    
    // 写入utils/changelog.js文件
    fs.writeFile(utilsPath, changelogContent, 'utf8', (err) => {
        if (err) {
            console.error('写入utils/changelog.js失败:', err);
            return;
        }
        
        console.log('CHANGELOG.md内容已成功同步到utils/changelog.js!');
    });
});