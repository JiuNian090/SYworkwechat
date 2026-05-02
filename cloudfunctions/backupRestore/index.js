'use strict';
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('schedule_users');
const imageBackupCollection = db.collection('schedule_image_backups');
const dataBackupCollection = db.collection('schedule_data_backups');

// 备份系统版本号
const BACKUP_SYSTEM_VERSION = 'v2.0.0';

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
  // 处理图片关联表的特殊情况，不依赖于顺序
  if (typeof data1 === 'object' && typeof data2 === 'object') {
    // 检查是否为图片关联表结构
    const isImageRelation = (obj) => {
      return obj && typeof obj === 'object' &&
             Object.values(obj).every(arr => Array.isArray(arr) &&
             arr.every(item => item && typeof item === 'object' &&
             'name' in item && 'path' in item));
    };

    if (isImageRelation(data1) && isImageRelation(data2)) {
      // 比较图片关联表，不依赖于顺序
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
  }

  // 普通数据比较
  const json1 = JSON.stringify(data1);
  const json2 = JSON.stringify(data2);
  return calculateHash(json1) === calculateHash(json2);
}

// 比较版本号大小
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

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    return imagesToDelete.length;
  } catch (e) {
    console.error('删除云端多余图片失败', e);
    return 0;
  }
}

// 初始化集合
async function initCollections() {
  try {
    // 尝试向集合添加一条临时数据，触发集合自动创建
    // 对于 imageBackupCollection
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

    // 删除临时数据
    await imageBackupCollection.doc(imageInitResult._id).remove();

    // 对于 dataBackupCollection
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

    // 删除临时数据
    await dataBackupCollection.doc(dataInitResult._id).remove();
  } catch (e) {
    console.log('集合初始化失败，可能是集合已经存在', e);
  }
}

exports.main = async (event, context) => {
  const { action, userId, data } = event;

  try {
    // 初始化集合
    await initCollections();

    // 验证用户是否存在
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    if (action === 'getBackupDiff') {
      // 第一步：分析备份差异，返回需要新增的图片清单
      const { imageWeekRelation } = data;

      console.log('getBackupDiff - 本地关联表:', imageWeekRelation);

      // 获取云端现有的图片备份
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      let existingImages = [];
      let existingImageWeekRelation = {};

      if (existingImageBackup.data.length > 0) {
        existingImages = existingImageBackup.data[0].images || [];
        existingImageWeekRelation = existingImageBackup.data[0].imageWeekRelation || {};
      }

      console.log('getBackupDiff - 云端图片数量:', existingImages.length);
      console.log('getBackupDiff - 云端关联表:', existingImageWeekRelation);

      // 构建本地图片映射
      const localImageMap = new Map();
      Object.keys(imageWeekRelation || {}).forEach(weekKey => {
        const weekImages = imageWeekRelation[weekKey] || [];
        weekImages.forEach(img => {
          const key = `${weekKey}_${img.name}`;
          localImageMap.set(key, img);
        });
      });

      // 构建云端图片映射
      const cloudImageMap = new Map();
      existingImages.forEach(img => {
        const key = `${img.weekKey}_${img.imageName}`;
        cloudImageMap.set(key, img);
      });

      console.log('getBackupDiff - 本地图片映射大小:', localImageMap.size);
      console.log('getBackupDiff - 云端图片映射大小:', cloudImageMap.size);

      // 找出需要新增的图片（本地有但云端没有的）
      const imagesToUpload = [];
      // 找出需要删除的图片（云端有但本地没有的）
      const imagesToDelete = [];

      // 检查本地图片
      Object.keys(imageWeekRelation || {}).forEach(weekKey => {
        const weekImages = imageWeekRelation[weekKey] || [];
        weekImages.forEach((img, index) => {
          const key = `${weekKey}_${img.name}`;
          if (!cloudImageMap.has(key)) {
            // 解析周信息，生成 remotePath
            const weekDateStr = weekKey.replace('week_images_', '');
            const weekDate = new Date(weekDateStr);
            const year = weekDate.getFullYear();
            const month = String(weekDate.getMonth() + 1).padStart(2, '0');
            const yearMonth = `${year}-${month}`;

            // 使用时间戳生成稳定的 remotePath
            const timestamp = Date.now();
            const remotePath = `images/${yearMonth}/${img.name}_${timestamp}.jpg`;

            // 需要新增的图片
            imagesToUpload.push({
              weekKey: weekKey,
              imageName: img.name,
              image: {
                path: img.path,
                name: img.name,
                addedTime: new Date().toISOString(),
                hash: img.hash
              },
              remotePath: remotePath,
              hash: img.hash
            });
          }
        });
      });

      // 检查云端图片
      existingImages.forEach(img => {
        const key = `${img.weekKey}_${img.imageName}`;
        if (!localImageMap.has(key)) {
          // 需要删除的图片
          imagesToDelete.push(img);
        }
      });

      console.log('getBackupDiff - 需要上传的图片数量:', imagesToUpload.length);
      console.log('getBackupDiff - 需要删除的图片数量:', imagesToDelete.length);

      return {
        success: true,
        imagesToUpload: imagesToUpload,
        imagesToDelete: imagesToDelete
      };
    }

    if (action === 'completeBackup') {
      // 第三步：完成备份，覆盖云端关联表
      const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex, version = 'v1.0.0' } = data;

      let totalChanges = false;
      let deletedImageCount = 0;
      let versionChanged = false;

      // 1. 检查版本号
      const existingDataBackup = await dataBackupCollection.where({
        userId: userId
      }).get();

      let existingVersion = 'v0.0.0';
      if (existingDataBackup.data.length > 0) {
        existingVersion = existingDataBackup.data[0].backupSystemVersion || 'v0.0.0';
      }

      // 比较版本号
      const versionComparison = compareVersions(version, existingVersion);

      // 2. 备份其他数据集合（全量替换）
      const dataBackupData = {
        userId: userId,
        shiftTemplates: shiftTemplates,
        shifts: shifts,
        backupIndex: backupIndex || {},
        backupSystemVersion: version,
        backupTime: new Date(),
        updateTime: new Date()
      };

      if (existingDataBackup.data.length > 0) {
        // 使用 set 方法全量替换，确保删除的排班也能同步到云端
        await dataBackupCollection.doc(existingDataBackup.data[0]._id).set({
          data: {
            ...dataBackupData,
            createTime: existingDataBackup.data[0].createTime || new Date()
          }
        });
      } else {
        dataBackupData.createTime = new Date();
        await dataBackupCollection.add({
          data: dataBackupData
        });
      }
      totalChanges = true;

      // 3. 备份图片数据集合
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      const imageBackupData = {
        userId: userId,
        images: images || [],
        imageWeekRelation: imageWeekRelation || {},
        backupSystemVersion: version,
        backupTime: new Date(),
        updateTime: new Date()
      };

      if (existingImageBackup.data.length > 0) {
        const currentImageBackup = existingImageBackup.data[0];
        let imageChanges = false;

        console.log('completeBackup - 云端现有图片数量:', (currentImageBackup.images || []).length);
        console.log('completeBackup - 本地上传图片数量:', (images || []).length);
        console.log('completeBackup - 本地关联表周数:', Object.keys(imageWeekRelation || {}).length);

        // 版本号变化或数据变化时更新
        if (versionComparison !== 0) {
          // 版本号变化，需要更新数据结构
          imageChanges = true;
          versionChanged = true;
        } else {
          // 对比图片关联表
          if (!isDataEqual(currentImageBackup.imageWeekRelation, imageWeekRelation || {})) {
            imageChanges = true;
          }
        }

        if (imageChanges) {
          // 构建本地图片映射（基于关联表）
          const localImageMap = new Map();

          // 首先从关联表构建本地图片映射
          Object.keys(imageWeekRelation || {}).forEach(weekKey => {
            const weekImages = imageWeekRelation[weekKey] || [];
            weekImages.forEach(img => {
              const key = `${weekKey}_${img.name}`;
              localImageMap.set(key, img);
            });
          });

          // 然后从上传的图片中补充信息
          (images || []).forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              localImageMap.set(key, img);
            }
          });

          // 构建云端图片映射
          const cloudImageMap = new Map();
          (currentImageBackup.images || []).forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              cloudImageMap.set(key, img);
            }
          });

          console.log('completeBackup - 本地图片映射大小:', localImageMap.size);
          console.log('completeBackup - 云端图片映射大小:', cloudImageMap.size);

          // 找出需要删除的图片（云端有但本地没有的）
          const imagesToDelete = [];
          (currentImageBackup.images || []).forEach(img => {
            if (img.weekKey && img.imageName) {
              const key = `${img.weekKey}_${img.imageName}`;
              if (!localImageMap.has(key)) {
                imagesToDelete.push(img);
              }
            }
          });

          console.log('completeBackup - 需要删除的图片数量:', imagesToDelete.length);

          // 删除云端多余的图片文件
          if (imagesToDelete.length > 0) {
            deletedImageCount = await deleteExtraCloudImages(
              userId,
              imagesToDelete,
              images || []
            );
          }

          await imageBackupCollection.doc(currentImageBackup._id).update({
            data: imageBackupData
          });
          totalChanges = true;
        }
      } else {
        imageBackupData.createTime = new Date();
        await imageBackupCollection.add({
          data: imageBackupData
        });
        totalChanges = true;
      }

      return {
        success: true,
        message: totalChanges
          ? versionChanged
            ? '备份成功（版本更新）'
            : '备份成功（有更新）'
          : '备份成功（无变化）',
        hasChanges: totalChanges,
        deletedImageCount: deletedImageCount,
        versionChanged: versionChanged
      };
    }

    if (action === 'getBackupRelation') {
      // 获取备份关联表
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      let imageWeekRelation = {};
      let backupSystemVersion = 'v1.0.0';

      if (existingImageBackup.data.length > 0) {
        imageWeekRelation = existingImageBackup.data[0].imageWeekRelation || {};
        backupSystemVersion = existingImageBackup.data[0].backupSystemVersion || 'v1.0.0';
      }

      return {
        success: true,
        imageWeekRelation: imageWeekRelation,
        backupSystemVersion: backupSystemVersion
      };
    }

    if (action === 'getImagesForRestore') {
      // 获取需要恢复的图片数据
      const { imagesToAdd } = data;

      // 获取云端图片备份
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      let existingImages = [];
      if (existingImageBackup.data.length > 0) {
        existingImages = existingImageBackup.data[0].images || [];
      }

      // 构建云端图片映射
      const cloudImageMap = new Map();
      existingImages.forEach(img => {
        const key = `${img.weekKey}_${img.imageName}`;
        cloudImageMap.set(key, img);
      });

      // 找出需要下载的图片
      const imagesToDownload = [];
      imagesToAdd.forEach(img => {
        // 尝试使用两种键格式，确保匹配
        const key1 = `${img.weekKey}_${img.name}`;
        const key2 = `${img.weekKey}_${img.imageName}`;

        if (cloudImageMap.has(key1)) {
          imagesToDownload.push(cloudImageMap.get(key1));
        } else if (cloudImageMap.has(key2)) {
          imagesToDownload.push(cloudImageMap.get(key2));
        }
      });

      return {
        success: true,
        images: imagesToDownload
      };
    }

    if (action === 'restoreOtherData') {
      // 恢复其他数据
      const existingDataBackup = await dataBackupCollection.where({
        userId: userId
      }).get();

      let backupData = {};

      if (existingDataBackup.data.length > 0) {
        backupData = existingDataBackup.data[0];
      }

      return {
        success: true,
        data: backupData
      };
    }

    if (action === 'getAllCloudImages') {
      // 获取所有云端图片数据
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      let existingImages = [];
      if (existingImageBackup.data.length > 0) {
        existingImages = existingImageBackup.data[0].images || [];
      }

      return {
        success: true,
        images: existingImages
      };
    }

    if (action === 'getExistingImages') {
      // 获取云端现有图片
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      let existingImages = [];
      if (existingImageBackup.data.length > 0) {
        existingImages = existingImageBackup.data[0].images || [];
      }

      return {
        success: true,
        images: existingImages
      };
    }

    if (action === 'backup') {
      // 备份数据 - 分别备份到三个集合
      const { shiftTemplates, shifts, images, imageWeekRelation, backupIndex, version = 'v1.0.0' } = data;

      let totalChanges = false;
      let deletedImageCount = 0;
      let versionChanged = false;

      // 1. 检查版本号
      const existingDataBackup = await dataBackupCollection.where({
        userId: userId
      }).get();

      let existingVersion = 'v0.0.0';
      if (existingDataBackup.data.length > 0) {
        existingVersion = existingDataBackup.data[0].backupSystemVersion || 'v0.0.0';
      }

      // 比较版本号
      const versionComparison = compareVersions(version, existingVersion);

      // 2. 备份其他数据集合（全量替换）
      const dataBackupData = {
        userId: userId,
        shiftTemplates: shiftTemplates,
        shifts: shifts,
        backupIndex: backupIndex || {},
        backupSystemVersion: version,
        backupTime: new Date(),
        updateTime: new Date()
      };

      if (existingDataBackup.data.length > 0) {
        // 使用 set 方法全量替换，确保删除的排班也能同步到云端
        await dataBackupCollection.doc(existingDataBackup.data[0]._id).set({
          data: {
            ...dataBackupData,
            createTime: existingDataBackup.data[0].createTime || new Date()
          }
        });
      } else {
        dataBackupData.createTime = new Date();
        await dataBackupCollection.add({
          data: dataBackupData
        });
      }
      totalChanges = true;

      // 3. 备份图片数据集合
      const existingImageBackup = await imageBackupCollection.where({
        userId: userId
      }).get();

      const imageBackupData = {
        userId: userId,
        images: images || [],
        imageWeekRelation: imageWeekRelation || {},
        backupSystemVersion: version,
        backupTime: new Date(),
        updateTime: new Date()
      };

      if (existingImageBackup.data.length > 0) {
        const currentImageBackup = existingImageBackup.data[0];
        let imageChanges = false;

        // 版本号变化或数据变化时更新
        if (versionComparison !== 0) {
          // 版本号变化，需要更新数据结构，但仍然保持图片的增量备份
          imageChanges = true;
          versionChanged = true;

          // 仍然对比图片数据，只删除真正需要删除的图片
          deletedImageCount = await deleteExtraCloudImages(
            userId,
            currentImageBackup.images || [],
            images || []
          );
        } else {
          // 对比图片数据 - 基于哈希值比较
          const currentImagesMap = new Map();
          (currentImageBackup.images || []).forEach(img => {
            if (img.remotePath) {
              currentImagesMap.set(img.remotePath, img);
            }
          });

          const newImagesMap = new Map();
          (images || []).forEach(img => {
            if (img.remotePath) {
              newImagesMap.set(img.remotePath, img);
            }
          });

          // 检查是否有图片变化（新增、删除或哈希值变更）
          if (currentImagesMap.size !== newImagesMap.size) {
            imageChanges = true;
          } else {
            // 大小相同，检查每个图片的哈希值
            for (const [remotePath, newImg] of newImagesMap.entries()) {
              const currentImg = currentImagesMap.get(remotePath);
              if (!currentImg || currentImg.hash !== newImg.hash) {
                imageChanges = true;
                break;
              }
            }
          }

          // 对比图片关联表
          if (!isDataEqual(currentImageBackup.imageWeekRelation, imageWeekRelation || {})) {
            imageChanges = true;
          }

          // 删除云端多余的图片文件
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
        await imageBackupCollection.add({
          data: imageBackupData
        });
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
        deletedImageCount: deletedImageCount,
        versionChanged: versionChanged
      };

    } else if (action === 'restore') {
      // 恢复数据 - 从三个集合中分别获取数据
      const dataBackupResult = await dataBackupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      const imageBackupResult = await imageBackupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      if (dataBackupResult.data.length === 0 && imageBackupResult.data.length === 0) {
        return {
          success: false,
          errMsg: '没有找到备份数据'
        };
      }

      const dataBackup = dataBackupResult.data[0] || {};
      const imageBackup = imageBackupResult.data[0] || {};

      // 获取备份系统版本号
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
          backupSystemVersion: backupSystemVersion
        }
      };

    } else if (action === 'getBackupInfo') {
      // 获取备份信息
      const dataBackupResult = await dataBackupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      const imageBackupResult = await imageBackupCollection.where({
        userId: userId
      }).orderBy('backupTime', 'desc').limit(1).get();

      if (dataBackupResult.data.length === 0 && imageBackupResult.data.length === 0) {
        return {
          success: true,
          hasBackup: false
        };
      }

      const dataBackup = dataBackupResult.data[0] || {};
      const imageBackup = imageBackupResult.data[0] || {};

      // 获取备份系统版本号
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
          backupSystemVersion: backupSystemVersion,
          backupHash: backupHash
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
