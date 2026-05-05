'use strict';

const fs = wx.getFileSystemManager();

interface CacheEntry {
  fileID: string;
  localPath: string;
  size: number;
  lastAccess: number;
  hash: string;
  weekKey: string;
  imageName: string;
}

const CACHE_DIR = `${wx.env.USER_DATA_PATH}/photo_cache/`;
const CACHE_INDEX_KEY = 'photo_cache_index';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB

function getIndex(): CacheEntry[] {
  try {
    return wx.getStorageSync(CACHE_INDEX_KEY) || [];
  } catch (e) {
    return [];
  }
}

function saveIndex(index: CacheEntry[]): void {
  try {
    wx.setStorageSync(CACHE_INDEX_KEY, index);
  } catch (e) {
    console.error('保存图片缓存索引失败', e);
  }
}

function ensureCacheDir(): void {
  try {
    fs.mkdirSync(CACHE_DIR, true);
  } catch (e) {
    // 目录已存在时忽略
  }
}

/** 从缓存中获取本地路径，未命中返回 null */
function getFromCache(fileID: string): string | null {
  const index = getIndex();
  const entry = index.find(e => e.fileID === fileID);
  if (!entry) return null;

  // 验证文件是否存在
  try {
    fs.getFileInfo({ filePath: entry.localPath });
    // 更新访问时间
    entry.lastAccess = Date.now();
    saveIndex(index);
    return entry.localPath;
  } catch (e) {
    // 文件已被清理，移除索引条目
    removeFromCache(fileID);
    return null;
  }
}

/** 保存临时文件到缓存 */
function saveToCache(
  fileID: string,
  tempPath: string,
  hash: string,
  weekKey: string,
  imageName: string
): string {
  ensureCacheDir();

  const ext = tempPath.lastIndexOf('.') > tempPath.lastIndexOf('/')
    ? tempPath.substring(tempPath.lastIndexOf('.'))
    : '.jpg';
  const fileName = `${fileID.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
  const destPath = `${CACHE_DIR}${fileName}`;

  try {
    // 如果已存在，先删除
    try { fs.unlinkSync(destPath); } catch (e) { /* 文件不存在 */ }

    const savedPath = fs.saveFileSync(tempPath, destPath);

    const stat = fs.statSync(savedPath) as WechatMiniprogram.Stats;
    const index = getIndex();

    // 移除旧条目（如果有）
    const existingIdx = index.findIndex(e => e.fileID === fileID);
    if (existingIdx !== -1) {
      index.splice(existingIdx, 1);
    }

    index.push({
      fileID,
      localPath: savedPath,
      size: stat.size,
      lastAccess: Date.now(),
      hash,
      weekKey,
      imageName
    });

    saveIndex(index);

    // 检查并执行 LRU 淘汰
    evictIfNeeded();

    return savedPath;
  } catch (e) {
    console.error('保存图片到缓存失败', e);
    return tempPath; // 降级返回原始路径
  }
}

/** 确保图片可用：缓存命中直接返回，未命中则从云端下载后缓存 */
async function ensureImage(
  fileID: string,
  cloudDownloadFn: () => Promise<string>,
  hash: string,
  weekKey: string,
  imageName: string
): Promise<string> {
  // 1. 查缓存
  const cached = getFromCache(fileID);
  if (cached) return cached;

  // 2. 从云端下载
  try {
    const tempPath = await cloudDownloadFn();
    // 3. 保存到缓存
    return saveToCache(fileID, tempPath, hash, weekKey, imageName);
  } catch (e) {
    console.error('下载图片失败', fileID, e);
    throw e;
  }
}

/** LRU 淘汰：超出上限时删除最久未访问的条目 */
function evictIfNeeded(): void {
  const index = getIndex();
  let totalSize = index.reduce((sum, e) => sum + e.size, 0);

  if (totalSize <= MAX_CACHE_SIZE) return;

  // 按 lastAccess 升序排序（最旧的在前）
  const sorted = [...index].sort((a, b) => a.lastAccess - b.lastAccess);

  const removed: string[] = [];
  for (const entry of sorted) {
    if (totalSize <= MAX_CACHE_SIZE) break;
    try {
      fs.unlinkSync(entry.localPath);
      totalSize -= entry.size;
      removed.push(entry.fileID);
    } catch (e) {
      // 文件可能已不存在
    }
  }

  if (removed.length > 0) {
    const newIndex = index.filter(e => !removed.includes(e.fileID));
    saveIndex(newIndex);
    console.log(`图片缓存淘汰：删除 ${removed.length} 个文件，释放 ${((totalSize > 0 ? index.reduce((s, e) => s + e.size, 0) - totalSize : 0) / 1024 / 1024).toFixed(1)}MB`);
  }
}

/** 从缓存中移除指定文件 */
function removeFromCache(fileID: string): void {
  const index = getIndex();
  const entry = index.find(e => e.fileID === fileID);
  if (entry) {
    try { fs.unlinkSync(entry.localPath); } catch (e) { /* 忽略 */ }
    saveIndex(index.filter(e => e.fileID !== fileID));
  }
}

/** 清空缓存 */
function clearCache(): void {
  const index = getIndex();
  for (const entry of index) {
    try { fs.unlinkSync(entry.localPath); } catch (e) { /* 忽略 */ }
  }
  saveIndex([]);
  console.log('图片缓存已清空');
}

/** 获取缓存统计 */
function getCacheStats(): { count: number; totalSize: number; maxSize: number } {
  const index = getIndex();
  return {
    count: index.length,
    totalSize: index.reduce((sum, e) => sum + e.size, 0),
    maxSize: MAX_CACHE_SIZE
  };
}

module.exports = {
  getFromCache,
  saveToCache,
  ensureImage,
  removeFromCache,
  clearCache,
  getCacheStats
};

export {};
