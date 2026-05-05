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
  const { action, userId } = event;

  try {
    await initCollections();

    const userValid = await validateUser(userId);
    if (!userValid.valid) {
      return { success: false, errMsg: userValid.errMsg };
    }

    switch (action) {

      // ========== cleanup ==========
      case 'cleanup': {
        // 1. 获取用户图片备份记录
        const imageBackupResult = await imageBackupCollection.where({ userId }).get();

        if (imageBackupResult.data.length === 0) {
          return {
            success: true,
            message: '没有需要清理的数据',
            deletedFiles: 0,
            removedRecords: 0
          };
        }

        const imageBackup = imageBackupResult.data[0];
        const storedImages = imageBackup.images || [];
        const imageWeekRelation = imageBackup.imageWeekRelation || {};

        // 2. 构建关联表中引用的图片集合
        const referencedImages = new Set();
        Object.keys(imageWeekRelation).forEach(weekKey => {
          const weekImages = imageWeekRelation[weekKey] || [];
          weekImages.forEach(img => {
            // 使用 weekKey + imageName 作为唯一标识
            referencedImages.add(`${weekKey}_${img.name}`);
          });
        });

        // 3. 找出孤立图片（在 images 数组中但不在 imageWeekRelation 中）
        const orphanImages = storedImages.filter(img => {
          if (!img.weekKey || !img.imageName) return true; // 无效记录也清理
          const key = `${img.weekKey}_${img.imageName}`;
          return !referencedImages.has(key);
        });

        console.log('cleanup - 存储图片总数:', storedImages.length);
        console.log('cleanup - 关联表引用图片数:', referencedImages.size);
        console.log('cleanup - 孤立图片数:', orphanImages.length);

        // 4. 删除孤立图片的云存储文件
        let deletedFiles = 0;
        if (orphanImages.length > 0) {
          const fileIDs = orphanImages
            .filter(img => img.fileID)
            .map(img => img.fileID);

          if (fileIDs.length > 0) {
            try {
              const deleteResult = await cloud.deleteFile({ fileList: fileIDs });
              deletedFiles = (deleteResult.fileList || []).filter(f => f.status === 0).length;
              console.log('cleanup - 成功删除云存储文件:', deletedFiles);
            } catch (e) {
              console.error('cleanup - 删除云存储文件失败', e);
            }
          }
        }

        // 5. 更新 DB：移除孤立图片记录
        if (orphanImages.length > 0) {
          const keptImages = storedImages.filter(img => {
            if (!img.weekKey || !img.imageName) return false;
            const key = `${img.weekKey}_${img.imageName}`;
            return referencedImages.has(key);
          });

          await imageBackupCollection.doc(imageBackup._id).update({
            data: {
              images: keptImages,
              updateTime: new Date()
            }
          });
        }

        return {
          success: true,
          message: orphanImages.length > 0
            ? `清理完成（删除${deletedFiles}个云文件，移除${orphanImages.length}条记录）`
            : '没有需要清理的孤立数据',
          deletedFiles,
          removedRecords: orphanImages.length
        };
      }

      // ========== cleanupByFileIDs ==========
      // 按指定 fileID 列表清理云存储文件
      case 'cleanupByFileIDs': {
        const { fileIDs } = event;
        if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
          return { success: false, errMsg: '缺少 fileIDs 参数' };
        }

        try {
          const deleteResult = await cloud.deleteFile({ fileList: fileIDs });
          const deletedCount = (deleteResult.fileList || []).filter(f => f.status === 0).length;

          return {
            success: true,
            message: `成功删除${deletedCount}个文件`,
            deletedFiles: deletedCount,
            totalRequested: fileIDs.length
          };
        } catch (e) {
          console.error('cleanupByFileIDs - 删除失败', e);
          return { success: false, errMsg: e.message };
        }
      }

      default:
        return { success: false, errMsg: `无效的操作: ${action}` };
    }

  } catch (e) {
    console.error('清理操作失败', e);
    return { success: false, errMsg: e.message };
  }
};
