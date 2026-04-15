const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation, getImageRelationTable, removeImageFromRelation } = require('./imageRelation.js');

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
          const imageName = image.name || `${year}-${month}-${week}`;
          // 使用图片名称和时间戳生成稳定的 remotePath，避免因索引变化导致的路径变化
          const timestamp = image.addedTime ? new Date(image.addedTime).getTime() : new Date().getTime();
          const remotePath = `images/${yearMonth}/${imageName}_${timestamp}.jpg`;
          
          images.push({
            weekKey: weekKey,
            image: image,
            yearMonth: yearMonth,
            imageName: imageName,
            remotePath: remotePath
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
  
  // 计算图片哈希值（基于图片时间戳、名称、内容和大小）
  calculateImageHash(imagePath, weekKey, imageName, addedTime) {
    return new Promise((resolve, reject) => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.getFileInfo({
        filePath: imagePath,
        success: (res) => {
          // 基于四个变量计算哈希值：图片时间戳、图片名称、图片内容、图片大小
          // 不包含位置信息，避免因位置变化导致哈希值变化
          const hashInput = `${addedTime}_${weekKey}_${imageName}_${res.mtime}_${res.size}`;
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
      
      // 清理旧的备份逻辑，使用新的三步骤流程
      
      // 获取头像信息
      const avatarInfo = {
        avatarType: wx.getStorageSync('avatarType') || 'text',
        avatarEmoji: wx.getStorageSync('avatarEmoji') || '',
        username: wx.getStorageSync('username') || ''
      };
      
      // 4. 调用云函数备份数据 - 新流程：先对比关联表，再上传图片
      wx.showLoading({ title: '分析备份差异...' });
      
      // 第一步：上传本地关联表，获取需要新增的图片清单
      const diffResult = await this.callCloudFunction('backupRestore', {
        action: 'getBackupDiff',
        userId: this.userId,
        data: {
          imageWeekRelation: validImageWeekRelation,
          version: this.BACKUP_SYSTEM_VERSION
        }
      });
      
      if (!diffResult.result.success) {
        wx.hideLoading();
        wx.showToast({
          title: diffResult.result.errMsg || '分析差异失败',
          icon: 'none'
        });
        return {
          success: false,
          errMsg: diffResult.result.errMsg || '分析差异失败'
        };
      }
      
      const imagesToUpload = diffResult.result.imagesToUpload || [];
      const imagesToDelete = diffResult.result.imagesToDelete || [];
      
      console.log('备份 - 需要上传的图片数量:', imagesToUpload.length);
      console.log('备份 - 需要删除的图片数量:', imagesToDelete.length);
      
      // 第二步：上传需要新增的图片
      const uploadedImages = [];
      let newImageCount = 0;
      
      if (imagesToUpload.length > 0) {
        wx.showLoading({ title: '上传图片...' });
        
        // 并行上传，控制并发数
        const maxConcurrentUploads = 5;
        for (let i = 0; i < imagesToUpload.length; i += maxConcurrentUploads) {
          const batch = imagesToUpload.slice(i, i + maxConcurrentUploads);
          const batchPromises = batch.map(async (imgInfo) => {
            try {
              // 压缩图片
              let compressedPath = imgInfo.image.path;
              try {
                const compressResult = await new Promise((resolve, reject) => {
                  wx.compressImage({
                    src: imgInfo.image.path,
                    quality: 80,
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
              
              // 计算哈希值
              const imageHash = await this.calculateImageHash(
                imgInfo.image.path,
                imgInfo.weekKey,
                imgInfo.imageName,
                imgInfo.image.addedTime
              );
              
              uploadedImages.push({
                ...imgInfo,
                fileID: uploadResult.fileID,
                hash: imageHash
              });
              
              newImageCount++;
            } catch (e) {
              console.error('上传图片失败', imgInfo.remotePath, e);
            }
          });
          
          await Promise.all(batchPromises);
        }
      }
      
      // 第三步：构建完整的图片列表，只包含本地存在的图片
      // 注意：不再从云端获取现有图片，而是基于本地关联表构建完整列表
      // 这样可以确保删除的图片不会被重新添加回来
      
      // 构建本地图片映射（基于关联表）
      const localImageMap = new Map();
      validImages.forEach(img => {
        if (img.weekKey && img.imageName) {
          const key = `${img.weekKey}_${img.imageName}`;
          localImageMap.set(key, img);
        }
      });
      
      // 从云端获取现有图片，但只保留本地存在的图片
      try {
        const existingImagesResult = await this.callCloudFunction('backupRestore', {
          action: 'getExistingImages',
          userId: this.userId
        });
        
        if (existingImagesResult.result.success) {
          const existingImages = existingImagesResult.result.images || [];
          
          // 构建已上传图片映射
          const uploadedImageMap = new Map();
          uploadedImages.forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              uploadedImageMap.set(key, img);
            }
          });
          
          // 添加本地存在且未上传的图片
          existingImages.forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              // 只有本地存在且未上传的图片才添加
              if (localImageMap.has(key) && !uploadedImageMap.has(key)) {
                uploadedImages.push(img);
              }
            }
          });
          
          console.log('备份 - 最终上传图片数量:', uploadedImages.length);
        }
      } catch (e) {
        console.log('获取云端现有图片失败', e);
      }
      
      // 第三步：调用云函数完成备份，覆盖云端关联表
      wx.showLoading({ title: '完成备份...' });
      const backupResult = await this.callCloudFunction('backupRestore', {
        action: 'completeBackup',
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
          if (newImageCount > 0 && deletedImageCount > 0) {
            message = `备份成功（新增${newImageCount}张，删除${deletedImageCount}张）`;
          } else if (newImageCount > 0) {
            message = `备份成功（新增${newImageCount}张图片）`;
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
          uploadedImages: newImageCount,
          newImages: newImageCount,
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
    let actualNewImagesCount = 0;
    let actualUpdatedImagesCount = 0;
    const images = backupData.images || [];
    const restoredWeekKeys = new Set();
    const imageWeekRelation = {};
    
    // 获取本地已有的图片信息，并计算哈希值
    const localImageMap = new Map();
    const storageInfo = wx.getStorageInfoSync();
    const weekKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));
    
    // 先计算所有本地图片的哈希值
    for (const weekKey of weekKeys) {
      const localImages = wx.getStorageSync(weekKey) || [];
      for (const img of localImages) {
        // 确保图片有哈希值
        if (!img.hash) {
          try {
            // 计算哈希值，传递所有必要的参数
            img.hash = await this.calculateImageHash(
              img.path, 
              weekKey, 
              img.name,
              img.addedTime || new Date().toISOString(),
              0 // 临时使用0作为索引，实际恢复时会使用正确的索引
            );
          } catch (e) {
            console.log('计算本地图片哈希值失败:', e);
            img.hash = '';
          }
        }
        // 使用周Key和图片名称作为唯一标识
        const key = `${weekKey}_${img.name}`;
        localImageMap.set(key, img);
      }
    }
    
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
      let foundExistingImage = false;
      let localImage = null;
      
      // 首先尝试通过周Key和图片名称查找
      const localKey = `${imgInfo.weekKey}_${imgInfo.imageName}`;
      if (localImageMap.has(localKey)) {
          localImage = localImageMap.get(localKey);
          // 检查哈希值是否相同
          if (localImage.hash === imgInfo.hash) {
            // 哈希值相同，图片未变化，跳过下载
            console.log('图片未变化，跳过下载:', imgInfo.remotePath);
            foundExistingImage = true;
          } else {
            console.log('哈希值不同，需要更新:', imgInfo.remotePath);
          }
        }
      
      // 如果没有找到，尝试通过哈希值查找（处理名称变化的情况）
      if (!foundExistingImage) {
        // 遍历该周的所有本地图片，查找哈希值相同的图片
        const weekKey = imgInfo.weekKey;
        if (weekKeys.includes(weekKey)) {
          const weekImages = wx.getStorageSync(weekKey) || [];
          for (const img of weekImages) {
            if (img.hash === imgInfo.hash) {
              // 找到哈希值相同的图片，无需下载
              console.log('找到哈希值相同的图片，跳过下载:', imgInfo.remotePath);
              foundExistingImage = true;
              break;
            }
          }
        }
      }
      
      if (!foundExistingImage) {
        // 新图片或需要更新的图片
        imagesToDownload.push(imgInfo);
      }
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
          
          // 计算下载图片的哈希值（基于图片时间戳、名称、内容和大小）
          const imageHash = await this.calculateImageHash(
            downloadResult.tempFilePath, 
            imgInfo.weekKey, 
            imgInfo.imageName,
            imgInfo.addedTime || new Date().toISOString()
          );
          
          // 保存到本地存储
          const weekKey = imgInfo.weekKey;
          const weekImages = wx.getStorageSync(weekKey) || [];
          
          // 检查是否需要更新现有图片
          let existingImageIndex = weekImages.findIndex(img => img.name === imgInfo.imageName);
          let finalImageName = imgInfo.imageName;
          let shouldUpdate = true;
          
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
          } else {
            // 检查现有图片的哈希值是否与下载的图片相同
            const existingImage = weekImages[existingImageIndex];
            if (existingImage.hash === imageHash) {
              // 哈希值相同，无需更新
              console.log('下载的图片与本地图片哈希值相同，跳过更新:', imgInfo.remotePath);
              shouldUpdate = false;
            }
          }
          
          if (shouldUpdate) {
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
              actualUpdatedImagesCount++;
            } else {
              // 添加新图片
              weekImages.push(newImage);
              actualNewImagesCount++;
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
          }
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
    
    // 删除本地存在但云端不存在的图片，确保与云端完全一致
    const cloudImageMap = new Map();
    images.forEach(imgInfo => {
      const key = `${imgInfo.weekKey}_${imgInfo.imageName}`;
      cloudImageMap.set(key, imgInfo);
    });
    
    let deletedImageCount = 0;
    weekKeys.forEach(weekKey => {
      let weekImages = wx.getStorageSync(weekKey) || [];
      const originalLength = weekImages.length;
      
      // 过滤出云端存在的图片
      weekImages = weekImages.filter(img => {
        const key = `${weekKey}_${img.name}`;
        return cloudImageMap.has(key);
      });
      
      // 如果有图片被删除
      if (weekImages.length < originalLength) {
        deletedImageCount += (originalLength - weekImages.length);
        wx.setStorageSync(weekKey, weekImages);
        syncRelationWithLocal(weekKey);
      }
    });
    
    wx.hideLoading();
    
    // 优化恢复提示，根据实际情况显示不同的消息
    if (actualNewImagesCount > 0 || actualUpdatedImagesCount > 0 || deletedImageCount > 0) {
      let message = '恢复成功';
      if (actualNewImagesCount > 0 && actualUpdatedImagesCount > 0 && deletedImageCount > 0) {
        message = `恢复成功（新增${actualNewImagesCount}张，更新${actualUpdatedImagesCount}张，删除${deletedImageCount}张）`;
      } else if (actualNewImagesCount > 0 && actualUpdatedImagesCount > 0) {
        message = `恢复成功（新增${actualNewImagesCount}张，更新${actualUpdatedImagesCount}张）`;
      } else if (actualNewImagesCount > 0 && deletedImageCount > 0) {
        message = `恢复成功（新增${actualNewImagesCount}张，删除${deletedImageCount}张）`;
      } else if (actualUpdatedImagesCount > 0 && deletedImageCount > 0) {
        message = `恢复成功（更新${actualUpdatedImagesCount}张，删除${deletedImageCount}张）`;
      } else if (actualNewImagesCount > 0) {
        message = `恢复成功（新增${actualNewImagesCount}张图片）`;
      } else if (actualUpdatedImagesCount > 0) {
        message = `恢复成功（更新${actualUpdatedImagesCount}张图片）`;
      } else if (deletedImageCount > 0) {
        message = `恢复成功（删除${deletedImageCount}张图片）`;
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
  
  // 恢复数据 - 新流程：先下载关联表，对比差异，再下载图片
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
      
      // 1. 调用云函数获取备份关联表
      const getRelationResult = await this.callCloudFunction('backupRestore', {
        action: 'getBackupRelation',
        userId: this.userId
      });
      
      if (!getRelationResult.result.success) {
        wx.hideLoading();
        wx.showToast({
          title: getRelationResult.result.errMsg || '获取备份关联表失败',
          icon: 'none'
        });
        return getRelationResult.result;
      }
      
      const cloudRelation = getRelationResult.result.imageWeekRelation || {};
      const backupVersion = getRelationResult.result.backupSystemVersion || 'v1.0.0';
      
      // 2. 检查版本兼容性
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
                const result = await this.performRestoreWithNewFlow(cloudRelation);
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
        const result = await this.performRestoreWithNewFlow(cloudRelation);
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
  
  // 执行恢复操作 - 新流程（优化版）
  async performRestoreWithNewFlow(cloudRelation) {
    try {
      wx.showLoading({ title: '分析恢复差异...' });
      
      // 1. 同步关联表与本地存储，确保使用最新的本地数据
      syncRelationWithLocal();
      
      // 2. 获取本地关联表
      const localRelation = getImageRelationTable();
      
      // 3. 对比本地和云端关联表，找出差异
      const imagesToAdd = [];
      const imagesToDelete = [];
      
      // 构建本地图片映射
      const localImageMap = new Map();
      Object.keys(localRelation || {}).forEach(weekKey => {
        const weekImages = localRelation[weekKey] || [];
        weekImages.forEach(img => {
          const key = `${weekKey}_${img.name}`;
          localImageMap.set(key, img);
        });
      });
      
      // 构建云端图片映射
      const cloudImageMap = new Map();
      Object.keys(cloudRelation || {}).forEach(weekKey => {
        const weekImages = cloudRelation[weekKey] || [];
        weekImages.forEach(img => {
          const key = `${weekKey}_${img.name}`;
          cloudImageMap.set(key, img);
        });
      });
      
      // 找出需要新增的图片（云端有但本地没有的）
      Object.keys(cloudRelation || {}).forEach(weekKey => {
        const weekImages = cloudRelation[weekKey] || [];
        weekImages.forEach(img => {
          const key = `${weekKey}_${img.name}`;
          if (!localImageMap.has(key)) {
            imagesToAdd.push({
              weekKey: weekKey,
              name: img.name,
              path: img.path,
              hash: img.hash
            });
          }
        });
      });
      
      // 找出需要删除的图片（本地有但云端没有的）
      Object.keys(localRelation || {}).forEach(weekKey => {
        const weekImages = localRelation[weekKey] || [];
        weekImages.forEach(img => {
          const key = `${weekKey}_${img.name}`;
          if (!cloudImageMap.has(key)) {
            imagesToDelete.push({
              weekKey: weekKey,
              name: img.name,
              path: img.path,
              id: img.id
            });
          }
        });
      });
      
      console.log('恢复 - 需要新增的图片数量:', imagesToAdd.length);
      console.log('恢复 - 需要删除的图片数量:', imagesToDelete.length);
      
      // 4. 删除本地多余的图片
      let deletedImageCount = 0;
      for (const imgToDelete of imagesToDelete) {
        // 从本地存储中删除
        const weekImages = wx.getStorageSync(imgToDelete.weekKey) || [];
        const updatedImages = weekImages.filter(img => img.id !== imgToDelete.id);
        wx.setStorageSync(imgToDelete.weekKey, updatedImages);
        
        // 从关联表中删除
        removeImageFromRelation(imgToDelete.weekKey, imgToDelete.id);
        
        deletedImageCount++;
      }
      
      // 5. 直接从云端获取所有图片数据
      let actualNewImagesCount = 0;
      if (imagesToAdd.length > 0) {
        wx.showLoading({ title: '获取图片数据...' });
        
        // 直接获取云端的所有图片数据
        const getImagesResult = await this.callCloudFunction('backupRestore', {
          action: 'getAllCloudImages',
          userId: this.userId
        });
        
        if (!getImagesResult.result.success) {
          wx.hideLoading();
          wx.showToast({
            title: getImagesResult.result.errMsg || '获取图片数据失败',
            icon: 'none'
          });
          return {
            success: false,
            errMsg: getImagesResult.result.errMsg || '获取图片数据失败'
          };
        }
        
        const allCloudImages = getImagesResult.result.images || [];
        
        // 筛选出需要下载的图片
        const imagesToDownload = allCloudImages.filter(img => {
          const key = `${img.weekKey}_${img.imageName || img.name}`;
          return imagesToAdd.some(addImg => {
            const addKey = `${addImg.weekKey}_${addImg.name}`;
            return key === addKey;
          });
        });
        
        // 6. 下载并保存图片
        if (imagesToDownload.length > 0) {
          wx.showLoading({ title: '下载图片...' });
          
          // 并行下载，控制并发数
          const maxConcurrentDownloads = 5;
          const totalImages = imagesToDownload.length;
          let currentImage = 0;
          
          for (let i = 0; i < totalImages; i += maxConcurrentDownloads) {
            const batch = imagesToDownload.slice(i, i + maxConcurrentDownloads);
            const batchPromises = batch.map(async (imgInfo) => {
              try {
                // 更新进度
                currentImage++;
                const progress = Math.round((currentImage / totalImages) * 100);
                wx.showLoading({ 
                  title: `恢复中 下载图片 ${currentImage}/${totalImages} (${progress}%)`,
                  mask: true
                });
                
                // 从云存储下载图片
                const downloadResult = await wx.cloud.downloadFile({
                  fileID: imgInfo.fileID
                });
                
                // 保存到本地存储
                const weekKey = imgInfo.weekKey;
                const weekImages = wx.getStorageSync(weekKey) || [];
                
                // 检查是否需要处理命名重复
                const nameCountMap = new Map();
                weekImages.forEach(img => {
                  const baseName = img.name.replace(/\(\d+\)$/, '').trim();
                  nameCountMap.set(baseName, (nameCountMap.get(baseName) || 0) + 1);
                });
                
                let finalImageName = imgInfo.imageName || imgInfo.name;
                const baseName = finalImageName.replace(/\(\d+\)$/, '').trim();
                if (nameCountMap.has(baseName)) {
                  // 名称冲突，添加后缀
                  const count = nameCountMap.get(baseName) + 1;
                  finalImageName = `${baseName}(${count})`;
                }
                
                // 创建新图片对象
                const newImage = {
                  id: `${weekKey}_${Date.now()}`,
                  name: finalImageName,
                  path: downloadResult.tempFilePath,
                  addedTime: new Date().toISOString(),
                  hash: imgInfo.hash
                };
                
                // 添加到本地存储
                weekImages.push(newImage);
                wx.setStorageSync(weekKey, weekImages);
                
                // 添加到关联表
                addImageToRelation(weekKey, newImage);
                
                actualNewImagesCount++;
              } catch (e) {
                console.error('下载图片失败', imgInfo.remotePath, e);
              }
            });
            
            await Promise.all(batchPromises);
          }
        }
      }
      
      // 7. 覆盖本地关联表为云端关联表
      wx.removeStorageSync('image_relation_table');
      importImageWeekRelation(cloudRelation);
      
      // 8. 恢复其他数据
      const restoreResult = await this.callCloudFunction('backupRestore', {
        action: 'restoreOtherData',
        userId: this.userId
      });
      
      if (restoreResult.result.success) {
        const backupData = restoreResult.result.data;
        
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
      }
      
      wx.hideLoading();
      
      // 优化恢复提示，根据实际情况显示不同的消息
      if (actualNewImagesCount > 0 || deletedImageCount > 0) {
        let message = '恢复成功';
        if (actualNewImagesCount > 0 && deletedImageCount > 0) {
          message = `恢复成功（新增${actualNewImagesCount}张，删除${deletedImageCount}张）`;
        } else if (actualNewImagesCount > 0) {
          message = `恢复成功（新增${actualNewImagesCount}张图片）`;
        } else if (deletedImageCount > 0) {
          message = `恢复成功（删除${deletedImageCount}张图片）`;
        }
        wx.showToast({
          title: message,
          icon: 'success'
        });
      } else {
        // 没有变化
        wx.showToast({
          title: '恢复成功（无变化）',
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
        newImages: actualNewImagesCount,
        deletedImages: deletedImageCount
      };
      
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