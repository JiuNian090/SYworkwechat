// 图片关联表管理工具
// 完全集成周关联表功能，自动同步图片在周之间的变化

const IMAGE_RELATION_KEY = 'image_relation_table';

/**
 * 获取完整的图片关联表
 */
function getImageRelationTable() {
  try {
    return wx.getStorageSync(IMAGE_RELATION_KEY) || {};
  } catch (e) {
    console.error('获取图片关联表失败', e);
    return {};
  }
}

/**
 * 保存图片关联表
 */
function saveImageRelationTable(table) {
  try {
    wx.setStorageSync(IMAGE_RELATION_KEY, table);
    return true;
  } catch (e) {
    console.error('保存图片关联表失败', e);
    return false;
  }
}

/**
 * 从本地存储重建关联表（用于初始化或修复）
 */
function rebuildRelationFromLocal() {
  const table = {};
  const storageInfo = wx.getStorageInfoSync();
  const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

  weekImageKeys.forEach(weekKey => {
    const weekImages = wx.getStorageSync(weekKey) || [];
    if (weekImages.length > 0) {
      table[weekKey] = weekImages.map(img => ({
        id: img.id,
        name: img.name,
        path: img.path,
        addedTime: img.addedTime || new Date().toISOString()
      }));
    }
  });

  saveImageRelationTable(table);
  return table;
}

/**
 * 添加图片到关联表
 * @param {string} weekKey - 周标识
 * @param {object} image - 图片对象
 */
function addImageToRelation(weekKey, image) {
  const table = getImageRelationTable();

  if (!table[weekKey]) {
    table[weekKey] = [];
  }

  // 检查图片是否已存在
  const exists = table[weekKey].some(img => img.id === image.id);
  if (!exists) {
    table[weekKey].push({
      id: image.id,
      name: image.name,
      path: image.path,
      addedTime: image.addedTime || new Date().toISOString()
    });
    saveImageRelationTable(table);
  }

  return table;
}

/**
 * 从关联表删除图片
 * @param {string} weekKey - 周标识
 * @param {string} imageId - 图片ID
 */
function removeImageFromRelation(weekKey, imageId) {
  const table = getImageRelationTable();

  if (table[weekKey]) {
    table[weekKey] = table[weekKey].filter(img => img.id !== imageId);

    // 如果该周没有图片了，删除该周的记录
    if (table[weekKey].length === 0) {
      delete table[weekKey];
    }

    saveImageRelationTable(table);
  }

  return table;
}

/**
 * 更新关联表中的图片信息
 * @param {string} weekKey - 周标识
 * @param {string} imageId - 图片ID
 * @param {object} updates - 要更新的字段
 */
function updateImageInRelation(weekKey, imageId, updates) {
  const table = getImageRelationTable();

  if (table[weekKey]) {
    const index = table[weekKey].findIndex(img => img.id === imageId);
    if (index !== -1) {
      table[weekKey][index] = {
        ...table[weekKey][index],
        ...updates,
        updatedTime: new Date().toISOString()
      };
      saveImageRelationTable(table);
    }
  }

  return table;
}

/**
 * 移动图片从一个周到另一个周
 * @param {string} fromWeekKey - 源周标识
 * @param {string} toWeekKey - 目标周标识
 * @param {string} imageId - 图片ID
 */
function moveImageBetweenWeeks(fromWeekKey, toWeekKey, imageId) {
  const table = getImageRelationTable();

  if (table[fromWeekKey]) {
    const imageIndex = table[fromWeekKey].findIndex(img => img.id === imageId);
    if (imageIndex !== -1) {
      const image = table[fromWeekKey][imageIndex];

      // 从源周移除
      table[fromWeekKey].splice(imageIndex, 1);
      if (table[fromWeekKey].length === 0) {
        delete table[fromWeekKey];
      }

      // 添加到目标周
      if (!table[toWeekKey]) {
        table[toWeekKey] = [];
      }
      table[toWeekKey].push({
        ...image,
        movedTime: new Date().toISOString()
      });

      saveImageRelationTable(table);
    }
  }

  return table;
}

/**
 * 验证图片文件是否存在
 * @param {string} imagePath - 图片路径
 */
function validateImageExists(imagePath) {
  return new Promise((resolve) => {
    // 添加超时处理，避免长时间等待
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, 500); // 500ms 超时

    wx.getFileInfo({
      filePath: imagePath,
      success: () => {
        clearTimeout(timeoutId);
        resolve(true);
      },
      fail: () => {
        clearTimeout(timeoutId);
        resolve(false);
      }
    });
  });
}

/**
 * 清理关联表中无效的图片记录
 * @param {string} weekKey - 周标识（可选，不传则清理所有）
 */
async function cleanupInvalidImages(weekKey) {
  const table = getImageRelationTable();
  const keysToCheck = weekKey ? [weekKey] : Object.keys(table);
  let cleanedCount = 0;

  for (const key of keysToCheck) {
    if (!table[key]) continue;

    const validImages = [];
    for (const img of table[key]) {
      const exists = await validateImageExists(img.path);
      if (exists) {
        validImages.push(img);
      } else {
        cleanedCount++;
        console.log('清理无效图片:', img.name, img.path);
      }
    }

    if (validImages.length === 0) {
      delete table[key];
    } else {
      table[key] = validImages;
    }
  }

  saveImageRelationTable(table);
  return { cleanedCount, table };
}

/**
 * 同步关联表与本地存储的图片数据
 * @param {string} weekKey - 周标识（可选，不传则同步所有）
 */
function syncRelationWithLocal(weekKey) {
  const table = getImageRelationTable();

  if (weekKey) {
    // 只同步指定周
    const localImages = wx.getStorageSync(weekKey) || [];
    table[weekKey] = localImages.map(img => ({
      id: img.id,
      name: img.name,
      path: img.path,
      addedTime: img.addedTime || new Date().toISOString()
    }));

    if (table[weekKey].length === 0) {
      delete table[weekKey];
    }
  } else {
    // 同步所有周
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

    // 清空表，重新构建
    Object.keys(table).forEach(key => {
      if (!weekImageKeys.includes(key)) {
        delete table[key];
      }
    });

    weekImageKeys.forEach(key => {
      const localImages = wx.getStorageSync(key) || [];
      if (localImages.length > 0) {
        table[key] = localImages.map(img => ({
          id: img.id,
          name: img.name,
          path: img.path,
          addedTime: img.addedTime || new Date().toISOString()
        }));
      } else {
        delete table[key];
      }
    });
  }

  saveImageRelationTable(table);
  return table;
}

/**
 * 获取某周的有效图片列表（已验证存在）
 * @param {string} weekKey - 周标识
 */
async function getValidImagesForWeek(weekKey) {
  const table = getImageRelationTable();
  const images = table[weekKey] || [];
  const validImages = [];

  for (const img of images) {
    const exists = await validateImageExists(img.path);
    if (exists) {
      validImages.push(img);
    }
  }

  return validImages;
}

/**
 * 获取所有有效的图片（用于备份）
 * 返回格式与旧的 getAllLocalImages() 兼容
 */
async function getAllValidImages() {
  const table = getImageRelationTable();
  const allValidImages = [];
  const imageWeekRelation = {};

  for (const weekKey of Object.keys(table)) {
    const validImages = await getValidImagesForWeek(weekKey);
    if (validImages.length > 0) {
      imageWeekRelation[weekKey] = validImages.map(img => ({
        name: img.name,
        path: img.path
      }));

      validImages.forEach((img, index) => {
        // 解析周信息，生成新格式图片名：年 - 月 - 周数字
        const weekDateStr = weekKey.replace('week_images_', '');
        const weekDate = new Date(weekDateStr);
        const year = weekDate.getFullYear();
        const month = String(weekDate.getMonth() + 1).padStart(2, '0');
        const week = getWeekOfMonth(weekDate);

        const yearMonth = `${year}-${month}`;
        const imageName = `${year}-${month}-${week}`;
        const remotePath = `images/${yearMonth}/${imageName}_${index}.jpg`;

        allValidImages.push({
          weekKey: weekKey,
          image: img,
          yearMonth: yearMonth,
          imageName: imageName,
          remotePath: remotePath,
          index: index
        });
      });
    }
  }

  return { images: allValidImages, imageWeekRelation };
}

/**
 * 获取某个日期是当月的第几周
 * 从 profile.js 复制过来，保持一致性
 */
function getWeekOfMonth(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = firstDay.getDay();
  const adjustedDate = date.getDate() + dayOfWeek;
  return Math.ceil(adjustedDate / 7);
}

/**
 * 导出图片周关联表（用于备份）
 */
function exportImageWeekRelation() {
  const table = getImageRelationTable();
  const relation = {};

  for (const weekKey of Object.keys(table)) {
    relation[weekKey] = table[weekKey].map(img => ({
      name: img.name,
      path: img.path
    }));
  }

  return relation;
}

/**
 * 导入图片周关联表（用于恢复）
 */
function importImageWeekRelation(relation) {
  const table = {};

  for (const weekKey of Object.keys(relation)) {
    table[weekKey] = relation[weekKey].map((img, index) => ({
      id: `${weekKey}_${Date.now()}_${index}`,
      name: img.name,
      path: img.path,
      addedTime: new Date().toISOString()
    }));
  }

  saveImageRelationTable(table);
  return table;
}

module.exports = {
  getImageRelationTable,
  saveImageRelationTable,
  rebuildRelationFromLocal,
  addImageToRelation,
  removeImageFromRelation,
  updateImageInRelation,
  moveImageBetweenWeeks,
  validateImageExists,
  cleanupInvalidImages,
  syncRelationWithLocal,
  getValidImagesForWeek,
  getAllValidImages,
  getWeekOfMonth,
  exportImageWeekRelation,
  importImageWeekRelation
};
