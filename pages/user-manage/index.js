'use strict';
const CloudManager = require('../../utils/cloudManager.js');
const AvatarManager = require('../../utils/avatarManager.js');
const { store } = require('../../utils/store.js');
const { encryptPassword, decryptPassword, isOldFormat } = require('../../utils/encrypt.js');

Page({
  data: {
    cloudUserInfo: null,
    cloudLoggedIn: false,
    cloudAccount: '',
    username: '',
    avatarText: '用',
    avatarEmoji: '',
    avatarType: 'text',
    emojiText: '',
    emojiEmotion: '',
    savedAccounts: [],
    autoRestoreMap: {}
  },

  onLoad() {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();
    this.initPageData();
  },

  onShow() {
    this.initPageData();
  },

  initPageData() {
    const cloudUserId = store.getState('cloudUserId');
    const cloudAccount = store.getState('cloudAccount') || '';
    const cloudUserInfo = store.getState('cloudUserInfo');
    const cloudLoggedIn = !!cloudUserId;

    this.userId = cloudUserId;

    let avatarInfo;
    if (cloudLoggedIn && cloudUserInfo) {
      avatarInfo = this.avatarManager.initAvatarFromCloud(cloudUserInfo);
    } else {
      avatarInfo = this.avatarManager.initAvatarInfo();
    }

    let savedAccounts = [];
    let migrated = false;
    try {
      savedAccounts = store.getState('savedAccounts') || [];
      savedAccounts.forEach(item => {
        if (item.password && item.password.length > 0) {
          const decrypted = decryptPassword(item.password);
          if (decrypted && isOldFormat(item.password)) {
            item.password = encryptPassword(decrypted);
            migrated = true;
          } else if (!decrypted) {
            item.password = '';
            migrated = true;
          }
        }
      });
      if (migrated) {
        store.setState({ savedAccounts }, ['savedAccounts']);
      }
    } catch (e) {
      console.error('加载保存的账号列表失败:', e);
    }

    let autoRestoreMap = {};
    try {
      autoRestoreMap = store.getState('autoRestoreMap') || {};
    } catch (e) {
      console.error('加载自动恢复勾选状态失败:', e);
    }

    const cloudInitialized = store.getState('cloudInitialized');

    this.setData({
      username: avatarInfo.username,
      avatarText: avatarInfo.avatarText,
      avatarEmoji: avatarInfo.avatarEmoji,
      avatarType: avatarInfo.avatarType,
      emojiText: avatarInfo.emojiText,
      emojiEmotion: avatarInfo.emojiEmotion,
      cloudManager: this.cloudManager,
      cloudLoggedIn: cloudLoggedIn,
      cloudAccount: cloudAccount,
      cloudUserInfo: cloudUserInfo,
      savedAccounts: savedAccounts,
      autoRestoreMap: autoRestoreMap
    });

    if (cloudLoggedIn && cloudInitialized) {
      this.getLatestAvatarFromCloud();
    }
  },

  async getLatestAvatarFromCloud() {
    try {
      const { cloudUserInfo } = this.data;
      const avatarInfo = await this.avatarManager.getLatestAvatarFromCloud(cloudUserInfo);
      if (avatarInfo) {
        this.setData({
          username: avatarInfo.username,
          avatarType: avatarInfo.avatarType,
          avatarEmoji: avatarInfo.avatarEmoji,
          avatarText: avatarInfo.avatarText,
          emojiText: avatarInfo.emojiText,
          emojiEmotion: avatarInfo.emojiEmotion,
          cloudUserInfo: avatarInfo.cloudUserInfo
        });
        this.updateAvatarInOtherPages();
      }
    } catch (e) {
      console.error('从云端获取头像信息失败', e);
    }
  },

  navigateToSubPage(e) {
    const page = e.currentTarget.dataset.page;
    const urlMap = {
      avatar: '/pages/user-manage/avatar/index',
      updateNickname: '/pages/user-manage/nickname/index',
      updatePassword: '/pages/user-manage/password/index',
      deleteAccount: '/pages/user-manage/delete-account/index'
    };
    wx.navigateTo({ url: urlMap[page] });
  },

  showSwitchAccountPage() {
    wx.navigateTo({ url: '/pages/user-manage/switch-account/index' });
  },

  showLoginPage() {
    wx.navigateTo({ url: '/pages/user-manage/login/index' });
  },

  updateAvatarInOtherPages() {
    const { avatarType, avatarText, avatarEmoji } = this.data;
    this.avatarManager.updateAvatarInOtherPages(avatarType, avatarText, avatarEmoji);
  },

  async syncAvatarToCloud(avatarType, avatarEmoji, avatarText) {
    try {
      const { cloudLoggedIn, cloudUserInfo } = this.data;
      const updatedUserInfo = await this.avatarManager.syncAvatarToCloud(avatarType, avatarEmoji, avatarText, cloudLoggedIn, cloudUserInfo);
      if (updatedUserInfo) {
        this.setData({ cloudUserInfo: updatedUserInfo });
      }
    } catch (e) {
      console.error('同步头像信息到云端失败', e);
    }
  },

  confirmLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出当前账号吗？',
      cancelText: '取消',
      confirmText: '退出登录',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          this.logoutFromCloud();
          wx.navigateBack();
        }
      }
    });
  },

  logoutFromCloud() {
    const cloudManager = this.data.cloudManager;
    cloudManager.logout();
    this.setData({
      cloudLoggedIn: false,
      cloudAccount: '',
      username: '',
      avatarType: 'emoji',
      avatarText: '',
      avatarEmoji: '😊',
      emojiText: '',
      emojiEmotion: 'neutral'
    });
    store.removeState(
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo'],
      ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']
    );
    this.userId = null;

    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  updateSavedAccountAvatar(account, avatarInfo) {
    try {
      const savedAccounts = store.getState('savedAccounts') || [];
      const index = savedAccounts.findIndex(item => item.account === account);
      if (index !== -1) {
        savedAccounts[index] = {
          ...savedAccounts[index],
          avatarType: avatarInfo.avatarType,
          avatarEmoji: avatarInfo.avatarEmoji,
          avatarText: avatarInfo.avatarText,
          avatarEmojiEmotion: avatarInfo.avatarEmojiEmotion
        };
        store.setState({ savedAccounts }, ['savedAccounts']);
        this.setData({ savedAccounts });
      }
    } catch (e) {
      console.error('更新 savedAccounts 头像失败:', e);
    }
  },

  onUnload() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    if (prevPage) {
      if (typeof prevPage.refreshUserInfo === 'function') {
        prevPage.refreshUserInfo();
      } else if (typeof prevPage.initPageData === 'function') {
        prevPage.initPageData();
      } else if (typeof prevPage.onShow === 'function') {
        prevPage.onShow();
      }
    }
  }
});
