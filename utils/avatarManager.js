'use strict';
const emojiManager = require('./emojiManager.js');
const { store } = require('./store.js');

class AvatarManager {
  constructor() {
    this.avatarType = 'emoji';
    this.avatarEmoji = '😊';
    this.avatarText = '用';
    this.username = '';
  }

  // 生成头像文字
  generateAvatarText(username) {
    if (!username) {
      return '用';
    }
    // 取用户名的第一个字符作为头像文字
    return username.charAt(0).toUpperCase();
  }

  // 从云端获取最新的头像信息
  async getLatestAvatarFromCloud(cloudUserInfo) {
    try {
      if (cloudUserInfo && cloudUserInfo.userId) {
        // 调用云函数获取用户信息
        const result = await wx.cloud.callFunction({
          name: 'userLogin',
          data: {
            action: 'getUserInfo',
            userId: cloudUserInfo.userId
          }
        });

        if (result.result.success && result.result.data) {
          const userData = result.result.data;
          // 检查是否有头像信息
          if (userData.avatarType || userData.avatarEmoji) {
            const avatarType = userData.avatarType || 'emoji';
            const avatarEmoji = userData.avatarEmoji || '😊';
            const username = userData.nickname || this.username;

            // 生成头像文字
            const avatarText = avatarType === 'text' ? this.generateAvatarText(username) : '';
            const emojiText = avatarType === 'emoji' ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
            const emojiEmotion = avatarType === 'emoji' ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

            // 更新本地存储
            wx.setStorageSync('avatarType', avatarType);
            wx.setStorageSync('avatarEmoji', avatarEmoji);
            if (username) {
              wx.setStorageSync('username', username);
            }

            // 更新本地用户信息
            const updatedUserInfo = {
              ...cloudUserInfo,
              avatarType: avatarType,
              avatarEmoji: avatarEmoji,
              nickname: username
            };
            wx.setStorageSync('cloudUserInfo', updatedUserInfo);

            return {
              username: username,
              avatarType: avatarType,
              avatarEmoji: avatarEmoji,
              avatarText: avatarText,
              emojiText: emojiText,
              emojiEmotion: emojiEmotion,
              cloudUserInfo: updatedUserInfo
            };
          }
        }
      }
    } catch (e) {
      console.error('从云端获取头像信息失败', e);
      // 获取失败不影响本地操作
    }
    return null;
  }

  // 同步头像信息到云端
  async syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo) {
    try {
      if (cloudLoggedIn && cloudUserInfo && cloudUserInfo.userId) {
        // 调用云函数更新头像信息
        const result = await wx.cloud.callFunction({
          name: 'userLogin',
          data: {
            action: 'updateAvatar',
            userId: cloudUserInfo.userId,
            avatarType: avatarType,
            avatarEmoji: avatarEmoji,
            avatarText: avatarText
          }
        });

        if (result.result.success) {
          // 更新本地存储的用户信息
          const updatedUserInfo = {
            ...cloudUserInfo,
            avatarType: avatarType,
            avatarEmoji: avatarEmoji,
            avatarText: avatarText
          };
          wx.setStorageSync('cloudUserInfo', updatedUserInfo);
          return updatedUserInfo;
        }
      }
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
      // 同步失败不影响本地操作
    }
    return null;
  }

  // 通知其他页面更新头像信息
  updateAvatarInOtherPages(avatarType, avatarText, avatarEmoji) {
    store.setState({ avatarType, avatarText, avatarEmoji }, ['avatarType', 'avatarEmoji']);
  }

  // 获取表情对应的文字和情绪类型
  getEmojiInfo(emoji) {
    const emojiText = emojiManager.getEmojiText(emoji) || '';
    const emojiEmotion = emojiManager.getEmojiEmotion(emoji) || 'neutral';
    return { emojiText, emojiEmotion };
  }

  // 初始化头像信息
  initAvatarInfo() {
    // 从本地存储获取头像信息
    const avatarType = wx.getStorageSync('avatarType') || 'emoji';
    const avatarEmoji = wx.getStorageSync('avatarEmoji') || '😊';
    const username = wx.getStorageSync('username') || '';

    // 生成头像文字（仅当使用文字头像时）
    const avatarText = avatarType === 'text' ? this.generateAvatarText(username) : '';

    // 确保表情头像有默认值
    const finalAvatarEmoji = avatarType === 'emoji' && avatarEmoji ? avatarEmoji : '😊';

    // 获取表情对应的文字和情绪类型
    const { emojiText, emojiEmotion } = this.getEmojiInfo(finalAvatarEmoji);

    // 更新实例属性
    this.avatarType = avatarType;
    this.avatarEmoji = finalAvatarEmoji;
    this.avatarText = avatarText;
    this.username = username;

    return {
      username: username,
      avatarText: avatarText,
      avatarEmoji: finalAvatarEmoji,
      avatarType: avatarType,
      emojiText: emojiText,
      emojiEmotion: emojiEmotion
    };
  }

  // 从云端用户信息初始化头像
  initAvatarFromCloud(cloudUserInfo) {
    if (cloudUserInfo) {
      const avatarType = cloudUserInfo.avatarType || 'emoji';
      const avatarEmoji = cloudUserInfo.avatarEmoji || '😊';
      const username = cloudUserInfo.nickname || this.username;

      // 生成头像文字
      const avatarText = avatarType === 'text' ? this.generateAvatarText(username) : '';
      const { emojiText, emojiEmotion } = this.getEmojiInfo(avatarEmoji);

      // 同步到本地存储
      wx.setStorageSync('avatarType', avatarType);
      wx.setStorageSync('avatarEmoji', avatarEmoji);
      if (username) {
        wx.setStorageSync('username', username);
      }

      // 更新实例属性
      this.avatarType = avatarType;
      this.avatarEmoji = avatarEmoji;
      this.avatarText = avatarText;
      this.username = username;

      return {
        username: username,
        avatarText: avatarText,
        avatarEmoji: avatarEmoji,
        avatarType: avatarType,
        emojiText: emojiText,
        emojiEmotion: emojiEmotion
      };
    }
    return this.initAvatarInfo();
  }
}

module.exports = AvatarManager;
