// @ts-nocheck
'use strict';
import CryptoJS from 'crypto-js';

function deriveKey(): string {
  const deviceInfo = wx.getDeviceInfo();
  const appBaseInfo = wx.getAppBaseInfo();
  const seed = [
    deviceInfo.model,
    deviceInfo.platform,
    deviceInfo.system,
    (appBaseInfo as Record<string, string>).SDKVersion,
    appBaseInfo.version,
    appBaseInfo.language
  ].join('|');
  return CryptoJS.SHA256(seed).toString();
}

function encryptPassword(password: string): string {
  if (!password) return '';
  try {
    const keyHex = deriveKey();
    const key = CryptoJS.enc.Hex.parse(keyHex);
    const iv = CryptoJS.enc.Hex.parse(keyHex.slice(0, 32));
    const encrypted = CryptoJS.AES.encrypt(password, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    return '01' + encrypted.toString();
  } catch (e) {
    console.error('密码加密失败:', e);
    return '';
  }
}

function decryptPassword(encryptedStr: string): string {
  if (!encryptedStr) return '';
  const aesResult = decryptAES(encryptedStr);
  if (aesResult) return aesResult;
  return xorDecrypt(encryptedStr);
}

function decryptAES(encryptedStr: string): string {
  try {
    if (encryptedStr.startsWith('01')) {
      const keyHex = deriveKey();
      const key = CryptoJS.enc.Hex.parse(keyHex);
      const iv = CryptoJS.enc.Hex.parse(keyHex.slice(0, 32));
      const ct = encryptedStr.slice(2);
      const decrypted = CryptoJS.AES.decrypt(ct, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    }
    const key = deriveKey();
    const decrypted = CryptoJS.AES.decrypt(encryptedStr, key);
    return decrypted.toString(CryptoJS.enc.Utf8) || '';
  } catch (e) {
    return '';
  }
}

function getDeviceKey(): string {
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

function base64Decode(str: string): string {
  try {
    const base64Str = str.replace(/-/g, '+').replace(/_/g, '/');
    const uint8Array = wx.base64ToArrayBuffer(base64Str);
    return String.fromCharCode(...Array.from(new Uint8Array(uint8Array)));
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

function xorWithKey(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const keyChar = key.charCodeAt(i % key.length);
    result += String.fromCharCode(text.charCodeAt(i) ^ keyChar);
  }
  return result;
}

function xorDecrypt(encrypted: string): string {
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

function hashPassword(password: string): string {
  if (!password) return '';
  return CryptoJS.SHA256(password).toString();
}

function verifyPassword(password: string, hash: string): boolean {
  if (!password || !hash) return false;
  return hashPassword(password) === hash;
}

function isOldFormat(encryptedStr: string): boolean {
  if (!encryptedStr) return false;
  if (encryptedStr.startsWith('01')) return false;
  return !encryptedStr.startsWith('U2FsdGVkX1');
}

function calculateHash(data: string): string {
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

export {
  encryptPassword,
  decryptPassword,
  hashPassword,
  verifyPassword,
  isOldFormat,
  calculateHash
};

export type EncryptPasswordFn = typeof encryptPassword;
export type DecryptPasswordFn = typeof decryptPassword;
export type HashPasswordFn = typeof hashPassword;
export type VerifyPasswordFn = typeof verifyPassword;
export type IsOldFormatFn = typeof isOldFormat;
export type CalculateHashFn = typeof calculateHash;
