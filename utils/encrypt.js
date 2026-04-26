'use strict';
const CryptoJS = require('crypto-js');

function deriveKey() {
  const deviceInfo = wx.getDeviceInfo();
  const appBaseInfo = wx.getAppBaseInfo();
  const seed = [
    deviceInfo.model,
    deviceInfo.platform,
    deviceInfo.system,
    appBaseInfo.sdkVersion,
    appBaseInfo.version,
    appBaseInfo.language
  ].join('|');
  return CryptoJS.SHA256(seed).toString();
}

function encryptPassword(password) {
  if (!password) return '';
  try {
    const key = deriveKey();
    const encrypted = CryptoJS.AES.encrypt(password, key);
    return encrypted.toString();
  } catch (e) {
    console.error('密码加密失败:', e);
    return '';
  }
}

function decryptPassword(encryptedStr) {
  if (!encryptedStr) return '';
  const aesResult = decryptAES(encryptedStr);
  if (aesResult) return aesResult;
  return xorDecrypt(encryptedStr);
}

function decryptAES(encryptedStr) {
  try {
    const key = deriveKey();
    const decrypted = CryptoJS.AES.decrypt(encryptedStr, key);
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    return result || '';
  } catch (e) {
    return '';
  }
}

function getDeviceKey() {
  let deviceKey = wx.getStorageSync('_device_key');
  if (!deviceKey) {
    const deviceInfo = wx.getDeviceInfo();
    const appBaseInfo = wx.getAppBaseInfo();
    const seed = deviceInfo.model + appBaseInfo.system + appBaseInfo.platform + Math.random().toString(36);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    deviceKey = Math.abs(hash).toString(16).padStart(8, '0');
    wx.setStorageSync('_device_key', deviceKey);
  }
  return deviceKey;
}

function base64Encode(str) {
  try {
    return wx.arrayBufferToBase64(new Uint8Array(str.split('').map(c => c.charCodeAt(0))));
  } catch (e) {
    let result = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < str.length; i += 3) {
      const a = str.charCodeAt(i);
      const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
      result += chars[a >> 2];
      result += chars[((a & 3) << 4) | (b >> 4)];
      result += i + 1 < str.length ? chars[((b & 15) << 2) | (c >> 6)] : '=';
      result += i + 2 < str.length ? chars[c & 63] : '=';
    }
    return result;
  }
}

function base64Decode(str) {
  try {
    const base64Str = str.replace(/-/g, '+').replace(/_/g, '/');
    const uint8Array = wx.base64ToArrayBuffer(base64Str);
    return String.fromCharCode.apply(null, new Uint8Array(uint8Array));
  } catch (e) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    for (let i = 0; i < str.length; i += 4) {
      const a = chars.indexOf(str[i]);
      const b = chars.indexOf(str[i + 1]);
      const c = str[i + 2] !== '=' ? chars.indexOf(str[i + 2]) : -1;
      const d = str[i + 3] !== '=' ? chars.indexOf(str[i + 3]) : -1;
      result += String.fromCharCode((a << 2) | (b >> 4));
      if (c !== -1) result += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d !== -1) result += String.fromCharCode(((c & 3) << 6) | d);
    }
    return result;
  }
}

function xorWithKey(text, key) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(text.charCodeAt(i) ^ keyChar);
  }
  return result;
}

function xorDecrypt(encrypted) {
  if (!encrypted) return '';
  try {
    const key = getDeviceKey();
    if (!key) return '';
    const xored = base64Decode(encrypted);
    if (!xored) return '';
    return xorWithKey(xored, key);
  } catch (e) {
    return '';
  }
}

function hashPassword(password) {
  if (!password) return '';
  return CryptoJS.SHA256(password).toString();
}

function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return hashPassword(password) === hash;
}

function isOldFormat(encryptedStr) {
  if (!encryptedStr) return false;
  return !encryptedStr.startsWith('U2FsdGVkX1');
}

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

module.exports = {
  encryptPassword,
  decryptPassword,
  hashPassword,
  verifyPassword,
  isOldFormat,
  calculateHash
};
