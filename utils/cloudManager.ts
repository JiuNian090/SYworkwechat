'use strict';
const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation, getImageRelationTable, removeImageFromRelation } = require('./imageRelation.js');
const { calculateHash } = require('./encrypt.js');
const { store } = require('./store.js');
const { getCalendarWeekOfMonth } = require('./date.js');
const { compareVersion } = require('./deviceInfo.js');
const config = require('../config.js');
const photoCache = require('./photoCache.js');

interface CloudFunctionOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

interface LocalDataItem<T> {
  data: T;
  hash: string;
  size: number;
}

interface LocalData {
  shiftTemplates: LocalDataItem<Array<{ id: string; name: string; startTime: string; endTime: string; color: string; hours?: number }>>;
  shifts: LocalDataItem<Record<string, Array<{ date: string; templateId: string; templateName?: string; startTime?: string; endTime?: string; color?: string; hours?: number; note?: string }>>>;
}

interface WeekImage {
  id: string;
  name: string;
  path: string;
  addedTime?: string;
  hash?: string;
  updatedTime?: string;
}

interface ImageRelation {
  [weekKey: string]: Array<{ name: string; path: string; hash?: string; id?: string }>;
}

interface ImageUploadInfo {
  weekKey: string;
  image: WeekImage;
  yearMonth: string;
  imageName: string;
  remotePath: string;
}

interface CloudFuncResult {
  success: boolean;
  errMsg?: string;
  data?: Record<string, unknown>;
  hasBackup?: boolean;
  hasChanges?: boolean;
  imagesToUpload?: ImageUploadInfo[];
  imagesToDelete?: string[];
  images?: Array<Record<string, unknown>>;
  deletedImageCount?: number;
  imageWeekRelation?: ImageRelation;
  backupSystemVersion?: string;
  uploadedImages?: number;
  restoredImages?: number;
  newImages?: number;
  deletedImages?: number;
}

class CloudManager {
  userId: string | null;

  constructor() {
    this.userId = null;
  }

  /** 单次备份/恢复操作最多处理的图片数，超出的需用户再次操作 */
  readonly MAX_IMAGES_PER_BATCH = 20;

  get BACKUP_SYSTEM_VERSION(): string {
    return config.backupSystemVersion;
  }

  isCloudInitialized(): boolean {
    return store.getState('cloudInitialized');
  }

  async callCloudFunction(name: string, data: Record<string, unknown>, options: CloudFunctionOptions = {}): Promise<{ result: CloudFuncResult }> {
    const { timeout = 10000, maxRetries = 3, retryDelay = 1000 } = options;

    let retries = 0;
    while (retries < maxRetries) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('云函数调用超时'));
          }, timeout);
        });

        const result = await Promise.race([
          wx.cloud.callFunction({ name, data }),
          timeoutPromise
        ]);

        return { result: result.result as CloudFuncResult };
      } catch (e) {
        retries++;
        if (retries >= maxRetries) {
          throw e;
        }
        console.warn(`云函数调用失败，正在重试(${retries}/${maxRetries})...`, e);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error('云函数调用失败：超过最大重试次数');
  }

  async register(account: string, password: string, nickname: string): Promise<CloudFuncResult> {
    try {
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }

      const result = await this.callCloudFunction(config.cloudFunctions.userLogin, {
        action: 'register',
        account: account,
        password: password,
        nickname: nickname
      });

      if (result.result.success) {
        this.userId = result.result.data!.userId as string;
        store.setState({ cloudUserId: this.userId, cloudAccount: account }, ['cloudUserId', 'cloudAccount']);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('注册失败', e);
      return {
        success: false,
        errMsg: (e as Error).message || '注册失败'
      };
    }
  }

  async login(account: string, password: string): Promise<CloudFuncResult> {
    try {
      if (!this.isCloudInitialized()) {
        return {
          success: false,
          errMsg: '云开发未初始化，请稍后重试'
        };
      }

      const result = await this.callCloudFunction(config.cloudFunctions.userLogin, {
        action: 'login',
        account: account,
        password: password
      });

      if (result.result.success) {
        this.userId = result.result.data!.userId as string;
        store.setState({ cloudUserId: this.userId, cloudAccount: account }, ['cloudUserId', 'cloudAccount']);
        return result.result;
      } else {
        return result.result;
      }
    } catch (e) {
      console.error('登录失败', e);
      return {
        success: false,
        errMsg: (e as Error).message || '登录失败'
      };
    }
  }

  isLoggedIn(): boolean {
    if (!this.userId) {
      this.userId = wx.getStorageSync('cloudUserId');
    }
    return !!this.userId;
  }

  logout(): void {
    this.userId = null;
    wx.removeStorageSync('cloudUserId');
    wx.removeStorageSync('cloudAccount');
  }

  getCurrentAccount(): string {
    return wx.getStorageSync('cloudAccount') || '';
  }

  getLocalData(): LocalData {
    const shiftTemplates = wx.getStorageSync('shiftTemplates') || [];
    const shifts = wx.getStorageSync('shifts') || {};

    const shiftTemplatesJson = JSON.stringify(shiftTemplates);
    const shiftsJson = JSON.stringify(shifts);

    return {
      shiftTemplates: {
        data: shiftTemplates,
        hash: calculateHash(shiftTemplatesJson),
        size: shiftTemplatesJson.length
      },
      shifts: {
        data: shifts,
        hash: calculateHash(shiftsJson),
        size: shiftsJson.length
      }
    };
  }

  checkAndUpdateOldImageNames(): boolean {
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

    let hasUpdated = false;

    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];

      const updatedImages = weekImages.map((image: WeekImage) => {
        if (image.name && (image.name.includes('年') || image.name.includes('月') ||
            image.name.includes('第') || image.name.includes('周'))) {
          hasUpdated = true;

          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = getCalendarWeekOfMonth(weekDate);

          const newName = `${year}-${month}-${week}`;

          return {
            ...image,
            name: newName,
            updatedTime: new Date().toISOString()
          };
        }
        return image;
      });

      if (hasUpdated) {
        wx.setStorageSync(weekKey, updatedImages);
      }
    });

    return hasUpdated;
  }

  getAllLocalImages(): { images: ImageUploadInfo[]; imageWeekRelation: ImageRelation } {
    this.checkAndUpdateOldImageNames();

    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

    const images: ImageUploadInfo[] = [];
    const imageWeekRelation: ImageRelation = {};

    weekImageKeys.forEach(weekKey => {
      const weekImages = wx.getStorageSync(weekKey) || [];
      if (weekImages.length > 0) {
        imageWeekRelation[weekKey] = weekImages.map((img: WeekImage) => ({
          name: img.name,
          path: img.path
        }));

        weekImages.forEach((image: WeekImage) => {
          const weekDateStr = weekKey.replace('week_images_', '');
          const weekDate = new Date(weekDateStr);
          const year = weekDate.getFullYear();
          const month = String(weekDate.getMonth() + 1).padStart(2, '0');
          const week = getCalendarWeekOfMonth(weekDate);

          const yearMonth = `${year}-${month}`;
          const imageName = image.name || `${year}-${month}-${week}`;
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

  validateImageExists(imagePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.getFileInfo({
        filePath: imagePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    });
  }

  calculateImageHash(imagePath: string, weekKey: string, imageName: string, addedTime: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fileSystemManager = wx.getFileSystemManager();
      fileSystemManager.getFileInfo({
        filePath: imagePath,
        success: (res) => {
          const hashInput = `${addedTime}_${weekKey}_${imageName}_${(res as unknown as Record<string, unknown>).mtime || ''}_${res.size}`;
          const hash = calculateHash(hashInput);
          resolve(hash);
        },
        fail: (err) => {
          console.error('获取文件信息失败', err);
          resolve('0');
        }
      });
    });
  }

  async backup(): Promise<CloudFuncResult> {
    try {
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

      const localData = this.getLocalData();

      const { images: validImages, imageWeekRelation: validImageWeekRelation } = await getAllValidImages();

      try {
        const infoResult = await this.callCloudFunction(config.cloudFunctions.backup, {
          action: 'getBackupInfo',
          userId: this.userId
        });
        if (infoResult.result.success && infoResult.result.hasBackup) {
          await this.callCloudFunction(config.cloudFunctions.restore, {
            action: 'restore',
            userId: this.userId
          });
        }
      } catch (e) {
        console.warn('获取云端备份信息失败，假设是新备份', e);
      }

      const avatarInfo = {
        avatarType: wx.getStorageSync('avatarType') || 'text',
        avatarEmoji: wx.getStorageSync('avatarEmoji') || '',
        username: wx.getStorageSync('username') || ''
      };

      wx.showLoading({ title: '开始备份...' });

      const diffResult = await this.callCloudFunction(config.cloudFunctions.backup, {
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
          title: '备份失败',
          icon: 'none'
        });
        return {
          success: false,
          errMsg: diffResult.result.errMsg || '备份失败'
        };
      }

      let imagesToUpload = diffResult.result.imagesToUpload || [];

      // 截断超过单批次上限的图片，避免云函数超时/负载过大
      const totalImageCount = imagesToUpload.length;
      if (totalImageCount > this.MAX_IMAGES_PER_BATCH) {
        console.warn(`备份图片数 ${totalImageCount} 超过单次上限 ${this.MAX_IMAGES_PER_BATCH}，仅处理前 ${this.MAX_IMAGES_PER_BATCH} 张，剩余请再次备份`);
        wx.showToast({
          title: `图片较多（${totalImageCount}张），本次仅备份前 ${this.MAX_IMAGES_PER_BATCH} 张，其余请再次备份`,
          icon: 'none',
          duration: 3000
        });
        imagesToUpload = imagesToUpload.slice(0, this.MAX_IMAGES_PER_BATCH);
      }

      const uploadedImages: Array<Record<string, unknown>> = [];
      let newImageCount = 0;

      if (imagesToUpload.length > 0) {
        const maxConcurrentUploads = 5;
        const totalImages = imagesToUpload.length;

        for (let i = 0; i < totalImages; i += maxConcurrentUploads) {
          const batch = imagesToUpload.slice(i, i + maxConcurrentUploads);
          const batchPromises = batch.map(async (imgInfo: ImageUploadInfo, batchIndex: number) => {
            try {
              const imgIndex = i + batchIndex + 1;
              const progress = Math.round((imgIndex / totalImages) * 100);
              wx.showLoading({
                title: `备份中 ${progress}%`,
                mask: true
              });

              let compressedPath = imgInfo.image.path;
              try {
                const compressResult = await new Promise<{ tempFilePath: string }>((resolve, reject) => {
                  wx.compressImage({
                    src: imgInfo.image.path,
                    quality: 80,
                    success: resolve,
                    fail: reject
                  });
                });
                compressedPath = compressResult.tempFilePath;
              } catch (e) {
                console.warn('图片压缩失败，使用原图', e);
              }

              const uploadResult = await wx.cloud.uploadFile({
                cloudPath: `schedule_images/${this.userId}/${imgInfo.remotePath}`,
                filePath: compressedPath
              });

              const imageHash = await this.calculateImageHash(
                imgInfo.image.path,
                imgInfo.weekKey,
                imgInfo.imageName,
                imgInfo.image.addedTime!
              );

              return {
                ...imgInfo,
                fileID: uploadResult.fileID,
                hash: imageHash
              };
            } catch (e) {
              console.error('上传图片失败', imgInfo.remotePath, e);
              return null;
            }
          });

          const batchResults = await Promise.all(batchPromises);
          for (const result of batchResults) {
            if (result) {
              uploadedImages.push(result);
              newImageCount++;
            }
          }
        }
      }

      const localImageMap = new Map<string, ImageUploadInfo>();
      validImages.forEach((img: ImageUploadInfo) => {
        if (img.weekKey && img.imageName) {
          const key = `${img.weekKey}_${img.imageName}`;
          localImageMap.set(key, img);
        }
      });

      try {
        const existingImagesResult = await this.callCloudFunction(config.cloudFunctions.backup, {
          action: 'getExistingImages',
          userId: this.userId
        });

        if (existingImagesResult.result.success) {
          const existingImages = existingImagesResult.result.images || [];

          const uploadedImageMap = new Map<string, Record<string, unknown>>();
          uploadedImages.forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              uploadedImageMap.set(key, img);
            }
          });

          existingImages.forEach((img: Record<string, unknown>) => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              if (localImageMap.has(key) && !uploadedImageMap.has(key)) {
                uploadedImages.push(img);
              }
            }
          });

        }
      } catch (e) {
        console.warn('获取云端现有图片失败', e);
      }

      wx.showLoading({ title: '完成备份...' });
      const backupResult = await this.callCloudFunction(config.cloudFunctions.backup, {
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

        let message: string;
        if (backupResult.result.hasChanges) {
          if (newImageCount > 0 && deletedImageCount > 0) {
            message = `备份成功（新增${newImageCount}张，删除${deletedImageCount}张图片）`;
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

        // 将新上传的图片注册到 LRU 缓存索引
        for (const img of uploadedImages) {
          const imageObj = img.image as Record<string, unknown>;
          if (img && img.fileID && imageObj && imageObj.path) {
            photoCache.registerExistingFile(
              img.fileID as string,
              imageObj.path as string,
              (img.hash as string) || '',
              img.weekKey as string,
              img.imageName as string
            );
          }
        }

        // 将 fileID 回写到本地 week_images_* 存储，供删除时清理 LRU 索引
        for (const img of uploadedImages) {
          if (img && img.fileID && img.weekKey && img.imageName) {
            const storageKey = img.weekKey as string;
            const weekImages: Record<string, unknown>[] = wx.getStorageSync(storageKey) || [];
            let hasUpdate = false;
            const updatedWeekImages = weekImages.map((wi: Record<string, unknown>) => {
              if (wi.name === img.imageName && !wi.fileID) {
                hasUpdate = true;
                return { ...wi, fileID: img.fileID };
              }
              return wi;
            });
            if (hasUpdate) {
              wx.setStorageSync(storageKey, updatedWeekImages);
            }
          }
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
        errMsg: (e as Error).message
      };
    }
  }

  async restore(): Promise<CloudFuncResult> {
    try {
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

      const getRelationResult = await this.callCloudFunction(config.cloudFunctions.restore, {
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

      const localVersion = this.BACKUP_SYSTEM_VERSION;
      const versionComparison = compareVersion(localVersion, backupVersion);

      if (versionComparison < 0) {
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
        wx.hideLoading();
        return new Promise<CloudFuncResult>((resolve) => {
          wx.showModal({
            title: '版本差异提示',
            content: `当前小程序版本(${localVersion})高于备份数据版本(${backupVersion})，恢复可能会导致数据结构不兼容。是否继续恢复？`,
            cancelText: '取消',
            confirmText: '继续恢复',
            success: async (res) => {
              if (res.confirm) {
                const result = await this.performRestoreWithNewFlow(cloudRelation);
                resolve(result);
              } else {
                resolve({
                  success: false,
                  errMsg: '用户取消恢复'
                });
              }
            }
          });
        });
      } else {
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
        errMsg: (e as Error).message
      };
    }
  }

  async performRestoreWithNewFlow(cloudRelation: ImageRelation): Promise<CloudFuncResult> {
    try {
      wx.showLoading({ title: '开始恢复...' });

      syncRelationWithLocal();

      const localRelation = getImageRelationTable();

      const imagesToAdd: Array<{ weekKey: string; name: string; path: string; hash: string }> = [];
      const imagesToDelete: Array<{ weekKey: string; name: string; path: string; id: string }> = [];

      const localImageMap = new Map<string, Record<string, unknown>>();
      Object.keys(localRelation || {}).forEach(weekKey => {
        const weekImages = localRelation[weekKey] || [];
        weekImages.forEach((img: Record<string, unknown>) => {
          const key = `${weekKey}_${img.name}`;
          localImageMap.set(key, img);
        });
      });

      const cloudImageMap = new Map<string, Record<string, unknown>>();
      Object.keys(cloudRelation || {}).forEach(weekKey => {
        const weekImages = cloudRelation[weekKey] || [];
        weekImages.forEach((img: Record<string, unknown>) => {
          const key = `${weekKey}_${img.name}`;
          cloudImageMap.set(key, img);
        });
      });

      Object.keys(cloudRelation || {}).forEach(weekKey => {
        const weekImages = cloudRelation[weekKey] || [];
        weekImages.forEach((img: Record<string, unknown>) => {
          const key = `${weekKey}_${img.name}`;
          if (!localImageMap.has(key)) {
            imagesToAdd.push({
              weekKey: weekKey,
              name: img.name as string,
              path: img.path as string,
              hash: img.hash as string
            });
          }
        });
      });

      Object.keys(localRelation || {}).forEach(weekKey => {
        const weekImages = localRelation[weekKey] || [];
        weekImages.forEach((img: Record<string, unknown>) => {
          const key = `${weekKey}_${img.name}`;
          if (!cloudImageMap.has(key)) {
            imagesToDelete.push({
              weekKey: weekKey,
              name: img.name as string,
              path: img.path as string,
              id: img.id as string
            });
          }
        });
      });

      let deletedImageCount = 0;
      for (const imgToDelete of imagesToDelete) {
        const weekImages = wx.getStorageSync(imgToDelete.weekKey) || [];
        const updatedImages = weekImages.filter((img: WeekImage) => img.id !== imgToDelete.id);
        wx.setStorageSync(imgToDelete.weekKey, updatedImages);

        removeImageFromRelation(imgToDelete.weekKey, imgToDelete.id);

        deletedImageCount++;
      }

      const imageCounters = { newImages: 0 };
      if (imagesToAdd.length > 0) {
        const getImagesResult = await this.callCloudFunction(config.cloudFunctions.restore, {
          action: 'getAllCloudImages',
          userId: this.userId
        });

        if (!getImagesResult.result.success) {
          wx.hideLoading();
          wx.showToast({
            title: '恢复失败',
            icon: 'none'
          });
          return {
            success: false,
            errMsg: getImagesResult.result.errMsg || '恢复失败'
          };
        }

        const allCloudImages = getImagesResult.result.images || [];

        // 构建云端 fileID 索引
        const cloudFileIDMap = new Map<string, string>();
        allCloudImages.forEach((img: Record<string, unknown>) => {
          const key = `${img.weekKey}_${img.imageName || img.name}`;
          if (img.fileID) cloudFileIDMap.set(key, img.fileID as string);
        });

        // 只写入元数据 + fileID，图片文件按需加载
        if (imagesToAdd.length > 0) {
          for (const addImg of imagesToAdd) {
            const lookupKey = `${addImg.weekKey}_${addImg.name}`;
            const fileID = cloudFileIDMap.get(lookupKey) || '';

            const weekKey = addImg.weekKey;
            const weekImages = wx.getStorageSync(weekKey) || [];

            // 查重
            const exists = weekImages.some((img: WeekImage) => img.name === addImg.name);
            if (exists) continue;

            const newImage: WeekImage & { fileID?: string } = {
              id: `${weekKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: addImg.name,
              path: '',  // 无本地缓存，由 photoCache 按需加载
              addedTime: new Date().toISOString(),
              hash: addImg.hash,
              fileID: fileID
            };

            weekImages.push(newImage);
            wx.setStorageSync(weekKey, weekImages);

            // 更新关联表（path 为空字符串，仅用于占位）
            addImageToRelation(weekKey, newImage);

            imageCounters.newImages++;
          }
        }
      }

      wx.removeStorageSync('image_relation_table');
      importImageWeekRelation(cloudRelation);

      const restoreResult = await this.callCloudFunction(config.cloudFunctions.restore, {
        action: 'restoreOtherData',
        userId: this.userId
      });

      if (restoreResult.result.success) {
        const backupData = restoreResult.result.data as Record<string, unknown>;

        wx.removeStorageSync('shifts');
        wx.removeStorageSync('shiftTemplates');
        wx.removeStorageSync('statData');
        wx.removeStorageSync('statLastModified');
        wx.removeStorageSync('standardHours');
        wx.removeStorageSync('imagesLastModified');

        if (backupData.shiftTemplates) {
          wx.setStorageSync('shiftTemplates', backupData.shiftTemplates);
        }
        if (backupData.shifts) {
          wx.setStorageSync('shifts', backupData.shifts);
        }
        if (backupData.avatarInfo) {
          const avatarInfo = backupData.avatarInfo as Record<string, string>;
          if (avatarInfo.avatarType) {
            wx.setStorageSync('avatarType', avatarInfo.avatarType);
          }
          if (avatarInfo.avatarEmoji) {
            wx.setStorageSync('avatarEmoji', avatarInfo.avatarEmoji);
          }
          if (avatarInfo.username) {
            wx.setStorageSync('username', avatarInfo.username);
          }
        }
      }

      wx.hideLoading();

      if (imageCounters.newImages > 0 || deletedImageCount > 0) {
        let message = '恢复成功';
        if (imageCounters.newImages > 0 && deletedImageCount > 0) {
          message = `恢复成功（新增${imageCounters.newImages}张，删除${deletedImageCount}张图片）`;
        } else if (imageCounters.newImages > 0) {
          message = `恢复成功（新增${imageCounters.newImages}张图片）`;
        } else if (deletedImageCount > 0) {
          message = `恢复成功（删除${deletedImageCount}张图片）`;
        }
        wx.showToast({
          title: message,
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: '恢复成功（无变化）',
          icon: 'success'
        });
      }

      store.setState({ _lastDataRestore: Date.now() });

      return {
        success: true,
        newImages: imageCounters.newImages,
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
        errMsg: (e as Error).message
      };
    }
  }

  async getBackupInfo(): Promise<CloudFuncResult> {
    try {
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

      const result = await this.callCloudFunction(config.cloudFunctions.backup, {
        action: 'getBackupInfo',
        userId: this.userId
      });

      return result.result;
    } catch (e) {
      console.error('获取备份信息失败', e);
      return {
        success: false,
        errMsg: (e as Error).message
      };
    }
  }

  async getLatestBackupInfo(): Promise<{ success: boolean; hasBackup?: boolean; backupTime?: string | null; backupHash?: string | null; errMsg?: string }> {
    try {
      if (!this.isCloudInitialized()) {
        return { success: false, errMsg: '云开发未初始化' };
      }
      if (!this.isLoggedIn()) {
        return { success: false, errMsg: '请先登录' };
      }

      const result = await this.callCloudFunction(config.cloudFunctions.backup, {
        action: 'getBackupInfo',
        userId: this.userId
      });

      if (result.result && result.result.success) {
        const data = (result.result.data || {}) as Record<string, unknown>;
        return {
          success: true,
          hasBackup: !!result.result.hasBackup,
          backupTime: (data.backupTime as string) || null,
          backupHash: (data.backupHash as string) || null
        };
      }
      return {
        success: false,
        errMsg: (result.result && result.result.errMsg) || '获取备份信息失败'
      };
    } catch (e) {
      console.error('获取最新备份信息失败', e);
      return { success: false, errMsg: (e as Error).message };
    }
  }
}

module.exports = CloudManager;

export {};
