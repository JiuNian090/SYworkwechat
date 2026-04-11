const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation } = require('./imageRelation.js');

/**
 * 云开发工具类 - 增量备份和恢复
 * 支持微信云开发，通过账号密码实现数据同步
 */
class CloudManager {
  constructor() {
    this.userId = null;
  }
  
  // 检查云开发是否初始化成功
  isCloudInitialized() {
    const app = getApp();
    return app.globalData.cloudInitialized;
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
      
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'register',
          account: account,
          password: password,
          nickname: nickname
        }
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
      
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'login',
          account: account,
          password: password
        }
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
      wx.getFileInfo({
        filePath: imagePath,
        success: () => resolve(true),
        fail: () => resolve(false)
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
      
      wx.showLoading({ title: '备份中...' });
      
      // 1. 获取本地数据
      const localData = this.getLocalData();
      
      // 使用新的图片关联表工具获取所有有效图片
      const { images: validImages, imageWeekRelation: validImageWeekRelation } = await getAllValidImages();
      
      // 2. 获取云端备份信息，了解已有哪些图片
      let existingImages = [];
      try {
        const infoResult = await wx.cloud.callFunction({
          name: 'backupRestore',
          data: {
            action: 'getBackupInfo',
            userId: this.userId
          }
        });
        if (infoResult.result.success && infoResult.result.hasBackup) {
          // 获取完整的备份数据，对比图片
          const restoreResult = await wx.cloud.callFunction({
            name: 'backupRestore',
            data: {
              action: 'restore',
              userId: this.userId
            }
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
      const existingImageMap = new Map();
      
      // 创建云端图片映射，用于快速查找
      existingImages.forEach(img => {
        if (img.remotePath) {
          existingImageMap.set(img.remotePath, img);
        }
      });
      
      // 上传图片到云存储（只上传新的或变化的图片）
      for (const imgInfo of validImages) {
        try {
          const existingImg = existingImageMap.get(imgInfo.remotePath);
          let shouldUpload = true;
          
          // 如果云端已存在，检查是否需要重新上传
          if (existingImg) {
            // 这里可以添加更复杂的对比逻辑，比如检查图片大小、时间戳等
            // 目前简化处理：如果存在就跳过，节省带宽
            shouldUpload = false;
            // 复用云端的 fileID
            uploadedImages.push({
              ...imgInfo,
              fileID: existingImg.fileID
            });
          }
          
          if (shouldUpload) {
            // 上传新图片到云存储
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: `schedule_images/${this.userId}/${imgInfo.remotePath}`,
              filePath: imgInfo.image.path
            });
            
            uploadedImages.push({
              ...imgInfo,
              fileID: uploadResult.fileID
            });
          }
        } catch (e) {
          console.error('上传图片失败', imgInfo.remotePath, e);
        }
      }
      
      // 获取头像信息
      const avatarInfo = {
        avatarType: wx.getStorageSync('avatarType') || 'text',
        avatarEmoji: wx.getStorageSync('avatarEmoji') || '',
        username: wx.getStorageSync('username') || ''
      };
      
      // 4. 调用云函数备份数据（云函数会对比差异，只更新有变化的数据）
      const backupResult = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'backup',
          userId: this.userId,
          data: {
            shiftTemplates: localData.shiftTemplates.data,
            shifts: localData.shifts.data,
            images: uploadedImages,
            imageWeekRelation: validImageWeekRelation,
            avatarInfo: avatarInfo,
            backupIndex: {}
          }
        }
      });
      
      wx.hideLoading();
      
      if (backupResult.result.success) {
        const newImageCount = uploadedImages.filter(img => !existingImageMap.has(img.remotePath)).length;
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
  
  // 恢复数据 - 完全恢复，先清空本地，再完全替换为云端数据
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
      
      wx.showLoading({ title: '恢复中...' });
      
      // 1. 调用云函数获取备份数据
      const restoreResult = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'restore',
          userId: this.userId
        }
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
      
      // 2. 先清空本地所有相关数据（确保本地与云端完全一致）
      
      // 清空基础数据
      wx.removeStorageSync('shifts');
      wx.removeStorageSync('shiftTemplates');
      wx.removeStorageSync('statData');
      wx.removeStorageSync('statLastModified');
      wx.removeStorageSync('standardHours');
      wx.removeStorageSync('imagesLastModified');
      
      // 清空图片关联表
      wx.removeStorageSync('imageRelation');
      
      // 清空所有周图片存储
      const storageInfo = wx.getStorageInfoSync();
      const keys = storageInfo.keys || [];
      keys.forEach(key => {
        if (key.startsWith('week_images_')) {
          wx.removeStorageSync(key);
        }
      });
      
      // 3. 恢复数据文件（完全替换）
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
      
      // 4. 恢复图片（完全替换）
      const restoredImages = [];
      const images = backupData.images || [];
      const restoredWeekKeys = new Set();
      
      // 导入图片周关联表到新的图片关联表
      if (backupData.imageWeekRelation) {
        importImageWeekRelation(backupData.imageWeekRelation);
      }
      
      for (const imgInfo of images) {
        try {
          // 从云存储下载图片
          const downloadResult = await wx.cloud.downloadFile({
            fileID: imgInfo.fileID
          });
          
          // 保存到本地存储（完全替换，不检查是否存在）
          const weekKey = imgInfo.weekKey;
          const weekImages = wx.getStorageSync(weekKey) || [];
          
          const newImage = {
            id: `${weekKey}_${Date.now()}`,
            name: imgInfo.imageName,
            path: downloadResult.tempFilePath,
            addedTime: new Date().toISOString()
          };
          
          weekImages.push(newImage);
          wx.setStorageSync(weekKey, weekImages);
          
          // 同步更新到图片关联表
          addImageToRelation(weekKey, newImage);
          restoredWeekKeys.add(weekKey);
          
          restoredImages.push(imgInfo.remotePath);
        } catch (e) {
          console.error('恢复图片失败', imgInfo.remotePath, e);
        }
      }
      
      // 同步所有恢复过的周的关联表
      restoredWeekKeys.forEach(weekKey => {
        syncRelationWithLocal(weekKey);
      });
      
      wx.hideLoading();
      wx.showToast({
        title: `恢复成功（${restoredImages.length}张图片）`,
        icon: 'success'
      });
      
      // 4. 刷新页面数据
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
      
      const result = await wx.cloud.callFunction({
        name: 'backupRestore',
        data: {
          action: 'getBackupInfo',
          userId: this.userId
        }
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