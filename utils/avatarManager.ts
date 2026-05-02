'use strict';
const emojiManager = require('./emojiManager.js');
const { store } = require('./store.js');
const config = require('../config.js');

interface CloudUserInfo {
  userId: string;
  avatarType?: string;
  avatarEmoji?: string;
  avatarText?: string;
  nickname?: string;
  [key: string]: unknown;
}

interface StoreState {
  avatarType?: string;
  avatarEmoji?: string;
  avatarText?: string;
  [key: string]: unknown;
}

interface EmojiManager {
  getEmojiText(emoji: string): string;
  getEmojiEmotion(emoji: string): string;
}

interface CloudFunctionResult {
  success: boolean;
  errMsg?: string;
  data?: Record<string, unknown>;
}

interface CloudAvatarResult {
  username: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
  emojiText: string;
  emojiEmotion: string;
  cloudUserInfo: CloudUserInfo;
}

interface AvatarLocalInfo {
  username: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
  emojiText: string;
  emojiEmotion: string;
}

interface EmojiInfo {
  emojiText: string;
  emojiEmotion: string;
}

class AvatarManager {
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
  username: string;

  constructor() {
    this.avatarType = 'emoji';
    this.avatarEmoji = '😊';
    this.avatarText = '用';
    this.username = '';
  }

  generateAvatarText(username: string): string {
    if (!username) {
      return '用';
    }
    return username.charAt(0).toUpperCase();
  }

  async getLatestAvatarFromCloud(cloudUserInfo: CloudUserInfo | null): Promise<CloudAvatarResult | null> {
    try {
      if (cloudUserInfo && cloudUserInfo.userId) {
        const result = await wx.cloud.callFunction({
          name: config.cloudFunctions.userLogin,
          data: {
            action: 'getUserInfo',
            userId: cloudUserInfo.userId
          }
        });

        const res = result.result as unknown as CloudFunctionResult;
        if (res.success && res.data) {
          const userData = res.data;
          if (userData.avatarType || userData.avatarEmoji) {
            const avatarType: string = (userData.avatarType as string) || 'emoji';
            const avatarEmoji: string = (userData.avatarEmoji as string) || '😊';
            const username: string = (userData.nickname as string) || this.username;

            const avatarText: string = avatarType === 'text' ? this.generateAvatarText(username) : '';
            const emojiText: string = avatarType === 'emoji' ? (emojiManager as EmojiManager).getEmojiText(avatarEmoji) || '' : '';
            const emojiEmotion: string = avatarType === 'emoji' ? (emojiManager as EmojiManager).getEmojiEmotion(avatarEmoji) || 'neutral' : '';

            wx.setStorageSync('avatarType', avatarType);
            wx.setStorageSync('avatarEmoji', avatarEmoji);
            if (username) {
              wx.setStorageSync('username', username);
            }

            const updatedUserInfo: CloudUserInfo = {
              ...cloudUserInfo,
              avatarType: avatarType as CloudUserInfo['avatarType'],
              avatarEmoji: avatarEmoji as CloudUserInfo['avatarEmoji'],
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
    }
    return null;
  }

  async syncAvatarToCloud(avatarType: string, avatarEmoji: string, avatarText: string, cloudLoggedIn: boolean, cloudUserInfo: CloudUserInfo | null): Promise<CloudUserInfo | null> {
    try {
      if (cloudLoggedIn && cloudUserInfo && cloudUserInfo.userId) {
        const result = await wx.cloud.callFunction({
          name: config.cloudFunctions.userLogin,
          data: {
            action: 'updateAvatar',
            userId: cloudUserInfo.userId,
            avatarType: avatarType,
            avatarEmoji: avatarEmoji,
            avatarText: avatarText
          }
        });

        const res = result.result as unknown as CloudFunctionResult;
        if (res.success) {
          const updatedUserInfo: CloudUserInfo = {
            ...cloudUserInfo,
            avatarType: avatarType as CloudUserInfo['avatarType'],
            avatarEmoji: avatarEmoji as CloudUserInfo['avatarEmoji'],
            avatarText: avatarText as CloudUserInfo['avatarText']
          };
          wx.setStorageSync('cloudUserInfo', updatedUserInfo);
          return updatedUserInfo;
        }
      }
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
    }
    return null;
  }

  updateAvatarInOtherPages(avatarType: string, avatarText: string, avatarEmoji: string): void {
    store.setState({ avatarType, avatarText, avatarEmoji } as Partial<StoreState>, ['avatarType', 'avatarEmoji']);
  }

  getEmojiInfo(emoji: string): EmojiInfo {
    const emojiText: string = (emojiManager as EmojiManager).getEmojiText(emoji) || '';
    const emojiEmotion: string = (emojiManager as EmojiManager).getEmojiEmotion(emoji) || 'neutral';
    return { emojiText, emojiEmotion };
  }

  initAvatarInfo(): AvatarLocalInfo {
    const avatarType: string = wx.getStorageSync('avatarType') || 'emoji';
    const avatarEmoji: string = wx.getStorageSync('avatarEmoji') || '😊';
    const username: string = wx.getStorageSync('username') || '';

    const avatarText: string = avatarType === 'text' ? this.generateAvatarText(username) : '';
    const finalAvatarEmoji: string = avatarType === 'emoji' && avatarEmoji ? avatarEmoji : '😊';
    const { emojiText, emojiEmotion }: EmojiInfo = this.getEmojiInfo(finalAvatarEmoji);

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

  initAvatarFromCloud(cloudUserInfo: CloudUserInfo | null): AvatarLocalInfo {
    if (cloudUserInfo) {
      const avatarType: string = cloudUserInfo.avatarType || 'emoji';
      const avatarEmoji: string = cloudUserInfo.avatarEmoji || '😊';
      const username: string = cloudUserInfo.nickname || this.username;

      const avatarText: string = avatarType === 'text' ? this.generateAvatarText(username) : '';
      const { emojiText, emojiEmotion }: EmojiInfo = this.getEmojiInfo(avatarEmoji);

      wx.setStorageSync('avatarType', avatarType);
      wx.setStorageSync('avatarEmoji', avatarEmoji);
      if (username) {
        wx.setStorageSync('username', username);
      }

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

export {};
