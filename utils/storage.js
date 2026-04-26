'use strict';
const STORAGE_KEYS = {
  cloudInitialized: 'cloudInitialized',
  cloudUserId: 'cloudUserId',
  cloudAccount: 'cloudAccount',
  cloudUserInfo: 'cloudUserInfo',
  cloudLoggedIn: 'cloudLoggedIn',
  username: 'username',
  avatarType: 'avatarType',
  avatarEmoji: 'avatarEmoji',
  shifts: 'shifts',
  shiftTemplates: 'shiftTemplates',
  customWeeklyHours: 'customWeeklyHours',
  customHours: 'customHours',
  chartType: 'statisticsChartType',
  savedAccounts: 'savedAccounts',
  autoRestoreMap: 'autoRestoreMap',
  lastBackupTime: 'lastBackupTime',
  lastRestoreTime: 'lastRestoreTime'
};

function get(key) {
  try {
    const storageKey = STORAGE_KEYS[key] || key;
    return wx.getStorageSync(storageKey);
  } catch (e) {
    return undefined;
  }
}

function set(key, value) {
  try {
    const storageKey = STORAGE_KEYS[key] || key;
    wx.setStorageSync(storageKey, value);
    return true;
  } catch (e) {
    console.error('存储失败:', key, e);
    return false;
  }
}

function remove(key) {
  try {
    const storageKey = STORAGE_KEYS[key] || key;
    wx.removeStorageSync(storageKey);
    return true;
  } catch (e) {
    console.error('删除存储失败:', key, e);
    return false;
  }
}

function getRaw(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    return undefined;
  }
}

function setRaw(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.error('存储失败:', key, e);
    return false;
  }
}

function removeRaw(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  STORAGE_KEYS,
  get,
  set,
  remove,
  getRaw,
  setRaw,
  removeRaw
};
