const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const backupCollection = db.collection('schedule_backups');
const usersCollection = db.collection('schedule_users');

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
      // 备份数据
      const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex } = data;
      
      // 查找是否有现有的备份记录
      const existingBackup = await backupCollection.where({
        userId: userId
      }).get();

      if (existingBackup.data.length > 0) {
        // 更新现有备份
        await backupCollection.doc(existingBackup.data[0]._id).update({
          data: {
            shiftTemplates: shiftTemplates,
            shifts: shifts,
            images: images || [],
            imageWeekRelation: imageWeekRelation || {},
            backupIndex: backupIndex || {},
            backupTime: new Date(),
            updateTime: new Date()
          }
        });
      } else {
        // 创建新备份
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
      }

      return {
        success: true,
        message: '备份成功'
      };

    } else if (action === 'restore') {
      // 恢复数据
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
          shiftCount: (backup.shifts || []).length
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
