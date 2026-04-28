'use strict';
const emojiManager = require('../../../utils/emojiManager.js');
const AvatarManager = require('../../../utils/avatarManager.js');
const { store } = require('../../../utils/store.js');

Page({
  data: {
    avatarMode: 'emoji',
    avatarModeCategory: 'face',
    avatarModeEmojis: emojiManager.getCategoryEmojis('face'),
    avatarModeEmoji: '',
    avatarModeText: '',
    avatarModeTextInput: '',
    textInputFocus: false,
    emojiCategories: emojiManager.getCategories()
  },

  onLoad() {
    this.avatarManager = new AvatarManager();
    const avatarType = store.getState('avatarType') || 'emoji';
    const avatarEmoji = store.getState('avatarEmoji') || '😊';
    const username = store.getState('username') || '';
    const currentText = avatarType === 'text' ? (username ? username.charAt(0).toUpperCase() : '') : '';
    this.setData({
      avatarMode: avatarType || 'emoji',
      avatarModeEmoji: avatarType === 'emoji' ? (avatarEmoji || '😊') : '',
      avatarModeText: currentText || '用',
      avatarModeTextInput: currentText || ''
    });
  },

  onAvatarModeSwitch(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.avatarMode) return;
    this.setData({ avatarMode: mode, textInputFocus: mode === 'text' });
  },

  onAvatarCategorySwitch(e) {
    const categoryId = e.currentTarget.dataset.category;
    this.setData({ avatarModeCategory: categoryId, avatarModeEmojis: emojiManager.getCategoryEmojis(categoryId) });
  },

  onAvatarEmojiPick(e) {
    this.setData({ avatarModeEmoji: e.currentTarget.dataset.emoji });
  },

  onAvatarTextInput(e) {
    const val = e.detail.value.trim();
    this.setData({ avatarModeTextInput: val, avatarModeText: val || '用' });
  },

  onAvatarTextConfirm() {},

  getEmojiDesc(emoji) {
    return emojiManager.getEmojiText(emoji) || '';
  },

  goBack() {
    wx.navigateBack();
  },

  async onAvatarConfirm() {
    const { avatarMode, avatarModeEmoji, avatarModeText } = this.data;
    const cloudLoggedIn = !!store.getState('cloudUserId');
    const cloudAccount = store.getState('cloudAccount') || '';
    const cloudUserInfo = store.getState('cloudUserInfo');

    if (avatarMode === 'emoji') {
      if (!avatarModeEmoji) {
        wx.showToast({ title: '请选择一个表情', icon: 'none' });
        return;
      }
      const emojiText = emojiManager.getEmojiText(avatarModeEmoji) || '';
      const emojiEmotion = emojiManager.getEmojiEmotion(avatarModeEmoji) || 'neutral';

      store.setState({ avatarType: 'emoji', avatarEmoji: avatarModeEmoji }, ['avatarType', 'avatarEmoji']);
      this.syncAvatarToCloud('emoji', avatarModeEmoji, '', cloudLoggedIn, cloudUserInfo);
    } else {
      const textChar = avatarModeText || '用';
      store.setState({ avatarType: 'text', avatarText: textChar, avatarEmoji: '' }, ['avatarType', 'avatarText', 'avatarEmoji']);
      this.syncAvatarToCloud('text', '', textChar, cloudLoggedIn, cloudUserInfo);
    }

    if (cloudAccount) {
      this.updateSavedAccountAvatar(cloudAccount, {
        avatarType: store.getState('avatarType'),
        avatarEmoji: store.getState('avatarEmoji'),
        avatarText: store.getState('avatarText') || '',
        avatarEmojiEmotion: store.getState('emojiEmotion') || 'neutral'
      });
    }

    wx.showToast({ title: '头像已更新', icon: 'success' });
    wx.navigateBack();
  },

  async syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo) {
    try {
      await this.avatarManager.syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo);
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
    }
  },

  updateSavedAccountAvatar(account, avatarInfo) {
    try {
      const savedAccounts = store.getState('savedAccounts') || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      if (index !== -1) {
        savedAccounts[index] = { ...savedAccounts[index], ...avatarInfo };
        store.setState({ savedAccounts }, ['savedAccounts']);
      }
    } catch (e) {
      console.error('更新 savedAccounts 头像失败:', e);
    }
  }
});
