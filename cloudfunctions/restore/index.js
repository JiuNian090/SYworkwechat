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

      // ========== restore ==========
      case 'restore': {
        const dataBackupResult = await dataBackupCollection.where({ userId })
          .orderBy('backupTime', 'desc').limit(1).get();
        const imageBackupResult = await imageBackupCollection.where({ userId })
          .orderBy('backupTime', 'desc').limit(1).get();

        if (dataBackupResult.data.length === 0 && imageBackupResult.data.length === 0) {
          return { success: false, errMsg: '没有找到备份数据' };
        }

        const dataBackup = dataBackupResult.data[0] || {};
        const imageBackup = imageBackupResult.data[0] || {};
        const backupSystemVersion = dataBackup.backupSystemVersion || imageBackup.backupSystemVersion || 'v1.0.0';

        return {
          success: true,
          data: {
            shiftTemplates: dataBackup.shiftTemplates,
            shifts: dataBackup.shifts,
            images: imageBackup.images || [],
            imageWeekRelation: imageBackup.imageWeekRelation || {},
            backupIndex: dataBackup.backupIndex || {},
            backupTime: dataBackup.backupTime || imageBackup.backupTime || new Date(),
            backupSystemVersion
          }
        };
      }

      // ========== getBackupRelation ==========
      case 'getBackupRelation': {
        const existingImageBackup = await imageBackupCollection.where({ userId }).get();

        let imageWeekRelation = {};
        let backupSystemVersion = 'v1.0.0';

        if (existingImageBackup.data.length > 0) {
          imageWeekRelation = existingImageBackup.data[0].imageWeekRelation || {};
          backupSystemVersion = existingImageBackup.data[0].backupSystemVersion || 'v1.0.0';
        }

        return { success: true, imageWeekRelation, backupSystemVersion };
      }

      // ========== getAllCloudImages ==========
      case 'getAllCloudImages': {
        const existingImageBackup = await imageBackupCollection.where({ userId }).get();

        let existingImages = [];
        if (existingImageBackup.data.length > 0) {
          existingImages = existingImageBackup.data[0].images || [];
        }

        return { success: true, images: existingImages };
      }

      // ========== restoreOtherData ==========
      case 'restoreOtherData': {
        const existingDataBackup = await dataBackupCollection.where({ userId }).get();

        let backupData = {};
        if (existingDataBackup.data.length > 0) {
          backupData = existingDataBackup.data[0];
        }

        return { success: true, data: backupData };
      }

      // ========== getImagesForRestore ==========
      case 'getImagesForRestore': {
        const { imagesToAdd } = data;

        const existingImageBackup = await imageBackupCollection.where({ userId }).get();
        let existingImages = [];
        if (existingImageBackup.data.length > 0) {
          existingImages = existingImageBackup.data[0].images || [];
        }

        const cloudImageMap = new Map();
        existingImages.forEach(img => {
          cloudImageMap.set(`${img.weekKey}_${img.imageName}`, img);
        });

        const imagesToDownload = [];
        imagesToAdd.forEach(img => {
          const key1 = `${img.weekKey}_${img.name}`;
          const key2 = `${img.weekKey}_${img.imageName}`;
          if (cloudImageMap.has(key1)) {
            imagesToDownload.push(cloudImageMap.get(key1));
          } else if (cloudImageMap.has(key2)) {
            imagesToDownload.push(cloudImageMap.get(key2));
          }
        });

        return { success: true, images: imagesToDownload };
      }

      default:
        return { success: false, errMsg: `无效的操作: ${action}` };
    }

  } catch (e) {
    console.error('恢复操作失败', e);
    return { success: false, errMsg: e.message };
  }
};
