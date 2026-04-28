'use strict';
const CloudManager = require('../../../utils/cloudManager.js');
const AvatarManager = require('../../../utils/avatarManager.js');
const emojiManager = require('../../../utils/emojiManager.js');
const { store } = require('../../../utils/store.js');
const { encryptPassword, hashPassword } = require('../../../utils/encrypt.js');

Page({
  data: {
    cloudAccountInput: '',
    cloudPasswordInput: '',
    cloudConfirmPassword: '',
    cloudNicknameInput: '',
    showCloudPassword: false,
    rememberPassword: false,
    mode: 'login',
    cloudManager: null,
    avatarManager: null
  },

  onLoad(options) {
    this.cloudManager = new CloudManager();
    this.avatarManager = new AvatarManager();
    if (options && options.mode === 'register') {
      this.setData({ mode: 'register' });
    }
  },

  onCloudAccountInput(e) {
    this.setData({ cloudAccountInput: e.detail.value });
  },

  onCloudPasswordInput(e) {
    this.setData({ cloudPasswordInput: e.detail.value });
  },

  onCloudConfirmPasswordInput(e) {
    this.setData({ cloudConfirmPassword: e.detail.value });
  },

  onCloudNicknameInput(e) {
    this.setData({ cloudNicknameInput: e.detail.value });
  },

  toggleCloudPasswordVisibility() {
    this.setData({ showCloudPassword: !this.data.showCloudPassword });
  },

  toggleRememberPassword() {
    this.setData({ rememberPassword: !this.data.rememberPassword });
  },

  goBack() {
    wx.navigateBack();
  },

  saveAccount(account, password) {
    try {
      let savedAccounts = store.getState('savedAccounts') || [];
      const avatarEmoji = store.getState('avatarEmoji') || '';
      const avatarType = store.getState('avatarType') || 'emoji';
      const avatarText = '';
      const emojiEmotion = 'neutral';

      const encryptedPwd = this.data.rememberPassword ? encryptPassword(password) : '';
      const pwdHash = this.data.rememberPassword ? hashPassword(password) : '';

      const existingIndex = savedAccounts.findIndex(item => item.account === account);
      const entry = { account, password: encryptedPwd, passwordHash: pwdHash, lastLogin: new Date().toISOString(), avatarType, avatarEmoji, avatarText, avatarEmojiEmotion: emojiEmotion };

      if (existingIndex >= 0) {
        savedAccounts[existingIndex] = entry;
      } else {
        savedAccounts.push(entry);
      }

      if (savedAccounts.length > 5) {
        savedAccounts = savedAccounts.sort((a, b) => new Date(b.lastLogin) - new Date(a.lastLogin)).slice(0, 5);
      }

      store.setState({ savedAccounts }, ['savedAccounts']);
    } catch (e) {
      console.error('保存账号失败:', e);
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
  },

  async handleSubmit() {
    const { mode } = this.data;
    if (mode === 'register') {
      await this.registerToCloud();
    } else {
      await this.loginToCloud();
    }
  },

  async loginToCloud() {
    const { cloudAccountInput, cloudPasswordInput } = this.data;

    if (!cloudAccountInput || !cloudPasswordInput) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const result = await this.cloudManager.login(cloudAccountInput, cloudPasswordInput);
      wx.hideLoading();

      if (result.success) {
        const cloudUserInfo = {
          userId: result.data.userId,
          account: cloudAccountInput,
          nickname: result.data.nickname || cloudAccountInput,
          avatarType: result.data.avatarType || 'emoji',
          avatarEmoji: result.data.avatarEmoji || '😊',
          avatarText: result.data.avatarText || ''
        };
        const displayUsername = result.data.nickname || cloudAccountInput;
        const avatarType = result.data.avatarType || 'emoji';
        const avatarEmoji = result.data.avatarEmoji || '😊';

        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        store.setState({
          username: displayUsername,
          avatarType,
          avatarEmoji,
          cloudAccount: cloudAccountInput,
          cloudLoggedIn: true,
          cloudUserId: result.data.userId,
          cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

        this.saveAccount(cloudAccountInput, cloudPasswordInput);
        this.updateSavedAccountAvatar(cloudAccountInput, { avatarType, avatarEmoji, avatarText: '', avatarEmojiEmotion: emojiEmotion });

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 });

        const autoRestoreMap = store.getState('autoRestoreMap') || {};
        if (autoRestoreMap[cloudAccountInput]) {
          this.autoRestoreData();
        }

        wx.navigateBack({ delta: 2 });
      } else {
        wx.showToast({ title: result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  async registerToCloud() {
    const { cloudAccountInput, cloudPasswordInput, cloudConfirmPassword, cloudNicknameInput } = this.data;

    if (!cloudAccountInput || !cloudPasswordInput || !cloudConfirmPassword) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    if (cloudPasswordInput !== cloudConfirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '注册中...' });

    try {
      const result = await wx.cloud.callFunction({
        name: 'userLogin',
        data: {
          action: 'register',
          account: cloudAccountInput,
          password: cloudPasswordInput,
          nickname: cloudNicknameInput || ''
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        const cloudUserInfo = {
          userId: result.result.data.userId,
          account: cloudAccountInput,
          nickname: result.result.data.nickname || cloudAccountInput,
          avatarType: result.result.data.avatarType || 'emoji',
          avatarEmoji: result.result.data.avatarEmoji || '😊',
          avatarText: result.result.data.avatarText || ''
        };
        const displayUsername = result.result.data.nickname || cloudAccountInput;
        const avatarType = result.result.data.avatarType || 'emoji';
        const avatarEmoji = result.result.data.avatarEmoji || '😊';

        const emojiText = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiText(avatarEmoji) || '' : '';
        const emojiEmotion = avatarType === 'emoji' && avatarEmoji ? emojiManager.getEmojiEmotion(avatarEmoji) || 'neutral' : '';

        store.setState({
          username: displayUsername,
          avatarType,
          avatarEmoji,
          cloudAccount: cloudAccountInput,
          cloudLoggedIn: true,
          cloudUserId: result.result.data.userId,
          cloudUserInfo
        }, ['username', 'avatarType', 'avatarEmoji', 'cloudAccount', 'cloudLoggedIn', 'cloudUserId', 'cloudUserInfo']);

        wx.showToast({ title: '注册成功', icon: 'success', duration: 1000 });
        wx.navigateBack({ delta: 2 });
      } else {
        wx.showToast({ title: result.result.errMsg || '注册失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '注册失败', icon: 'none' });
    }
  },

  async autoRestoreData() {
    try {
      const backupInfo = await this.cloudManager.getBackupInfo();
      if (!backupInfo.success || !backupInfo.hasBackup) return;

      wx.showLoading({ title: '恢复数据中...' });
      const result = await this.cloudManager.restore();
      wx.hideLoading();

      if (result.success) {
        store.setState({ lastRestoreTime: Date.now() }, ['lastRestoreTime']);
        wx.showToast({ title: '数据恢复成功', icon: 'success', duration: 1500 });
      }
    } catch (e) {
      wx.hideLoading();
      console.error('自动恢复数据异常:', e);
    }
  }
});
