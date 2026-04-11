class WebDAVManager {
  constructor() {
    this.webdavConfig = wx.getStorageSync('webdavConfig') || {
      url: '',
      username: '',
      password: '',
      folder: ''
    };
  }

  // 测试WebDAV连接
  testWebDAVConnection(callback) {
    const { url, username, password } = this.webdavConfig;
    
    if (!url || !username || !password) {
      wx.showToast({
        title: '请先填写完整的服务器信息',
        icon: 'none'
      });
      if (callback) callback(false);
      return;
    }
    
    // 验证URL格式
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      wx.showToast({
        title: 'URL格式错误，请包含http://或https://',
        icon: 'none'
      });
      if (callback) callback(false);
      return;
    }
    
    wx.showLoading({
      title: '测试连接中...'
    });
    
    try {
      // 生成测试文件内容
      const testContent = JSON.stringify({
        test: true,
        timestamp: new Date().toISOString(),
        message: 'WebDAV连接测试文件'
      }, null, 2);
      
      // 生成测试文件名
      const testFileName = `webdav_test_${Date.now()}.json`;
      const testFilePath = `${wx.env.USER_DATA_PATH}/${testFileName}`;
      const fs = wx.getFileSystemManager();
      
      // 写入测试文件
      fs.writeFile({
        filePath: testFilePath,
        data: testContent,
        encoding: 'utf8',
        success: () => {
          // 生成固定的测试文件夹名
          let folder = this.webdavConfig.folder;
          if (!folder) {
            const user = wx.getStorageSync('username') || '未命名用户';
            folder = `${user}排班备份`;
          }
          
          // 上传测试文件到WebDAV
          this.uploadToWebDAV(testFilePath, testFileName, url, username, password, folder).then(() => {
            // 上传成功后，检查文件是否存在
            this.checkWebDAVFileExists(url, username, password, folder, testFileName).then((exists) => {
              if (exists) {
                // 文件存在，连接成功
                // 删除测试文件
                this.deleteWebDAVFile(url, username, password, folder, testFileName);
                // 删除本地测试文件
                fs.unlinkSync(testFilePath);
                wx.hideLoading();
                wx.showToast({
                  title: '连接成功',
                  icon: 'success'
                });
                if (callback) callback(true);
              } else {
                // 文件不存在，连接失败
                fs.unlinkSync(testFilePath);
                wx.hideLoading();
                wx.showToast({
                  title: '连接失败：无法验证文件上传',
                  icon: 'none'
                });
                if (callback) callback(false);
              }
            }).catch((err) => {
              console.error('检查测试文件失败', err);
              fs.unlinkSync(testFilePath);
              wx.hideLoading();
              wx.showToast({
                title: '连接失败：无法验证文件上传',
                icon: 'none'
              });
              if (callback) callback(false);
            });
          }).catch((err) => {
            console.error('上传测试文件失败', err);
            fs.unlinkSync(testFilePath);
            wx.hideLoading();
            wx.showToast({
              title: '连接失败：无法上传测试文件',
              icon: 'none'
            });
            if (callback) callback(false);
          });
        },
        fail: (err) => {
          console.error('创建测试文件失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '连接失败：无法创建测试文件',
            icon: 'none'
          });
          if (callback) callback(false);
        }
      });
    } catch (e) {
      console.error('测试连接失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '连接失败：测试过程中出现错误',
        icon: 'none'
      });
      if (callback) callback(false);
    }
  }

  // 检查WebDAV服务器上文件是否存在
  checkWebDAVFileExists(url, username, password, folder, fileName) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      // 使用HEAD方法检查文件是否存在
      wx.request({
        url: fileUrl,
        method: 'HEAD',
        header: {
          'Authorization': authHeader
        },
        success: (res) => {
          if (res.statusCode === 200) {
            // 文件存在
            resolve(true);
          } else if (res.statusCode === 404) {
            // 文件不存在
            resolve(false);
          } else {
            console.error('检查文件存在性失败', res.statusCode);
            resolve(false);
          }
        },
        fail: (err) => {
          console.error('检查文件存在性请求失败', err);
          // HEAD请求失败后尝试GET请求
          wx.request({
            url: fileUrl,
            method: 'GET',
            header: {
              'Authorization': authHeader
            },
            success: (res) => {
              if (res.statusCode === 200) {
                // 文件存在
                resolve(true);
              } else {
                resolve(false);
              }
            },
            fail: (err) => {
              console.error('GET请求检查文件存在性失败', err);
              resolve(false);
            }
          });
        }
      });
    });
  }

  // 构建WebDAV URL
  buildWebDAVUrl(baseUrl, folder, fileName) {
    // 确保baseUrl以/结尾
    let url = baseUrl;
    if (!url.endsWith('/')) {
      url += '/';
    }
    
    // 添加文件夹路径
    if (folder) {
      // 确保folder不以/开头和结尾
      let folderPath = folder;
      if (folderPath.startsWith('/')) {
        folderPath = folderPath.substring(1);
      }
      if (folderPath.endsWith('/')) {
        folderPath = folderPath.substring(0, folderPath.length - 1);
      }
      url += folderPath + '/';
    }
    
    // 添加文件名
    url += fileName;
    
    return url;
  }

  // Base64编码
  base64Encode(str) {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    
    while (i < str.length) {
      const c1 = str.charCodeAt(i++) & 0xff;
      const c2 = i < str.length ? str.charCodeAt(i++) & 0xff : 0;
      const c3 = i < str.length ? str.charCodeAt(i++) & 0xff : 0;
      
      const enc1 = c1 >> 2;
      const enc2 = ((c1 & 3) << 4) | (c2 >> 4);
      const enc3 = ((c2 & 15) << 2) | (c3 >> 6);
      const enc4 = c3 & 63;
      
      result += base64Chars.charAt(enc1) + base64Chars.charAt(enc2) +
                (i > str.length + 1 ? '=' : base64Chars.charAt(enc3)) +
                (i > str.length ? '=' : base64Chars.charAt(enc4));
    }
    
    return result;
  }

  // 上传文件到WebDAV
  uploadToWebDAV(filePath, fileName, url, username, password, folder) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      const fs = wx.getFileSystemManager();
      
      // 读取文件内容
      fs.readFile({
        filePath: filePath,
        success: (res) => {
          // 上传文件
          wx.request({
            url: fileUrl,
            method: 'PUT',
            header: {
              'Authorization': authHeader,
              'Content-Type': 'application/octet-stream'
            },
            data: res.data,
            success: (res) => {
              if (res.statusCode === 200 || res.statusCode === 201) {
                resolve();
              } else {
                reject(new Error(`上传失败，状态码: ${res.statusCode}`));
              }
            },
            fail: (err) => {
              reject(err);
            }
          });
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }

  // 删除WebDAV上的文件
  deleteWebDAVFile(url, username, password, folder, fileName) {
    return new Promise((resolve, reject) => {
      const fileUrl = this.buildWebDAVUrl(url, folder, fileName);
      const authHeader = 'Basic ' + this.base64Encode(`${username}:${password}`);
      
      wx.request({
        url: fileUrl,
        method: 'DELETE',
        header: {
          'Authorization': authHeader
        },
        success: (res) => {
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve();
          } else {
            reject(new Error(`删除失败，状态码: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  }

  // 保存WebDAV配置
  saveWebDAVConfig(config) {
    this.webdavConfig = config;
    wx.setStorageSync('webdavConfig', config);
  }

  // 获取WebDAV配置
  getWebDAVConfig() {
    return this.webdavConfig;
  }

  // 提取和恢复备份
  extractAndRestoreBackup(filePath, fs) {
    return new Promise((resolve, reject) => {
      // 这里可以实现从ZIP文件提取和恢复备份的逻辑
      // 由于代码较长，这里只提供一个框架
      resolve();
    });
  }
}

module.exports = WebDAVManager;