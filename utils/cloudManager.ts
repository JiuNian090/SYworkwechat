// @ts-nocheck
'use strict';
const { getAllValidImages, addImageToRelation, syncRelationWithLocal, importImageWeekRelation, getImageRelationTable, removeImageFromRelation } = require('./imageRelation.js');
const { calculateHash } = require('./encrypt.js');
const { store } = require('./store.js');
const { getCalendarWeekOfMonth } = require('./date.js');
const { compareVersion } = require('./deviceInfo.js');

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
}

class CloudManager {
  userId: string | null;

  constructor() {
    this.userId = null;
  }

  get BACKUP_SYSTEM_VERSION(): string {
    return 'v2.0.0';
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

  async register(account: string, password: string, nickname: string): Promise<CloudFuncResult> {
    try {
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

      const result = await this.callCloudFunction('userLogin', {
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
        console.log(`已更新周 ${weekKey} 的图片名称格式`);
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
          const hashInput = `${addedTime}_${weekKey}_${imageName}_${res.mtime}_${res.size}`;
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
        const infoResult = await this.callCloudFunction('backupRestore', {
          action: 'getBackupInfo',
          userId: this.userId
        });
        if (infoResult.result.success && infoResult.result.hasBackup) {
          await this.callCloudFunction('backupRestore', {
            action: 'restore',
            userId: this.userId
          });
        }
      } catch (e) {
        console.log('获取云端备份信息失败，假设是新备份', e);
      }

      const avatarInfo = {
        avatarType: wx.getStorageSync('avatarType') || 'text',
        avatarEmoji: wx.getStorageSync('avatarEmoji') || '',
        username: wx.getStorageSync('username') || ''
      };

      wx.showLoading({ title: '开始备份...' });

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
          title: '备份失败',
          icon: 'none'
        });
        return {
          success: false,
          errMsg: diffResult.result.errMsg || '备份失败'
        };
      }

      const imagesToUpload = diffResult.result.imagesToUpload || [];
      const imagesToDelete = diffResult.result.imagesToDelete || [];

      console.log('备份 - 需要上传的图片数量:', imagesToUpload.length);
      console.log('备份 - 需要删除的图片数量:', imagesToDelete.length);

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
                console.log('图片压缩失败，使用原图', e);
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
        const existingImagesResult = await this.callCloudFunction('backupRestore', {
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

          console.log('备份 - 最终上传图片数量:', uploadedImages.length);
        }
      } catch (e) {
        console.log('获取云端现有图片失败', e);
      }

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

  async performRestore(backupData: Record<string, unknown>): Promise<CloudFuncResult> {
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

    const restoredImages: string[] = [];
    const counters = { actualNewImages: 0, actualUpdatedImages: 0 };
    const images = (backupData.images || []) as Array<Record<string, unknown>>;
    const restoredWeekKeys = new Set<string>();
    const imageWeekRelation: ImageRelation = {};

    const localImageMap = new Map<string, WeekImage>();
    const storageInfo = wx.getStorageInfoSync();
    const weekKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

    for (const weekKey of weekKeys) {
      const localImages = wx.getStorageSync(weekKey) || [];
      for (const img of localImages) {
        if (!img.hash) {
          try {
            img.hash = await this.calculateImageHash(
              img.path,
              weekKey,
              img.name,
              img.addedTime || new Date().toISOString()
            );
          } catch (e) {
            console.log('计算本地图片哈希值失败:', e);
            img.hash = '';
          }
        }
        const key = `${weekKey}_${img.name}`;
        localImageMap.set(key, img);
      }
    }

    const imagesToDownload: Array<Record<string, unknown>> = [];
    const weekNameCountMap = new Map<string, Map<string, number>>();

    images.forEach((imgInfo: Record<string, unknown>) => {
      if (!weekNameCountMap.has(imgInfo.weekKey as string)) {
        weekNameCountMap.set(imgInfo.weekKey as string, new Map<string, number>());
      }
      const nameMap = weekNameCountMap.get(imgInfo.weekKey as string)!;
      const baseName = (imgInfo.imageName as string || '').replace(/\(\d+\)$/, '').trim();
      nameMap.set(baseName, (nameMap.get(baseName) || 0) + 1);
    });

    for (const imgInfo of images) {
      let foundExistingImage = false;
      let localImage: WeekImage | null = null;

      const localKey = `${imgInfo.weekKey}_${imgInfo.imageName}`;
      if (localImageMap.has(localKey)) {
        localImage = localImageMap.get(localKey)!;
        if (localImage.hash === imgInfo.hash) {
          console.log('图片未变化，跳过下载:', imgInfo.remotePath);
          foundExistingImage = true;
        } else {
          console.log('哈希值不同，需要更新:', imgInfo.remotePath);
        }
      }

      if (!foundExistingImage) {
        const weekKey = imgInfo.weekKey as string;
        if (weekKeys.includes(weekKey)) {
          const weekImages = wx.getStorageSync(weekKey) || [];
          for (const img of weekImages) {
            if (img.hash === imgInfo.hash) {
              console.log('找到哈希值相同的图片，跳过下载:', imgInfo.remotePath);
              foundExistingImage = true;
              break;
            }
          }
        }
      }

      if (!foundExistingImage) {
        imagesToDownload.push(imgInfo);
      }
    }

    const maxConcurrentDownloads = 5;
    const totalImages = imagesToDownload.length;

    for (let i = 0; i < totalImages; i += maxConcurrentDownloads) {
      const batch = imagesToDownload.slice(i, i + maxConcurrentDownloads);
      const batchPromises = batch.map(async (imgInfo: Record<string, unknown>, batchIndex: number) => {
        try {
          const imgIndex = i + batchIndex + 1;
          const progress = Math.round((imgIndex / totalImages) * 100);
          const localKey = `${imgInfo.weekKey}_${imgInfo.imageName}`;
          const localImage = localImageMap.get(localKey);
          const operation = localImage && localImage.hash !== imgInfo.hash ? '更新' : '新增';
          wx.showLoading({
            title: `恢复中 ${operation}图片 ${imgIndex}/${totalImages} (${progress}%)`,
            mask: true
          });

          const downloadResult = await wx.cloud.downloadFile({
            fileID: imgInfo.fileID as string
          });

          const imageHash = await this.calculateImageHash(
            downloadResult.tempFilePath,
            imgInfo.weekKey as string,
            imgInfo.imageName as string,
            (imgInfo.addedTime as string) || new Date().toISOString()
          );

          const weekKey = imgInfo.weekKey as string;
          const weekImages = wx.getStorageSync(weekKey) || [];

          const existingImageIndex = weekImages.findIndex((img: WeekImage) => img.name === imgInfo.imageName);
          let finalImageName = imgInfo.imageName as string;
          let shouldUpdate = true;

          if (existingImageIndex === -1) {
            const nameCountMap = new Map<string, number>();
            weekImages.forEach((img: WeekImage) => {
              const baseName = img.name.replace(/\(\d+\)$/, '').trim();
              nameCountMap.set(baseName, (nameCountMap.get(baseName) || 0) + 1);
            });

            const baseName = (imgInfo.imageName as string).replace(/\(\d+\)$/, '').trim();
            if (nameCountMap.has(baseName)) {
              const count = nameCountMap.get(baseName)! + 1;
              finalImageName = `${baseName}(${count})`;
            }
          } else {
            const existingImage = weekImages[existingImageIndex];
            if (existingImage.hash === imageHash) {
              console.log('下载的图片与本地图片哈希值相同，跳过更新:', imgInfo.remotePath);
              shouldUpdate = false;
            }
          }

          if (shouldUpdate) {
            const newImage: WeekImage = {
              id: `${weekKey}_${Date.now()}`,
              name: finalImageName,
              path: downloadResult.tempFilePath,
              addedTime: new Date().toISOString(),
              hash: imageHash
            };

            if (existingImageIndex !== -1) {
              weekImages[existingImageIndex] = newImage;
              counters.actualUpdatedImages++;
            } else {
              weekImages.push(newImage);
              counters.actualNewImages++;
            }

            wx.setStorageSync(weekKey, weekImages);

            addImageToRelation(weekKey, newImage);
            restoredWeekKeys.add(weekKey);

            if (!imageWeekRelation[weekKey]) {
              imageWeekRelation[weekKey] = [];
            }
            imageWeekRelation[weekKey].push({
              name: newImage.name,
              path: newImage.path,
              hash: imageHash
            });

            restoredImages.push(imgInfo.remotePath as string);
          }
        } catch (e) {
          console.error('恢复图片失败', imgInfo.remotePath, e);
        }
      });

      await Promise.all(batchPromises);
    }

    wx.removeStorageSync('image_relation_table');
    if (Object.keys(imageWeekRelation).length > 0) {
      importImageWeekRelation(imageWeekRelation);
    }

    restoredWeekKeys.forEach(weekKey => {
      syncRelationWithLocal(weekKey);
    });

    const cloudImageMap = new Map<string, Record<string, unknown>>();
    images.forEach((imgInfo: Record<string, unknown>) => {
      const key = `${imgInfo.weekKey}_${imgInfo.imageName}`;
      cloudImageMap.set(key, imgInfo);
    });

    let deletedImageCount = 0;
    weekKeys.forEach(weekKey => {
      let weekImages = wx.getStorageSync(weekKey) || [];
      const originalLength = weekImages.length;

      weekImages = weekImages.filter((img: WeekImage) => {
        const key = `${weekKey}_${img.name}`;
        return cloudImageMap.has(key);
      });

      if (weekImages.length < originalLength) {
        deletedImageCount += (originalLength - weekImages.length);
        wx.setStorageSync(weekKey, weekImages);
        syncRelationWithLocal(weekKey);
      }
    });

    wx.hideLoading();

    if (counters.actualNewImages > 0 || counters.actualUpdatedImages > 0 || deletedImageCount > 0) {
      let message = '恢复成功';
      if (counters.actualNewImages > 0 && counters.actualUpdatedImages > 0 && deletedImageCount > 0) {
        message = `恢复成功（新增${counters.actualNewImages}张，更新${counters.actualUpdatedImages}张，删除${deletedImageCount}张）`;
      } else if (counters.actualNewImages > 0 && counters.actualUpdatedImages > 0) {
        message = `恢复成功（新增${counters.actualNewImages}张，更新${counters.actualUpdatedImages}张）`;
      } else if (counters.actualNewImages > 0 && deletedImageCount > 0) {
        message = `恢复成功（新增${counters.actualNewImages}张，删除${deletedImageCount}张）`;
      } else if (counters.actualUpdatedImages > 0 && deletedImageCount > 0) {
        message = `恢复成功（更新${counters.actualUpdatedImages}张，删除${deletedImageCount}张）`;
      } else if (counters.actualNewImages > 0) {
        message = `恢复成功（新增${counters.actualNewImages}张图片）`;
      } else if (counters.actualUpdatedImages > 0) {
        message = `恢复成功（更新${counters.actualUpdatedImages}张图片）`;
      } else if (deletedImageCount > 0) {
        message = `恢复成功（删除${deletedImageCount}张图片）`;
      }
      wx.showToast({
        title: message,
        icon: 'success'
      });
    } else if (images.length > 0) {
      wx.showToast({
        title: '恢复成功（图片无变化）',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '恢复成功（无图片数据）',
        icon: 'success'
      });
    }

    setTimeout(() => {
      store.setState({ _lastDataRestore: Date.now() });
    }, 500);

    return {
      success: true,
      restoredImages: restoredImages.length
    };
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

      console.log('恢复 - 需要新增的图片数量:', imagesToAdd.length);
      console.log('恢复 - 需要删除的图片数量:', imagesToDelete.length);

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
        const getImagesResult = await this.callCloudFunction('backupRestore', {
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

        const imagesToDownload = allCloudImages.filter((img: Record<string, unknown>) => {
          const key = `${img.weekKey}_${img.imageName || img.name}`;
          return imagesToAdd.some(addImg => {
            const addKey = `${addImg.weekKey}_${addImg.name}`;
            return key === addKey;
          });
        });

        if (imagesToDownload.length > 0) {
          const maxConcurrentDownloads = 5;
          const totalImages = imagesToDownload.length;

          for (let i = 0; i < totalImages; i += maxConcurrentDownloads) {
            const batch = imagesToDownload.slice(i, i + maxConcurrentDownloads);
            const batchPromises = batch.map(async (imgInfo: Record<string, unknown>, batchIndex: number) => {
              try {
                const imgIndex = i + batchIndex + 1;
                const progress = Math.round((imgIndex / totalImages) * 100);
                wx.showLoading({
                  title: `恢复中 ${progress}%`,
                  mask: true
                });

                const downloadResult = await wx.cloud.downloadFile({
                  fileID: imgInfo.fileID as string
                });

                const weekKey = imgInfo.weekKey as string;
                const weekImages = wx.getStorageSync(weekKey) || [];

                const nameCountMap = new Map<string, number>();
                weekImages.forEach((img: WeekImage) => {
                  const baseName = img.name.replace(/\(\d+\)$/, '').trim();
                  nameCountMap.set(baseName, (nameCountMap.get(baseName) || 0) + 1);
                });

                let finalImageName = (imgInfo.imageName || imgInfo.name) as string;
                const baseName = finalImageName.replace(/\(\d+\)$/, '').trim();
                if (nameCountMap.has(baseName)) {
                  const count = nameCountMap.get(baseName)! + 1;
                  finalImageName = `${baseName}(${count})`;
                }

                const newImage: WeekImage = {
                  id: `${weekKey}_${Date.now()}`,
                  name: finalImageName,
                  path: downloadResult.tempFilePath,
                  addedTime: new Date().toISOString(),
                  hash: imgInfo.hash as string
                };

                weekImages.push(newImage);
                wx.setStorageSync(weekKey, weekImages);

                addImageToRelation(weekKey, newImage);

                imageCounters.newImages++;
              } catch (e) {
                console.error('下载图片失败', imgInfo.remotePath, e);
              }
            });

            await Promise.all(batchPromises);
          }
        }
      }

      wx.removeStorageSync('image_relation_table');
      importImageWeekRelation(cloudRelation);

      const restoreResult = await this.callCloudFunction('backupRestore', {
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

      const result = await this.callCloudFunction('backupRestore', {
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

      const result = await this.callCloudFunction('backupRestore', {
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
