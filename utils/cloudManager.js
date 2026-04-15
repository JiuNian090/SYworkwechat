const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation } = require('./imageRelation.js');

/**
 * 云开发工具类 - 增量备份和恢复
 * 支持微信云开发，通过账号密码实现数据同步
 */
class CloudManager {
  constructor() {
    this.userId = null;
  }
  
  // 备份系统版本号
  get BACKUP_SYSTEM_VERSION() {
    return 'v1.0.0';
  }
  
  // 检查云开发是否初始化成功
  isCloudInitialized() {
    const app = getApp();
    return app.globalData.cloudInitialized;
  }
  
  // 调用云函数的通用方法，包含超时处理和重试机制
  async callCloudFunction(name, data, options = {}) {
    const { timeout = 10000, maxRetries = 3, retryDelay = 1000 } = options;
    
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('云函数调用超时'));
          }, timeout);
        });
        
        const result = await Promise.race([
          wx.cloud.callFunction({ name, data }),
          timeoutPromise
        ]);
        
        return result;
      } catch (e) {
        retries++;
        if (retries >= maxRetries) {
          throw e;
        }
        console.warn(`云函数调用失败，正在重试(${retries}/${maxRetries})...`, e);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // 用户注册
  async register(account, password, nickname) {
    try {
      // 检查云开发是否初始化成功
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }
      
      const result = await this.callCloudFunction('userLogin', {
        action: 'register',
        account: account,
        password: password,
        nickname: nickname
      });
      
      if (result.result.success) {
        this.userId = result.result.data.userId;
        wx.setStorageSync('cloudUserId', this.userId);
        wx.setStorageSync('cloudAccount', account);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('注册失败', e);
      return {
        success: false,
        errMsg: e.message || '注册失败'
      };
    }
  }
  
  // 用户登录
  async login(account, password) {
    try {
      // 检查云开发是否初始化成功
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }
      
      const result = await this.callCloudFunction('userLogin', {
        action: 'login',
        account: account,
        password: password
      });
      
      if (result.result.success) {
        this.userId = result.result.data.userId;
        wx.setStorageSync('cloudUserId', this.userId);
        wx.setStorageSync('cloudAccount', account);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('登录失败', e);
      return {
        success: false,
        errMsg: e.message || '登录失败'
      };
    }
  }
  
  // 检查是否已登录
  isLoggedIn() {
    if (!this.userId) {
      this.userId = wx.getStorageSync('cloudUserId');
    }
    return !!this.userId;
  }
  
  // 退出登录
  logout() {
    this.userId = null;
    wx.removeStorageSync('cloudUserId');
    wx.removeStorageSync('cloudAccount');
  }
  
  // 获取当前账号
  getCurrentAccount() {
    return wx.getStorageSync('cloudAccount') || '';
  }
  
  // 计算哈希值（用于差异检测）
  calculateHash(data) {
    if (typeof data === 'string') {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return hash.toString(16);
    }
    return '0';
  }
  
  // 获取本地数据
  getLocalData() {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const shifts = wx.getStorageSync('shifts') || {};
    
    const shiftTemplatesJson = JSON.stringify(shiftTemplates);
    const shiftsJson = JSON.stringify(shifts);
    
    return {
      shiftTemplates: {
        data: shiftTemplates,
        hash: this.calculateHash(shiftTemplatesJson),
        size: shiftTemplatesJson.length
      },
      shifts: {
        data: shifts,
        hash: this.calculateHash(shiftsJson),
        size: shiftsJson.length
      }
    };
  }
  
  // 检测并更新旧格式图片名称
  checkAndUpdateOldImageNames() {
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    let hasUpdated = false;
    
    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];
      
      // 检测并更新旧格式图片
      const updatedImages = weekImages.map(image => {
        // 检查是否为旧格式：包含"年"、"月"、"周"等中文字符
        if (image.name && (image.name.includes('年') || image.name.includes('月') || 
            image.name.includes('第') || image.name.includes('周'))) {
          hasUpdated = true;
          
          // 从 weekKey 中提取日期信息
          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = this.getWeekOfMonth(weekDate);
          
          // 生成新格式名称：年 - 月 - 周数字
          const newName = `${year}-${month}-${week}`;
          
          return {
            ...image,
            name: newName,
            updatedTime: new Date().toISOString()
          };
        }
        return image;
      });
      
      // 如果有更新，保存到本地存储
      if (hasUpdated) {
        wx.setStorageSync(weekKey, updatedImages);
        console.log(`已更新周 ${weekKey} 的图片名称格式`);
      }
    });
    
    return hasUpdated;
  }
  
  // 获取本地所有图片
  getAllLocalImages() {
    // 首先检测并更新旧格式图片名称
    this.checkAndUpdateOldImageNames();
    
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    const images = [];
    const imageWeekRelation = {};
    
    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];
      if (weekImages.length > 0) {
        imageWeekRelation[weekKey] = weekImages.map(img => ({
          name: img.name,
          path: img.path
        }));
        
        weekImages.forEach((image, index) => {
          // 解析周信息，生成新格式图片名：年 - 月 - 周数字
          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = this.getWeekOfMonth(weekDate);
          
          const yearMonth = `${year}-${month}`;
          const imageName = `${year}-${month}-${week}`;
          const remotePath = `images/${yearMonth}/${imageName}_${index}.jpg`;
          
          images.push({
            weekKey: weekKey,
            image: image,
            yearMonth: yearMonth,
            imageName: imageName,
            remotePath: remotePath,
            index: index
          });
        });
      }
    });
    
    return { images, imageWeekRelation };
  }

  // 获取某个日期是当月的第几周
  getWeekOfMonth(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const adjustedDate = date.getDate() + dayOfWeek;
    return Math.ceil(adjustedDate / 7);
  }

  // 验证图片文件是否存在
  validateImageExists(imagePath) {
    return new Promise((resolve) => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.getFileInfo({
        filePath: imagePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  }
  
  // 计算图片哈希值（基于图片内容、位置和名称）
  calculateImageHash(imagePath, weekKey, imageName) {
    return new Promise((resolve, reject) => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.getFileInfo({
        filePath: imagePath,
        success: (res) => {
          // 基于文件内容（大小+修改时间）、位置（weekKey）和名称（imageName）计算哈希值
          // 这样只有当图片内容、位置或名称改变时，哈希值才会变化
          const hashInput = `${res.size}_${res.mtime}_${weekKey}_${imageName}`;
          const hash = this.calculateHash(hashInput);
          resolve(hash);
        },
        fail: (err) => {
          console.error('获取文件信息失败', err);
          resolve('0');
        }
      });
    });
  }
  
  // 备份数据 - 增量备份，只上传有变化的图片
  async backup() {
    try {
      // 检查云开发是否初始化成功
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }
      
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      wx.showLoading({ title: '准备备份...' });
      
      // 1. 获取本地数据
      const localData = this.getLocalData();
      
      // 使用新的图片关联表工具获取所有有效图片
      const { images: validImages, imageWeekRelation: validImageWeekRelation } = await getAllValidImages();
      
      // 2. 获取云端备份信息，了解已有哪些图片
      let existingImages = [];
      try {
        const infoResult = await this.callCloudFunction('backupRestore', {
          action: 'getBackupInfo',
          userId: this.userId
        });
        if (infoResult.result.success && infoResult.result.hasBackup) {
          // 获取完整的备份数据，对比图片
          const restoreResult = await this.callCloudFunction('backupRestore', {
            action: 'restore',
            userId: this.userId
          });
          if (restoreResult.result.success) {
            existingImages = restoreResult.result.data.images || [];
          }
        }
      } catch (e) {
        console.log('获取云端备份信息失败，假设是新备份', e);
      }
      
      // 3. 对比本地和云端图片，只上传新的或变化的图片
      const uploadedImages = [];
      let newImageCount = 0;
      let updatedImageCount = 0;
      const existingImageMap = new Map();
      
      // 创建云端图片映射，用于快速查找
      existingImages.forEach(img => {
        if (img.remotePath) {
          existingImageMap.set(img.remotePath, img);
        }
      });
      
      // 上传图片到云存储（只上传新的或变化的图片）
      // 并行上传，控制并发数
      const maxConcurrentUploads = 5; // 控制并发数，避免超过微信小程序限制
      const uploadBatches = [];
      
      // 准备需要上传的图片
      const imagesToUpload = [];
      for (const imgInfo of validImages) {
        const existingImg = existingImageMap.get(imgInfo.remotePath);
        let shouldUpload = true;
        let imageHash = null;
        
        // 如果云端已存在，检查是否需要重新上传
        if (existingImg) {
          // 检查图片名称是否变化
          if (existingImg.imageName !== imgInfo.imageName) {
            // 名称变化，需要重新计算哈希值并上传
            imageHash = await this.calculateImageHash(imgInfo.image.path, imgInfo.weekKey, imgInfo.imageName);
            updatedImageCount++;
          } else {
            // 名称未变化，检查哈希值是否相同
            // 复用云端的哈希值进行比较
            imageHash = existingImg.hash;
            // 只对可能变化的图片重新计算哈希值
            const currentHash = await this.calculateImageHash(imgInfo.image.path, imgInfo.weekKey, imgInfo.imageName);
            if (existingImg.hash === currentHash) {
              shouldUpload = false;
              // 复用云端的 fileID
              uploadedImages.push({
                ...imgInfo,
                fileID: existingImg.fileID,
                hash: currentHash
              });
            } else {
              // 哈希值不同，需要更新
              imageHash = currentHash;
              updatedImageCount++;
            }
          }
        } else {
          // 新图片，计算哈希值
          imageHash = await this.calculateImageHash(imgInfo.image.path, imgInfo.weekKey, imgInfo.imageName);
          newImageCount++;
        }
        
        if (shouldUpload && imageHash) {
          imagesToUpload.push({ ...imgInfo, hash: imageHash });
        }
      }
      
      // 计算需要上传的图片数量
      const totalImages = imagesToUpload.length;
      let currentImage = 0;
      
      // 分批次并行上传
      for (let i = 0; i < imagesToUpload.length; i += maxConcurrentUploads) {
        const batch = imagesToUpload.slice(i, i + maxConcurrentUploads);
        const batchPromises = batch.map(async (imgInfo) => {
          try {
            // 更新进度
            currentImage++;
            const progress = Math.round((currentImage / totalImages) * 100);
            const existingImg = existingImageMap.get(imgInfo.remotePath);
            const imageHash = imgInfo.hash;
            const operation = existingImg && existingImg.hash !== imageHash ? '更新' : '新增';
            wx.showLoading({ 
              title: `备份中 ${operation}图片 ${currentImage}/${totalImages} (${progress}%)`,
              mask: true
            });
            
            // 压缩图片
            let compressedPath = imgInfo.image.path;
            try {
              const compressResult = await new Promise((resolve, reject) => {
                wx.compressImage({
                  src: imgInfo.image.path,
                  quality: 80, // 压缩质量，0-100
                  success: resolve,
                  fail: reject
                });
              });
              compressedPath = compressResult.tempFilePath;
            } catch (e) {
              console.log('图片压缩失败，使用原图', e);
            }
            
            // 上传压缩后的图片到云存储
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: `schedule_images/${this.userId}/${imgInfo.remotePath}`,
              filePath: compressedPath
            });
            
            uploadedImages.push({
              ...imgInfo,
              fileID: uploadResult.fileID
            });
          } catch (e) {
            console.error('上传图片失败', imgInfo.remotePath, e);
          }
        });
        
        // 等待当前批次上传完成
        await Promise.all(batchPromises);
      }
      
      // 获取头像信息
      const avatarInfo = {
        avatarType: wx.getStorageSync('avatarType') || 'text',
        avatarEmoji: wx.getStorageSync('avatarEmoji') || '',
        username: wx.getStorageSync('username') || ''
      };
      
      // 4. 调用云函数备份数据（云函数会对比差异，只更新有变化的数据）
      wx.showLoading({ title: '保存备份数据...' });
      const backupResult = await this.callCloudFunction('backupRestore', {
        action: 'backup',
        userId: this.userId,
        data: {
          shiftTemplates: localData.shiftTemplates.data,
          shifts: localData.shifts.data,
          images: uploadedImages,
          imageWeekRelation: validImageWeekRelation,
          avatarInfo: avatarInfo,
          backupIndex: {},
          version: this.BACKUP_SYSTEM_VERSION
        }
      });
      
      wx.hideLoading();
      
      if (backupResult.result.success) {
        const deletedImageCount = backupResult.result.deletedImageCount || 0;
        
        let message;
        if (backupResult.result.hasChanges) {
          if (newImageCount > 0 && updatedImageCount > 0 && deletedImageCount > 0) {
            message = `备份成功（新增${newImageCount}张，更新${updatedImageCount}张，删除${deletedImageCount}张）`;
          } else if (newImageCount > 0 && updatedImageCount > 0) {
            message = `备份成功（新增${newImageCount}张，更新${updatedImageCount}张）`;
          } else if (newImageCount > 0 && deletedImageCount > 0) {
            message = `备份成功（新增${newImageCount}张，删除${deletedImageCount}张）`;
          } else if (updatedImageCount > 0 && deletedImageCount > 0) {
            message = `备份成功（更新${updatedImageCount}张，删除${deletedImageCount}张）`;
          } else if (newImageCount > 0) {
            message = `备份成功（新增${newImageCount}张图片）`;
          } else if (updatedImageCount > 0) {
            message = `备份成功（更新${updatedImageCount}张图片）`;
          } else if (deletedImageCount > 0) {
            message = `备份成功（删除${deletedImageCount}张图片）`;
          } else {
            message = '备份成功（有更新）';
          }
        } else {
          message = '备份成功（无变化）';
        }
          
        wx.showToast({
          title: message,
          icon: 'success'
        });
        return {
          success: true,
          uploadedImages: newImageCount + updatedImageCount,
          newImages: newImageCount,
          updatedImages: updatedImageCount,
          deletedImages: deletedImageCount,
          hasChanges: backupResult.result.hasChanges
        };
      } else {
        wx.showToast({
          title: backupResult.result.errMsg || '备份失败',
          icon: 'none'
        });
        return backupResult.result;
      }
      
    } catch (e) {
      console.error('备份失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '备份失败',
        icon: 'none'
      });
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
  
  // 比较版本号大小
  compareVersions(version1, version2) {
    const v1 = version1.replace('v', '').split('.').map(Number);
    const v2 = version2.replace('v', '').split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }
  
  // 执行恢复操作
  async performRestore(backupData) {
    // 清空基础数据（确保与云端完全一致）
    wx.removeStorageSync('shifts');
    wx.removeStorageSync('shiftTemplates');
    wx.removeStorageSync('statData');
    wx.removeStorageSync('statLastModified');
    wx.removeStorageSync('standardHours');
    wx.removeStorageSync('imagesLastModified');
    
    // 恢复数据文件（完全替换）
    if (backupData.shiftTemplates) {
      wx.setStorageSync('shiftTemplates', backupData.shiftTemplates);
    }
    if (backupData.shifts) {
      wx.setStorageSync('shifts', backupData.shifts);
    }
    // 恢复头像信息
    if (backupData.avatarInfo) {
      if (backupData.avatarInfo.avatarType) {
        wx.setStorageSync('avatarType', backupData.avatarInfo.avatarType);
      }
      if (backupData.avatarInfo.avatarEmoji) {
        wx.setStorageSync('avatarEmoji', backupData.avatarInfo.avatarEmoji);
      }
      if (backupData.avatarInfo.username) {
        wx.setStorageSync('username', backupData.avatarInfo.username);
      }
    }
    
    // 恢复图片（增量恢复，只恢复哈希值不同的图片）
    const restoredImages = [];
    let newImagesCount = 0;
    let updatedImagesCount = 0;
    const images = backupData.images || [];
    const restoredWeekKeys = new Set();
    const imageWeekRelation = {};
    
    // 获取本地已有的图片信息
    const localImageMap = new Map();
    const storageInfo = wx.getStorageInfoSync();
    const weekKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    weekKeys.forEach(weekKey => {
      const localImages = wx.getStorageSync(weekKey) || [];
      localImages.forEach(img => {
        // 使用周Key和图片名称作为唯一标识
        const key = `${weekKey}_${img.name}`;
        localImageMap.set(key, img);
      });
    });
    
    // 准备需要下载的图片
    const imagesToDownload = [];
    // 统计每个周内的图片名称，用于处理恢复时的命名重复
    const weekNameCountMap = new Map();
    
    // 先统计每个周内的图片名称数量
    images.forEach(imgInfo => {
      if (!weekNameCountMap.has(imgInfo.weekKey)) {
        weekNameCountMap.set(imgInfo.weekKey, new Map());
      }
      const nameMap = weekNameCountMap.get(imgInfo.weekKey);
      const baseName = imgInfo.imageName.replace(/\(\d+\)$/, '').trim();
      nameMap.set(baseName, (nameMap.get(baseName) || 0) + 1);
    });
    
    for (const imgInfo of images) {
      // 检查图片是否已存在本地
      const localKey = `${imgInfo.weekKey}_${imgInfo.imageName}`;
      if (localImageMap.has(localKey)) {
        // 图片已存在，检查哈希值是否相同
        const localImage = localImageMap.get(localKey);
        if (localImage.hash === imgInfo.hash) {
          // 哈希值相同，图片未变化，跳过下载
          console.log('图片未变化，跳过下载:', imgInfo.remotePath);
          continue;
        } else {
          // 哈希值不同，需要更新
          updatedImagesCount++;
        }
      } else {
        // 新图片
        newImagesCount++;
      }
      imagesToDownload.push(imgInfo);
    }
    
    // 并行下载，控制并发数
    const maxConcurrentDownloads = 5; // 控制并发数，避免超过微信小程序限制
    const totalImages = imagesToDownload.length;
    let currentImage = 0;
    
    // 分批次并行下载
    for (let i = 0; i < totalImages; i += maxConcurrentDownloads) {
      const batch = imagesToDownload.slice(i, i + maxConcurrentDownloads);
      const batchPromises = batch.map(async (imgInfo) => {
        try {
          // 更新进度
          currentImage++;
          const progress = Math.round((currentImage / totalImages) * 100);
          const localKey = `${imgInfo.weekKey}_${imgInfo.imageName}`;
          const localImage = localImageMap.get(localKey);
          const operation = localImage && localImage.hash !== imgInfo.hash ? '更新' : '新增';
          wx.showLoading({ 
            title: `恢复中 ${operation}图片 ${currentImage}/${totalImages} (${progress}%)`,
            mask: true
          });
          
          // 从云存储下载图片
          const downloadResult = await wx.cloud.downloadFile({
            fileID: imgInfo.fileID
          });
          
          // 计算下载图片的哈希值（基于内容、位置和名称）
          const imageHash = await this.calculateImageHash(downloadResult.tempFilePath, imgInfo.weekKey, imgInfo.imageName);
          
          // 保存到本地存储
          const weekKey = imgInfo.weekKey;
          const weekImages = wx.getStorageSync(weekKey) || [];
          
          // 检查是否需要更新现有图片
          let existingImageIndex = weekImages.findIndex(img => img.name === imgInfo.imageName);
          let finalImageName = imgInfo.imageName;
          
          // 处理命名重复问题
          if (existingImageIndex === -1) {
            // 新图片，检查是否与现有图片名称冲突
            const nameCountMap = new Map();
            weekImages.forEach(img => {
              const baseName = img.name.replace(/\(\d+\)$/, '').trim();
              nameCountMap.set(baseName, (nameCountMap.get(baseName) || 0) + 1);
            });
            
            const baseName = imgInfo.imageName.replace(/\(\d+\)$/, '').trim();
            if (nameCountMap.has(baseName)) {
              // 名称冲突，添加后缀
              const count = nameCountMap.get(baseName) + 1;
              finalImageName = `${baseName}(${count})`;
            }
          }
          
          const newImage = {
            id: `${weekKey}_${Date.now()}`,
            name: finalImageName,
            path: downloadResult.tempFilePath,
            addedTime: new Date().toISOString(),
            hash: imageHash
          };
          
          if (existingImageIndex !== -1) {
            // 更新现有图片
            weekImages[existingImageIndex] = newImage;
          } else {
            // 添加新图片
            weekImages.push(newImage);
          }
          
          wx.setStorageSync(weekKey, weekImages);
          
          // 同步更新到图片关联表
          addImageToRelation(weekKey, newImage);
          restoredWeekKeys.add(weekKey);
          
          // 构建图片周关联表
          if (!imageWeekRelation[weekKey]) {
            imageWeekRelation[weekKey] = [];
          }
          imageWeekRelation[weekKey].push({
            name: newImage.name,
            path: newImage.path,
            hash: imageHash
          });
          
          restoredImages.push(imgInfo.remotePath);
        } catch (e) {
          console.error('恢复图片失败', imgInfo.remotePath, e);
        }
      });
      
      // 等待当前批次下载完成
      await Promise.all(batchPromises);
    }
    
    // 清空图片关联表并导入构建好的关联表
    wx.removeStorageSync('image_relation_table');
    if (Object.keys(imageWeekRelation).length > 0) {
      importImageWeekRelation(imageWeekRelation);
    }
    
    // 同步所有恢复过的周的关联表
    restoredWeekKeys.forEach(weekKey => {
      syncRelationWithLocal(weekKey);
    });
    
    wx.hideLoading();
    
    // 优化恢复提示，根据实际情况显示不同的消息
    if (newImagesCount > 0 || updatedImagesCount > 0) {
      let message = '恢复成功';
      if (newImagesCount > 0 && updatedImagesCount > 0) {
        message = `恢复成功（新增${newImagesCount}张，更新${updatedImagesCount}张）`;
      } else if (newImagesCount > 0) {
        message = `恢复成功（新增${newImagesCount}张图片）`;
      } else if (updatedImagesCount > 0) {
        message = `恢复成功（更新${updatedImagesCount}张图片）`;
      }
      wx.showToast({
        title: message,
        icon: 'success'
      });
    } else if (images.length > 0) {
      // 有备份图片但没有变化
      wx.showToast({
        title: '恢复成功（图片无变化）',
        icon: 'success'
      });
    } else {
      // 没有备份图片
      wx.showToast({
        title: '恢复成功（无图片数据）',
        icon: 'success'
      });
    }
    
    // 刷新页面数据
    setTimeout(() => {
      const pages = getCurrentPages();
      pages.forEach(page => {
        if (page.refreshPageData) {
          page.refreshPageData();
        }
      });
    }, 500);
    
    return {
      success: true,
      restoredImages: restoredImages.length
    };
  }
  
  // 恢复数据 - 增量恢复，只恢复本地没有的图片，并显示进度
  async restore() {
    try {
      // 检查云开发是否初始化成功
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }
      
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      wx.showLoading({ title: '准备恢复...' });
      
      // 1. 调用云函数获取备份数据
      const restoreResult = await this.callCloudFunction('backupRestore', {
        action: 'restore',
        userId: this.userId
      });
      
      if (!restoreResult.result.success) {
        wx.hideLoading();
        wx.showToast({
          title: restoreResult.result.errMsg || '恢复失败',
          icon: 'none'
        });
        return restoreResult.result;
      }
      
      const backupData = restoreResult.result.data;
      
      // 2. 检查版本兼容性
      const backupVersion = backupData.backupSystemVersion || 'v1.0.0';
      const localVersion = this.BACKUP_SYSTEM_VERSION;
      
      const versionComparison = this.compareVersions(localVersion, backupVersion);
      
      if (versionComparison < 0) {
        // 本地版本低于备份版本，不兼容
        wx.hideLoading();
        wx.showToast({
          title: '备份版本高于当前小程序版本，请更新小程序后再恢复',
          icon: 'none'
        });
        return {
          success: false,
          errMsg: '备份版本不兼容'
        };
      } else if (versionComparison > 0) {
        // 本地版本高于备份版本，可能存在兼容性问题
        wx.hideLoading();
        return new Promise((resolve) => {
          wx.showModal({
            title: '版本差异提示',
            content: `当前小程序版本(${localVersion})高于备份数据版本(${backupVersion})，恢复可能会导致数据结构不兼容。是否继续恢复？`,
            cancelText: '取消',
            confirmText: '继续恢复',
            success: async (res) => {
              if (res.confirm) {
                // 用户选择继续恢复
                const result = await this.performRestore(backupData);
                resolve(result);
              } else {
                // 用户选择取消
                resolve({
                  success: false,
                  errMsg: '用户取消恢复'
                });
              }
            }
          });
        });
      } else {
        // 版本相同，正常恢复
        const result = await this.performRestore(backupData);
        return result;
      }
      
    } catch (e) {
      console.error('恢复失败', e);
      wx.hideLoading();
      wx.showToast({
        title: '恢复失败',
        icon: 'none'
      });
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
  
  // 获取备份信息
  async getBackupInfo() {
    try {
      // 检查云开发是否初始化成功
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }
      
      if (!this.isLoggedIn()) {
        return {
          success: false,
          errMsg: '请先登录'
        };
      }
      
      const result = await this.callCloudFunction('backupRestore', {
        action: 'getBackupInfo',
        userId: this.userId
      });
      
      return result.result;
    } catch (e) {
      console.error('获取备份信息失败', e);
      return {
        success: false,
        errMsg: e.message
      };
    }
  }
}

module.exports = CloudManager;