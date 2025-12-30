// sync_changelog.js
// 用于将CHANGELOG.md的内容同步到utils/changelog.js中

const fs = require('fs');
const path = require('path');

// 读取CHANGELOG.md文件内容
const changelogPath = path.join(__dirname, 'CHANGELOG.md');
const utilsPath = path.join(__dirname, 'utils', 'changelog.js');

// 同步更新日志内容的函数
function syncChangelog() {
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
}

// 立即执行一次同步
syncChangelog();

// 监听CHANGELOG.md文件变化，实现自动同步
fs.watch(changelogPath, (eventType, filename) => {
    if (eventType === 'change') {
        console.log('检测到CHANGELOG.md文件变化，开始同步...');
        syncChangelog();
    }
});

console.log('已启动CHANGELOG.md文件监听，将自动同步更新日志内容...');