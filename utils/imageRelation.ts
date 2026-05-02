// @ts-nocheck
'use strict';

interface ImageInfo {
  id: string;
  name: string;
  path: string;
  addedTime: string;
  hash?: string;
  updatedTime?: string;
  movedTime?: string;
  size?: number;
}

interface RelationTable {
  [weekKey: string]: ImageInfo[];
}

interface CleanupResult {
  cleanedCount: number;
  table: RelationTable;
}

interface ImageWeekEntry {
  name: string;
  path: string;
  hash?: string;
}

interface ValidImageEntry {
  weekKey: string;
  image: ImageInfo;
  yearMonth: string;
  imageName: string;
  remotePath: string;
  hash?: string;
}

interface GetAllValidImagesResult {
  images: ValidImageEntry[];
  imageWeekRelation: {
    [weekKey: string]: ImageWeekEntry[];
  };
}

interface ExportRelation {
  [weekKey: string]: Array<{
    name: string;
    path: string;
  }>;
}

interface ImportRelation {
  [weekKey: string]: Array<{
    name: string;
    path: string;
  }>;
}

const IMAGE_RELATION_KEY = 'image_relation_table';

function getImageRelationTable(): RelationTable {
  try {
    return wx.getStorageSync(IMAGE_RELATION_KEY) || {};
  } catch (e) {
    console.error('获取图片关联表失败', e);
    return {};
  }
}

function saveImageRelationTable(table: RelationTable): boolean {
  try {
    wx.setStorageSync(IMAGE_RELATION_KEY, table);
    return true;
  } catch (e) {
    console.error('保存图片关联表失败', e);
    return false;
  }
}

function rebuildRelationFromLocal(): RelationTable {
  const table: RelationTable = {};
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

function addImageToRelation(weekKey: string, image: ImageInfo): RelationTable {
  const table = getImageRelationTable();

  if (!table[weekKey]) {
    table[weekKey] = [];
  }

  const exists = table[weekKey].some(img => img.id === image.id);
  if (!exists) {
    const hash = calculateImageHash(image);

    table[weekKey].push({
      id: image.id,
      name: image.name,
      path: image.path,
      addedTime: image.addedTime || new Date().toISOString(),
      hash: hash
    });
    saveImageRelationTable(table);
  } else {
    const index = table[weekKey].findIndex(img => img.id === image.id);
    if (index !== -1) {
      const existingImage = table[weekKey][index];
      const hasChanged = existingImage.name !== image.name ||
                        existingImage.path !== image.path;

      if (hasChanged) {
        const hash = calculateImageHash(image);

        table[weekKey][index] = {
          ...existingImage,
          name: image.name,
          path: image.path,
          hash: hash
        };
        saveImageRelationTable(table);
      }
    }
  }

  return table;
}

function calculateImageHash(image: { addedTime?: string; name?: string; path?: string; size?: number }): string {
  const hashInput = `${image.addedTime || new Date().toISOString()}_${image.name || ''}_${image.path || ''}_${image.size || 0}`;

  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function removeImageFromRelation(weekKey: string, imageId: string): RelationTable {
  const table = getImageRelationTable();

  if (table[weekKey]) {
    table[weekKey] = table[weekKey].filter(img => img.id !== imageId);

    if (table[weekKey].length === 0) {
      delete table[weekKey];
    }

    saveImageRelationTable(table);
  }

  return table;
}

function updateImageInRelation(weekKey: string, imageId: string, updates: Partial<ImageInfo>): RelationTable {
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

function moveImageBetweenWeeks(fromWeekKey: string, toWeekKey: string, imageId: string): RelationTable {
  const table = getImageRelationTable();

  if (table[fromWeekKey]) {
    const imageIndex = table[fromWeekKey].findIndex(img => img.id === imageId);
    if (imageIndex !== -1) {
      const image = table[fromWeekKey][imageIndex];

      table[fromWeekKey].splice(imageIndex, 1);
      if (table[fromWeekKey].length === 0) {
        delete table[fromWeekKey];
      }

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

function validateImageExists(imagePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, 500);

    const fileSystemManager = wx.getFileSystemManager();
    fileSystemManager.getFileInfo({
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

async function cleanupInvalidImages(weekKey?: string): Promise<CleanupResult> {
  const table = getImageRelationTable();
  const keysToCheck = weekKey ? [weekKey] : Object.keys(table);
  let cleanedCount = 0;

  for (const key of keysToCheck) {
    if (!table[key]) continue;

    const validImages: ImageInfo[] = [];
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

function syncRelationWithLocal(weekKey?: string): RelationTable {
  const table = getImageRelationTable();

  if (weekKey) {
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
    const storageInfo = wx.getStorageInfoSync();
    const weekImageKeys = storageInfo.keys.filter(key => key.startsWith('week_images_'));

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

async function getValidImagesForWeek(weekKey: string): Promise<ImageInfo[]> {
  const table = getImageRelationTable();
  const images = table[weekKey] || [];
  const validImages: ImageInfo[] = [];

  for (const img of images) {
    const exists = await validateImageExists(img.path);
    if (exists) {
      validImages.push(img);
    }
  }

  return validImages;
}

async function getAllValidImages(): Promise<GetAllValidImagesResult> {
  syncRelationWithLocal();

  await cleanupInvalidImages();

  const table = getImageRelationTable();
  const allValidImages: ValidImageEntry[] = [];
  const imageWeekRelation: { [weekKey: string]: ImageWeekEntry[] } = {};

  for (const weekKey of Object.keys(table)) {
    const validImages = await getValidImagesForWeek(weekKey);
    if (validImages.length > 0) {
      imageWeekRelation[weekKey] = validImages.map(img => ({
        name: img.name,
        path: img.path,
        hash: img.hash
      }));

      validImages.forEach((img, index) => {
        const weekDateStr = weekKey.replace('week_images_', '');
        const weekDate = new Date(weekDateStr);
        const year = weekDate.getFullYear();
        const month = String(weekDate.getMonth() + 1).padStart(2, '0');
        const week = getWeekOfMonth(weekDate);

        const yearMonth = `${year}-${month}`;
        const imageName = img.name || `${year}-${month}-${week}`;

        const timestamp = img.addedTime ? new Date(img.addedTime).getTime() : new Date().getTime();
        const remotePath = `images/${yearMonth}/${imageName}_${timestamp}.jpg`;

        allValidImages.push({
          weekKey: weekKey,
          image: img,
          yearMonth: yearMonth,
          imageName: imageName,
          remotePath: remotePath,
          hash: img.hash
        });
      });
    }
  }

  return { images: allValidImages, imageWeekRelation };
}

function getWeekOfMonth(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfWeek = firstDay.getDay();
  const adjustedDate = date.getDate() + dayOfWeek;
  return Math.ceil(adjustedDate / 7);
}

function exportImageWeekRelation(): ExportRelation {
  const table = getImageRelationTable();
  const relation: ExportRelation = {};

  for (const weekKey of Object.keys(table)) {
    relation[weekKey] = table[weekKey].map(img => ({
      name: img.name,
      path: img.path
    }));
  }

  return relation;
}

function importImageWeekRelation(relation: ImportRelation): RelationTable {
  const table: RelationTable = {};

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

export {};
