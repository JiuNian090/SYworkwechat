const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const backupCollection = db.collection('schedule_backups');
const usersCollection = db.collection('schedule_users');

// 计算数据哈希值
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

// 对比两个数据是否相同
function isDataEqual(data1, data2) {
  const json1 = JSON.stringify(data1);
  const json2 = JSON.stringify(data2);
  return calculateHash(json1) === calculateHash(json2);
}

// 删除云端多余的图片文件
async function deleteExtraCloudImages(userId, existingImages, newImages) {
  try {
    const existingImageMap = new Map();
    existingImages.forEach(img => {
      if (img.remotePath) {
        existingImageMap.set(img.remotePath, img);
      }
    });

    const newImageMap = new Map();
    newImages.forEach(img => {
      if (img.remotePath) {
        newImageMap.set(img.remotePath, img);
      }
    });

    // 找出需要删除的图片（云端有但本地没有的）
    const imagesToDelete = [];
    existingImageMap.forEach((img, remotePath) => {
      if (!newImageMap.has(remotePath)) {
        imagesToDelete.push(img);
      }
    });

    // 删除云端图片文件
    const deletePromises = [];
    for (const img of imagesToDelete) {
      try {
        if (img.fileID) {
          deletePromises.push(
            cloud.deleteFile({
              fileList: [img.fileID]
            })
          );
        }
      } catch (e) {
        console.error('删除云端图片失败', img.remotePath, e);
      }
    }

    await Promise.all(deletePromises);
    return imagesToDelete.length;
  } catch (e) {
    console.error('删除云端多余图片失败', e);
    return 0;
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, userId, data } = event;

  try {
    // 验证用户是否存在
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    if (action === 'backup') {
      // 备份数据 - 增量备份，只更新有变化的数据，同时删除云端多余的图片
      const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex } = data;
      
      // 查找是否有现有的备份记录
      const existingBackup = await backupCollection.where({
        userId: userId
      }).get();

      if (existingBackup.data.length > 0) {
        const currentBackup = existingBackup.data[0];
        const updateData = {};
        let hasChanges = false;

        // 对比班次模板
        if (!isDataEqual(currentBackup.shiftTemplates, shiftTemplates)) {
          updateData.shiftTemplates = shiftTemplates;
          hasChanges = true;
        }

        // 对比排班数据
        if (!isDataEqual(currentBackup.shifts, shifts)) {
          updateData.shifts = shifts;
          hasChanges = true;
        }

        // 对比图片数据
        if (!isDataEqual(currentBackup.images, images || [])) {
          updateData.images = images || [];
          hasChanges = true;
        }

        // 对比图片关联表
        if (!isDataEqual(currentBackup.imageWeekRelation, imageWeekRelation || {})) {
          updateData.imageWeekRelation = imageWeekRelation || {};
          hasChanges = true;
        }

        // 对比备份索引
        if (!isDataEqual(currentBackup.backupIndex, backupIndex || {})) {
          updateData.backupIndex = backupIndex || {};
          hasChanges = true;
        }

        // 删除云端多余的图片文件
        let deletedImageCount = 0;
        if (hasChanges || currentBackup.images.length !== (images || []).length) {
          deletedImageCount = await deleteExtraCloudImages(
            userId, 
            currentBackup.images || [], 
            images || []
          );
        }

        if (hasChanges) {
          // 有变化，更新备份
          updateData.updateTime = new Date();
          updateData.backupTime = new Date();
          await backupCollection.doc(currentBackup._id).update({
            data: updateData
          });
        }

        return {
          success: true,
          message: hasChanges 
            ? `备份成功（有更新，删除${deletedImageCount}张图片）` 
            : `备份成功（无变化）`,
          hasChanges: hasChanges,
          deletedImageCount: deletedImageCount
        };
      } else {
        // 没有现有备份，创建新备份
        await backupCollection.add({
          data: {
            userId: userId,
            shiftTemplates: shiftTemplates,
            shifts: shifts,
            images: images || [],
            imageWeekRelation: imageWeekRelation || {},
            backupIndex: backupIndex || {},
            backupTime: new Date(),
            createTime: new Date(),
            updateTime: new Date()
          }
        });

        return {
          success: true,
          message: '备份成功（新备份）',
          hasChanges: true,
          deletedImageCount: 0
        };
      }

    } else if (action === 'restore') {
      // 恢复数据 - 返回云端完整数据，由前端完全替换本地
      const backupResult = await backupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      if (backupResult.data.length === 0) {
        return {
          success: false,
          errMsg: '没有找到备份数据'
        };
      }

      const backup = backupResult.data[0];

      return {
        success: true,
        data: {
          shiftTemplates: backup.shiftTemplates,
          shifts: backup.shifts,
          images: backup.images || [],
          imageWeekRelation: backup.imageWeekRelation || {},
          backupIndex: backup.backupIndex || {},
          backupTime: backup.backupTime
        }
      };

    } else if (action === 'getBackupInfo') {
      // 获取备份信息
      const backupResult = await backupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      if (backupResult.data.length === 0) {
        return {
          success: true,
          hasBackup: false
        };
      }

      const backup = backupResult.data[0];

      return {
        success: true,
        hasBackup: true,
        data: {
          backupTime: backup.backupTime,
          imageCount: (backup.images || []).length,
          shiftCount: Object.keys(backup.shifts || {}).length
        }
      };
    }

    return {
      success: false,
      errMsg: '无效的操作'
    };

  } catch (e) {
    console.error('备份/恢复失败', e);
    return {
      success: false,
      errMsg: e.message
    };
  }
};