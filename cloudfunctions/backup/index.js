'use strict';
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('schedule_users');
const imageBackupCollection = db.collection('schedule_image_backups');
const dataBackupCollection = db.collection('schedule_data_backups');

const BACKUP_SYSTEM_VERSION = 'v2.0.0';

// ==================== 工具函数 ====================

function calculateHash(data) {
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

function isDataEqual(data1, data2) {
  const isImageRelation = (obj) => {
    return obj && typeof obj === 'object' &&
           Object.values(obj).every(arr => Array.isArray(arr) &&
           arr.every(item => item && typeof item === 'object' &&
           'name' in item && 'path' in item));
  };

  if (isImageRelation(data1) && isImageRelation(data2)) {
    const keys1 = Object.keys(data1).sort();
    const keys2 = Object.keys(data2).sort();
    if (keys1.length !== keys2.length) return false;
    for (let i = 0; i < keys1.length; i++) {
      const key = keys1[i];
      if (key !== keys2[i]) return false;
      const arr1 = data1[key].sort((a, b) => a.name.localeCompare(b.name));
      const arr2 = data2[key].sort((a, b) => a.name.localeCompare(b.name));
      if (arr1.length !== arr2.length) return false;
      for (let j = 0; j < arr1.length; j++) {
        if (arr1[j].name !== arr2[j].name || arr1[j].path !== arr2[j].path) {
          return false;
        }
      }
    }
    return true;
  }

  const json1 = JSON.stringify(data1);
  const json2 = JSON.stringify(data2);
  return calculateHash(json1) === calculateHash(json2);
}

function compareVersions(version1, version2) {
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

async function deleteExtraCloudImages(userId, existingImages, newImages) {
  try {
    const existingImageMap = new Map();
    existingImages.forEach(img => {
      if (img.remotePath) existingImageMap.set(img.remotePath, img);
    });

    const newImageMap = new Map();
    newImages.forEach(img => {
      if (img.remotePath) newImageMap.set(img.remotePath, img);
    });

    const imagesToDelete = [];
    existingImageMap.forEach((img, remotePath) => {
      if (!newImageMap.has(remotePath)) imagesToDelete.push(img);
    });

    const deletePromises = [];
    for (const img of imagesToDelete) {
      try {
        if (img.fileID) {
          deletePromises.push(cloud.deleteFile({ fileList: [img.fileID] }));
        }
      } catch (e) {
        console.error('删除云端图片失败', img.remotePath, e);
      }
    }

    if (deletePromises.length > 0) await Promise.all(deletePromises);
    return imagesToDelete.length;
  } catch (e) {
    console.error('删除云端多余图片失败', e);
    return 0;
  }
}

async function initCollections() {
  try {
    const imageInitResult = await imageBackupCollection.add({
      data: {
        userId: 'temp_init',
        images: [],
        imageWeekRelation: {},
        backupSystemVersion: BACKUP_SYSTEM_VERSION,
        backupTime: new Date(),
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    await imageBackupCollection.doc(imageInitResult._id).remove();

    const dataInitResult = await dataBackupCollection.add({
      data: {
        userId: 'temp_init',
        shiftTemplates: [],
        shifts: {},
        backupIndex: {},
        backupSystemVersion: BACKUP_SYSTEM_VERSION,
        backupTime: new Date(),
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    await dataBackupCollection.doc(dataInitResult._id).remove();
  } catch (e) {
    console.log('集合初始化失败，可能是集合已经存在', e);
  }
}

async function validateUser(userId) {
  const userResult = await usersCollection.doc(userId).get();
  if (!userResult.data) {
    return { valid: false, errMsg: '用户不存在' };
  }
  return { valid: true };
}

// ==================== 主入口 ====================

exports.main = async (event, context) => {
  const { action, userId, data } = event;

  try {
    await initCollections();

    const userValid = await validateUser(userId);
    if (!userValid.valid) {
      return { success: false, errMsg: userValid.errMsg };
    }

    switch (action) {

      // ========== getBackupInfo ==========
      case 'getBackupInfo': {
        const dataBackupResult = await dataBackupCollection.where({ userId })
          .orderBy('backupTime', 'desc').limit(1).get();
        const imageBackupResult = await imageBackupCollection.where({ userId })
          .orderBy('backupTime', 'desc').limit(1).get();

        if (dataBackupResult.data.length === 0 && imageBackupResult.data.length === 0) {
          return { success: true, hasBackup: false };
        }

        const dataBackup = dataBackupResult.data[0] || {};
        const imageBackup = imageBackupResult.data[0] || {};

        const backupSystemVersion = dataBackup.backupSystemVersion || imageBackup.backupSystemVersion || 'v1.0.0';
        const shiftTemplates = dataBackup.shiftTemplates || [];
        const shifts = dataBackup.shifts || {};
        const combined = JSON.stringify(shiftTemplates) + JSON.stringify(shifts);
        const backupHash = calculateHash(combined);

        return {
          success: true,
          hasBackup: true,
          data: {
            backupTime: dataBackup.backupTime || imageBackup.backupTime || new Date(),
            imageCount: (imageBackup.images || []).length,
            shiftCount: Object.keys(shifts).length,
            backupSystemVersion,
            backupHash
          }
        };
      }

      // ========== getBackupDiff ==========
      case 'getBackupDiff': {
        const { imageWeekRelation } = data;
        console.log('getBackupDiff - 本地关联表:', imageWeekRelation);

        const existingImageBackup = await imageBackupCollection.where({ userId }).get();
        let existingImages = [];
        let existingImageWeekRelation = {};

        if (existingImageBackup.data.length > 0) {
          existingImages = existingImageBackup.data[0].images || [];
          existingImageWeekRelation = existingImageBackup.data[0].imageWeekRelation || {};
        }

        console.log('getBackupDiff - 云端图片数量:', existingImages.length);
        console.log('getBackupDiff - 云端关联表:', existingImageWeekRelation);

        const localImageMap = new Map();
        Object.keys(imageWeekRelation || {}).forEach(weekKey => {
          const weekImages = imageWeekRelation[weekKey] || [];
          weekImages.forEach(img => {
            localImageMap.set(`${weekKey}_${img.name}`, img);
          });
        });

        const cloudImageMap = new Map();
        existingImages.forEach(img => {
          cloudImageMap.set(`${img.weekKey}_${img.imageName}`, img);
        });

        const imagesToUpload = [];
        const imagesToDelete = [];

        Object.keys(imageWeekRelation || {}).forEach(weekKey => {
          const weekImages = imageWeekRelation[weekKey] || [];
          weekImages.forEach(img => {
            const key = `${weekKey}_${img.name}`;
            if (!cloudImageMap.has(key)) {
              const weekDateStr = weekKey.replace('week_images_', '');
              const weekDate = new Date(weekDateStr);
              const year = weekDate.getFullYear();
              const month = String(weekDate.getMonth() + 1).padStart(2, '0');
              const yearMonth = `${year}-${month}`;
              const timestamp = Date.now();
              const remotePath = `images/${yearMonth}/${img.name}_${timestamp}.jpg`;

              imagesToUpload.push({
                weekKey,
                imageName: img.name,
                image: {
                  path: img.path,
                  name: img.name,
                  addedTime: new Date().toISOString(),
                  hash: img.hash
                },
                remotePath,
                hash: img.hash
              });
            }
          });
        });

        existingImages.forEach(img => {
          const key = `${img.weekKey}_${img.imageName}`;
          if (!localImageMap.has(key)) {
            imagesToDelete.push(img);
          }
        });

        console.log('getBackupDiff - 需要上传的图片数量:', imagesToUpload.length);
        console.log('getBackupDiff - 需要删除的图片数量:', imagesToDelete.length);

        return { success: true, imagesToUpload, imagesToDelete };
      }

      // ========== getExistingImages ==========
      case 'getExistingImages': {
        const existingImageBackup = await imageBackupCollection.where({ userId }).get();
        let existingImages = [];
        if (existingImageBackup.data.length > 0) {
          existingImages = existingImageBackup.data[0].images || [];
        }
        return { success: true, images: existingImages };
      }

      // ========== completeBackup ==========
      case 'completeBackup': {
        const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex, version = 'v1.0.0' } = data;

        let totalChanges = false;
        let deletedImageCount = 0;
        let versionChanged = false;

        // 1. 检查版本号
        const existingDataBackup = await dataBackupCollection.where({ userId }).get();
        let existingVersion = 'v0.0.0';
        if (existingDataBackup.data.length > 0) {
          existingVersion = existingDataBackup.data[0].backupSystemVersion || 'v0.0.0';
        }
        const versionComparison = compareVersions(version, existingVersion);

        // 2. 备份数据集合（全量替换）
        const dataBackupData = {
          userId,
          shiftTemplates,
          shifts,
          backupIndex: backupIndex || {},
          backupSystemVersion: version,
          backupTime: new Date(),
          updateTime: new Date()
        };

        if (existingDataBackup.data.length > 0) {
          await dataBackupCollection.doc(existingDataBackup.data[0]._id).set({
            data: {
              ...dataBackupData,
              createTime: existingDataBackup.data[0].createTime || new Date()
            }
          });
        } else {
          dataBackupData.createTime = new Date();
          await dataBackupCollection.add({ data: dataBackupData });
        }
        totalChanges = true;

        // 3. 备份图片数据集合
        const existingImageBackup = await imageBackupCollection.where({ userId }).get();
        const imageBackupData = {
          userId,
          images: images || [],
          imageWeekRelation: imageWeekRelation || {},
          backupSystemVersion: version,
          backupTime: new Date(),
          updateTime: new Date()
        };

        if (existingImageBackup.data.length > 0) {
          const currentImageBackup = existingImageBackup.data[0];
          let imageChanges = false;

          if (versionComparison !== 0) {
            imageChanges = true;
            versionChanged = true;
          } else {
            if (!isDataEqual(currentImageBackup.imageWeekRelation, imageWeekRelation || {})) {
              imageChanges = true;
            }
          }

          if (imageChanges) {
            // 找出并删除多余的云端图片
            const imagesToDelete = [];
            (currentImageBackup.images || []).forEach(img => {
              if (img.weekKey && img.imageName) {
                const key = `${img.weekKey}_${img.imageName}`;
                const localImageMap = new Map();
                (images || []).forEach(newImg => {
                  if (newImg.weekKey && newImg.imageName) {
                    localImageMap.set(`${newImg.weekKey}_${newImg.imageName}`, newImg);
                  }
                });
                if (!localImageMap.has(key)) {
                  imagesToDelete.push(img);
                }
              }
            });

            if (imagesToDelete.length > 0) {
              deletedImageCount = await deleteExtraCloudImages(userId, imagesToDelete, images || []);
            }

            await imageBackupCollection.doc(currentImageBackup._id).update({
              data: imageBackupData
            });
            totalChanges = true;
          }
        } else {
          imageBackupData.createTime = new Date();
          await imageBackupCollection.add({ data: imageBackupData });
          totalChanges = true;
        }

        return {
          success: true,
          message: totalChanges
            ? versionChanged ? '备份成功（版本更新）' : '备份成功（有更新）'
            : '备份成功（无变化）',
          hasChanges: totalChanges,
          deletedImageCount,
          versionChanged
        };
      }

      // ========== backup (旧版兼容) ==========
      case 'backup': {
        const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex, version = 'v1.0.0' } = data;

        let totalChanges = false;
        let deletedImageCount = 0;
        let versionChanged = false;

        const existingDataBackup = await dataBackupCollection.where({ userId }).get();
        let existingVersion = 'v0.0.0';
        if (existingDataBackup.data.length > 0) {
          existingVersion = existingDataBackup.data[0].backupSystemVersion || 'v0.0.0';
        }
        const versionComparison = compareVersions(version, existingVersion);

        const dataBackupData = {
          userId,
          shiftTemplates,
          shifts,
          backupIndex: backupIndex || {},
          backupSystemVersion: version,
          backupTime: new Date(),
          updateTime: new Date()
        };

        if (existingDataBackup.data.length > 0) {
          await dataBackupCollection.doc(existingDataBackup.data[0]._id).set({
            data: {
              ...dataBackupData,
              createTime: existingDataBackup.data[0].createTime || new Date()
            }
          });
        } else {
          dataBackupData.createTime = new Date();
          await dataBackupCollection.add({ data: dataBackupData });
        }
        totalChanges = true;

        const existingImageBackup = await imageBackupCollection.where({ userId }).get();
        const imageBackupData = {
          userId,
          images: images || [],
          imageWeekRelation: imageWeekRelation || {},
          backupSystemVersion: version,
          backupTime: new Date(),
          updateTime: new Date()
        };

        if (existingImageBackup.data.length > 0) {
          const currentImageBackup = existingImageBackup.data[0];
          let imageChanges = false;

          if (versionComparison !== 0) {
            imageChanges = true;
            versionChanged = true;
            deletedImageCount = await deleteExtraCloudImages(
              userId,
              currentImageBackup.images || [],
              images || []
            );
          } else {
            const currentImagesMap = new Map();
            (currentImageBackup.images || []).forEach(img => {
              if (img.remotePath) currentImagesMap.set(img.remotePath, img);
            });
            const newImagesMap = new Map();
            (images || []).forEach(img => {
              if (img.remotePath) newImagesMap.set(img.remotePath, img);
            });

            if (currentImagesMap.size !== newImagesMap.size) {
              imageChanges = true;
            } else {
              for (const [remotePath, newImg] of newImagesMap.entries()) {
                const currentImg = currentImagesMap.get(remotePath);
                if (!currentImg || currentImg.hash !== newImg.hash) {
                  imageChanges = true;
                  break;
                }
              }
            }

            if (!isDataEqual(currentImageBackup.imageWeekRelation, imageWeekRelation || {})) {
              imageChanges = true;
            }

            if (imageChanges) {
              deletedImageCount = await deleteExtraCloudImages(
                userId,
                currentImageBackup.images || [],
                images || []
              );
            }
          }

          if (imageChanges) {
            await imageBackupCollection.doc(currentImageBackup._id).update({
              data: imageBackupData
            });
            totalChanges = true;
          }
        } else {
          imageBackupData.createTime = new Date();
          await imageBackupCollection.add({ data: imageBackupData });
          totalChanges = true;
        }

        return {
          success: true,
          message: totalChanges
            ? versionChanged
              ? `备份成功（版本更新，删除${deletedImageCount}张图片）`
              : `备份成功（有更新，删除${deletedImageCount}张图片）`
            : '备份成功（无变化）',
          hasChanges: totalChanges,
          deletedImageCount,
          versionChanged
        };
      }

      default:
        return { success: false, errMsg: `无效的操作: ${action}` };
    }

  } catch (e) {
    console.error('备份操作失败', e);
    return { success: false, errMsg: e.message };
  }
};
